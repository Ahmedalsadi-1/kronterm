// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildBrowserInteractionScript,
    buildSandboxDragPayload,
    buildSandboxKeyboardPressPayload,
    buildSandboxScrollPayload,
    sandboxComputerUseUrlFromStatus,
} from "./tabrpcclient";

class FakeElement {
    id = "";
    parentElement: FakeElement | null = null;
    scrollHeight = 0;
    clientHeight = 0;
    scrollTop = 0;
    clicked = 0;
    focused = false;

    getBoundingClientRect() {
        return { left: 0, top: 0, width: 100, height: 20 };
    }

    dispatchEvent() {
        return true;
    }

    scrollIntoView() {}

    focus() {
        this.focused = true;
        fakeDocument.activeElement = this;
    }

    click() {
        this.clicked += 1;
    }
}

class FakeInput extends FakeElement {
    private innerValue = "";
    selectionStart = 0;
    selectionEnd = 0;

    get value() {
        return this.innerValue;
    }

    set value(next: string) {
        this.innerValue = next;
    }

    setSelectionRange(start: number, end: number) {
        this.selectionStart = start;
        this.selectionEnd = end;
    }
}

class FakeTextArea extends FakeInput {}
class FakeSelect extends FakeElement {}

const elements = new Map<string, FakeElement>();
const fakeDocument = {
    activeElement: null as FakeElement | null,
    scrollingElement: null as FakeElement | null,
    documentElement: new FakeElement(),
    getElementById: (id: string) => elements.get(id) ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    elementFromPoint: () => null as FakeElement | null,
    execCommand: () => true,
};

async function runInteraction(action: "click" | "type" | "scroll", payload: Record<string, unknown>) {
    return (0, eval)(buildBrowserInteractionScript(action, payload));
}

describe("browser interaction scripts", () => {
    beforeEach(() => {
        elements.clear();
        fakeDocument.activeElement = null;
        fakeDocument.scrollingElement = null;
        vi.stubGlobal("Element", FakeElement);
        vi.stubGlobal("HTMLElement", FakeElement);
        vi.stubGlobal("HTMLInputElement", FakeInput);
        vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
        vi.stubGlobal("HTMLSelectElement", FakeSelect);
        vi.stubGlobal("MouseEvent", class {});
        vi.stubGlobal("WheelEvent", class {});
        vi.stubGlobal("InputEvent", class {});
        vi.stubGlobal("KeyboardEvent", class {});
        vi.stubGlobal("CSS", { escape: (value: string) => value });
        vi.stubGlobal("document", fakeDocument);
        vi.stubGlobal("window", {
            setTimeout,
            getComputedStyle: (element: FakeElement) => ({
                overflowY: element.scrollHeight > element.clientHeight ? "auto" : "visible",
            }),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("focuses and activates a clicked input", async () => {
        const input = new FakeInput();
        elements.set("field", input);

        const result = await runInteraction("click", { elementref: "field", clicktype: "single" });

        expect(result.success).toBe(true);
        expect(input.focused).toBe(true);
        expect(input.clicked).toBe(1);
    });

    it("inserts typed text at the current selection", async () => {
        const input = new FakeInput();
        input.value = "ac";
        input.setSelectionRange(1, 1);
        fakeDocument.activeElement = input;

        const result = await runInteraction("type", { text: "b", delayMs: 0 });

        expect(result.success).toBe(true);
        expect(input.value).toBe("abc");
        expect(input.selectionStart).toBe(2);
    });

    it("scrolls the nearest scrollable ancestor of the pointed element", async () => {
        const container = new FakeElement();
        container.scrollHeight = 600;
        container.clientHeight = 100;
        const child = new FakeElement();
        child.parentElement = container;
        fakeDocument.elementFromPoint = () => child;

        const result = await runInteraction("scroll", { amount: 125, originX: 10, originY: 10 });

        expect(result.success).toBe(true);
        expect(container.scrollTop).toBe(125);
    });
});

describe("sandbox computer-use URL resolution", () => {
    it("prefers the advertised MCP URL", () => {
        expect(
            sandboxComputerUseUrlFromStatus({
                status: "running",
                mcpUrl: "http://127.0.0.1:4567/computer-use/",
                desktopUrl: "http://localhost:9990/novnc/vnc_lite.html?scale=true",
            })
        ).toBe("http://127.0.0.1:4567/computer-use");
    });

    it("derives computer-use from the desktop preview URL", () => {
        expect(
            sandboxComputerUseUrlFromStatus({
                status: "running",
                desktopUrl: "http://localhost:9990/novnc/vnc_lite.html?scale=true",
            })
        ).toBe("http://localhost:9990/computer-use");
    });

    it("falls back to the development endpoint when status has no URL", () => {
        expect(sandboxComputerUseUrlFromStatus({ status: "running" })).toBe("http://localhost:9990/computer-use");
    });
});

describe("sandbox computer-use payloads", () => {
    it("uses type_keys for widget key presses", () => {
        expect(buildSandboxKeyboardPressPayload(["Enter"])).toEqual({
            action: "type_keys",
            keys: ["Enter"],
        });
    });

    it("uses scrollCount and optional coordinates for sandbox scrolling", () => {
        expect(buildSandboxScrollPayload("down", 125, 40, 50)).toEqual({
            action: "scroll",
            direction: "down",
            scrollCount: 3,
            coordinates: { x: 40, y: 50 },
        });
    });

    it("uses a path for sandbox drags", () => {
        expect(buildSandboxDragPayload(10, 20, 30, 40)).toEqual({
            action: "drag_mouse",
            button: "left",
            path: [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
            ],
        });
    });
});
