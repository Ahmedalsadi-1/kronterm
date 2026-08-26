// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ipcRenderer } from "electron";

type HumanSimPoint = {
    x?: number;
    y?: number;
};

type HumanSimWidgetPayload = HumanSimPoint & {
    elementref?: string;
};

type OpenDesignElement = {
    ref: string;
    role: string;
    name: string;
    value?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    focusable: boolean;
    visible: boolean;
    selector?: string;
    tagName?: string;
    componentName?: string;
};

type OpenDesignTheme = {
    background?: string;
    surface?: string;
    foreground?: string;
    muted?: string;
    border?: string;
};

const OpenDesignRootId = "__kronterm_open_design_root";
let openDesignEnabled = false;
let openDesignRoot: HTMLDivElement | null = null;
let openDesignOutline: HTMLDivElement | null = null;
let openDesignLabel: HTMLDivElement | null = null;
let openDesignComposer: HTMLDivElement | null = null;
let openDesignTarget: HTMLElement | null = null;
let openDesignPreviousCursor = "";

function truncateOpenDesignText(value: unknown, length = 240): string {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, length);
}

function getOpenDesignSelector(element: HTMLElement): string {
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }
    const testId = element.getAttribute("data-testid");
    if (testId) {
        return `[data-testid="${CSS.escape(testId)}"]`;
    }
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    while (current && current !== document.body && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        const stableClass = Array.from(current.classList).find((name) => !/^(css-|sc-|jsx-|_[a-z0-9])/i.test(name));
        if (stableClass) {
            part += `.${CSS.escape(stableClass)}`;
        } else if (current.parentElement) {
            const siblings = Array.from(current.parentElement.children).filter(
                (child) => child.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
        }
        parts.unshift(part);
        current = current.parentElement;
    }
    return parts.join(" > ");
}

function getOpenDesignComponentName(element: HTMLElement): string {
    let current: HTMLElement | null = element;
    while (current) {
        const explicit = current.getAttribute("data-component") || current.getAttribute("data-component-name");
        if (explicit) {
            return truncateOpenDesignText(explicit, 120);
        }
        const fiberKey = Object.keys(current).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? (current as any)[fiberKey] : null;
        while (fiber) {
            const type = fiber.elementType ?? fiber.type;
            const name = typeof type === "function" ? type.displayName || type.name : type?.displayName;
            if (name && !/^(Fragment|Suspense|StrictMode)$/i.test(name)) {
                return truncateOpenDesignText(name, 120);
            }
            fiber = fiber.return;
        }
        current = current.parentElement;
    }
    return "";
}

function describeOpenDesignElement(element: HTMLElement): OpenDesignElement {
    const rect = element.getBoundingClientRect();
    const selector = getOpenDesignSelector(element);
    const role =
        element.getAttribute("role") ||
        ({ A: "link", BUTTON: "button", INPUT: "textbox", TEXTAREA: "textbox", SELECT: "combobox", IMG: "img" }[
            element.tagName
        ] ??
            element.tagName.toLowerCase());
    const name = truncateOpenDesignText(
        element.getAttribute("aria-label") ||
            element.getAttribute("alt") ||
            element.getAttribute("title") ||
            element.innerText ||
            element.getAttribute("placeholder") ||
            selector
    );
    const value =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
            ? truncateOpenDesignText(element.value)
            : "";
    const componentName = getOpenDesignComponentName(element);
    return {
        ref: selector,
        role,
        name,
        ...(value ? { value } : {}),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        focusable: element.matches("a, button, input, textarea, select, [tabindex]"),
        visible: rect.width > 0 && rect.height > 0,
        selector,
        tagName: element.tagName.toLowerCase(),
        ...(componentName ? { componentName } : {}),
    };
}

