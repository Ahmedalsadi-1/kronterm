// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, describe, it } from "node:test";

const RequiredFamilies = {
    workspace: [
        "workspace_snapshot",
        "workspace_screenshot",
        "workspace_set_presentation",
        "workspace_focus_widget",
        "workspace_move_widget",
        "workspace_resize_widget",
        "workspace_swap_widgets",
        "workspace_toggle_magnify",
        "workspace_navigate",
        "workspace_canvas_view",
        "workspace_canvas_add_note",
        "workspace_canvas_update_object",
        "workspace_canvas_delete_object",
        "workspace_canvas_connect",
    ],
    terminal: ["block_run_command", "terminal_open", "terminal_scrollback"],
    browser: [
        "browser_open",
        "browser_navigate",
        "browser_get_html",
        "widget_snapshot",
        "widget_screenshot",
        "widget_click",
        "widget_type",
        "widget_press",
    ],
    desktop: [
        "kron_computer_status",
        "kron_computer_list_apps",
        "kron_computer_get_app_state",
        "kron_computer_click",
        "kron_computer_type_text",
        "kron_computer_press_key",
        "kron_computer_scroll",
        "kron_computer_drag",
        "kron_computer_set_value",
        "kron_computer_secondary_action",
        "kron_computer_turn_ended",
    ],
    sandbox: [
        "sandbox_start",
        "sandbox_status",
        "sandbox_stop",
        "sandbox_screenshot",
        "sandbox_mouse_move",
        "sandbox_click",
        "sandbox_type",
        "sandbox_paste",
        "sandbox_press",
        "sandbox_scroll",
        "sandbox_drag",
    ],
    canvas: [
        "canvas_load",
        "canvas_snapshot",
        "canvas_save",
        "canvas_create_node",
        "canvas_update_node",
        "canvas_delete_node",
        "canvas_connect_nodes",
        "canvas_launch_node",
        "canvas_upload_asset",
    ],
    lsp: ["lsp_diagnostics", "lsp_symbols", "lsp_hover", "lsp_definition", "lsp_references"],
} as const;

type ListedTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

describe("Hermes KronTerm tool parity", () => {
    let client: Client;
    let server: McpServer;
    let toolsByName: Map<string, ListedTool>;
    let previousWsh: string | undefined;

    before(async () => {
        previousWsh = process.env.KRONTERM_WSH;
        process.env.KRONTERM_WSH = "/usr/bin/false";
        ({ server } = await import("../src/index.ts"));
        client = new Client({ name: "kronterm-hermes-parity-test", version: "1.0.0" });
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        const manifest = await client.listTools();
        toolsByName = new Map(manifest.tools.map((tool) => [tool.name, tool]));
    });

    after(async () => {
        await client.close();
        await server.close();
        if (previousWsh == null) {
            delete process.env.KRONTERM_WSH;
        } else {
            process.env.KRONTERM_WSH = previousWsh;
        }
    });

    for (const [family, names] of Object.entries(RequiredFamilies)) {
        it(`exposes the ${family} contract through the MCP manifest Hermes receives`, () => {
            const missing = names.filter((name) => !toolsByName.has(name));
            assert.deepEqual(missing, []);
        });
    }

    it("exposes every registered KronTerm MCP tool, not only the required family samples", () => {
        const bridge = spawnSync(process.execPath, [new URL("../dist/native-bridge.js", import.meta.url).pathname], {
            input: JSON.stringify({ method: "list" }),
            encoding: "utf8",
            maxBuffer: 16 * 1024 * 1024,
            env: { ...process.env, KRONTERM_WSH: "/usr/bin/false" },
        });
        assert.equal(bridge.status, 0, bridge.stderr);
        const registered = (JSON.parse(bridge.stdout) as { tools: Array<{ name: string }> }).tools
            .map((tool) => tool.name)
            .sort();
        const advertised = Array.from(toolsByName.keys()).sort();

        assert.ok(registered.length > 100, "expected the complete KronTerm tool catalog");
        assert.deepEqual(advertised, registered);
    });

    it("advertises observation tools as read-only and idempotent", () => {
        for (const name of [
            "terminal_scrollback",
            "workspace_snapshot",
            "workspace_screenshot",
            "browser_get_html",
            "kron_computer_status",
            "kron_computer_list_apps",
            "kron_computer_get_app_state",
            "sandbox_status",
            "sandbox_screenshot",
            "canvas_load",
            "canvas_snapshot",
            "lsp_diagnostics",
            "lsp_symbols",
            "lsp_hover",
            "lsp_definition",
            "lsp_references",
        ]) {
            const annotations = toolsByName.get(name)?.annotations;
            assert.equal(annotations?.readOnlyHint, true, `${name} must be read-only`);
            assert.equal(annotations?.destructiveHint, false, `${name} must not be destructive`);
            assert.equal(annotations?.idempotentHint, true, `${name} must be idempotent`);
        }
    });

    it("marks destructive lifecycle and canvas replacement operations", () => {
        for (const name of ["sandbox_stop", "canvas_save", "canvas_update_node", "canvas_delete_node"]) {
            const annotations = toolsByName.get(name)?.annotations;
            assert.equal(annotations?.readOnlyHint, false, `${name} must be write-capable`);
            assert.equal(annotations?.destructiveHint, true, `${name} must be destructive`);
        }
    });

    it("rejects malformed browser, terminal, and canvas calls before reaching a surface", async () => {
        await assertInvalidCall(client, { name: "browser_open", arguments: { url: "not a url" } });
        await assertInvalidCall(client, { name: "terminal_scrollback", arguments: {} });
        await assertInvalidCall(client, {
            name: "canvas_delete_node",
            arguments: { workspaceId: "workspace-1", blockId: "block-1" },
        });
    });

    it("rejects ambiguous desktop and sandbox coordinates without invoking their runtimes", async () => {
        const desktop = await client.callTool({
            name: "kron_computer_click",
            arguments: { app: "Finder", x: 10 },
        });
        assert.equal(desktop.isError, true);
        assert.match(resultText(desktop), /both x and y/i);

        const sandbox = await client.callTool({
            name: "sandbox_scroll",
            arguments: { sessionId: "default", x: 10 },
        });
        assert.equal(sandbox.isError, true);
        assert.match(resultText(sandbox), /both x and y/i);

        const widget = await client.callTool({
            name: "widget_click",
            arguments: { blockId: "block-1", x: 10 },
        });
        assert.equal(widget.isError, true);
        assert.match(resultText(widget), /both x and y/i);
    });

    it("fails closed when a destructive sandbox target runtime is unavailable", async () => {
        const result = await client.callTool({ name: "sandbox_stop", arguments: { sessionId: "default" } });
        assert.equal(result.isError, true);
        assert.match(resultText(result), /error|unavailable|missing|enoent/i);
    });
});

function resultText(result: Awaited<ReturnType<Client["callTool"]>>): string {
    return result.content
        .filter((item): item is { type: "text"; text: string } => item.type === "text")
        .map((item) => item.text)
        .join("\n");
}

async function assertInvalidCall(client: Client, input: Parameters<Client["callTool"]>[0]): Promise<void> {
    const result = await client.callTool(input);
    assert.equal(result.isError, true);
    assert.match(resultText(result), /invalid/i);
}
