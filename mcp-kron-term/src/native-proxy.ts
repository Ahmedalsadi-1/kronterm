// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// stdio MCP proxy in front of KronTerm's in-process TypeScript tool runtime.
//
// Spawn sites (ACP agent manager, KronosChamber gateway) keep the stdio server
// contract they already have, but every manifest/call is proxied to the
// Electron-owned `/native` endpoint — so there is no wsh-CLI dependency, no
// bridge-token pairing to go stale after app restarts, and exactly one tool
// implementation (the persistent KronTermNativeToolBridge).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const URL_ENV = "KRONTERM_NATIVE_TOOL_URL";
const TOKEN_ENV = "KRONTERM_NATIVE_TOOL_TOKEN";
const MAX_OUTPUT_CHARS = 16 * 1024 * 1024;

type NativeTool = {
    name?: unknown;
    description?: unknown;
    inputSchema?: unknown;
    annotations?: unknown;
};

function isNativeTool(value: unknown): value is NativeTool & { name: string } {
    return typeof value === "object" && value != null && typeof (value as NativeTool).name === "string";
}

async function bridgeRequest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = (process.env[URL_ENV] ?? "").trim();
    const token = (process.env[TOKEN_ENV] ?? "").trim();
    if (!url || !token) {
        return { error: "KronTerm native tool bridge is unavailable (missing URL or token)" };
    }
    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        return {
            error: `KronTerm native tool bridge failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    const text = await response.text();
    if (text.length > MAX_OUTPUT_CHARS) {
        return { error: "KronTerm native tool bridge returned an oversized response" };
    }
    if (response.status !== 200) {
        return { error: `KronTerm native tool bridge returned ${response.status}: ${text.slice(0, 200)}` };
    }
    try {
        const parsed: unknown = JSON.parse(text);
        return typeof parsed === "object" && parsed != null ? (parsed as Record<string, unknown>) : { error: "KronTerm native tool bridge returned an invalid response" };
    } catch {
        return { error: "KronTerm native tool bridge returned invalid JSON" };
    }
}

export async function startKronTermNativeProxy(): Promise<void> {
    const server = new Server({ name: "kron-term", version: "1.0.0" }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const response = await bridgeRequest({ method: "list" });
        const tools = Array.isArray(response.tools) ? response.tools.filter(isNativeTool) : [];
        if (response.error) {
            console.error(`[kronterm-native-proxy] tool list unavailable: ${String(response.error)}`);
        }
        return {
            tools: tools.map((tool) => ({
                name: tool.name,
                description: typeof tool.description === "string" ? tool.description : undefined,
                inputSchema: typeof tool.inputSchema === "object" && tool.inputSchema != null ? tool.inputSchema : { type: "object" },
                annotations: typeof tool.annotations === "object" && tool.annotations != null ? tool.annotations : undefined,
            })),
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const response = await bridgeRequest({
            method: "call",
            name: request.params.name,
            arguments: (request.params.arguments ?? {}) as Record<string, unknown>,
        });
        if (response.error) {
            return {
                content: [{ type: "text", text: String(response.error) }],
                isError: true,
            };
        }
        return response;
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

const modulePath = fileURLToPath(import.meta.url);
const isMainModule =
    process.argv[1] != null &&
    path.basename(modulePath) === "native-proxy.js" &&
    path.resolve(process.argv[1]) === modulePath;
if (isMainModule) {
    startKronTermNativeProxy().catch((err) => {
        console.error("mcp-kron-term native proxy: server error:", err);
        process.exit(1);
    });
}