function positionOpenDesignOutline(element: HTMLElement): void {
    if (!openDesignOutline || !openDesignLabel) {
        return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(openDesignOutline.style, {
        display: "block",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
    });
    const description = describeOpenDesignElement(element);
    openDesignLabel.textContent =
        description.componentName || description.name || description.tagName || description.role;
    Object.assign(openDesignLabel.style, {
        display: "block",
        left: `${Math.max(6, rect.left)}px`,
        top: `${Math.max(6, rect.top - 24)}px`,
    });
}

function installOpenDesignUi(): void {
    if (openDesignRoot?.isConnected) {
        return;
    }
    openDesignRoot = document.createElement("div");
    openDesignRoot.id = OpenDesignRootId;
    openDesignRoot.style.cssText =
        "--od-bg:#171717;--od-surface:#242424;--od-fg:#f5f5f5;--od-muted:#b4b4b4;--od-border:#454545;position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:var(--od-fg)";
    openDesignOutline = document.createElement("div");
    openDesignOutline.style.cssText =
        "position:fixed;display:none;box-sizing:border-box;border:2px solid var(--od-fg);background:color-mix(in srgb,var(--od-fg) 8%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--od-bg) 70%,transparent),0 8px 24px rgba(0,0,0,.18);pointer-events:none";
    openDesignLabel = document.createElement("div");
    openDesignLabel.style.cssText =
        "position:fixed;display:none;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--od-border);border-radius:6px;background:var(--od-fg);color:var(--od-bg);padding:4px 7px;font-weight:600;line-height:16px;pointer-events:none";
    openDesignComposer = document.createElement("div");
    openDesignComposer.style.cssText =
        "position:fixed;display:none;width:min(320px,calc(100vw - 24px));border:1px solid var(--od-border);border-radius:12px;background:var(--od-bg);color:var(--od-fg);padding:10px;box-shadow:0 18px 55px rgba(0,0,0,.4);pointer-events:auto";
    openDesignComposer.innerHTML =
        '<div data-open-design-title style="margin:0 0 7px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Comment on component</div><textarea aria-label="Open Design comment" placeholder="Tell Hermes what to change…" style="display:block;box-sizing:border-box;width:100%;min-height:72px;resize:vertical;border:1px solid var(--od-border);border-radius:8px;background:var(--od-surface);color:var(--od-fg);padding:8px;font:12px inherit;outline:none"></textarea><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px"><button data-open-design-cancel type="button" style="cursor:pointer;border:1px solid var(--od-border);border-radius:7px;background:var(--od-surface);color:var(--od-muted);padding:6px 10px">Cancel</button><button data-open-design-submit type="button" style="cursor:pointer;border:1px solid var(--od-fg);border-radius:7px;background:var(--od-fg);color:var(--od-bg);padding:6px 10px;font-weight:650">Add comment</button></div>';
    openDesignRoot.append(openDesignOutline, openDesignLabel, openDesignComposer);
    document.documentElement.append(openDesignRoot);

    openDesignComposer.querySelector("[data-open-design-cancel]")?.addEventListener("click", () => {
        if (openDesignComposer) openDesignComposer.style.display = "none";
    });
    openDesignComposer.querySelector("[data-open-design-submit]")?.addEventListener("click", () => {
        const textarea = openDesignComposer?.querySelector("textarea") as HTMLTextAreaElement | null;
        const comment = truncateOpenDesignText(textarea?.value, 2_000);
        if (!openDesignTarget || !comment) {
            textarea?.focus();
            return;
        }
        ipcRenderer.sendToHost("open-design-comment", {
            url: location.href,
            element: describeOpenDesignElement(openDesignTarget),
            comment,
        });
        if (textarea) textarea.value = "";
        if (openDesignComposer) openDesignComposer.style.display = "none";
    });
}

function applyOpenDesignTheme(theme?: OpenDesignTheme): void {
    if (!openDesignRoot || !theme) {
        return;
    }
    const tokens = {
        "--od-bg": theme.background,
        "--od-surface": theme.surface,
        "--od-fg": theme.foreground,
        "--od-muted": theme.muted,
        "--od-border": theme.border,
    };
    for (const [token, value] of Object.entries(tokens)) {
        if (value?.trim()) {
            openDesignRoot.style.setProperty(token, value.trim());
        }
    }
}

function setOpenDesignEnabled(enabled: boolean): void {
    if (enabled === openDesignEnabled) {
        return;
    }
    openDesignEnabled = enabled;
    installOpenDesignUi();
    if (enabled) {
        openDesignPreviousCursor = document.documentElement.style.cursor;
        document.documentElement.style.cursor = "crosshair";
        return;
    }
    if (!enabled) {
        openDesignTarget = null;
        if (openDesignOutline) openDesignOutline.style.display = "none";
        if (openDesignLabel) openDesignLabel.style.display = "none";
        if (openDesignComposer) openDesignComposer.style.display = "none";
    }
    document.documentElement.style.cursor = openDesignPreviousCursor;
}

document.addEventListener(
    "pointermove",
    (event) => {
        if (
            !openDesignEnabled ||
            openDesignComposer?.style.display === "block" ||
            !(event.target instanceof HTMLElement) ||
            openDesignRoot?.contains(event.target)
        ) {
            return;
        }
        positionOpenDesignOutline(event.target);
    },
    true
);

document.addEventListener(
    "click",
    (event) => {
        if (!openDesignEnabled || !(event.target instanceof HTMLElement) || openDesignRoot?.contains(event.target)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        openDesignTarget = event.target;
        positionOpenDesignOutline(openDesignTarget);
        const description = describeOpenDesignElement(openDesignTarget);
        ipcRenderer.sendToHost("open-design-selection", { url: location.href, element: description });
        if (!openDesignComposer) {
            return;
        }
        const title = openDesignComposer.querySelector("[data-open-design-title]");
        if (title)
            title.textContent = description.componentName || description.name || description.selector || "Component";
        const rect = openDesignTarget.getBoundingClientRect();
        const left = Math.min(Math.max(12, rect.left), Math.max(12, innerWidth - 332));
        const top = rect.bottom + 10 + 130 < innerHeight ? rect.bottom + 10 : Math.max(12, rect.top - 140);
        Object.assign(openDesignComposer.style, { display: "block", left: `${left}px`, top: `${top}px` });
        (openDesignComposer.querySelector("textarea") as HTMLTextAreaElement | null)?.focus();
    },
    true
);

ipcRenderer.on("open-design-set-inspect-mode", (_event, payload: { enabled?: boolean; theme?: OpenDesignTheme }) => {
    setOpenDesignEnabled(payload?.enabled === true);
    applyOpenDesignTheme(payload?.theme);
});

function getElementByRef(ref?: string): HTMLElement | null {
    if (!ref) {
        return null;
    }
    return (
        document.getElementById(ref) ??
        (document.querySelector(`[name="${CSS.escape(ref)}"]`) as HTMLElement | null) ??
        (document.querySelector(`[aria-label="${CSS.escape(ref)}"]`) as HTMLElement | null) ??
        (document.querySelector(`[data-wave-ref="${CSS.escape(ref)}"]`) as HTMLElement | null)
    );
}

function getElementFromPayload(payload: HumanSimWidgetPayload): HTMLElement | null {
    const element = getElementByRef(payload.elementref);
    if (element != null) {
        return element;
    }
    if (payload.x == null || payload.y == null) {
        return null;
    }
    return document.elementFromPoint(payload.x, payload.y) as HTMLElement | null;
}

function getPoint(target: Element, point?: HumanSimPoint): { clientX: number; clientY: number } {
    const rect = target.getBoundingClientRect();
    return {
        clientX: point?.x ?? rect.left + rect.width / 2,
        clientY: point?.y ?? rect.top + rect.height / 2,
    };
}

function dispatchPointerEvent(target: Element, type: string, point?: HumanSimPoint, button = 0, buttons = 0): void {
    if (typeof PointerEvent !== "function") {
        return;
    }
    const { clientX, clientY } = getPoint(target, point);
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            clientX,
            clientY,
            button,
            buttons,
        })
    );
}

