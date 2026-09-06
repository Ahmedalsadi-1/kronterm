// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage, MessageExtraInfo, RequestId } from "@modelcontextprotocol/sdk/types.js";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { server as mcpServer, setKronTermToolBridge, warmKronComputerUse } from "../mcp-kron-term/src/index";
import { isToolAllowedBySurfaceCapability } from "../mcp-kron-term/src/surface-policy";
import type { SurfaceCapability } from "../mcp-kron-term/src/wsh-bridge";
import type { HermesSurfaceContext } from "./hermes-runtime";
import { KronTermNativeToolBridge } from "./kronterm-native-tool-bridge";

export type KronTermToolServerDescriptor = {
    url: string;
    nativeUrl: string;
    token: string;
};

type SurfaceContextProvider = () => HermesSurfaceContext | null;

type NativeRegisteredTool = {
    enabled: boolean;
    title?: string;
    description?: string;
    inputSchema?: z.ZodType;
    annotations?: Record<string, unknown>;
    handler: (args: Record<string, unknown>, extra: Record<string, never>) => Promise<unknown> | unknown;
};

function registeredTools(): Record<string, NativeRegisteredTool> {
    return (mcpServer as unknown as { _registeredTools: Record<string, NativeRegisteredTool> })._registeredTools;
}

function requestKey(id: RequestId): string {
    return `${typeof id}:${String(id)}`;
}

function surfaceCapability(context: HermesSurfaceContext | null): SurfaceCapability | undefined {
    if (!context?.tabId) {
        return undefined;
    }
    return {
        token: "electron-owned",
        tabId: context.tabId,
        blockId: context.blockId,
        workspaceId: context.workspaceId,
        hostMode: context.hostMode ?? "kronterm",
        capabilities: context.capabilities,
    };
}

class ScopedMcpTransport implements Transport {
    private inner: StreamableHTTPServerTransport;
    private contextProvider: SurfaceContextProvider;
    private listRequestIds = new Set<string>();
    private messageHandler: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined;

    constructor(inner: StreamableHTTPServerTransport, contextProvider: SurfaceContextProvider) {
        this.inner = inner;
        this.contextProvider = contextProvider;
        inner.onmessage = (message, extra) => this.handleIncoming(message, extra);
    }

    get onclose(): (() => void) | undefined {
        return this.inner.onclose;
    }

    set onclose(handler: (() => void) | undefined) {
        this.inner.onclose = handler;
    }

    get onerror(): ((error: Error) => void) | undefined {
        return this.inner.onerror;
    }

    set onerror(handler: ((error: Error) => void) | undefined) {
        this.inner.onerror = handler;
    }

    get onmessage(): ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined {
        return this.messageHandler;
    }

    set onmessage(handler: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined) {
        this.messageHandler = handler;
    }

    async start(): Promise<void> {
        await this.inner.start();
    }

    async close(): Promise<void> {
        await this.inner.close();
    }

    async send(message: JSONRPCMessage, options?: { relatedRequestId?: RequestId }): Promise<void> {
        const record = message as unknown as Record<string, unknown>;
        if (record.id != null && this.listRequestIds.delete(requestKey(record.id as RequestId))) {
            const result = record.result as { tools?: Array<{ name?: string }> } | undefined;
            if (Array.isArray(result?.tools)) {
                const capability = surfaceCapability(this.contextProvider());
                message = {
                    ...record,
                    result: {
                        ...result,
                        tools: result.tools.filter(
                            (tool) =>
                                typeof tool.name === "string" && isToolAllowedBySurfaceCapability(tool.name, capability)
                        ),
                    },
                } as unknown as JSONRPCMessage;
            }
        }
        await this.inner.send(message, options);
    }

    private handleIncoming(message: JSONRPCMessage, extra?: MessageExtraInfo): void {
        const record = message as unknown as Record<string, unknown>;
        const method = typeof record.method === "string" ? record.method : "";
        if (method === "tools/list" && record.id != null) {
            this.listRequestIds.add(requestKey(record.id as RequestId));
        }
        if (method === "tools/call" && record.id != null) {
            const params = record.params as { name?: unknown } | undefined;
            const name = typeof params?.name === "string" ? params.name : "";
            if (!name || !isToolAllowedBySurfaceCapability(name, surfaceCapability(this.contextProvider()))) {
                void this.inner.send({
                    jsonrpc: "2.0",
                    id: record.id as RequestId,
                    error: { code: -32601, message: `Tool ${name || "<unknown>"} is outside this surface capability` },
                });
                return;
            }
        }
        this.messageHandler?.(message, extra);
    }
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
    const authorization = request.headers.authorization ?? "";
    const expected = `Bearer ${token}`;
    const actualBytes = Buffer.from(authorization);
    const expectedBytes = Buffer.from(expected);
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function writeError(response: ServerResponse, status: number, message: string): void {
    if (response.headersSent) {
        response.end();
        return;
    }
    response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: message }));
}

class KronTermToolServer {
    private contextProvider: SurfaceContextProvider;
    private server: Server | null = null;
    private startPromise: Promise<KronTermToolServerDescriptor> | null = null;
    private token = randomBytes(32).toString("base64url");
    private transport: StreamableHTTPServerTransport | null = null;
    private scopedTransport: ScopedMcpTransport | null = null;

    constructor(contextProvider: SurfaceContextProvider) {
        this.contextProvider = contextProvider;
    }

