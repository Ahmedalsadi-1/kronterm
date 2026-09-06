// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { buildAgentWidgetShortcutText, isAgentWidgetShortcutView } from "./agent-widget-shortcuts";

describe("agent widget shortcuts", () => {
    it("identifies widget-like views", () => {
        expect(isAgentWidgetShortcutView("web")).toBe(true);
        expect(isAgentWidgetShortcutView("sandbox")).toBe(true);
        expect(isAgentWidgetShortcutView("appstream")).toBe(true);
        expect(isAgentWidgetShortcutView("term")).toBe(false);
    });

    it("includes the basic widget movement toolset", () => {
        const text = buildAgentWidgetShortcutText("block-1", "web");
        expect(text).toContain('widget_snapshot {"blockId":"block-1"}');
        expect(text).toContain('widget_mouse_move {"blockId":"block-1","elementRef":"@e1"}');
        expect(text).toContain('widget_drag {"blockId":"block-1","startX":40,"startY":40,"endX":180,"endY":120}');
    });

    it("adds sandbox desktop shortcuts for sandbox blocks", () => {
        const text = buildAgentWidgetShortcutText("sb-1", "sandbox");
        expect(text).toContain('sandbox_click {"sessionId":"sb-1","x":120,"y":80}');
        expect(text).toContain('sandbox_drag {"sessionId":"sb-1","startX":40,"startY":40,"endX":180,"endY":120}');
    });

    it("adds native app stream shortcuts for appstream blocks", () => {
        const text = buildAgentWidgetShortcutText("app-1", "appstream");
        expect(text).not.toContain("widget_snapshot");
        expect(text).toContain('kron_computer_click {"app":"App Name","x":120,"y":80}');
        expect(text).toContain("App stream block: app-1");
    });
});