function dispatchMouseEvent(
    target: Element,
    type: string,
    point?: HumanSimPoint,
    button = 0,
    detail = 1,
    buttons = 0
): void {
    const { clientX, clientY } = getPoint(target, point);
    target.dispatchEvent(
        new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX,
            clientY,
            button,
            detail,
            buttons,
        })
    );
}

function dispatchDragEvent(target: Element, type: string, point?: HumanSimPoint, dataTransfer?: DataTransfer): void {
    if (typeof DragEvent !== "function") {
        return;
    }
    const { clientX, clientY } = getPoint(target, point);
    target.dispatchEvent(
        new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX,
            clientY,
            dataTransfer,
        })
    );
}

function setNativeValue(element: HTMLElement, value: string): void {
    if (element instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return;
    }
    if (element instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

function clickElement(payload: HumanSimWidgetPayload & { button?: string; clicktype?: string }): void {
    const element = getElementFromPayload(payload);
    if (element == null) {
        return;
    }
    const buttonMap = { left: 0, middle: 1, right: 2 } as const;
    const button = buttonMap[payload.button as keyof typeof buttonMap] ?? 0;
    const clickCount = payload.clicktype === "triple" ? 3 : payload.clicktype === "double" ? 2 : 1;
    for (let idx = 0; idx < clickCount; idx++) {
        dispatchPointerEvent(element, "pointerover", payload, button, 0);
        dispatchPointerEvent(element, "pointerenter", payload, button, 0);
        dispatchMouseEvent(element, "mouseover", payload, button, idx + 1, 0);
        dispatchMouseEvent(element, "mouseenter", payload, button, idx + 1, 0);
        dispatchPointerEvent(element, "pointerdown", payload, button, 1 << button);
        dispatchMouseEvent(element, "mousedown", payload, button, idx + 1, 1 << button);
        dispatchPointerEvent(element, "pointerup", payload, button, 0);
        dispatchMouseEvent(element, "mouseup", payload, button, idx + 1, 0);
        dispatchMouseEvent(element, button === 2 ? "contextmenu" : "click", payload, button, idx + 1, 0);
    }
    if (button === 0 && clickCount >= 2) {
        dispatchMouseEvent(element, "dblclick", payload, button, 2, 0);
    }
}

ipcRenderer.on("human-sim-widget-click", (_event, payload) => {
    clickElement(payload);
});

ipcRenderer.on("human-sim-widget-hover", (_event, payload: HumanSimWidgetPayload) => {
    const element = getElementFromPayload(payload);
    if (element == null) {
        return;
    }
    dispatchPointerEvent(element, "pointerover", payload);
    dispatchPointerEvent(element, "pointerenter", payload);
    dispatchPointerEvent(element, "pointermove", payload);
    dispatchMouseEvent(element, "mousemove", payload);
    dispatchMouseEvent(element, "mouseover", payload);
    dispatchMouseEvent(element, "mouseenter", payload);
});

ipcRenderer.on("human-sim-widget-scroll-to", (_event, payload: HumanSimWidgetPayload) => {
    const element = getElementFromPayload(payload);
    element?.scrollIntoView({ block: "center", inline: "center" });
});

ipcRenderer.on("human-sim-widget-set-value", (_event, payload: HumanSimWidgetPayload & { value?: string }) => {
    const element = getElementFromPayload(payload);
    if (element == null || payload.value == null) {
        return;
    }
    setNativeValue(element, payload.value);
});

ipcRenderer.on("human-sim-widget-clear", (_event, payload: HumanSimWidgetPayload) => {
    const element = getElementFromPayload(payload);
    if (element == null) {
        return;
    }
    setNativeValue(element, "");
});

ipcRenderer.on("human-sim-widget-select", (_event, payload: HumanSimWidgetPayload & { option?: string }) => {
    const element = getElementFromPayload(payload);
    if (!(element instanceof HTMLSelectElement) || payload.option == null) {
        return;
    }
    const byValue = Array.from(element.options).find((option) => option.value === payload.option);
    const byText = Array.from(element.options).find((option) => option.text === payload.option);
    const option = byValue ?? byText;
    if (option == null) {
        return;
    }
    element.value = option.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
});

ipcRenderer.on("human-sim-widget-toggle", (_event, payload: HumanSimWidgetPayload) => {
    const element = getElementFromPayload(payload);
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        element.checked = !element.checked;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return;
    }
    element?.click();
});

ipcRenderer.on("human-sim-keyboard-type", (_event, payload: { text?: string }) => {
    const active = document.activeElement as HTMLElement | null;
    if (active == null || payload.text == null) {
        return;
    }
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        setNativeValue(active, `${active.value}${payload.text}`);
    }
});

