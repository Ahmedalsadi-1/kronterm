// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { getApi, getBlockComponentModel, getConnStatusAtom, globalStore, WOS } from "@/app/store/global";
import type { TermViewModel } from "@/app/view/term/term-model";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { base64ToArrayBuffer } from "@/util/util";
import { WebviewTag } from "electron";
import { RpcResponseHelper, WshClient } from "./wshclient";
import { RpcApi } from "./wshclientapi";

type BrowserInteractionAction = "click" | "scroll" | "type" | "press" | "drag" | "scroll-to";

type BrowserInteractionResult = {
    success: boolean;
    message: string;
};

const DefaultKrontermDesktopComputerUseUrl = "http://localhost:9990/computer-use";

export function sandboxComputerUseUrlFromStatus(status: SandboxStatusResponse | null | undefined): string {
    const statusWithUrls = status as
        | (SandboxStatusResponse & { mcpUrl?: string; desktopUrl?: string })
        | null
        | undefined;
    if (statusWithUrls?.mcpUrl) {
        return statusWithUrls.mcpUrl.replace(/\/+$/, "");
    }
    if (statusWithUrls?.desktopUrl) {
        try {
            const desktopUrl = new URL(statusWithUrls.desktopUrl);
            return `${desktopUrl.protocol}//${desktopUrl.host}/computer-use`;
        } catch {
            return DefaultKrontermDesktopComputerUseUrl;
        }
    }
    return DefaultKrontermDesktopComputerUseUrl;
}

export function buildSandboxKeyboardPressPayload(keys: string[]): Record<string, unknown> {
    return { action: "type_keys", keys };
}

export function buildSandboxScrollPayload(
    direction: string,
    amount: number,
    originX?: number,
    originY?: number
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        action: "scroll",
        direction: direction || "down",
        scrollCount: Math.max(1, Math.ceil(Math.abs(amount) / 50)),
    };
    if (originX != null && originY != null) {
        payload.coordinates = { x: originX, y: originY };
    }
    return payload;
}

export function buildSandboxDragPayload(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    button = "left"
): Record<string, unknown> {
    return {
        action: "drag_mouse",
        button,
        path: [
            { x: startX, y: startY },
            { x: endX, y: endY },
        ],
    };
}

