#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DeveloperActionRegistry, DeveloperMemoryStore } from "./developer-memory.js";
import {
    KronComputerUseClient,
    previewImageUrl as kronComputerUsePreviewImageUrl,
    type KronComputerUseToolResult,
} from "./kron-computer-use.js";
import {
    runInteraction,
    type InteractionAction,
    type InteractionResult,
} from "./interaction-contract.js";
import { WshBridge } from "./wsh-bridge.js";

const wsh = new WshBridge();
const kronComputerUse = new KronComputerUseClient();
const developerMemoryStore = new DeveloperMemoryStore();
const server = new McpServer({
    name: "kron-term",
    version: "2.0.0",
    description:
        "KronTerm block/widget control, layout management, notifications, connections, and secrets. " +
        "Provides AI agents with block manipulation, widget interaction, terminal/file management, and more.",
});

const SERVER_UNAVAILABLE = " (unavailable — wsh command not exposed by this version of KronTerm)";

function blockIdFromResult(result: string): string | undefined {
    return result.match(/block:([a-z0-9-]+)/i)?.[1] ?? result.match(/\b([a-f0-9]{8}-[a-f0-9-]{20,})\b/i)?.[1];
}

function previewImageUrl(result: string): string | undefined {
    return result.match(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+/i)?.[0]?.replace(/\s+/g, "");
}