ipcRenderer.on("human-sim-mouse-click", (_event, payload: HumanSimPoint & { button?: string; clickCount?: number }) => {
    const target = getElementFromPayload(payload);
    if (target == null) {
        return;
    }
    const buttonMap = { left: 0, middle: 1, right: 2 } as const;
    const button = buttonMap[payload.button as keyof typeof buttonMap] ?? 0;
    const clickCount = payload.clickCount ?? 1;
    for (let idx = 0; idx < clickCount; idx++) {
        dispatchMouseEvent(target, "mousedown", payload, button);
        dispatchMouseEvent(target, "mouseup", payload, button);
        dispatchMouseEvent(target, "click", payload, button);
    }
});

ipcRenderer.on("human-sim-mouse-scroll", (_event, payload: { amount?: number; originX?: number; originY?: number }) => {
    const amount = payload.amount ?? 0;
    const hasOrigin = payload.originX != null && payload.originY != null;
    const target = hasOrigin
        ? document.elementFromPoint(payload.originX!, payload.originY!)
        : (document.scrollingElement ?? document.body);
    target?.dispatchEvent(
        new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: amount,
            clientX: payload.originX ?? 0,
            clientY: payload.originY ?? 0,
        })
    );
    if (hasOrigin && target instanceof HTMLElement) {
        target.scrollBy({ top: amount });
    } else {
        window.scrollBy({ top: amount });
    }
});