export function buildBrowserInteractionScript(
    action: BrowserInteractionAction,
    payload: Record<string, unknown>
): string {
    return `
        (async function() {
            const action = ${JSON.stringify(action)};
            const payload = ${JSON.stringify(payload)};
            const buttonNumbers = { left: 0, middle: 1, right: 2 };
            const button = buttonNumbers[payload.button] ?? 0;

            function findByRef(ref) {
                if (!ref) {
                    return null;
                }
                const escaped = CSS.escape(String(ref));
                return document.getElementById(String(ref)) ||
                    document.querySelector('[name="' + escaped + '"]') ||
                    document.querySelector('[aria-label="' + escaped + '"]') ||
                    document.querySelector('[data-wave-ref="' + escaped + '"]');
            }

            function findTarget(ref, x, y) {
                return findByRef(ref) || (x != null && y != null ? document.elementFromPoint(x, y) : null);
            }

            function pointFor(element, x, y) {
                const rect = element.getBoundingClientRect();
                return {
                    clientX: x ?? rect.left + rect.width / 2,
                    clientY: y ?? rect.top + rect.height / 2,
                };
            }

            function pointerEvent(element, type, x, y, buttons) {
                if (typeof PointerEvent !== "function") {
                    return;
                }
                const point = pointFor(element, x, y);
                element.dispatchEvent(new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                    clientX: point.clientX,
                    clientY: point.clientY,
                    button,
                    buttons,
                }));
            }

            function mouseEvent(element, type, x, y, detail, buttons) {
                const point = pointFor(element, x, y);
                element.dispatchEvent(new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: point.clientX,
                    clientY: point.clientY,
                    button,
                    buttons,
                    detail,
                }));
            }

            function dragEvent(element, type, x, y, dataTransfer) {
                if (typeof DragEvent !== "function") {
                    return;
                }
                const point = pointFor(element, x, y);
                element.dispatchEvent(new DragEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: point.clientX,
                    clientY: point.clientY,
                    dataTransfer,
                }));
            }

            function setInputValue(element, value) {
                const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                setter?.call(element, value);
            }

            function insertText(element, text) {
                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                    const start = element.selectionStart ?? element.value.length;
                    const end = element.selectionEnd ?? start;
                    const next = element.value.slice(0, start) + text + element.value.slice(end);
                    setInputValue(element, next);
                    const position = start + text.length;
                    element.setSelectionRange(position, position);
                    element.dispatchEvent(new InputEvent("input", {
                        bubbles: true,
                        inputType: "insertText",
                        data: text,
                    }));
                    return true;
                }
                if (element instanceof HTMLElement && element.isContentEditable) {
                    element.focus();
                    document.execCommand("insertText", false, text);
                    element.dispatchEvent(new InputEvent("input", {
                        bubbles: true,
                        inputType: "insertText",
                        data: text,
                    }));
                    return true;
                }
                return false;
            }

            function scrollContainer(element) {
                let current = element instanceof Element ? element : null;
                while (current instanceof HTMLElement) {
                    const style = window.getComputedStyle(current);
                    const canScroll = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
                    if (canScroll) {
                        return current;
                    }
                    current = current.parentElement;
                }
                return document.scrollingElement || document.documentElement;
            }

            if (action === "click") {
                const target = findTarget(payload.elementref, payload.x, payload.y);
                if (!(target instanceof HTMLElement)) {
                    return { success: false, message: "Click target not found" };
                }
                target.scrollIntoView({ block: "nearest", inline: "nearest" });
                target.focus({ preventScroll: true });
                const count = payload.clickCount ?? (payload.clicktype === "triple" ? 3 : payload.clicktype === "double" ? 2 : 1);
                for (let index = 1; index <= count; index++) {
                    pointerEvent(target, "pointerover", payload.x, payload.y, 0);
                    pointerEvent(target, "pointerenter", payload.x, payload.y, 0);
                    mouseEvent(target, "mouseover", payload.x, payload.y, index, 0);
                    mouseEvent(target, "mouseenter", payload.x, payload.y, index, 0);
                    pointerEvent(target, "pointerdown", payload.x, payload.y, 1 << button);
                    mouseEvent(target, "mousedown", payload.x, payload.y, index, 1 << button);
                    pointerEvent(target, "pointerup", payload.x, payload.y, 0);
                    mouseEvent(target, "mouseup", payload.x, payload.y, index, 0);
                    if (button === 0) {
                        target.click();
                    } else if (button === 2) {
                        mouseEvent(target, "contextmenu", payload.x, payload.y, index, 0);
                    } else {
                        mouseEvent(target, "click", payload.x, payload.y, index, 0);
                    }
                }
                if (button === 0 && count >= 2) {
                    mouseEvent(target, "dblclick", payload.x, payload.y, 2, 0);
                }
                return { success: true, message: "Clicked target " + count + " time(s)" };
            }

            if (action === "type") {
                const target = document.activeElement;
                if (!(target instanceof HTMLElement)) {
                    return { success: false, message: "No focused text target" };
                }
                const text = String(payload.text ?? "");
                const delay = Math.max(0, Number(payload.delayMs ?? 0));
                for (const char of text) {
                    if (!insertText(target, char)) {
                        return { success: false, message: "Focused target does not accept text" };
                    }
                    if (delay > 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, delay));
                    }
                }
                return { success: true, message: "Typed " + text.length + " character(s)" };
            }

            if (action === "press") {
                const target = document.activeElement;
                const keys = Array.isArray(payload.keys) ? payload.keys.map(String) : [];
                const key = keys[keys.length - 1];
                if (!(target instanceof HTMLElement) || !key) {
                    return { success: false, message: "No focused key target" };
                }
                const eventOptions = {
                    key,
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    altKey: keys.includes("Alt"),
                    ctrlKey: keys.includes("Control"),
                    metaKey: keys.includes("Meta") || keys.includes("Command"),
                    shiftKey: keys.includes("Shift"),
                };
                const allowed = target.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
                if (allowed && !eventOptions.altKey && !eventOptions.ctrlKey && !eventOptions.metaKey) {
                    if (key === "Enter" && target instanceof HTMLTextAreaElement) {
                        insertText(target, "\\n");
                    } else if (key === "Enter") {
                        const form = target.closest("form");
                        if (form instanceof HTMLFormElement) {
                            form.requestSubmit();
                        } else {
                            target.click();
                        }
                    } else if (key === "Backspace" && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
                        const start = target.selectionStart ?? target.value.length;
                        const end = target.selectionEnd ?? start;
                        const removeFrom = start === end ? Math.max(0, start - 1) : start;
                        target.setSelectionRange(removeFrom, end);
                        insertText(target, "");
                    } else if (key === "Tab") {
                        const focusable = Array.from(document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
                        const index = focusable.indexOf(target);
                        const direction = eventOptions.shiftKey ? -1 : 1;
                        const next = focusable[(index + direction + focusable.length) % focusable.length];
                        if (next instanceof HTMLElement) {
                            next.focus();
                        }
                    }
                }
                target.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
                return { success: true, message: "Pressed " + keys.join("+") };
            }

            if (action === "scroll") {
                const amount = Number(payload.amount ?? 0);
                const hasOrigin = payload.originX != null && payload.originY != null;
                if (hasOrigin) {
                    const pointed = document.elementFromPoint(payload.originX, payload.originY);
                    const target = scrollContainer(pointed);
                    const before = target.scrollTop;
                    target.dispatchEvent(new WheelEvent("wheel", {
                        bubbles: true, cancelable: true, composed: true,
                        deltaY: amount,
                        clientX: payload.originX, clientY: payload.originY,
                    }));
                    target.scrollTop += amount;
                    return {
                        success: target.scrollTop !== before || amount === 0,
                        message: "Scrolled from " + before + " to " + target.scrollTop,
                    };
                }
                const before = window.scrollY;
                window.dispatchEvent(new WheelEvent("wheel", {
                    bubbles: true, cancelable: true, composed: true,
                    deltaY: amount,
                    clientX: 0, clientY: 0,
                }));
                window.scrollBy(0, amount);
                return {
                    success: true,
                    message: "Scrolled from " + before + " to " + window.scrollY,
                };
            }

            if (action === "scroll-to") {
                const target = findTarget(payload.elementref, payload.x, payload.y);
                if (!(target instanceof HTMLElement)) {
                    return { success: false, message: "Scroll target not found" };
                }
                target.scrollIntoView({ block: "center", inline: "nearest" });
                return { success: true, message: "Scrolled target into view" };
            }

            if (action === "drag") {
                const start = findTarget(payload.startref, payload.startx, payload.starty);
                const end = findTarget(payload.endref, payload.endx, payload.endy);
                if (!(start instanceof HTMLElement) || !(end instanceof HTMLElement)) {
                    return { success: false, message: "Drag target not found" };
                }
                start.scrollIntoView({ block: "nearest", inline: "nearest" });
                const startPoint = pointFor(start, payload.startx, payload.starty);
                const endPoint = pointFor(end, payload.endx, payload.endy);
                const dataTransfer = typeof DataTransfer === "function" ? new DataTransfer() : undefined;
                pointerEvent(start, "pointerover", payload.startx, payload.starty, 0);
                pointerEvent(start, "pointerenter", payload.startx, payload.starty, 0);
                mouseEvent(start, "mouseover", payload.startx, payload.starty, 1, 0);
                mouseEvent(start, "mouseenter", payload.startx, payload.starty, 1, 0);
                pointerEvent(start, "pointerdown", payload.startx, payload.starty, 1 << button);
                mouseEvent(start, "mousedown", payload.startx, payload.starty, 1, 1 << button);
                dragEvent(start, "dragstart", payload.startx, payload.starty, dataTransfer);
                for (let step = 1; step <= 8; step++) {
                    const ratio = step / 8;
                    const x = startPoint.clientX + (endPoint.clientX - startPoint.clientX) * ratio;
                    const y = startPoint.clientY + (endPoint.clientY - startPoint.clientY) * ratio;
                    const current = document.elementFromPoint(x, y) || end;
                    if (current instanceof HTMLElement) {
                        pointerEvent(current, "pointermove", x, y, 1 << button);
                        mouseEvent(current, "mousemove", x, y, 1, 1 << button);
                        dragEvent(current, "dragover", x, y, dataTransfer);
                    }
                }
                dragEvent(end, "drop", payload.endx, payload.endy, dataTransfer);
                dragEvent(start, "dragend", payload.endx, payload.endy, dataTransfer);
                pointerEvent(end, "pointerup", payload.endx, payload.endy, 0);
                mouseEvent(end, "mouseup", payload.endx, payload.endy, 1, 0);
                return { success: true, message: "Drag events dispatched" };
            }

            return { success: false, message: "Unsupported browser action" };
        })()
    `;
}

