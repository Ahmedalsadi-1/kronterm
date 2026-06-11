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