ipcRenderer.on(
    "human-sim-mouse-drag",
    (_event, payload: { startX?: number; startY?: number; endX?: number; endY?: number; button?: string }) => {
        const start = document.elementFromPoint(payload.startX ?? 0, payload.startY ?? 0);
        const end = document.elementFromPoint(payload.endX ?? 0, payload.endY ?? 0);
        if (start == null || end == null) {
            return;
        }
        const buttonMap = { left: 0, middle: 1, right: 2 } as const;
        const button = buttonMap[payload.button as keyof typeof buttonMap] ?? 0;
        dispatchPointerEvent(start, "pointerdown", { x: payload.startX, y: payload.startY }, button, 1 << button);
        dispatchMouseEvent(start, "mousedown", { x: payload.startX, y: payload.startY }, button, 1, 1 << button);
        dispatchPointerEvent(end, "pointermove", { x: payload.endX, y: payload.endY }, button, 1 << button);
        dispatchMouseEvent(end, "mousemove", { x: payload.endX, y: payload.endY }, button, 1, 1 << button);
        dispatchPointerEvent(end, "pointerup", { x: payload.endX, y: payload.endY }, button, 0);
        dispatchMouseEvent(end, "mouseup", { x: payload.endX, y: payload.endY }, button, 1, 0);
    }
);

ipcRenderer.on("human-sim-keyboard-press", (_event, payload: { keys?: string[] }) => {
    const active = document.activeElement;
    const keys = payload.keys ?? [];
    const key = keys.at(-1);
    if (active == null || key == null) {
        return;
    }
    const eventOptions = {
        key,
        bubbles: true,
        cancelable: true,
        altKey: keys.includes("Alt"),
        ctrlKey: keys.includes("Control"),
        metaKey: keys.includes("Meta") || keys.includes("Command"),
        shiftKey: keys.includes("Shift"),
    };
    active.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
    active.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
});

