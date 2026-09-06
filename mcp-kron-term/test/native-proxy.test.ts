// The native proxy keeps the stdio MCP contract for ACP sessions and the
// KronosChamber gateway, but must land every manifest/call on the in-process
// /native endpoint. These tests spawn the built proxy against a mock bridge.

import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import http from "node:http";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const proxyPath = path.join(import.meta.dirname, "..", "dist", "native-proxy.js");
const NATIVE_TOKEN = "test-proxy-token";

type BridgeCall = { method?: string; name?: string };

let bridgeCalls: BridgeCall[] = [];
let bridgeServer: http.Server;
let bridgeUrl: string;

before(async () => {
    bridgeServer = http.createServer((request, response) => {
        let body = "";
        request.on("data", (chunk) => (body += chunk));
        request.on("end", () => {
            if (request.headers.authorization !== `Bearer ${NATIVE_TOKEN}`) {
                response.writeHead(401, { "content-type": "application/json" });
                response.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
            let payload: BridgeCall = {};
            try {
                payload = JSON.parse(body) as BridgeCall;
            } catch {
                payload = {};
            }
            bridgeCalls.push(payload);
            if (payload.method === "list") {
                response.writeHead(200, { "content-type": "application/json" });
                response.end(
                    JSON.stringify({
                        tools: [
                            {
                                name: "surface_status",
                                title: "Surface status",
                                description: "Inspect the active KronTerm surface",
                                inputSchema: { type: "object", properties: {} },
                                annotations: { readOnlyHint: true },
                            },
                        ],
                    })
                );
                return;
            }
            if (payload.method === "call" && payload.name === "surface_status") {
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify({ content: [{ type: "text", text: "surface ok" }] }));
                return;
            }
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: `Tool ${payload.name ?? "<unknown>"} is unavailable` }));
        });
    });
    await new Promise<void>((resolve) => bridgeServer.listen(0, "127.0.0.1", resolve));
    const address = bridgeServer.address();
    assert(address != null && typeof address === "object");
    bridgeUrl = `http://127.0.0.1:${address.port}/native`;
});

after(() => {
    bridgeServer?.close();
});

function makeClient(): Client {
    return new Client({ name: "native-proxy-test", version: "1.0.0" }, { capabilities: {} });
}

function makeTransport(extraEnv: Record<string, string> = {}): StdioClientTransport {
    return new StdioClientTransport({
        command: process.execPath,
        args: [proxyPath],
        env: {
            ...process.env,
            KRONTERM_NATIVE_TOOL_URL: bridgeUrl,
            KRONTERM_NATIVE_TOOL_TOKEN: NATIVE_TOKEN,
            ...extraEnv,
        },
    });
}

test("proxy lists tools from the native bridge manifest", async () => {
    const client = makeClient();
    try {
        await client.connect(makeTransport());
        const tools = await client.listTools();
        const status = tools.tools.find((tool) => tool.name === "surface_status");
        assert(status, "surface_status should be exposed by the proxy");
        assert.equal(status.description, "Inspect the active KronTerm surface");
        assert.deepEqual(bridgeCalls.at(-1), { method: "list" });
    } finally {
        await client.close();
    }
});

test("proxy forwards tool calls and preserves results", async () => {
    const client = makeClient();
    try {
        await client.connect(makeTransport());
        const result = await client.callTool({ name: "surface_status", arguments: {} });
        assert.deepEqual(result.content, [{ type: "text", text: "surface ok" }]);
        assert.equal(result.isError, undefined);
        assert.deepEqual(bridgeCalls.at(-1), { method: "call", name: "surface_status", arguments: {} });
    } finally {
        await client.close();
    }
});

test("proxy reports bridge failures as isError results", async () => {
    const client = makeClient();
    try {
        await client.connect(makeTransport());
        const result = await client.callTool({ name: "nonexistent_tool", arguments: {} });
        assert.equal(result.isError, true);
        const text = result.content?.[0];
        assert(text && "text" in text && /unavailable/.test(String(text.text)));
    } finally {
        await client.close();
    }
});

test("proxy without bridge env yields an empty tool list", async () => {
    const client = makeClient();
    try {
        await client.connect(makeTransport({ KRONTERM_NATIVE_TOOL_URL: "", KRONTERM_NATIVE_TOOL_TOKEN: "" }));
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 0);
    } finally {
        await client.close();
    }
});