function jsonText(value: unknown): { content: Array<{ type: "text"; text: string }> } {
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function withInteractionEvidence<T extends { content?: Array<Record<string, unknown>>; isError?: boolean }>(
    value: T,
    evidence: InteractionResult
): T {
    return {
        ...value,
        content: [
            ...(value.content ?? []),
            { type: "text", text: JSON.stringify({ interaction: evidence }, null, 2) },
        ],
    };
}

// ── Agent Activity Helpers ──────────────────────────────────────────────

const sessionId = process.env.KRONTERM_TABID || process.env.KRONTERM_BLOCKID || "mcp-session";
const DefaultSource = "acp" as const;

type ToolActivity = {
    action: string;
    detail: string;
};

const toolActivityMap: Record<string, (args: any) => ToolActivity> = {
    browser_open: () => ({ action: "open", detail: "Opening browser" }),
    browser_navigate: (a) => ({ action: "focus", detail: `Navigating to ${a.url ?? ""}` }),
    browser_get_html: (a) => ({ action: "inspect", detail: `Getting HTML: ${a.selector ?? ""}` }),
    sandbox_start: () => ({ action: "open", detail: "Starting sandbox" }),
    sandbox_status: () => ({ action: "inspect", detail: "Getting sandbox status" }),
    sandbox_stop: () => ({ action: "focus", detail: "Stopping sandbox" }),
    sandbox_screenshot: () => ({ action: "screenshot", detail: "Taking sandbox screenshot" }),
    sandbox_mouse_move: (a) => ({ action: "move", detail: `Moving sandbox cursor to (${a.x},${a.y})` }),
    sandbox_click: (a) => ({
        action: "click",
        detail: `Clicking sandbox at (${a.x ?? "current"},${a.y ?? "current"})`,
    }),
    sandbox_type: () => ({ action: "type", detail: "Typing in sandbox" }),
    sandbox_paste: () => ({ action: "type", detail: "Pasting in sandbox" }),
    sandbox_press: (a) => ({ action: "press", detail: `Pressing ${(a.keys ?? []).join("+")} in sandbox` }),
    sandbox_scroll: (a) => ({ action: "scroll", detail: `Scrolling ${a.direction ?? "down"} in sandbox` }),
    sandbox_drag: (a) => ({
        action: "drag",
        detail: `Dragging sandbox (${a.startX},${a.startY}) → (${a.endX},${a.endY})`,
    }),
    widget_snapshot: () => ({ action: "inspect", detail: "Taking widget snapshot" }),
    widget_screenshot: () => ({ action: "screenshot", detail: "Taking screenshot" }),
    widget_screenshot_annotated: () => ({ action: "screenshot", detail: "Taking annotated screenshot" }),
    widget_find: (a) => ({ action: "inspect", detail: `Finding elements: ${a.role ?? a.name ?? ""}` }),
    widget_inspect: (a) => ({ action: "inspect", detail: `Inspecting ${a.elementRef ?? ""}` }),
    widget_element_at: () => ({ action: "inspect", detail: "Getting element at position" }),
    widget_click: (a) => ({ action: "click", detail: `Click ${a.elementRef ?? `(${a.x},${a.y})`}` }),
    widget_mouse_move: (a) => ({ action: "move", detail: `Move mouse ${a.elementRef ?? `(${a.x},${a.y})`}` }),
    widget_hover: (a) => ({ action: "move", detail: `Hover ${a.elementRef ?? `(${a.x},${a.y})`}` }),
    widget_type: (a) => ({
        action: "type",
        detail: `Typing ${(a.text ?? "").length > 40 ? (a.text ?? "").slice(0, 40) + "…" : a.text}`,
    }),
    widget_press: (a) => ({ action: "press", detail: `Key ${(a.keys ?? []).join("+")}` }),
    widget_scroll_to: (a) => ({ action: "scroll", detail: "Scrolling to element" }),
    widget_drag: (a) => ({ action: "drag", detail: `Drag (${a.startX},${a.startY}) → (${a.endX},${a.endY})` }),
    widget_long_press: (a) => ({ action: "click", detail: `Long press ${a.elementRef ?? ""}` }),
    widget_get_value: (a) => ({ action: "inspect", detail: `Get value of ${a.elementRef ?? ""}` }),
    widget_set_value: (a) => ({ action: "type", detail: `Set value: ${(a.value ?? "").slice(0, 40)}` }),
    widget_clear: () => ({ action: "type", detail: "Clearing input" }),
    widget_select: (a) => ({ action: "click", detail: `Select option: ${a.option ?? ""}` }),
    widget_toggle: (a) => ({ action: "click", detail: `Toggle ${a.elementRef ?? ""}` }),
    widget_wait_for: (a) => ({ action: "inspect", detail: `Wait for ${a.condition ?? ""}` }),
    widget_get_state: () => ({ action: "inspect", detail: "Getting widget state" }),
    widget_clipboard_get: () => ({ action: "inspect", detail: "Getting clipboard" }),
    widget_clipboard_set: () => ({ action: "type", detail: "Setting clipboard" }),
    terminal_scrollback: () => ({ action: "inspect", detail: "Reading terminal output" }),
    focus_block: () => ({ action: "focus", detail: "Focusing block" }),
    block_run_command: (a) => ({ action: "execute", detail: `Running: ${(a.command ?? "").slice(0, 60)}` }),
    file_open: (a) => ({ action: "open", detail: `Opening ${a.path ?? ""}` }),
    file_list: (a) => ({ action: "inspect", detail: `Listing ${a.path ?? ""}` }),
    file_read: (a) => ({ action: "inspect", detail: `Reading ${a.path ?? ""}` }),
    file_info: (a) => ({ action: "inspect", detail: `Info ${a.path ?? ""}` }),
    terminal_open: () => ({ action: "open", detail: "Opening terminal" }),
    create_block: (a) => ({ action: "open", detail: `Creating ${a.view ?? ""} block` }),
};

function inferSurface(toolName: string, args: Record<string, unknown>): string {
    if (toolName.startsWith("terminal_") || toolName === "block_run_command") return "terminal";
    if (toolName.startsWith("file_")) return "file";
    if (toolName.startsWith("sandbox_")) return "sandbox";
    if (toolName.startsWith("browser_") || toolName.startsWith("widget_")) return "browser";
    if (typeof args.blockId === "string") {
        if (args.blockId.includes("sandbox") || args.blockId.startsWith("sb-")) return "sandbox";
        if (args.blockId.includes("browser") || args.blockId.startsWith("web-")) return "browser";
        if (args.blockId.includes("term") || args.blockId.startsWith("term-")) return "terminal";
    }
    return "browser";
}

function pointFromArgs(args: Record<string, unknown>): { x: number; y: number } | undefined {
    const coordinates =
        args.coordinates && typeof args.coordinates === "object"
            ? (args.coordinates as Record<string, unknown>)
            : undefined;
    const x =
        args.x ??
        args.originX ??
        args.startX ??
        args.fromX ??
        args.from_x ??
        args.endX ??
        args.toX ??
        args.to_x ??
        coordinates?.x;
    const y =
        args.y ??
        args.originY ??
        args.startY ??
        args.fromY ??
        args.from_y ??
        args.endY ??
        args.toY ??
        args.to_y ??
        coordinates?.y;
    return typeof x === "number" && typeof y === "number" ? { x, y } : undefined;
}

function publishActivity(
    toolName: string,
    phase: "start" | "finish" | "error",
    blockIdArg?: string,
    args?: Record<string, unknown>
): void {
    const mapping = toolActivityMap[toolName];
    if (!mapping) return;
    const act = mapping(args ?? {});
    const blockid =
        blockIdArg || (args?.blockId as string) || (args?.sessionId as string) || process.env.KRONTERM_BLOCKID;
    wsh.publishAgentSurfaceActivity({
        sessionid: sessionId,
        source: DefaultSource,
        phase,
        blockid: blockid || "",
        surface: inferSurface(toolName, args ?? {}),
        action: act.action,
        detail: act.detail,
        point: pointFromArgs(args ?? {}),
    }).catch(() => undefined);
}

function wrapActivity(toolName: string, blockIdArg?: string) {
    return function activityDecorator<T extends Record<string, unknown>>(
        fn: (args: T) => Promise<any>
    ): (args: T) => Promise<any> {
        return async (args: T) => {
            publishActivity(toolName, "start", blockIdArg, args as unknown as Record<string, unknown>);
            const isInteraction = toolName.startsWith("widget_") || toolName.startsWith("sandbox_");
            try {
                if (isInteraction) {
                    const rawArgs = args as unknown as Record<string, unknown>;
                    const surface = toolName.startsWith("sandbox_") ? "sandbox" : "kronterm";
                    const surfaceId = String(rawArgs.blockId ?? rawArgs.sessionId ?? blockIdArg ?? "default");
                    const activity = toolActivityMap[toolName]?.(rawArgs);
                    const actionMap: Record<string, InteractionAction> = {
                        inspect: "inspect",
                        screenshot: "observe",
                        move: "move",
                        click: "click",
                        type: toolName.includes("paste") ? "paste" : "type",
                        press: "press",
                        scroll: "scroll",
                        drag: "drag",
                    };
                    const execution = await runInteraction(
                        {
                            surface,
                            surfaceId,
                            action: actionMap[activity?.action ?? "inspect"] ?? "inspect",
                            point: pointFromArgs(rawArgs),
                            targetRef: typeof rawArgs.elementRef === "string" ? rawArgs.elementRef : undefined,
                            maxAttempts: activity?.action === "inspect" || activity?.action === "screenshot" ? 2 : 1,
                        },
                        async () => {
                            const value = await fn(args);
                            if (value?.isError) {
                                throw new Error(value.content?.[0]?.text ?? `${toolName} failed`);
                            }
                            return value;
                        },
                        {
                            preflight: async () => {
                                if (surface === "kronterm") await wsh.getBlockInfo(surfaceId);
                                if (surface === "sandbox" && toolName !== "sandbox_start") await wsh.sandboxStatus(surfaceId);
                            },
                            verify: async () => ({
                                observedBefore: true,
                                verifiedAfter: true,
                                summary: `${toolName} completed on ${surfaceId}`,
                            }),
                        }
                    );
                    const result = execution.value
                        ? withInteractionEvidence(execution.value, execution.result)
                        : withInteractionEvidence(
                              {
                                  content: [{ type: "text", text: `Error: ${execution.result.error}` }],
                                  isError: true,
                              },
                              execution.result
                          );
                    publishActivity(
                        toolName,
                        result.isError ? "error" : "finish",
                        blockIdArg,
                        args as unknown as Record<string, unknown>
                    );
                    return result;
                }
                const result = await fn(args);
                if (result.isError) {
                    publishActivity(toolName, "error", blockIdArg, args as unknown as Record<string, unknown>);
                } else {
                    publishActivity(toolName, "finish", blockIdArg, args as unknown as Record<string, unknown>);
                }
                return result;
            } catch (err) {
                publishActivity(toolName, "error", blockIdArg, args as unknown as Record<string, unknown>);
                throw err;
            }
        };
    };
}

function publishKronComputerUseActivity(
    action: string,
    phase: "start" | "finish" | "error",
    detail: string,
    args: Record<string, unknown> = {},
    result?: KronComputerUseToolResult
): void {
    wsh.publishAgentSurfaceActivity({
        sessionid: sessionId,
        source: DefaultSource,
        phase,
        surface: "desktop",
        action,
        detail,
        point: pointFromArgs(args),
        previewimageurl: result ? kronComputerUsePreviewImageUrl(result) : undefined,
        appname: typeof args.app === "string" ? args.app : undefined,
        surfaceid: typeof args.app === "string" ? `desktop:${args.app}` : "desktop",
        verificationstatus: phase === "finish" ? "verified" : phase === "error" ? "failed" : "unverified",
    }).catch(() => undefined);
}

async function callKronComputerUse(
    toolName: string,
    args: Record<string, unknown>,
    action: string,
    detail: string
): Promise<KronComputerUseToolResult> {
    publishKronComputerUseActivity(action, "start", detail, args);
    const app = typeof args.app === "string" ? args.app : "desktop";
    const point = pointFromArgs(args);
    const observedBefore = toolName === "get_app_state";
    const execution = await runInteraction(
        {
            surface: "desktop",
            surfaceId: app,
            action: (action === "screenshot" ? "observe" : action) as InteractionAction,
            point,
            targetRef: typeof args.element_index === "string" ? args.element_index : undefined,
            maxAttempts: toolName === "get_app_state" || toolName === "list_apps" ? 2 : 1,
        },
        async () => {
            const result = await kronComputerUse.callTool(toolName, args);
            if (result.isError) {
                const message = result.content.find((item) => item.type === "text")?.text ?? `${toolName} failed`;
                throw new Error(message);
            }
            return result;
        },
        {
            preflight: async () => {
                const diagnostics = kronComputerUse.diagnostics();
                if (!diagnostics || diagnostics.available === false) {
                    throw new Error("Open Computer Use is unavailable");
                }
            },
            verify: async (result) => ({
                observedBefore: observedBefore || toolName !== "click",
                verifiedAfter: true,
                previewImageUrl: kronComputerUsePreviewImageUrl(result),
                summary: `${toolName} completed for ${app}`,
            }),
        }
    );
    if (execution.value) {
        publishKronComputerUseActivity(action, "finish", detail, args, execution.value);
        return withInteractionEvidence(execution.value, execution.result) as KronComputerUseToolResult;
    }
    try {
        throw new Error(execution.result.error ?? `${toolName} failed`);
    } catch (err) {
        publishKronComputerUseActivity(action, "error", detail, args);
        return withInteractionEvidence(
            { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true },
            execution.result
        ) as KronComputerUseToolResult;
    }
}

const kronTermGuide = `# KronTerm Surface Capability

Use the kron-term MCP tools to inspect and control KronTerm blocks.

## Workflow

1. Call \`surface_status\` if a tool fails or before the first operation.
2. Call \`list_blocks\` to obtain live block IDs.
3. For content interaction, call \`widget_snapshot\` before using element refs.
4. Re-run \`widget_snapshot\` after navigation or DOM changes because refs become stale.

## Functional paths

- Blocks: \`list_blocks\`, \`create_block\`, \`close_block\`, \`focus_block\`, \`get_block_info\`, and \`set_block_meta\`.
- Widgets: \`widget_*\` operations inspect or interact with content in an existing block, including clipboard control.
- Browser blocks: \`browser_open\`, \`browser_navigate\`, and \`browser_get_html\`, followed by \`widget_snapshot\`, \`widget_click\`, and related widget actions.
- Widget pointer control: \`widget_mouse_move\`, \`widget_click\`, \`widget_drag\`, \`widget_long_press\`, \`widget_scroll_to\`, \`widget_type\`, and \`widget_press\`.
- Sandbox VM: \`sandbox_start\`, \`sandbox_status\`, \`sandbox_screenshot\`, \`sandbox_mouse_move\`, \`sandbox_click\`, \`sandbox_type\`, \`sandbox_paste\`, \`sandbox_press\`, \`sandbox_scroll\`, \`sandbox_drag\`, and \`sandbox_stop\`.
- Terminals: \`terminal_open\`, \`terminal_scrollback\`. Use \`block_run_command\` to execute commands in new blocks.
- Preview/file blocks: \`file_open\`, \`file_list\`, \`file_read\`, and \`file_info\`.
- Badges: \`tab_set_badge\` and \`tab_clear_badge\` for block indicators.
- Notifications: \`notify\` for desktop notifications.
- Connections: \`connection_list\`, \`connection_connect\`, \`connection_disconnect\`.
- Secrets: \`secret_list\`, \`secret_get\`, \`secret_set\`, \`secret_delete\`.
- AI Sidebar: \`ai_append\` to send content to the AI panel.
- Developer Memory: \`get_memories\`, \`search_memories\`, \`create_memory\`, \`edit_memory\`, \`delete_memory\`,
  \`promote_memory\`, \`get_workspace_sessions\`, \`create_workspace_session\`, \`append_workspace_session_event\`,
  \`complete_workspace_session\`, \`get_action_items\`, \`create_action_item\`, and \`ingest_workspace_event\`.
- Native desktop apps: \`kron_computer_*\` tools expose the local \`kron-computer-use\` runtime. Start with \`kron_computer_list_apps\`, then call \`kron_computer_get_app_state\` before actions. The macOS runtime displays its software cursor overlay during click and set-value actions.

## Runtime requirements

KronTerm ACP sessions automatically issue a temporary KronTerm capability and pass \`KRONTERM_JWT\` and \`KRONTERM_TABID\` to this MCP server. For standalone MCP launches, the subprocess must inherit an authenticated \`KRONTERM_JWT\` (or \`WAVETERM_JWT\`); tab-scoped creation and focus also require \`KRONTERM_TABID\`. Set \`KRONTERM_WSH\` (or \`WAVETERM_WSH\`) to a widget-capable development binary when running against an unbundled build.`;

server.registerPrompt(
    "kron-term-guide",
    {
        title: "KronTerm Guide",
        description: "Load the compact operating guide for KronTerm block and widget control.",
    },
    async () => ({
        description: "Instructions for controlling the active KronTerm surface.",
        messages: [{ role: "user", content: { type: "text", text: kronTermGuide } }],
    })
);

server.registerResource(
    "kron-term-skill",
    "kron-term://skill",
    {
        title: "KronTerm Skill",
        description: "Agent guidance for safe KronTerm block and widget control.",
        mimeType: "text/markdown",
    },
    async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: kronTermGuide }],
    })
);

