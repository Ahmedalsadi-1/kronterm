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

function dispatchMouseEvent(target: Element, type: string, point?: HumanSimPoint, button = 0): void {
    const rect = target.getBoundingClientRect();
    const clientX = point?.x ?? rect.left + rect.width / 2;
    const clientY = point?.y ?? rect.top + rect.height / 2;
    target.dispatchEvent(
        new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            button,
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
        dispatchMouseEvent(element, "mousedown", payload, button);
        dispatchMouseEvent(element, "mouseup", payload, button);
        dispatchMouseEvent(element, "click", payload, button);
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

ipcRenderer.on(
    "human-sim-mouse-scroll",
    (_event, payload: { amount?: number; originX?: number; originY?: number }) => {
        const amount = payload.amount ?? 0;
        const hasOrigin = payload.originX != null && payload.originY != null;
        const target = hasOrigin
            ? document.elementFromPoint(payload.originX!, payload.originY!)
            : document.scrollingElement ?? document.body;
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
    }
);

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
        dispatchMouseEvent(start, "mousedown", { x: payload.startX, y: payload.startY }, button);
        dispatchMouseEvent(end, "mousemove", { x: payload.endX, y: payload.endY }, button);
        dispatchMouseEvent(end, "mouseup", { x: payload.endX, y: payload.endY }, button);
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
    dispatchMouseEvent(element, "mousedown", payload);
    window.setTimeout(() => {
        dispatchMouseEvent(element, "mouseup", payload);
    }, Math.max(100, (payload.duration ?? 1) * 1000));
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
        dispatchMouseEvent(start, "mousedown", { x: payload.startx, y: payload.starty }, button);
        dispatchMouseEvent(end, "mousemove", { x: payload.endx, y: payload.endy }, button);
        dispatchMouseEvent(end, "mouseup", { x: payload.endx, y: payload.endy }, button);
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