export class TabClient extends WshClient {
    constructor(routeId: string) {
        super(routeId);
    }

    private async executeBrowserInteraction(
        blockId: string,
        action: BrowserInteractionAction,
        payload: Record<string, unknown>
    ): Promise<WidgetMouseActionRtnData> {
        const webview = document.querySelector(`div[data-blockid='${blockId}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: blockId, success: false, message: "Webview not found" };
        }
        try {
            const result = (await webview.executeJavaScript(
                buildBrowserInteractionScript(action, payload)
            )) as BrowserInteractionResult;
            return { blockid: blockId, success: result.success, message: result.message };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Browser interaction failed: ${e}` };
        }
    }

    private async sandboxClick(
        blockId: string,
        x: number,
        y: number,
        button: string
    ): Promise<WidgetMouseActionRtnData> {
        try {
            const payload = {
                action: "click_mouse",
                button: button || "left",
                clickCount: 1,
                coordinates: { x, y },
            };
            const response = await fetch(await this.sandboxComputerUseUrl(blockId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const text = await response.text();
                return {
                    blockid: blockId,
                    success: false,
                    message: `Desktop click failed (${response.status}): ${text}`,
                };
            }
            return { blockid: blockId, success: true, message: "" };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Desktop click error: ${e}` };
        }
    }

    private async sandboxKeyboardType(blockId: string, text: string): Promise<WidgetMouseActionRtnData> {
        try {
            const payload = { action: "type_text", text };
            const response = await fetch(await this.sandboxComputerUseUrl(blockId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errText = await response.text();
                return {
                    blockid: blockId,
                    success: false,
                    message: `Desktop type failed (${response.status}): ${errText}`,
                };
            }
            return { blockid: blockId, success: true, message: "" };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Desktop type error: ${e}` };
        }
    }

    private async sandboxKeyboardPress(blockId: string, keys: string[]): Promise<WidgetMouseActionRtnData> {
        try {
            const payload = buildSandboxKeyboardPressPayload(keys);
            const response = await fetch(await this.sandboxComputerUseUrl(blockId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errText = await response.text();
                return {
                    blockid: blockId,
                    success: false,
                    message: `Desktop press failed (${response.status}): ${errText}`,
                };
            }
            return { blockid: blockId, success: true, message: "" };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Desktop press error: ${e}` };
        }
    }

    private async sandboxScroll(
        blockId: string,
        direction: string,
        amount: number,
        originX?: number,
        originY?: number
    ): Promise<WidgetMouseActionRtnData> {
        try {
            const payload = buildSandboxScrollPayload(direction, amount, originX, originY);
            const response = await fetch(await this.sandboxComputerUseUrl(blockId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errText = await response.text();
                return {
                    blockid: blockId,
                    success: false,
                    message: `Desktop scroll failed (${response.status}): ${errText}`,
                };
            }
            return { blockid: blockId, success: true, message: "" };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Desktop scroll error: ${e}` };
        }
    }

    private async sandboxDrag(
        blockId: string,
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): Promise<WidgetMouseActionRtnData> {
        try {
            const payload = buildSandboxDragPayload(startX, startY, endX, endY);
            const response = await fetch(await this.sandboxComputerUseUrl(blockId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errText = await response.text();
                return {
                    blockid: blockId,
                    success: false,
                    message: `Desktop drag failed (${response.status}): ${errText}`,
                };
            }
            return { blockid: blockId, success: true, message: "" };
        } catch (e) {
            return { blockid: blockId, success: false, message: `Desktop drag error: ${e}` };
        }
    }

    private async sandboxComputerUseUrl(blockId: string): Promise<string> {
        try {
            const status = await RpcApi.SandboxStatusCommand(this, { sessionId: blockId }, { timeout: 5000 });
            return sandboxComputerUseUrlFromStatus(status);
        } catch {
            return DefaultKrontermDesktopComputerUseUrl;
        }
    }

    handle_captureblockscreenshot(rh: RpcResponseHelper, data: CommandCaptureBlockScreenshotData): Promise<string> {
        return this.captureBlockScreenshot(data.blockid);
    }

    async captureBlockScreenshot(blockId: string): Promise<string> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(blockId);
        if (!node) {
            throw new Error(`Block not found: ${blockId}`);
        }

        const displayContainer = layoutModel.displayContainerRef.current;
        if (!displayContainer) {
            throw new Error("Display container not found");
        }

        const containerRect = displayContainer.getBoundingClientRect();
        const additionalProps = layoutModel.getNodeAdditionalProperties(node);

        let electronRect: Electron.Rectangle;

        if (!additionalProps?.rect) {
            // Bug: rect is not set when there is only one block in the layout
            // In this case, use the full container rect
            electronRect = {
                x: Math.round(containerRect.x),
                y: Math.round(containerRect.y),
                width: Math.round(containerRect.width),
                height: Math.round(containerRect.height),
            };
        } else {
            const blockRect = additionalProps.rect;
            electronRect = {
                x: Math.round(containerRect.x + blockRect.left),
                y: Math.round(containerRect.y + blockRect.top),
                width: Math.round(blockRect.width),
                height: Math.round(blockRect.height),
            };
        }

        return await getApi().captureScreenshot(electronRect);
    }

    async handle_waveaiaddcontext(rh: RpcResponseHelper, data: CommandWaveAIAddContextData): Promise<void> {
        const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
        if (!workspaceLayoutModel.getAIPanelVisible()) {
            workspaceLayoutModel.setAIPanelVisible(true, { nofocus: true });
        }

        const model = WaveAIModel.getInstance();

        if (data.newchat) {
            model.clearChat();
        }

        if (data.files && data.files.length > 0) {
            for (const fileData of data.files) {
                const decodedData = base64ToArrayBuffer(fileData.data64);
                const blob = new Blob([decodedData], { type: fileData.type });
                const file = new File([blob], fileData.name, { type: fileData.type });
                await model.addFile(file);
            }
        }

        if (data.text) {
            model.appendText(data.text);
        }

        if (data.submit) {
            await model.handleSubmit();
        }
    }

    async handle_setblockfocus(rh: RpcResponseHelper, blockId: string): Promise<void> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(blockId);
        if (!node) {
            throw new Error(`Block not found in tab: ${blockId}`);
        }

        layoutModel.focusNode(node.id);
    }

    async handle_getfocusedblockdata(rh: RpcResponseHelper): Promise<FocusedBlockData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const focusedNode = globalStore.get(layoutModel.focusedNode);
        const blockId = focusedNode?.data?.blockId;

        if (!blockId) {
            return null;
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId));
        const blockData = globalStore.get(blockAtom);

        if (!blockData) {
            return null;
        }

        const viewType = blockData.meta?.view ?? "";
        const controller = blockData.meta?.controller ?? "";
        const connName = blockData.meta?.connection ?? "";

        const result: FocusedBlockData = {
            blockid: blockId,
            viewtype: viewType,
            controller: controller,
            connname: connName,
            blockmeta: blockData.meta ?? {},
        };

        if (viewType === "term" && controller === "shell") {
            const jobStatus = await RpcApi.BlockJobStatusCommand(this, blockId);
            if (jobStatus) {
                result.termjobstatus = jobStatus;
            }
        }

        if (connName) {
            const connStatusAtom = getConnStatusAtom(connName);
            const connStatus = globalStore.get(connStatusAtom);
            if (connStatus) {
                result.connstatus = connStatus;
            }
        }

        if (viewType === "term") {
            try {
                const bcm = getBlockComponentModel(blockId);
                if (bcm?.viewModel) {
                    const termViewModel = bcm.viewModel as TermViewModel;
                    if (termViewModel.termRef?.current?.shellIntegrationStatusAtom) {
                        const shellIntegrationStatus = globalStore.get(
                            termViewModel.termRef.current.shellIntegrationStatusAtom
                        );
                        result.termshellintegrationstatus = shellIntegrationStatus || "";
                    }
                    if (termViewModel.termRef?.current?.lastCommandAtom) {
                        const lastCommand = globalStore.get(termViewModel.termRef.current.lastCommandAtom);
                        result.termlastcommand = lastCommand || "";
                    }
                }
            } catch (e) {
                console.log("error getting term-specific data", e);
            }
        }

        return result;
    }

    // =========================================================================
    // Human Simulation Widget Handlers
    // =========================================================================

    async handle_widgetgetelements(
        rh: RpcResponseHelper,
        data: CommandWidgetGetElementsData
    ): Promise<WidgetGetElementsRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            throw new Error(`Block not found: ${data.blockid}`);
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        const elements: WidgetElementData[] = [];

        if (viewType === "term") {
            const bcm = getBlockComponentModel(data.blockid);
            if (bcm?.viewModel) {
                const termViewModel = bcm.viewModel as TermViewModel;
                elements.push({
                    ref: "terminal",
                    role: "terminal",
                    name: "Terminal",
                    value: "",
                    x: 0,
                    y: 0,
                    width: 800,
                    height: 600,
                    focusable: true,
                    visible: true,
                });
            }
        } else if (viewType === "web") {
            const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as WebviewTag;
            if (webview) {
                const bounds = webview.getBoundingClientRect();
                elements.push({
                    ref: "webview",
                    role: "browser",
                    name: "Web Browser",
                    value: "",
                    x: Math.round(bounds.x),
                    y: Math.round(bounds.y),
                    width: Math.round(bounds.width),
                    height: Math.round(bounds.height),
                    focusable: true,
                    visible: true,
                });
            }
        } else if (viewType === "sandbox") {
            const sandboxMode = blockData?.meta?.["sandbox:mode"] ?? "desktop";
            const sandboxUrl = blockData?.meta?.["sandbox:browserurl"] ?? "";
            const sandboxBlockId = blockData?.meta?.["sandbox:browserblockid"] ?? "";

            elements.push({
                ref: "sandbox-desktop",
                role: "desktop",
                name: "Sandbox Desktop",
                value: `mode: ${sandboxMode}, browser: ${sandboxUrl || "none"}, browserBlock: ${sandboxBlockId || "none"}`,
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                focusable: false,
                visible: true,
            });

            // For kronterm-desktop runtime, try to fetch a screenshot
            try {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 5000);
                const response = await fetch(await this.sandboxComputerUseUrl(data.blockid), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "screenshot" }),
                    signal: controller.signal,
                });
                window.clearTimeout(timeoutId);
                if (response.ok) {
                    const data = await response.json();
                    if (data?.image) {
                        elements.push({
                            ref: "screenshot",
                            role: "image",
                            name: "Desktop Screenshot",
                            value: `data:image/png;base64,${data.image}`,
                            x: 0,
                            y: 0,
                            width: 800,
                            height: 600,
                            focusable: false,
                            visible: true,
                        });
                    }
                }
            } catch {
                // Sandbox API not available — return basic info only
            }
        }

        return {
            blockid: data.blockid,
            elements: elements,
            count: elements.length,
            timestamp: Date.now(),
        };
    }

    async handle_widgetgetstate(
        rh: RpcResponseHelper,
        data: CommandWidgetGetStateData
    ): Promise<WidgetGetStateRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            throw new Error(`Block not found: ${data.blockid}`);
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        const additionalProps = layoutModel.getNodeAdditionalProperties(node);
        let width = 800;
        let height = 600;
        if (additionalProps?.rect) {
            width = additionalProps.rect.width;
            height = additionalProps.rect.height;
        }

        const focusedNode = globalStore.get(layoutModel.focusedNode);
        const isFocused = focusedNode?.data?.blockId === data.blockid;

        return {
            blockid: data.blockid,
            viewtype: viewType,
            state: {},
            focused: isFocused,
            x: 0,
            y: 0,
            width: width,
            height: height,
        };
    }

    async handle_widgetmouseclick(
        rh: RpcResponseHelper,
        data: CommandWidgetMouseClickData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        // Route sandbox clicks to the kronterm-desktop API
        if (viewType === "sandbox") {
            return this.sandboxClick(data.blockid, data.x ?? 0, data.y ?? 0, data.button ?? "left");
        }

        return this.executeBrowserInteraction(data.blockid, "click", {
            x: data.x,
            y: data.y,
            button: data.button,
            clickCount: data.clickcount,
        });
    }

    async handle_widgetmousescroll(
        rh: RpcResponseHelper,
        data: CommandWidgetMouseScrollData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        if (viewType === "sandbox") {
            const direction = (data.amount ?? 0) >= 0 ? "down" : "up";
            return this.sandboxScroll(data.blockid, direction, data.amount ?? 0, data.originx, data.originy);
        }

        return this.executeBrowserInteraction(data.blockid, "scroll", {
            amount: data.amount,
            originX: data.originx,
            originY: data.originy,
        });
    }

    async handle_widgetmousedrag(
        rh: RpcResponseHelper,
        data: CommandWidgetMouseDragData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        if (viewType === "sandbox") {
            return this.sandboxDrag(data.blockid, data.startx ?? 0, data.starty ?? 0, data.endx ?? 0, data.endy ?? 0);
        }

        return this.executeBrowserInteraction(data.blockid, "drag", {
            startx: data.startx,
            starty: data.starty,
            endx: data.endx,
            endy: data.endy,
            button: data.button,
        });
    }

    async handle_widgetkeyboardtype(
        rh: RpcResponseHelper,
        data: CommandWidgetKeyboardTypeData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        if (viewType === "sandbox") {
            return this.sandboxKeyboardType(data.blockid, data.text);
        }

        return this.executeBrowserInteraction(data.blockid, "type", { text: data.text, delayMs: data.delayms });
    }

    async handle_widgetkeyboardpress(
        rh: RpcResponseHelper,
        data: CommandWidgetKeyboardPressData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }

        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }

        const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", data.blockid));
        const blockData = globalStore.get(blockAtom);
        const viewType = blockData?.meta?.view ?? "";

        if (viewType === "sandbox") {
            return this.sandboxKeyboardPress(data.blockid, data.keys);
        }

        return this.executeBrowserInteraction(data.blockid, "press", { keys: data.keys });
    }

    async handle_widgetwaitforelement(
        rh: RpcResponseHelper,
        data: CommandWidgetWaitForElementData
    ): Promise<WidgetWaitForElementRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return {
                blockid: data.blockid,
                condition: data.condition || "visible",
                met: false,
                wait_time_ms: 0,
                message: "Block not found",
            };
        }

        const startTime = Date.now();
        const timeout = data.timeoutms || 5000;
        const condition = data.condition || "visible";
        const ref = data.elementref || "";

        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            while (Date.now() - startTime < timeout) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            return {
                blockid: data.blockid,
                condition: condition,
                met: false,
                wait_time_ms: Date.now() - startTime,
                message: "Webview not found",
            };
        }

        while (Date.now() - startTime < timeout) {
            try {
                const checkResult = await webview.executeJavaScript(`
                    (function() {
                        var ref = ${JSON.stringify(ref)};
                        var condition = ${JSON.stringify(condition)};
                        var el = null;
                        if (ref) {
                            el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]');
                        }
                        if (!el) return false;
                        if (condition === 'visible') {
                            var rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                        }
                        if (condition === 'hidden') return el.offsetWidth === 0 && el.offsetHeight === 0;
                        if (condition === 'enabled') return !el.disabled;
                        if (condition === 'focused') return document.activeElement === el;
                        return true;
                    })()
                `);
                if (checkResult) {
                    return {
                        blockid: data.blockid,
                        condition: condition,
                        met: true,
                        wait_time_ms: Date.now() - startTime,
                        message: "Condition met",
                    };
                }
            } catch (_) {
                // webview may not be ready yet, keep polling
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        return {
            blockid: data.blockid,
            condition: condition,
            met: false,
            wait_time_ms: Date.now() - startTime,
            message: "Element wait timeout - condition not met",
        };
    }

    async handle_widgetscreenshotannotated(
        rh: RpcResponseHelper,
        data: CommandWidgetScreenshotAnnotatedData
    ): Promise<WidgetScreenshotAnnotatedRtnData> {
        const screenshot = await this.captureBlockScreenshot(data.blockid);
        return {
            blockid: data.blockid,
            imageurl: screenshot,
        };
    }

    async handle_widgetsnapshot(
        rh: RpcResponseHelper,
        data: CommandWidgetSnapshotData
    ): Promise<WidgetSnapshotRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, elements: [], count: 0, timestamp: Date.now() };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, elements: [], count: 0, timestamp: Date.now() };
        }
        try {
            const elements = await webview.executeJavaScript(`
                (function() {
                    var interactive = document.querySelectorAll('a, button, input, select, textarea, [role], [tabindex], [onclick], [aria-label]');
                    var result = [];
                    for (var i = 0; i < interactive.length && i < 50; i++) {
                        var el = interactive[i];
                        var rect = el.getBoundingClientRect();
                        if (rect.width === 0 && rect.height === 0) continue;
                        var ref = el.id || el.name || el.getAttribute('aria-label') || el.getAttribute('data-wave-ref');
                        if (!ref) {
                            ref = 'wave-ref-' + i;
                            el.setAttribute('data-wave-ref', ref);
                        }
                        result.push({
                            ref: ref,
                            role: el.getAttribute('role') || el.tagName.toLowerCase(),
                            name: el.getAttribute('aria-label') || el.textContent?.substring(0, 80) || el.name || '',
                            value: el.value || '',
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            focusable: !el.disabled && el.tabIndex >= 0,
                            visible: rect.width > 0 && rect.height > 0
                        });
                    }
                    return result;
                })()
            `);
            return {
                blockid: data.blockid,
                elements: elements || [],
                count: (elements || []).length,
                timestamp: Date.now(),
            };
        } catch (e) {
            return { blockid: data.blockid, elements: [], count: 0, timestamp: Date.now() };
        }
    }

    async handle_widgetfind(rh: RpcResponseHelper, data: CommandWidgetFindData): Promise<WidgetFindRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, elements: [], count: 0 };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, elements: [], count: 0 };
        }
        try {
            const maxCount = data.maxcount || 10;
            const roleFilter = data.role || "";
            const nameFilter = data.name || "";
            const valueFilter = data.value || "";
            const textFilter = data.text || "";
            const elements = await webview.executeJavaScript(`
                (function() {
                    var maxCount = ${maxCount};
                    var roleFilter = ${JSON.stringify(roleFilter)};
                    var nameFilter = ${JSON.stringify(nameFilter)};
                    var valueFilter = ${JSON.stringify(valueFilter)};
                    var textFilter = ${JSON.stringify(textFilter)};
                    var all = document.querySelectorAll('a, button, input, select, textarea, [role], [tabindex], [onclick], [aria-label]');
                    var result = [];
                    for (var i = 0; i < all.length && result.length < maxCount; i++) {
                        var el = all[i];
                        var rect = el.getBoundingClientRect();
                        if (rect.width === 0 && rect.height === 0) continue;
                        var elRole = el.getAttribute('role') || el.tagName.toLowerCase();
                        var elName = el.getAttribute('aria-label') || el.name || '';
                        var elValue = el.value || '';
                        var elText = el.textContent || '';
                        if (roleFilter && elRole !== roleFilter) continue;
                        if (nameFilter && elName.indexOf(nameFilter) === -1) continue;
                        if (valueFilter && String(elValue).indexOf(valueFilter) === -1) continue;
                        if (textFilter && elText.indexOf(textFilter) === -1) continue;
                        var ref = el.id || el.name || el.getAttribute('aria-label') || el.getAttribute('data-wave-ref');
                        if (!ref) {
                            ref = 'wave-ref-' + i;
                            el.setAttribute('data-wave-ref', ref);
                        }
                        result.push({
                            ref: ref,
                            role: elRole,
                            name: elName.substring(0, 80),
                            value: String(elValue).substring(0, 200),
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            focusable: !el.disabled && el.tabIndex >= 0,
                            visible: true
                        });
                    }
                    return result;
                })()
            `);
            return { blockid: data.blockid, elements: elements || [], count: (elements || []).length };
        } catch (e) {
            return { blockid: data.blockid, elements: [], count: 0 };
        }
    }

    async handle_widgetinspect(rh: RpcResponseHelper, data: CommandWidgetInspectData): Promise<WidgetInspectRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return {
                blockid: data.blockid,
                elementref: data.elementref,
                role: "",
                name: "",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                focusable: false,
                visible: false,
                enabled: false,
            };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return {
                blockid: data.blockid,
                elementref: data.elementref,
                role: "",
                name: "",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                focusable: false,
                visible: false,
                enabled: false,
            };
        }
        try {
            const ref = data.elementref || "";
            const result = await webview.executeJavaScript(`
                (function() {
                    var ref = ${JSON.stringify(ref)};
                    var el = null;
                    if (ref) {
                        el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]') || document.querySelector('[data-wave-ref="' + ref + '"]');
                    }
                    if (!el) return null;
                    var rect = el.getBoundingClientRect();
                    return {
                        role: el.getAttribute('role') || el.tagName.toLowerCase(),
                        name: el.getAttribute('aria-label') || el.name || el.textContent?.substring(0, 80) || '',
                        value: el.value || '',
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        focusable: !el.disabled && el.tabIndex >= 0,
                        visible: rect.width > 0 && rect.height > 0,
                        enabled: !el.disabled
                    };
                })()
            `);
            if (!result) {
                return {
                    blockid: data.blockid,
                    elementref: data.elementref,
                    role: "",
                    name: "",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    focusable: false,
                    visible: false,
                    enabled: false,
                };
            }
            return {
                blockid: data.blockid,
                elementref: data.elementref,
                role: result.role || "",
                name: result.name || "",
                x: result.x || 0,
                y: result.y || 0,
                width: result.width || 0,
                height: result.height || 0,
                focusable: result.focusable || false,
                visible: result.visible || false,
                enabled: result.enabled || false,
            };
        } catch (e) {
            return {
                blockid: data.blockid,
                elementref: data.elementref,
                role: "",
                name: "",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                focusable: false,
                visible: false,
                enabled: false,
            };
        }
    }

    async handle_widgetelementat(
        rh: RpcResponseHelper,
        data: CommandWidgetElementAtData
    ): Promise<WidgetElementAtRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, x: data.x, y: data.y, found: false };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, x: data.x, y: data.y, found: false };
        }
        try {
            const result = await webview.executeJavaScript(`
                (function() {
                    var x = ${data.x};
                    var y = ${data.y};
                    var el = document.elementFromPoint(x, y);
                    if (!el) return null;
                    var rect = el.getBoundingClientRect();
                    var ref = el.id || el.name || el.getAttribute('aria-label') || el.getAttribute('data-wave-ref');
                    if (!ref) {
                        ref = 'wave-ref-element-at';
                        el.setAttribute('data-wave-ref', ref);
                    }
                    return {
                        ref: ref,
                        role: el.getAttribute('role') || el.tagName.toLowerCase(),
                        name: el.getAttribute('aria-label') || el.name || el.textContent?.substring(0, 80) || '',
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    };
                })()
            `);
            if (!result) {
                return { blockid: data.blockid, x: data.x, y: data.y, found: false };
            }
            return {
                blockid: data.blockid,
                x: data.x,
                y: data.y,
                found: true,
                elementref: result.ref,
                role: result.role,
                name: result.name,
            };
        } catch (e) {
            return { blockid: data.blockid, x: data.x, y: data.y, found: false };
        }
    }

    async handle_widgetclick(rh: RpcResponseHelper, data: CommandWidgetClickData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        return this.executeBrowserInteraction(data.blockid, "click", {
            elementref: data.elementref,
            x: data.x,
            y: data.y,
            button: data.button,
            clicktype: data.clicktype,
        });
    }

    async handle_widgethover(rh: RpcResponseHelper, data: CommandWidgetHoverData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            webview.send("human-sim-widget-hover", {
                blockid: data.blockid,
                elementref: data.elementref,
                x: data.x,
                y: data.y,
            });
            return { blockid: data.blockid, success: true, message: "Hover executed" };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to hover: ${e}` };
        }
    }

    async handle_widgetlongpress(
        rh: RpcResponseHelper,
        data: CommandWidgetLongPressData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            webview.send("human-sim-widget-long-press", {
                blockid: data.blockid,
                elementref: data.elementref,
                x: data.x,
                y: data.y,
                duration: data.duration,
            });
            return { blockid: data.blockid, success: true, message: "Long press executed" };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to long press: ${e}` };
        }
    }

    async handle_widgetdrag(rh: RpcResponseHelper, data: CommandWidgetDragData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        return this.executeBrowserInteraction(data.blockid, "drag", {
            startref: data.startref,
            startx: data.startx,
            starty: data.starty,
            endref: data.endref,
            endx: data.endx,
            endy: data.endy,
            button: data.button,
        });
    }

    async handle_widgetscrollto(
        rh: RpcResponseHelper,
        data: CommandWidgetScrollToData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        return this.executeBrowserInteraction(data.blockid, "scroll-to", {
            elementref: data.elementref,
            x: data.x,
            y: data.y,
        });
    }

    async handle_widgetgetvalue(
        rh: RpcResponseHelper,
        data: CommandWidgetGetValueData
    ): Promise<WidgetGetValueRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, elementref: data.elementref, value: "" };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, elementref: data.elementref, value: "" };
        }
        try {
            const ref = data.elementref || "";
            const value = await webview.executeJavaScript(`
                (function() {
                    var ref = ${JSON.stringify(ref)};
                    var el = null;
                    if (ref) {
                        el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]') || document.querySelector('[data-wave-ref="' + ref + '"]');
                    }
                    if (!el) return '';
                    if (el.tagName === 'SELECT') return el.value || '';
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';
                    return el.textContent || '';
                })()
            `);
            return { blockid: data.blockid, elementref: data.elementref, value: value || "" };
        } catch (e) {
            return { blockid: data.blockid, elementref: data.elementref, value: "" };
        }
    }

    async handle_widgetsetvalue(
        rh: RpcResponseHelper,
        data: CommandWidgetSetValueData
    ): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            const result = await webview.executeJavaScript(`
                (function() {
                    var ref = ${JSON.stringify(data.elementref || "")};
                    var value = ${JSON.stringify(data.value)};
                    var el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]') || document.querySelector('[data-wave-ref="' + ref + '"]');
                    if (!el) return { success: false, message: 'Element not found' };
                    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
                        return { success: false, message: 'Element does not accept text input' };
                    }
                    var proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
                    var setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    setter?.call(el, value);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, message: 'Value set' };
                })()
            `);
            return {
                blockid: data.blockid,
                success: !!result?.success,
                message: result?.message ?? "Failed to set value",
            };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to set value: ${e}` };
        }
    }

    async handle_widgetclear(rh: RpcResponseHelper, data: CommandWidgetClearData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            webview.send("human-sim-widget-clear", { blockid: data.blockid, elementref: data.elementref });
            return { blockid: data.blockid, success: true, message: "Clear executed" };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to clear: ${e}` };
        }
    }

    async handle_widgetselect(rh: RpcResponseHelper, data: CommandWidgetSelectData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            const result = await webview.executeJavaScript(`
                (function() {
                    var ref = ${JSON.stringify(data.elementref || "")};
                    var requested = ${JSON.stringify(data.option)};
                    var el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]') || document.querySelector('[data-wave-ref="' + ref + '"]');
                    if (!(el instanceof HTMLSelectElement)) {
                        return { success: false, message: 'Select element not found' };
                    }
                    var option = Array.from(el.options).find(function(item) {
                        return item.value === requested || item.text === requested;
                    });
                    if (!option) return { success: false, message: 'Option not found' };
                    el.value = option.value;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, message: 'Select executed' };
                })()
            `);
            return {
                blockid: data.blockid,
                success: !!result?.success,
                message: result?.message ?? "Failed to select",
            };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to select: ${e}` };
        }
    }

    async handle_widgettoggle(rh: RpcResponseHelper, data: CommandWidgetToggleData): Promise<WidgetMouseActionRtnData> {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            throw new Error("Layout model not found");
        }
        const node = layoutModel.getNodeByBlockId(data.blockid);
        if (!node) {
            return { blockid: data.blockid, success: false, message: `Block not found: ${data.blockid}` };
        }
        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            return { blockid: data.blockid, success: false, message: "Webview not found" };
        }
        try {
            const result = await webview.executeJavaScript(`
                (function() {
                    var ref = ${JSON.stringify(data.elementref || "")};
                    var el = document.getElementById(ref) || document.querySelector('[name="' + ref + '"]') || document.querySelector('[aria-label="' + ref + '"]') || document.querySelector('[data-wave-ref="' + ref + '"]');
                    if (!el) return { success: false, message: 'Element not found' };
                    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
                        el.checked = !el.checked;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return { success: true, message: 'Toggle executed' };
                    }
                    el.click();
                    return { success: true, message: 'Toggle executed' };
                })()
            `);
            return {
                blockid: data.blockid,
                success: !!result?.success,
                message: result?.message ?? "Failed to toggle",
            };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to toggle: ${e}` };
        }
    }

    async handle_widgetclipboardget(
        rh: RpcResponseHelper,
        data: CommandWidgetClipboardGetData
    ): Promise<WidgetClipboardGetRtnData> {
        try {
            const text = await navigator.clipboard.readText();
            return { blockid: data.blockid, text };
        } catch (e) {
            return { blockid: data.blockid, text: "" };
        }
    }

    async handle_widgetclipboardset(
        rh: RpcResponseHelper,
        data: CommandWidgetClipboardSetData
    ): Promise<WidgetMouseActionRtnData> {
        try {
            await navigator.clipboard.writeText(data.text);
            return { blockid: data.blockid, success: true, message: "Clipboard set" };
        } catch (e) {
            return { blockid: data.blockid, success: false, message: `Failed to set clipboard: ${e}` };
        }
    }

    async handle_widgetwaitcondition(
        rh: RpcResponseHelper,
        data: CommandWidgetWaitConditionData
    ): Promise<WidgetWaitConditionRtnData> {
        const startTime = Date.now();
        const timeout = data.timeoutms || 10000;
        const condition = data.condition || "";
        const elementref = data.elementref || "";

        const webview = document.querySelector(`div[data-blockid='${data.blockid}'] webview`) as Electron.WebviewTag;
        if (!webview) {
            while (Date.now() - startTime < timeout) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            return {
                blockid: data.blockid,
                condition,
                met: false,
                wait_time_ms: Date.now() - startTime,
                message: "Webview not found",
            };
        }

        while (Date.now() - startTime < timeout) {
            try {
                const checkResult = await webview.executeJavaScript(`
                    (function() {
                        var elementref = ${JSON.stringify(elementref)};
                        var condition = ${JSON.stringify(condition)};
                        var el = null;
                        if (elementref) {
                            el = document.getElementById(elementref) || document.querySelector('[name="' + elementref + '"]') || document.querySelector('[aria-label="' + elementref + '"]');
                        }
                        if (!el && elementref) return false;
                        if (condition === 'visible' || condition === 'exists') {
                            if (!el) return document.body != null;
                            var rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                        }
                        if (condition === 'hidden') return el ? (el.offsetWidth === 0 && el.offsetHeight === 0) : true;
                        if (condition === 'enabled') return el ? !el.disabled : false;
                        if (condition === 'disabled') return el ? el.disabled : false;
                        if (condition === 'focused') return el ? document.activeElement === el : false;
                        if (condition === 'text') return el ? (el.textContent || '').length > 0 : false;
                        if (condition === 'value') return el ? (el.value || '').length > 0 : false;
                        if (condition.startsWith('text:')) {
                            var searchText = condition.substring(5);
                            return el ? (el.textContent || '').indexOf(searchText) !== -1 : false;
                        }
                        if (condition.startsWith('value:')) {
                            var searchValue = condition.substring(6);
                            return el ? String(el.value || '').indexOf(searchValue) !== -1 : false;
                        }
                        return el != null;
                    })()
                `);
                if (checkResult) {
                    return {
                        blockid: data.blockid,
                        condition,
                        met: true,
                        wait_time_ms: Date.now() - startTime,
                        message: "Condition met",
                    };
                }
            } catch (_) {
                // webview may not be ready yet, keep polling
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
        }

        return {
            blockid: data.blockid,
            condition,
            met: false,
            wait_time_ms: Date.now() - startTime,
            message: "Condition timeout",
        };
    }
}