ipcRenderer.on("human-sim-widget-long-press", (_event, payload: HumanSimWidgetPayload & { duration?: number }) => {
    const element = getElementFromPayload(payload);
    if (element == null) {
        return;
    }
    dispatchPointerEvent(element, "pointerdown", payload, 0, 1);
    dispatchMouseEvent(element, "mousedown", payload, 0, 1, 1);
    window.setTimeout(
        () => {
            dispatchPointerEvent(element, "pointerup", payload);
            dispatchMouseEvent(element, "mouseup", payload);
        },
        Math.max(100, (payload.duration ?? 1) * 1000)
    );
});

ipcRenderer.on(
    "human-sim-widget-drag",
    (
        _event,
        payload: {
            startref?: string;
            startx?: number;
            starty?: number;
            endref?: string;
            endx?: number;
            endy?: number;
            button?: string;
        }
    ) => {
        const start =
            getElementByRef(payload.startref) ??
            (document.elementFromPoint(payload.startx ?? 0, payload.starty ?? 0) as HTMLElement | null);
        const end =
            getElementByRef(payload.endref) ??
            (document.elementFromPoint(payload.endx ?? 0, payload.endy ?? 0) as HTMLElement | null);
        if (start == null || end == null) {
            return;
        }
        const buttonMap = { left: 0, middle: 1, right: 2 } as const;
        const button = buttonMap[payload.button as keyof typeof buttonMap] ?? 0;
        const startPoint = getPoint(start, { x: payload.startx, y: payload.starty });
        const endPoint = getPoint(end, { x: payload.endx, y: payload.endy });
        const dataTransfer = typeof DataTransfer === "function" ? new DataTransfer() : undefined;
        dispatchPointerEvent(start, "pointerdown", { x: payload.startx, y: payload.starty }, button, 1 << button);
        dispatchMouseEvent(start, "mousedown", { x: payload.startx, y: payload.starty }, button, 1, 1 << button);
        dispatchDragEvent(start, "dragstart", { x: payload.startx, y: payload.starty }, dataTransfer);
        for (let step = 1; step <= 8; step++) {
            const ratio = step / 8;
            const x = startPoint.clientX + (endPoint.clientX - startPoint.clientX) * ratio;
            const y = startPoint.clientY + (endPoint.clientY - startPoint.clientY) * ratio;
            const current = (document.elementFromPoint(x, y) as HTMLElement | null) ?? end;
            dispatchPointerEvent(current, "pointermove", { x, y }, button, 1 << button);
            dispatchMouseEvent(current, "mousemove", { x, y }, button, 1, 1 << button);
            dispatchDragEvent(current, "dragover", { x, y }, dataTransfer);
        }
        dispatchDragEvent(end, "drop", { x: payload.endx, y: payload.endy }, dataTransfer);
        dispatchDragEvent(start, "dragend", { x: payload.endx, y: payload.endy }, dataTransfer);
        dispatchPointerEvent(end, "pointerup", { x: payload.endx, y: payload.endy }, button, 0);
        dispatchMouseEvent(end, "mouseup", { x: payload.endx, y: payload.endy }, button, 1, 0);
    }
);

document.addEventListener("contextmenu", (event) => {
    console.log("contextmenu event", event);
    if (event.target == null) {
        return;
    }
    const targetElement = event.target as HTMLElement;
    // Check if the right-click is on an image
    if (targetElement.tagName === "IMG") {
        setTimeout(() => {
            if (event.defaultPrevented) {
                return;
            }
            event.preventDefault();
            const imgElem = targetElement as HTMLImageElement;
            const imageUrl = imgElem.src;
            ipcRenderer.send("webview-image-contextmenu", { src: imageUrl });
        }, 50);
        return;
    }
    // do nothing
});

console.log("loaded wave preload-webview.ts");