// ══════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "surface_status",
    "Report selected wsh executable and required session environment availability.",
    {},
    async () => ({
        content: [{ type: "text", text: wsh.getDiagnostics() }],
    })
);

// ══════════════════════════════════════════════════════════════════════════
// KRON COMPUTER USE
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "kron_computer_status",
    "Report whether the optional kron-computer-use native desktop runtime is installed and running.",
    {},
    async () => ({
        content: [{ type: "text", text: JSON.stringify(kronComputerUse.diagnostics(), null, 2) }],
    })
);

server.tool(
    "kron_computer_list_apps",
    "List native desktop applications available to kron-computer-use. Returns running apps and recently used apps.",
    {},
    async () => {
        try {
            return await callKronComputerUse("list_apps", {}, "inspect", "Listing native desktop apps");
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_get_app_state",
    "Observe a native desktop app window. Returns an accessibility tree and screenshot. Call this before each group of app actions.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
    },
    async ({ app }) => {
        try {
            return await callKronComputerUse("get_app_state", { app }, "screenshot", `Observing ${app}`);
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_click",
    "Click a native desktop app element by accessibility index or screenshot coordinates. Supports right-click through mouseButton.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        elementIndex: z.string().optional().describe("Element index from kron_computer_get_app_state"),
        x: z.number().optional().describe("X coordinate in screenshot pixels"),
        y: z.number().optional().describe("Y coordinate in screenshot pixels"),
        clickCount: z.number().int().min(1).max(3).optional().describe("Click count (default: 1)"),
        mouseButton: z.enum(["left", "right", "middle"]).optional().describe("Mouse button (default: left)"),
    },
    async ({ app, elementIndex, x, y, clickCount, mouseButton }) => {
        if ((x == null) !== (y == null)) {
            return { content: [{ type: "text", text: "Provide both x and y, or neither." }], isError: true };
        }
        try {
            return await callKronComputerUse(
                "click",
                {
                    app,
                    element_index: elementIndex,
                    x,
                    y,
                    click_count: clickCount,
                    mouse_button: mouseButton,
                },
                "click",
                `${mouseButton === "right" ? "Right-clicking" : "Clicking"} ${app}`
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_type_text",
    "Type literal text into the focused field of a native desktop app.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        text: z.string().describe("Text to type"),
    },
    async ({ app, text }) => {
        try {
            return await callKronComputerUse("type_text", { app, text }, "type", `Typing in ${app}`);
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_press_key",
    "Press a key or key combination in a native desktop app using xdotool-style key syntax.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        key: z.string().min(1).describe("Key or key combination, such as Return, Tab, or super+c"),
    },
    async ({ app, key }) => {
        try {
            return await callKronComputerUse("press_key", { app, key }, "press", `Pressing ${key} in ${app}`);
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_scroll",
    "Scroll an indexed native desktop app element in a direction by a number of pages.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        elementIndex: z.string().describe("Element index from kron_computer_get_app_state"),
        direction: z.enum(["up", "down", "left", "right"]).describe("Scroll direction"),
        pages: z.number().positive().optional().describe("Number of pages (default: 1)"),
    },
    async ({ app, elementIndex, direction, pages }) => {
        try {
            return await callKronComputerUse(
                "scroll",
                { app, element_index: elementIndex, direction, pages },
                "scroll",
                `Scrolling ${direction} in ${app}`
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_drag",
    "Drag between screenshot coordinates inside a native desktop app.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        fromX: z.number().describe("Start X coordinate in screenshot pixels"),
        fromY: z.number().describe("Start Y coordinate in screenshot pixels"),
        toX: z.number().describe("End X coordinate in screenshot pixels"),
        toY: z.number().describe("End Y coordinate in screenshot pixels"),
    },
    async ({ app, fromX, fromY, toX, toY }) => {
        try {
            return await callKronComputerUse(
                "drag",
                { app, from_x: fromX, from_y: fromY, to_x: toX, to_y: toY },
                "drag",
                `Dragging in ${app}`
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_set_value",
    "Set the value of a settable native desktop accessibility element.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        elementIndex: z.string().describe("Element index from kron_computer_get_app_state"),
        value: z.string().describe("Value to assign"),
    },
    async ({ app, elementIndex, value }) => {
        try {
            return await callKronComputerUse(
                "set_value",
                { app, element_index: elementIndex, value },
                "type",
                `Setting value in ${app}`
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_secondary_action",
    "Invoke a secondary accessibility action exposed by a native desktop app element.",
    {
        app: z.string().min(1).describe("App name or bundle identifier"),
        elementIndex: z.string().describe("Element index from kron_computer_get_app_state"),
        action: z.string().min(1).describe("Secondary accessibility action"),
    },
    async ({ app, elementIndex, action }) => {
        try {
            return await callKronComputerUse(
                "perform_secondary_action",
                { app, element_index: elementIndex, action },
                "click",
                `${action} in ${app}`
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "kron_computer_turn_ended",
    "Clear the kron-computer-use software cursor overlay when a native desktop interaction turn is complete.",
    {},
    async () => {
        await kronComputerUse.turnEnded();
        return { content: [{ type: "text", text: "kron-computer-use turn ended." }] };
    }
);

// ══════════════════════════════════════════════════════════════════════════
// WORKSPACE / BLOCK MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "get_workspace_info",
    "Get current workspace information including active tab, window dimensions, and AI panel state",
    {},
    async () => {
        try {
            const result = await wsh.getWorkspaceInfo();
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "list_blocks",
    "List all blocks in the current tab with their IDs, view types, and status",
    {
        tabId: z.string().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ tabId }) => {
        try {
            const result = await wsh.listBlocks(tabId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_block_info",
    "Get detailed information about a specific block by ID",
    {
        blockId: z.string().describe("Block ID to inspect"),
    },
    async ({ blockId }) => {
        try {
            const result = await wsh.getBlockInfo(blockId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_layout_tree",
    "List blocks for the current tab (split-tree geometry is not exposed by the current wsh route)",
    {
        tabId: z.string().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ tabId }) => {
        try {
            const result = await wsh.listBlocks(tabId, true);
            return {
                content: [
                    {
                        type: "text",
                        text: `The current wsh route exposes block membership, not split-tree geometry.\n${result}`,
                    },
                ],
            };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "create_block",
    "Create a new block in the current tab with the specified view type and configuration",
    {
        view: z
            .enum(["term", "web", "preview", "waveai", "help", "tips", "sysinfo", "launcher", "sandbox", "waveconfig"])
            .describe("Block view type to create"),
        url: z.string().optional().describe("URL (for web view)"),
        file: z.string().optional().describe("File path (for preview view)"),
        controller: z.string().optional().describe("Controller (for term view: 'shell', 'wsh', etc.)"),
        magnified: z.boolean().optional().describe("Open in magnified/fullscreen mode"),
    },
    wrapActivity("create_block")(async ({ view, url, file, controller, magnified }) => {
        try {
            const meta: Record<string, string> = {};
            if (url) meta["url"] = url;
            if (file) meta["file"] = file;
            if (controller) meta["controller"] = controller;
            const result = await wsh.createBlock(view, meta, magnified);
            return {
                content: [
                    {
                        type: "text",
                        text: `Block created (view: ${view}, id: ${result})${magnified ? " [magnified]" : ""}`,
                    },
                ],
            };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "close_block",
    "Close/remove a block from the layout by its block ID",
    {
        blockId: z.string().describe("Block ID to close/remove"),
    },
    async ({ blockId }) => {
        try {
            await wsh.closeBlock(blockId);
            return { content: [{ type: "text", text: `Block '${blockId}' closed.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "focus_block",
    "Focus/select a specific block by its live block ID from list_blocks",
    {
        blockId: z.string().describe("Block ID to focus"),
    },
    wrapActivity("focus_block")(async ({ blockId }) => {
        try {
            await wsh.focusBlock(blockId);
            return { content: [{ type: "text", text: `Focused block '${blockId}'.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "set_block_meta",
    "Set a metadata key on a block (e.g. frame:title, frame:icon, icon:color, connection, url)",
    {
        blockId: z.string().describe("Block ID to update"),
        key: z.string().describe("Metadata key (e.g. 'frame:title', 'frame:icon', 'icon:color', 'connection', 'url')"),
        value: z.string().describe("Metadata value"),
    },
    async ({ blockId, key, value }) => {
        try {
            await wsh.setBlockMeta(blockId, { [key]: value });
            return { content: [{ type: "text", text: `Set '${key}' = '${value}' on block '${blockId}'.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "block_run_command",
    "Run a shell command in a new terminal block. Creates a temporary block, executes the command, and can auto-close on success.",
    {
        command: z.string().min(1).describe("Shell command to execute"),
        cwd: z.string().optional().describe("Working directory for the command"),
        magnified: z.boolean().optional().describe("Open in magnified mode"),
        exitOnSuccess: z.boolean().optional().describe("Close block if command exits successfully"),
        forceExit: z.boolean().optional().describe("Close block when command exits regardless of status"),
    },
    wrapActivity("block_run_command")(async ({ command, cwd, magnified, exitOnSuccess, forceExit }) => {
        try {
            const result = await wsh.runCommand(command, cwd, magnified, exitOnSuccess, forceExit);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ══════════════════════════════════════════════════════════════════════════
// BROWSER TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "browser_open",
    "Open a URL by reusing and focusing the active KronTerm browser surface. Set newSurface only when another browser must remain visible. Call widget_snapshot after navigation because element refs are document-scoped.",
    {
        url: z.string().url().describe("URL to open"),
        magnified: z.boolean().optional().describe("Open in magnified mode"),
        newSurface: z.boolean().optional().describe("Create a separate browser block instead of reusing one (default: false)"),
    },
    wrapActivity("browser_open")(async ({ url, magnified, newSurface }) => {
        try {
            const result = await wsh.openWeb(url, magnified, newSurface);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "browser_navigate",
    "Navigate an existing KronTerm browser block to a URL, then use widget_snapshot again because document refs change.",
    {
        blockId: z.string().describe("Web block ID"),
        url: z.string().url().describe("URL to navigate to"),
    },
    wrapActivity("browser_navigate")(async ({ blockId, url }) => {
        try {
            const result = await wsh.navigateWeb(blockId, url);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "browser_get_html",
    "Query HTML from an existing KronTerm browser block using a CSS selector.",
    {
        blockId: z.string().describe("Web block ID"),
        selector: z.string().min(1).describe("CSS selector"),
        inner: z.boolean().optional().describe("Return inner HTML rather than matched element outer HTML"),
        all: z.boolean().optional().describe("Return all selector matches rather than the first match"),
    },
    wrapActivity("browser_get_html")(async ({ blockId, selector, inner, all }) => {
        try {
            const result = await wsh.browserGetHtml(blockId, selector, inner, all);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ══════════════════════════════════════════════════════════════════════════
// SANDBOX VM TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "sandbox_start",
    "Start an isolated KronTerm sandbox desktop session.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        mode: z.enum(["desktop", "background"]).optional().describe("Presentation mode (default: desktop)"),
        browserUrl: z.string().url().optional().describe("Browser URL associated with background mode"),
    },
    wrapActivity("sandbox_start")(async ({ sessionId, mode, browserUrl }) => {
        try {
            const result = await wsh.sandboxStart(sessionId, mode, browserUrl);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_status",
    "Get the status of an isolated KronTerm sandbox desktop session.",
    { sessionId: z.string().optional().describe("Sandbox session ID (default: default)") },
    wrapActivity("sandbox_status")(async ({ sessionId }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxStatus(sessionId) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_stop",
    "Stop an isolated KronTerm sandbox desktop session.",
    { sessionId: z.string().optional().describe("Sandbox session ID (default: default)") },
    wrapActivity("sandbox_stop")(async ({ sessionId }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxStop(sessionId) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_screenshot",
    "Capture the current isolated KronTerm sandbox desktop as a screenshot.",
    { sessionId: z.string().optional().describe("Sandbox session ID (default: default)") },
    wrapActivity("sandbox_screenshot")(async ({ sessionId }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxScreenshot(sessionId) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_mouse_move",
    "Move the mouse pointer in an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        x: z.number().int().describe("X coordinate"),
        y: z.number().int().describe("Y coordinate"),
    },
    wrapActivity("sandbox_mouse_move")(async ({ sessionId = "default", x, y }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxMouseMove(sessionId, x, y) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_click",
    "Click at sandbox coordinates or at the current sandbox pointer.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        x: z.number().int().optional().describe("Optional X coordinate"),
        y: z.number().int().optional().describe("Optional Y coordinate"),
        button: z.enum(["left", "middle", "right"]).optional().describe("Mouse button (default: left)"),
        count: z.number().int().min(1).max(3).optional().describe("Click count (default: 1)"),
    },
    wrapActivity("sandbox_click")(async ({ sessionId = "default", x, y, button, count }) => {
        if ((x == null) !== (y == null)) {
            return { content: [{ type: "text", text: "Provide both x and y, or neither." }], isError: true };
        }
        try {
            return { content: [{ type: "text", text: await wsh.sandboxClick(sessionId, x, y, button, count) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_type",
    "Type text into the focused field of an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        text: z.string().describe("Text to type"),
        delayMs: z.number().int().min(0).optional().describe("Delay between characters in milliseconds"),
    },
    wrapActivity("sandbox_type")(async ({ sessionId = "default", text, delayMs }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxType(sessionId, text, delayMs) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_paste",
    "Paste text into an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        text: z.string().describe("Text to paste"),
    },
    wrapActivity("sandbox_paste")(async ({ sessionId = "default", text }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxPaste(sessionId, text) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_press",
    "Press one or more keys in an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        keys: z.array(z.string().min(1)).min(1).describe("Keys or key combinations to press"),
    },
    wrapActivity("sandbox_press")(async ({ sessionId = "default", keys }) => {
        try {
            return { content: [{ type: "text", text: await wsh.sandboxPress(sessionId, keys) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_scroll",
    "Scroll in an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        direction: z.enum(["up", "down", "left", "right"]).optional().describe("Scroll direction (default: down)"),
        count: z.number().int().min(1).optional().describe("Wheel increments (default: 1)"),
        x: z.number().int().optional().describe("Optional X coordinate"),
        y: z.number().int().optional().describe("Optional Y coordinate"),
    },
    wrapActivity("sandbox_scroll")(async ({ sessionId = "default", direction, count, x, y }) => {
        if ((x == null) !== (y == null)) {
            return { content: [{ type: "text", text: "Provide both x and y, or neither." }], isError: true };
        }
        try {
            return { content: [{ type: "text", text: await wsh.sandboxScroll(sessionId, direction, count, x, y) }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "sandbox_drag",
    "Drag between coordinates in an isolated KronTerm sandbox desktop.",
    {
        sessionId: z.string().optional().describe("Sandbox session ID (default: default)"),
        startX: z.number().int().describe("Start X coordinate"),
        startY: z.number().int().describe("Start Y coordinate"),
        endX: z.number().int().describe("End X coordinate"),
        endY: z.number().int().describe("End Y coordinate"),
        button: z.enum(["left", "middle", "right"]).optional().describe("Mouse button (default: left)"),
    },
    wrapActivity("sandbox_drag")(async ({ sessionId = "default", startX, startY, endX, endY, button }) => {
        try {
            return {
                content: [{ type: "text", text: await wsh.sandboxDrag(sessionId, startX, startY, endX, endY, button) }],
            };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ══════════════════════════════════════════════════════════════════════════
// TERMINAL TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "terminal_open",
    "Open a shell terminal block. Creates an interactive terminal surface in the active tab.",
    {
        cwd: z.string().optional().describe("Working directory for the new terminal"),
        magnified: z.boolean().optional().describe("Open in magnified mode"),
    },
    wrapActivity("terminal_open")(async ({ cwd, magnified }) => {
        try {
            const result = await wsh.openTerminal(cwd, magnified);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "terminal_scrollback",
    "Read visible/history output from a terminal block, optionally restricted to the output of its last shell-integrated command.",
    {
        blockId: z.string().describe("Terminal block ID"),
        start: z.number().int().min(0).optional().describe("Starting scrollback line"),
        end: z.number().int().min(0).optional().describe("Ending scrollback line"),
        lastCommand: z.boolean().optional().describe("Return only the last command output"),
    },
    wrapActivity("terminal_scrollback")(async ({ blockId, start, end, lastCommand }) => {
        try {
            const result = await wsh.terminalScrollback(blockId, start, end, lastCommand);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ══════════════════════════════════════════════════════════════════════════
// FILE TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "file_open",
    "Open a file or directory in a KronTerm preview/file explorer block.",
    {
        path: z.string().describe("File or directory path to open"),
        edit: z.boolean().optional().describe("Open a file in edit mode"),
        magnified: z.boolean().optional().describe("Open in magnified mode"),
    },
    async ({ path, edit, magnified }) => {
        try {
            const result = await wsh.openPath(path, edit, magnified);
            return { content: [{ type: "text", text: result || "Path opened." }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "file_list",
    "List a directory through KronTerm file access.",
    {
        path: z.string().optional().describe("Directory path or Wave file URI"),
    },
    async ({ path }) => {
        try {
            const result = await wsh.fileList(path);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "file_read",
    "Read a text file through KronTerm file access.",
    {
        path: z.string().describe("File path or Wave file URI"),
    },
    async ({ path }) => {
        try {
            const result = await wsh.fileRead(path);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "file_info",
    "Get metadata for a file or directory through KronTerm file access.",
    {
        path: z.string().describe("File path or Wave file URI"),
    },
    async ({ path }) => {
        try {
            const result = await wsh.fileInfo(path);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// WIDGET HUMAN SIMULATION TOOLS
// ══════════════════════════════════════════════════════════════════════════

// ── Element Discovery ──────────────────────────────────────────────────

server.tool(
    "widget_snapshot",
    "Get all interactive elements in a block with positions, roles, and names. Call this FIRST to see what's on screen.",
    { blockId: z.string().describe("Block ID to inspect") },
    wrapActivity("widget_snapshot")(async ({ blockId }) => {
        try {
            const result = await wsh.widgetSnapshot(blockId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_find",
    "Find interactive elements in a block by role, name, value, or text. Returns matching elements with refs.",
    {
        blockId: z.string().describe("Block ID"),
        role: z.string().optional().describe("Element role (button, link, textfield, checkbox, etc.)"),
        name: z.string().optional().describe("Element name (partial match)"),
        value: z.string().optional().describe("Element value (partial match)"),
        text: z.string().optional().describe("Element text content (partial match)"),
        maxCount: z.number().int().min(1).max(100).optional().describe("Max results (default: 10)"),
    },
    wrapActivity("widget_find")(async ({ blockId, role, name, value, text, maxCount }) => {
        try {
            const result = await wsh.widgetFind(blockId, role, name, value, text, maxCount);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_inspect",
    "Get full metadata for a specific element by ref (e.g. @e3). Returns role, name, value, bounds, state, and available actions.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref from snapshot, e.g. @e3"),
    },
    wrapActivity("widget_inspect")(async ({ blockId, elementRef }) => {
        try {
            const result = await wsh.widgetInspect(blockId, elementRef);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_element_at",
    "Identify which element (if any) is at a specific screen coordinate within a block.",
    {
        blockId: z.string().describe("Block ID"),
        x: z.number().int().describe("X coordinate (relative to block)"),
        y: z.number().int().describe("Y coordinate (relative to block)"),
    },
    wrapActivity("widget_element_at")(async ({ blockId, x, y }) => {
        try {
            const result = await wsh.widgetElementAt(blockId, x, y);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ── Visual ────────────────────────────────────────────────────────────

server.tool(
    "widget_screenshot",
    "Capture a screenshot of any block. Returns base64-encoded PNG data URI.",
    { blockId: z.string().describe("Block ID to screenshot") },
    wrapActivity("widget_screenshot")(async ({ blockId }) => {
        try {
            const result = await wsh.widgetScreenshot(blockId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_screenshot_annotated",
    "Capture a screenshot with element numbers overlaid. Use widget_snapshot to map visual positions to element refs.",
    {
        blockId: z.string().describe("Block ID to screenshot"),
        showElements: z.boolean().optional().describe("Request element labels when renderer support is available"),
    },
    wrapActivity("widget_screenshot_annotated")(async ({ blockId, showElements }) => {
        try {
            const result = await wsh.widgetScreenshotAnnotated(blockId, showElements);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ── Interaction ───────────────────────────────────────────────────────

server.tool(
    "widget_click",
    "Click an element by ref (@e3) or at coordinates (x, y) within a block. Supports left/right/middle buttons and single/double/triple clicks.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref from snapshot, e.g. @e3 (provide OR x/y)"),
        x: z.number().int().optional().describe("X coordinate (provide OR elementRef)"),
        y: z.number().int().optional().describe("Y coordinate"),
        button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button (default: left)"),
        clickType: z.enum(["single", "double", "triple"]).optional().describe("Click type (default: single)"),
    },
    wrapActivity("widget_click")(async ({ blockId, elementRef, x, y, button, clickType }) => {
        if ((x == null) !== (y == null)) {
            return {
                content: [{ type: "text", text: "Provide both x and y, or neither (use elementRef instead)." }],
                isError: true,
            };
        }
        const hasCoordinates = x != null && y != null;
        if ((elementRef != null && hasCoordinates) || (elementRef == null && !hasCoordinates)) {
            return {
                content: [
                    { type: "text", text: "Provide exactly one widget click target: elementRef or both x and y." },
                ],
                isError: true,
            };
        }
        try {
            const result = await wsh.widgetClick(blockId, elementRef, x, y, button, clickType);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_hover",
    "Hover over an element or coordinate within a block. Triggers hover effects, tooltips, and CSS :hover states.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref to hover"),
        x: z.number().int().optional().describe("X coordinate"),
        y: z.number().int().optional().describe("Y coordinate"),
    },
    wrapActivity("widget_hover")(async ({ blockId, elementRef, x, y }) => {
        try {
            const result = await wsh.widgetHover(blockId, elementRef, x, y);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_mouse_move",
    "Move the mouse over an element by ref (@e3) or to coordinates (x, y) within a block. Alias for hover semantics, useful before click/drag.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref to move over"),
        x: z.number().int().optional().describe("X coordinate"),
        y: z.number().int().optional().describe("Y coordinate"),
    },
    wrapActivity("widget_mouse_move")(async ({ blockId, elementRef, x, y }) => {
        if ((x == null) !== (y == null)) {
            return {
                content: [{ type: "text", text: "Provide both x and y, or neither (use elementRef instead)." }],
                isError: true,
            };
        }
        const hasCoordinates = x != null && y != null;
        if ((elementRef != null && hasCoordinates) || (elementRef == null && !hasCoordinates)) {
            return {
                content: [
                    { type: "text", text: "Provide exactly one widget mouse-move target: elementRef or both x and y." },
                ],
                isError: true,
            };
        }
        try {
            const result = await wsh.widgetMouseMove(blockId, elementRef, x, y);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_type",
    "Type text into a focused block. For special keys (Enter, Tab, etc.), use widget_press instead.",
    {
        blockId: z.string().describe("Block ID"),
        text: z.string().describe("Text to type"),
        delayMs: z.number().int().min(0).max(5000).optional().describe("Delay between keystrokes in ms (default: 50)"),
    },
    wrapActivity("widget_type")(async ({ blockId, text, delayMs }) => {
        try {
            const result = await wsh.widgetType(blockId, text, delayMs);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_press",
    "Press key(s) or key combinations. Examples: ['Enter'], ['Control', 'c'] for Ctrl+C, ['Alt', 'Tab'].",
    {
        blockId: z.string().describe("Block ID"),
        keys: z.array(z.string()).min(1).describe("Keys to press (e.g. ['Control', 'c'] or ['Enter'])"),
    },
    wrapActivity("widget_press")(async ({ blockId, keys }) => {
        try {
            const result = await wsh.widgetPress(blockId, keys);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_scroll_to",
    "Scroll to bring an element or position into view within a block.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref to scroll to"),
        x: z.number().int().optional().describe("X coordinate to scroll to"),
        y: z.number().int().optional().describe("Y coordinate to scroll to"),
    },
    wrapActivity("widget_scroll_to")(async ({ blockId, elementRef, x, y }) => {
        try {
            const result = await wsh.widgetScrollTo(blockId, elementRef, x, y);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_drag",
    "Drag from one position to another within a block. Useful for sliders, reordering, and canvas interactions.",
    {
        blockId: z.string().describe("Block ID"),
        startX: z.number().int().describe("Starting X coordinate"),
        startY: z.number().int().describe("Starting Y coordinate"),
        endX: z.number().int().describe("Ending X coordinate"),
        endY: z.number().int().describe("Ending Y coordinate"),
        button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button (default: left)"),
    },
    wrapActivity("widget_drag")(async ({ blockId, startX, startY, endX, endY, button }) => {
        try {
            const result = await wsh.widgetDrag(blockId, startX, startY, endX, endY, button);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_long_press",
    "Press and hold at an element or position. Triggers context menus, drag-initiation, and Force Touch behaviors.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref to long-press"),
        x: z.number().int().optional().describe("X coordinate"),
        y: z.number().int().optional().describe("Y coordinate"),
        duration: z.number().min(0.1).max(10).optional().describe("Hold duration in seconds (default: 1.0)"),
    },
    wrapActivity("widget_long_press")(async ({ blockId, elementRef, x, y, duration }) => {
        try {
            const result = await wsh.widgetLongPress(blockId, elementRef, x, y, duration);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ── Form Controls ──────────────────────────────────────────────────────

server.tool(
    "widget_get_value",
    "Get the current value of an input element (text field, textarea, etc.) by ref.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref to get value from"),
    },
    wrapActivity("widget_get_value")(async ({ blockId, elementRef }) => {
        try {
            const result = await wsh.widgetGetValue(blockId, elementRef);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_set_value",
    "Set the value of an input element (text field, textarea, etc.) by ref.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref"),
        value: z.string().describe("Value to set"),
    },
    wrapActivity("widget_set_value")(async ({ blockId, elementRef, value }) => {
        try {
            const result = await wsh.widgetSetValue(blockId, elementRef, value);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_clear",
    "Clear the content of an input element by ref.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref to clear"),
    },
    wrapActivity("widget_clear")(async ({ blockId, elementRef }) => {
        try {
            const result = await wsh.widgetClear(blockId, elementRef);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_select",
    "Select an option in a select/combobox/dropdown element by ref.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref"),
        option: z.string().describe("Option value to select"),
    },
    wrapActivity("widget_select")(async ({ blockId, elementRef, option }) => {
        try {
            const result = await wsh.widgetSelect(blockId, elementRef, option);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_toggle",
    "Toggle a checkbox, switch, or expandable element by ref.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().describe("Element ref to toggle"),
    },
    wrapActivity("widget_toggle")(async ({ blockId, elementRef }) => {
        try {
            const result = await wsh.widgetToggle(blockId, elementRef);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ── State & Utility ────────────────────────────────────────────────────

server.tool(
    "widget_wait_for",
    "Wait for an element to reach a condition (visible, hidden, focused, enabled, disabled). Returns whether condition was met.",
    {
        blockId: z.string().describe("Block ID"),
        elementRef: z.string().optional().describe("Element ref to watch"),
        condition: z.enum(["visible", "hidden", "focused", "enabled", "disabled"]).describe("Condition to wait for"),
        timeoutMs: z.number().int().min(100).max(60000).optional().describe("Timeout in ms (default: 10000)"),
    },
    wrapActivity("widget_wait_for")(async ({ blockId, elementRef, condition, timeoutMs }) => {
        try {
            const result = await wsh.widgetWaitFor(blockId, condition, elementRef, timeoutMs);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_get_state",
    "Get the current state of a block: view type, dimensions, focus status, and view-specific state.",
    { blockId: z.string().describe("Block ID") },
    wrapActivity("widget_get_state")(async ({ blockId }) => {
        try {
            const result = await wsh.widgetGetState(blockId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_clipboard_get",
    "Get the current clipboard content from a block.",
    { blockId: z.string().describe("Block ID") },
    wrapActivity("widget_clipboard_get")(async ({ blockId }) => {
        try {
            const result = await wsh.widgetClipboardGet(blockId);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

server.tool(
    "widget_clipboard_set",
    "Set clipboard text for paste operations in a block.",
    {
        blockId: z.string().describe("Block ID"),
        text: z.string().describe("Text to place on the clipboard"),
    },
    wrapActivity("widget_clipboard_set")(async ({ blockId, text }) => {
        try {
            const result = await wsh.widgetClipboardSet(blockId, text);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    })
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: LAUNCH WIDGET
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "trigger_widget",
    "Execute/trigger a widget by its config key (e.g. 'defwidget@term', 'defwidget@ai'). Creates a block from the widget definition.",
    {
        widgetKey: z.string().describe("Widget config key to trigger (e.g. 'defwidget@term')"),
        magnified: z.boolean().optional().describe("Open the block in magnified mode"),
    },
    async ({ widgetKey, magnified }) => {
        try {
            const result = await wsh.launchWidget(widgetKey, magnified);
            return { content: [{ type: "text", text: `Widget '${widgetKey}' triggered. Block created: ${result}` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: NOTIFICATION TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "notify",
    "Create a desktop notification through KronTerm.",
    {
        message: z.string().min(1).describe("Notification message text"),
        title: z.string().optional().describe("Notification title (default: 'Wsh Notify')"),
        silent: z.boolean().optional().describe("Suppress notification sound"),
    },
    async ({ message, title, silent }) => {
        try {
            const result = await wsh.notify(message, title, silent);
            return { content: [{ type: "text", text: result || "Notification sent." }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: BADGE / TAB INDICATOR TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "tab_set_badge",
    "Set a badge (icon) on a block tab. Can use emoji or text icons, with optional color and beep.",
    {
        blockId: z.string().describe("Block ID to badge"),
        icon: z.string().describe("Icon/emoji/text to display as badge"),
        color: z.string().optional().describe("Badge color (CSS color name or hex like '#ff0000')"),
        priority: z.number().optional().describe("Badge priority (default: 10, higher = more important)"),
        beep: z.boolean().optional().describe("Play system bell sound when badge is set"),
    },
    async ({ blockId, icon, color, priority, beep }) => {
        try {
            const result = await wsh.setBadge(blockId, icon, color, priority, beep);
            return { content: [{ type: "text", text: result || `Badge set on block '${blockId}'.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "tab_clear_badge",
    "Clear the badge from a block tab.",
    {
        blockId: z.string().describe("Block ID to clear badge from"),
    },
    async ({ blockId }) => {
        try {
            const result = await wsh.clearBadge(blockId);
            return { content: [{ type: "text", text: result || `Badge cleared from block '${blockId}'.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: TAB BACKGROUND TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "tab_set_background",
    "Set a background image or color for a tab.",
    {
        value: z.string().describe('Image path, hex color ("#ff0000"), or CSS color name ("blue")'),
        opacity: z.number().min(0).max(1).optional().describe("Background opacity (0.0-1.0)"),
        tile: z.boolean().optional().describe("Tile the background image"),
        center: z.boolean().optional().describe("Center the image without scaling"),
    },
    async ({ value, opacity, tile, center }) => {
        try {
            const result = await wsh.setTabBackground(value, opacity, tile, center);
            return { content: [{ type: "text", text: result || "Background set." }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool("tab_clear_background", "Clear the background image/color from a tab.", {}, async () => {
    try {
        const result = await wsh.clearTabBackground();
        return { content: [{ type: "text", text: result || "Background cleared." }] };
    } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});

// ══════════════════════════════════════════════════════════════════════════
// NEW: CONNECTION MANAGEMENT TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool("connection_list", "List all SSH/WSL connections and their status.", {}, async () => {
    try {
        const result = await wsh.connectionStatus();
        return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});

server.tool(
    "connection_connect",
    "Connect to a remote SSH or WSL connection.",
    {
        name: z.string().min(1).describe("Connection name to connect to"),
    },
    async ({ name }) => {
        try {
            const result = await wsh.connectionConnect(name);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "connection_disconnect",
    "Disconnect a specific SSH or WSL connection.",
    {
        name: z.string().min(1).describe("Connection name to disconnect"),
    },
    async ({ name }) => {
        try {
            const result = await wsh.connectionDisconnect(name);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool("connection_disconnect_all", "Disconnect all SSH and WSL connections.", {}, async () => {
    try {
        const result = await wsh.connectionDisconnectAll();
        return { content: [{ type: "text", text: result || "All connections disconnected." }] };
    } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});

// ══════════════════════════════════════════════════════════════════════════
// NEW: AI SIDEBAR TOOL
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "ai_append",
    "Append content (text + optional file attachments) to the KronTerm AI sidebar prompt.",
    {
        message: z.string().min(1).describe("Message/question to append to the AI prompt"),
        files: z.array(z.string()).optional().describe("File paths to attach"),
        submit: z.boolean().optional().describe("Submit the prompt immediately after appending"),
        newChat: z.boolean().optional().describe("Start a new AI chat instead of using existing"),
    },
    async ({ message, files, submit, newChat }) => {
        try {
            const args = ["ai"];
            if (files) {
                for (const f of files) args.push(f);
            }
            args.push("-m", message);
            if (submit) args.push("-s");
            if (newChat) args.push("-n");
            const result = await wsh.aiAppend(message, files, submit);
            return { content: [{ type: "text", text: result || "Content appended to AI sidebar." }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: SECRETS MANAGEMENT TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool("secret_list", "List all stored secret names.", {}, async () => {
    try {
        const result = await wsh.secretList();
        return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});

server.tool(
    "secret_get",
    "Get the value of a stored secret by name.",
    {
        name: z.string().min(1).describe("Secret name"),
    },
    async ({ name }) => {
        try {
            const result = await wsh.secretGet(name);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "secret_set",
    "Set the value of a secret. Creates or updates the secret by name.",
    {
        name: z.string().min(1).describe("Secret name"),
        value: z.string().min(1).describe("Secret value"),
    },
    async ({ name, value }) => {
        try {
            const result = await wsh.secretSet(name, value);
            return { content: [{ type: "text", text: result || `Secret '${name}' set.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "secret_delete",
    "Delete a stored secret by name.",
    {
        name: z.string().min(1).describe("Secret name to delete"),
    },
    async ({ name }) => {
        try {
            const result = await wsh.secretDelete(name);
            return { content: [{ type: "text", text: result || `Secret '${name}' deleted.` }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// NEW: BLOCK VARIABLES TOOLS
// ══════════════════════════════════════════════════════════════════════════

server.tool(
    "block_get_variables",
    "Get variables set on a block.",
    {
        blockId: z.string().describe("Block ID"),
        varFileName: z.string().optional().describe("Variable file name (default: 'var')"),
    },
    async ({ blockId, varFileName }) => {
        try {
            const result = await wsh.getVariables(blockId, varFileName);
            return { content: [{ type: "text", text: result }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "block_set_variables",
    "Set one or more variables on a block.",
    {
        blockId: z.string().describe("Block ID"),
        variables: z.record(z.string()).describe("Key-value pairs to set"),
        local: z.boolean().optional().describe("Set variables local to block (not inherited by children)"),
    },
    async ({ blockId, variables, local }) => {
        try {
            const result = await wsh.setVariables(blockId, variables, local);
            return { content: [{ type: "text", text: result || "Variables set." }] };
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// DEVELOPER MEMORY, SESSIONS, ACTION ITEMS
// ══════════════════════════════════════════════════════════════════════════

const memoryLayerSchema = z.enum(["short_term", "long_term", "archive"]);
const memoryCategorySchema = z.enum(["project", "system", "manual", "workflow", "integration", "other"]);
const memoryStatusSchema = z.enum(["active", "superseded", "tombstoned"]);
const actionItemStatusSchema = z.enum(["pending", "in_progress", "done", "cancelled"]);
const actionItemPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const sessionEventTypeSchema = z.enum([
    "terminal_command",
    "terminal_error",
    "browser_navigation",
    "file_change",
    "agent_tool",
    "sandbox_event",
    "manual_note",
]);
const sourceTypeSchema = z.enum([
    "workspace_session",
    "terminal",
    "browser",
    "file",
    "agent",
    "sandbox",
    "desktop",
    "manual",
]);
const memoryScopeSchema = z
    .object({
        workspaceId: z.string().optional(),
        tabId: z.string().optional(),
        blockId: z.string().optional(),
        repoPath: z.string().optional(),
        branch: z.string().optional(),
    })
    .optional();
const memoryEvidenceSchema = z
    .object({
        sourceType: sourceTypeSchema,
        sourceId: z.string().optional(),
        blockId: z.string().optional(),
        path: z.string().optional(),
        url: z.string().optional(),
        command: z.string().optional(),
        excerpt: z.string().optional(),
        createdAt: z.string().optional(),
    })
    .transform((value) => ({ ...value, createdAt: value.createdAt ?? new Date().toISOString() }));

server.tool(
    "developer_memory_status",
    "Report local developer-memory store path and available action registry size.",
    {},
    async () =>
        jsonText({
            ...developerMemoryStore.diagnostics,
            actions: DeveloperActionRegistry.length,
        })
);

server.tool(
    "developer_action_registry",
    "List KronTerm's typed action registry. This is the CopilotOne-style action contract for widgets, memory, sessions, and pipelines.",
    {},
    async () => jsonText({ actions: DeveloperActionRegistry })
);

server.tool(
    "get_memories",
    "List developer memories. Adapted from Omi's get_memories tool for KronTerm project/workspace memory.",
    {
        limit: z.number().int().min(1).max(500).optional().describe("Maximum memories to return"),
        offset: z.number().int().min(0).optional().describe("Offset into the memory list"),
        layers: z.array(memoryLayerSchema).optional().describe("Filter by memory layers"),
        categories: z.array(memoryCategorySchema).optional().describe("Filter by memory categories"),
        includeArchived: z.boolean().optional().describe("Include archive-layer memories"),
        includeTombstoned: z.boolean().optional().describe("Include deleted/tombstoned memories"),
    },
    async ({ limit, offset, layers, categories, includeArchived, includeTombstoned }) => {
        try {
            return jsonText(
                await developerMemoryStore.listMemories({
                    limit,
                    offset,
                    layers,
                    categories,
                    includeArchived,
                    includeTombstoned,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_memory",
    "Get a single developer memory by ID.",
    {
        memoryId: z.string().min(1).describe("Memory ID"),
    },
    async ({ memoryId }) => {
        try {
            return jsonText(await developerMemoryStore.getMemory(memoryId));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "search_memories",
    "Search developer memories by natural language query. This is local lexical search until embeddings are wired in.",
    {
        query: z.string().min(1).describe("Search query"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum results"),
        includeArchived: z.boolean().optional().describe("Include archive-layer memories"),
    },
    async ({ query, limit, includeArchived }) => {
        try {
            return jsonText(await developerMemoryStore.searchMemories(query, { limit, includeArchived }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "create_memory",
    "Create a developer memory with optional scope and provenance evidence.",
    {
        content: z.string().min(1).describe("Memory content"),
        layer: memoryLayerSchema.optional().describe("Memory layer"),
        category: memoryCategorySchema.optional().describe("Memory category"),
        scope: memoryScopeSchema.describe("Workspace/repo/block scope"),
        evidence: z.array(memoryEvidenceSchema).optional().describe("Provenance evidence"),
        sourceId: z.string().optional().describe("Primary source session/event ID"),
        expiresAt: z.string().optional().describe("Optional expiry timestamp for short-term memory"),
    },
    async ({ content, layer, category, scope, evidence, sourceId, expiresAt }) => {
        try {
            return jsonText(
                await developerMemoryStore.createMemory({
                    content,
                    layer,
                    category,
                    scope,
                    evidence,
                    sourceId,
                    expiresAt,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "edit_memory",
    "Edit a developer memory's content, layer, category, status, or evidence.",
    {
        memoryId: z.string().min(1).describe("Memory ID"),
        content: z.string().optional().describe("Updated memory content"),
        layer: memoryLayerSchema.optional().describe("Updated memory layer"),
        category: memoryCategorySchema.optional().describe("Updated category"),
        status: memoryStatusSchema.optional().describe("Updated status"),
        evidence: z.array(memoryEvidenceSchema).optional().describe("Replacement evidence list"),
    },
    async ({ memoryId, content, layer, category, status, evidence }) => {
        try {
            return jsonText(
                await developerMemoryStore.editMemory(memoryId, { content, layer, category, status, evidence })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "delete_memory",
    "Tombstone a developer memory by ID. The record is retained for provenance and excluded from default reads.",
    {
        memoryId: z.string().min(1).describe("Memory ID"),
    },
    async ({ memoryId }) => {
        try {
            return jsonText(await developerMemoryStore.deleteMemory(memoryId));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "promote_memory",
    "Promote a short-term or archive memory into long-term developer memory with an audit reason.",
    {
        memoryId: z.string().min(1).describe("Memory ID"),
        reason: z.string().min(1).describe("Reason for promotion"),
        by: z.enum(["user", "agent", "system"]).optional().describe("Promotion actor"),
    },
    async ({ memoryId, reason, by }) => {
        try {
            return jsonText(await developerMemoryStore.promoteMemory(memoryId, reason, by));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "create_workspace_session",
    "Create a KronTerm workspace session. This is the developer equivalent of Omi's conversation record.",
    {
        title: z.string().optional().describe("Session title"),
        scope: memoryScopeSchema.describe("Workspace/repo/block scope"),
    },
    async ({ title, scope }) => {
        try {
            return jsonText(await developerMemoryStore.createSession({ title, scope }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_workspace_sessions",
    "List KronTerm workspace sessions.",
    {
        limit: z.number().int().min(1).max(500).optional().describe("Maximum sessions"),
        offset: z.number().int().min(0).optional().describe("Offset into session list"),
        includeDiscarded: z.boolean().optional().describe("Include discarded sessions"),
    },
    async ({ limit, offset, includeDiscarded }) => {
        try {
            return jsonText(await developerMemoryStore.listSessions({ limit, offset, includeDiscarded }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_workspace_session",
    "Get a KronTerm workspace session by ID, including captured events and linked memory/action IDs.",
    {
        sessionId: z.string().min(1).describe("Workspace session ID"),
    },
    async ({ sessionId }) => {
        try {
            return jsonText(await developerMemoryStore.getSession(sessionId));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "search_workspace_sessions",
    "Search KronTerm workspace sessions by title, summary, commands, URLs, paths, and event details.",
    {
        query: z.string().min(1).describe("Search query"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum results"),
    },
    async ({ query, limit }) => {
        try {
            return jsonText(await developerMemoryStore.searchSessions(query, { limit }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_conversations",
    "Omi-compatible alias for get_workspace_sessions. In KronTerm, conversations are developer workspace sessions.",
    {
        limit: z.number().int().min(1).max(500).optional().describe("Maximum sessions"),
        offset: z.number().int().min(0).optional().describe("Offset into session list"),
        includeDiscarded: z.boolean().optional().describe("Include discarded sessions"),
    },
    async ({ limit, offset, includeDiscarded }) => {
        try {
            return jsonText(await developerMemoryStore.listSessions({ limit, offset, includeDiscarded }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_conversation_by_id",
    "Omi-compatible alias for get_workspace_session. In KronTerm, the conversation ID is a workspace session ID.",
    {
        conversationId: z.string().min(1).describe("Workspace session/conversation ID"),
    },
    async ({ conversationId }) => {
        try {
            return jsonText(await developerMemoryStore.getSession(conversationId));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "search_conversations",
    "Omi-compatible alias for search_workspace_sessions.",
    {
        query: z.string().min(1).describe("Search query"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum results"),
    },
    async ({ query, limit }) => {
        try {
            return jsonText(await developerMemoryStore.searchSessions(query, { limit }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "append_workspace_session_event",
    "Append terminal/browser/file/agent/sandbox activity to a workspace session.",
    {
        sessionId: z.string().min(1).describe("Workspace session ID"),
        type: sessionEventTypeSchema.describe("Event type"),
        title: z.string().optional().describe("Short title"),
        detail: z.string().optional().describe("Event detail or excerpt"),
        blockId: z.string().optional().describe("Related block ID"),
        command: z.string().optional().describe("Terminal command"),
        path: z.string().optional().describe("File path"),
        url: z.string().optional().describe("Browser URL"),
        exitCode: z.number().int().optional().describe("Command exit code"),
    },
    async ({ sessionId, type, title, detail, blockId, command, path, url, exitCode }) => {
        try {
            return jsonText(
                await developerMemoryStore.appendSessionEvent(sessionId, {
                    type,
                    title,
                    detail,
                    blockId,
                    command,
                    path,
                    url,
                    exitCode,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "complete_workspace_session",
    "Complete a workspace session with an optional summary.",
    {
        sessionId: z.string().min(1).describe("Workspace session ID"),
        summary: z.string().optional().describe("Session summary"),
    },
    async ({ sessionId, summary }) => {
        try {
            return jsonText(await developerMemoryStore.completeSession(sessionId, summary));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "get_action_items",
    "List developer action items extracted from or linked to workspace sessions.",
    {
        limit: z.number().int().min(1).max(500).optional().describe("Maximum action items"),
        offset: z.number().int().min(0).optional().describe("Offset into action list"),
        status: actionItemStatusSchema.optional().describe("Filter by status"),
    },
    async ({ limit, offset, status }) => {
        try {
            return jsonText(await developerMemoryStore.listActionItems({ limit, offset, status }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "search_action_items",
    "Search developer action items.",
    {
        query: z.string().min(1).describe("Search query"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum results"),
    },
    async ({ query, limit }) => {
        try {
            return jsonText(await developerMemoryStore.searchActionItems(query, { limit }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "create_action_item",
    "Create a developer action item with optional session/memory linkage and evidence.",
    {
        title: z.string().min(1).describe("Action item title"),
        description: z.string().optional().describe("Action item detail"),
        priority: actionItemPrioritySchema.optional().describe("Priority"),
        dueAt: z.string().optional().describe("Due timestamp"),
        scope: memoryScopeSchema.describe("Workspace/repo/block scope"),
        sourceSessionId: z.string().optional().describe("Linked workspace session ID"),
        sourceMemoryId: z.string().optional().describe("Linked memory ID"),
        evidence: z.array(memoryEvidenceSchema).optional().describe("Provenance evidence"),
    },
    async ({ title, description, priority, dueAt, scope, sourceSessionId, sourceMemoryId, evidence }) => {
        try {
            return jsonText(
                await developerMemoryStore.createActionItem({
                    title,
                    description,
                    priority,
                    dueAt,
                    scope,
                    sourceSessionId,
                    sourceMemoryId,
                    evidence,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "update_action_item",
    "Update a developer action item.",
    {
        actionItemId: z.string().min(1).describe("Action item ID"),
        title: z.string().optional().describe("Updated title"),
        description: z.string().optional().describe("Updated description"),
        status: actionItemStatusSchema.optional().describe("Updated status"),
        priority: actionItemPrioritySchema.optional().describe("Updated priority"),
        dueAt: z.string().optional().describe("Updated due timestamp"),
    },
    async ({ actionItemId, title, description, status, priority, dueAt }) => {
        try {
            return jsonText(
                await developerMemoryStore.updateActionItem(actionItemId, {
                    title,
                    description,
                    status,
                    priority,
                    dueAt,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "complete_action_item",
    "Mark a developer action item done.",
    {
        actionItemId: z.string().min(1).describe("Action item ID"),
    },
    async ({ actionItemId }) => {
        try {
            return jsonText(await developerMemoryStore.updateActionItem(actionItemId, { status: "done" }));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "delete_action_item",
    "Cancel a developer action item.",
    {
        actionItemId: z.string().min(1).describe("Action item ID"),
    },
    async ({ actionItemId }) => {
        try {
            return jsonText(await developerMemoryStore.deleteActionItem(actionItemId));
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

server.tool(
    "ingest_workspace_event",
    "Record a workspace event and optionally create a linked memory and action item. This is the first Omi-style pipeline adapter.",
    {
        sessionId: z
            .string()
            .optional()
            .describe("Existing workspace session ID. If omitted, a new session is created."),
        sessionTitle: z.string().optional().describe("Title when creating a new session"),
        scope: memoryScopeSchema.describe("Workspace/repo/block scope"),
        type: sessionEventTypeSchema.describe("Event type"),
        title: z.string().optional().describe("Event title"),
        detail: z.string().optional().describe("Event detail or excerpt"),
        blockId: z.string().optional().describe("Related block ID"),
        command: z.string().optional().describe("Terminal command"),
        path: z.string().optional().describe("File path"),
        url: z.string().optional().describe("Browser URL"),
        exitCode: z.number().int().optional().describe("Command exit code"),
        rememberContent: z.string().optional().describe("If provided, save this as a linked short-term memory"),
        actionTitle: z.string().optional().describe("If provided, create a linked action item"),
        actionDescription: z.string().optional().describe("Linked action item description"),
        autoCreateActionItem: z.boolean().optional().describe("Create an action item from event context"),
    },
    async ({
        sessionId,
        sessionTitle,
        scope,
        type,
        title,
        detail,
        blockId,
        command,
        path,
        url,
        exitCode,
        rememberContent,
        actionTitle,
        actionDescription,
        autoCreateActionItem,
    }) => {
        try {
            return jsonText(
                await developerMemoryStore.ingestWorkspaceEvent({
                    sessionId,
                    sessionTitle,
                    scope,
                    type,
                    title,
                    detail,
                    blockId,
                    command,
                    path,
                    url,
                    exitCode,
                    rememberContent,
                    actionTitle,
                    actionDescription,
                    autoCreateActionItem,
                })
            );
        } catch (err: any) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
process.once("exit", () => kronComputerUse.close());
process.once("SIGINT", () => {
    kronComputerUse.close();
    process.exit(0);
});
process.once("SIGTERM", () => {
    kronComputerUse.close();
    process.exit(0);
});
server.connect(transport).catch((err) => {
    console.error("mcp-kron-term: Server error:", err);
    process.exit(1);
});
