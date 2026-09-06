// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";
import { clampHermesHudGeometry, hermesSurfaceController } from "./hermes-surface-controller";

afterEach(() => {
    hermesSurfaceController.resetForTests();
});

describe("Hermes surface controller", () => {
    it("moves one surface between HUD and widget presentation", async () => {
        const expand = vi.fn(async () => undefined);
        hermesSurfaceController.setExpandHandler(expand);
        hermesSurfaceController.requestOpenHud("session-1");
        expect(hermesSurfaceController.getSnapshot()).toMatchObject({
            presentation: "hud",
            sessionId: "session-1",
        });

        await hermesSurfaceController.expandToWidget();
        expect(expand).toHaveBeenCalledOnce();
        expect(hermesSurfaceController.getSnapshot().presentation).toBe("hud");

        const closeToHud = vi.fn();
        const unregister = hermesSurfaceController.registerWidgetHost({ blockId: "hermes-1", closeToHud });
        expect(hermesSurfaceController.getSnapshot().presentation).toBe("widget");
        hermesSurfaceController.requestOpenHud();
        expect(closeToHud).toHaveBeenCalledOnce();
        unregister();
        expect(hermesSurfaceController.getSnapshot().presentation).toBe("hud");
    });

    it("dismisses independently from expanding", () => {
        hermesSurfaceController.requestOpenHud();
        hermesSurfaceController.dismiss();
        expect(hermesSurfaceController.getSnapshot().presentation).toBe("closed");
    });

    it("moves the active widget into the docked panel", () => {
        const closeToHud = vi.fn();
        const unregister = hermesSurfaceController.registerWidgetHost({ blockId: "hermes-1", closeToHud });

        hermesSurfaceController.requestOpenPanel("session-panel");
        expect(closeToHud).toHaveBeenCalledOnce();
        unregister();
        expect(hermesSurfaceController.getSnapshot()).toMatchObject({
            presentation: "panel",
            sessionId: "session-panel",
            widgetBlockId: null,
        });
    });

    it("gives an open widget ownership instead of leaving the HUD expanded", () => {
        hermesSurfaceController.requestOpenHud("session-widget");
        hermesSurfaceController.registerWidgetHost({ blockId: "hermes-visible", closeToHud: vi.fn() });

        expect(hermesSurfaceController.getSnapshot()).toMatchObject({
            presentation: "widget",
            sessionId: "session-widget",
            widgetBlockId: "hermes-visible",
        });
    });

    it("activates the widget the user interacts with", () => {
        hermesSurfaceController.registerWidgetHost({ blockId: "hermes-1", closeToHud: vi.fn() });
        hermesSurfaceController.registerWidgetHost({ blockId: "hermes-2", closeToHud: vi.fn() });

        hermesSurfaceController.activateWidget("hermes-2");
        expect(hermesSurfaceController.getSnapshot()).toMatchObject({
            presentation: "widget",
            widgetBlockId: "hermes-2",
        });
    });
});

describe("Hermes HUD geometry", () => {
    it("defaults bottom-center and clamps saved bounds inside the workspace", () => {
        const bounds = new DOMRect(100, 50, 1000, 700);
        const initial = clampHermesHudGeometry({}, bounds);
        expect(initial).toMatchObject({ x: 290, y: 352, width: 620, height: 320 });

        expect(clampHermesHudGeometry({ x: -500, y: 2000, width: 2000, height: 20 }, bounds)).toEqual({
            x: 112,
            y: 512,
            width: 976,
            height: 160,
        });
    });
});