    // Every runtime (Hermes, ACP sessions, KronosChamber) tracks the same focused
    // surface, so the last caller to start/ensure the server wins the provider.
    setContextProvider(contextProvider: SurfaceContextProvider): void {
        this.contextProvider = contextProvider;
    }

    start(): Promise<KronTermToolServerDescriptor> {
        if (!this.startPromise) {
            this.startPromise = this.startInternal();
        }
        return this.startPromise;
    }

    private async startInternal(): Promise<KronTermToolServerDescriptor> {
        setKronTermToolBridge(new KronTermNativeToolBridge(this.contextProvider));
        void warmKronComputerUse().catch((error) =>
            console.log("[kronterm-tools] Native computer-use warmup unavailable", error)
        );
        await this.createTransport();
        const server = createServer((request, response) => {
            void this.handleRequest(request, response);
        });
        server.keepAliveTimeout = 60_000;
        server.requestTimeout = 0;
        server.headersTimeout = 65_000;
        this.server = server;
        const port = await new Promise<number>((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", () => {
                server.removeListener("error", reject);
                const address = server.address();
                if (!address || typeof address === "string") {
                    reject(new Error("KronTerm tool server did not bind a TCP port"));
                    return;
                }
                resolve(address.port);
            });
        });
        return {
            url: `http://127.0.0.1:${port}/mcp`,
            nativeUrl: `http://127.0.0.1:${port}/native`,
            token: this.token,
        };
    }

    private async createTransport(): Promise<void> {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: randomUUID,
            onsessioninitialized: (sessionId) => console.log(`[kronterm-tools] MCP session ${sessionId} connected`),
        });
        const scoped = new ScopedMcpTransport(transport, this.contextProvider);
        transport.onclose = () => {
            if (this.transport === transport) {
                this.transport = null;
                this.scopedTransport = null;
            }
        };
        transport.onerror = (error) => console.log("[kronterm-tools] MCP transport error", error);
        await mcpServer.connect(scoped);
        this.transport = transport;
        this.scopedTransport = scoped;
    }

    private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
        if (request.url !== "/mcp" && request.url !== "/native") {
            writeError(response, 404, "Not found");
            return;
        }
        if (!isAuthorized(request, this.token)) {
            response.setHeader("www-authenticate", 'Bearer realm="KronTerm tools"');
            writeError(response, 401, "Unauthorized");
            return;
        }
        if (request.method === "HEAD") {
            response.writeHead(204, { "cache-control": "no-store" });
            response.end();
            return;
        }
        if (request.url === "/native") {
            await this.handleNativeRequest(request, response);
            return;
        }
        if (!request.headers["mcp-session-id"] && (!this.transport || this.transport.sessionId != null)) {
            await this.createTransport();
        }
        if (!this.transport || !["GET", "POST", "DELETE"].includes(request.method ?? "")) {
            writeError(response, 405, "Method not allowed");
            return;
        }
        try {
            await this.transport.handleRequest(request, response);
        } catch (error) {
            console.log("[kronterm-tools] MCP request failed", error);
            writeError(response, 500, error instanceof Error ? error.message : String(error));
        }
    }

    private async handleNativeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
        if (request.method !== "POST") {
            writeError(response, 405, "Method not allowed");
            return;
        }
        try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of request) {
                const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                size += bytes.length;
                if (size > 2 * 1024 * 1024) {
                    writeError(response, 413, "Request too large");
                    return;
                }
                chunks.push(bytes);
            }
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
                method?: string;
                name?: string;
                arguments?: Record<string, unknown>;
            };
            const capability = surfaceCapability(this.contextProvider());
            const tools = registeredTools();
            if (payload.method === "manifest" || payload.method === "list") {
                const manifest = Object.entries(tools)
                    .filter(
                        ([name, tool]) =>
                            tool.enabled &&
                            (payload.method === "manifest" || isToolAllowedBySurfaceCapability(name, capability))
                    )
                    .map(([name, tool]) => ({
                        name,
                        title: tool.title,
                        description: tool.description,
                        inputSchema: tool.inputSchema ? z.toJSONSchema(tool.inputSchema) : { type: "object" },
                        annotations: tool.annotations,
                    }));
                this.writeNativeResponse(response, { tools: manifest });
                return;
            }
            const name = payload.name ?? "";
            const tool = tools[name];
            if (payload.method !== "call" || !tool?.enabled || !isToolAllowedBySurfaceCapability(name, capability)) {
                writeError(response, 404, `Tool ${name || "<unknown>"} is unavailable`);
                return;
            }
            const args = tool.inputSchema
                ? await tool.inputSchema.parseAsync(payload.arguments ?? {})
                : (payload.arguments ?? {});
            this.writeNativeResponse(response, await tool.handler(args as Record<string, unknown>, {}));
        } catch (error) {
            writeError(response, 400, error instanceof Error ? error.message : String(error));
        }
    }

    private writeNativeResponse(response: ServerResponse, value: unknown): void {
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify(value));
    }
}

let toolServer: KronTermToolServer | null = null;

export function startKronTermToolServer(
    contextProvider: SurfaceContextProvider
): Promise<KronTermToolServerDescriptor> {
    if (!toolServer) {
        toolServer = new KronTermToolServer(contextProvider);
    } else {
        toolServer.setContextProvider(contextProvider);
    }
    return toolServer.start();
}
