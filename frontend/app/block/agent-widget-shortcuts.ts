// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const WidgetControlViews = new Set(["web", "webview", "sandbox", "appstream"]);

function widgetToolCall(name: string, args: Record<string, unknown>): string {
    return `${name} ${JSON.stringify(args)}`;
}

function buildWidgetToolShortcuts(blockId: string): string[] {
    return [
        widgetToolCall("widget_snapshot", { blockId }),
        widgetToolCall("widget_screenshot_annotated", { blockId }),
        widgetToolCall("widget_click", { blockId, elementRef: "@e1" }),
        widgetToolCall("widget_click", { blockId, x: 120, y: 80 }),
        widgetToolCall("widget_mouse_move", { blockId, elementRef: "@e1" }),
        widgetToolCall("widget_drag", { blockId, startX: 40, startY: 40, endX: 180, endY: 120 }),
        widgetToolCall("widget_scroll_to", { blockId, elementRef: "@e1" }),
        widgetToolCall("widget_type", { blockId, text: "text" }),
        widgetToolCall("widget_press", { blockId, keys: ["Enter"] }),
    ];
}

function buildSandboxDesktopShortcuts(blockId: string): string[] {
    return [
        widgetToolCall("sandbox_screenshot", { sessionId: blockId }),
        widgetToolCall("sandbox_mouse_move", { sessionId: blockId, x: 120, y: 80 }),
        widgetToolCall("sandbox_click", { sessionId: blockId, x: 120, y: 80 }),
        widgetToolCall("sandbox_drag", { sessionId: blockId, startX: 40, startY: 40, endX: 180, endY: 120 }),
        widgetToolCall("sandbox_scroll", { sessionId: blockId, direction: "down", count: 3, x: 120, y: 80 }),
        widgetToolCall("sandbox_type", { sessionId: blockId, text: "text" }),
        widgetToolCall("sandbox_press", { sessionId: blockId, keys: ["Enter"] }),
    ];
}

function buildAppStreamShortcuts(blockId: string): string[] {
    return [
        widgetToolCall("kron_computer_get_app_state", { app: "App Name" }),
        widgetToolCall("kron_computer_click", { app: "App Name", x: 120, y: 80 }),
        widgetToolCall("kron_computer_drag", { app: "App Name", fromX: 40, fromY: 40, toX: 180, toY: 120 }),
        `App stream block: ${blockId}`,
    ];
}

export function isAgentWidgetShortcutView(view: string | undefined): boolean {
    return WidgetControlViews.has(view ?? "");
}

export function buildAgentWidgetShortcutText(blockId: string, view: string | undefined): string {
    const lines = [`Agent widget shortcuts for block ${blockId}`];
    if (view !== "appstream") {
        lines.push("", "Start by mapping visible targets:", ...buildWidgetToolShortcuts(blockId));
    }
    if (view === "sandbox") {
        lines.push("", "Sandbox desktop controls:", ...buildSandboxDesktopShortcuts(blockId));
    }
    if (view === "appstream") {
        lines.push("", "Native app stream controls:", ...buildAppStreamShortcuts(blockId));
    }
    return lines.join("\n");
}
