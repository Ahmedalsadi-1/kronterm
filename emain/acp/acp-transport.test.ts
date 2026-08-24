// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from "events";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { RpcApi } from "../../frontend/app/store/wshclientapi";
import { AcpAgentManager, createAgentManager, listAgentManagers, removeAgentManager } from "./acp-agent-manager";
import { NdjsonTransport } from "./acp-transport";

vi.mock("../../frontend/app/store/wshclientapi", () => ({
    RpcApi: { CreateSurfaceTokenCommand: vi.fn() },
}));
vi.mock("../emain-wsh", () => ({
    ElectronWshClient: {},
}));

function makeChild() {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const writes: string[] = [];
    const child = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        stdin: {
            write: (value: string) => writes.push(value),
            end: vi.fn(),
        },
        exitCode: null,
        signalCode: null,
        kill: vi.fn(),
    });
    return { child: child as any, stdout, writes };
}

describe("NdjsonTransport", () => {
    it("advertises only client methods implemented by Kronterm", async () => {
        const { child, stdout, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const initialized = transport.initialize();

        const request = JSON.parse(writes[0]);
        expect(request.params.clientInfo).toEqual({ name: "KronTerm", version: "0.14.3" });
        expect(request.params.clientCapabilities).toEqual({
            fs: { readTextFile: true, writeTextFile: true },
            terminal: false,
        });

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true}}}\n'
            )
        );
        await expect(initialized).resolves.toMatchObject({ capabilities: { loadSession: true } });
    });

    it("allows slow ACP initialize responses beyond the default request timeout", async () => {
        vi.useFakeTimers();
        try {
            const { child, stdout } = makeChild();
            const transport = new NdjsonTransport(child);
            const initialized = transport.initialize();

            await vi.advanceTimersByTimeAsync(61_000);
            stdout.emit(
                "data",
                Buffer.from(
                    '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true}}}\n'
                )
            );

            await expect(initialized).resolves.toMatchObject({ capabilities: { loadSession: true } });
        } finally {
            vi.useRealTimers();
        }
    });

    it("ignores bracket-prefixed stdout banners before ACP JSON responses", async () => {
        const { child, stdout } = makeChild();
        const transport = new NdjsonTransport(child);
        const initialized = transport.initialize();

        stdout.emit(
            "data",
            Buffer.from(
                [
                    "[pty.loader] Auto-resolved BUN_PTY_LIB=/tmp/librust_pty_arm64.dylib",
                    "[pty.loader] bun-pty loaded successfully",
                    "[opencode-roadmap-plugin@1.2.0] loaded - 10 agent(s), 2 command(s) synced",
                    '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true}}}',
                    "",
                ].join("\n")
            )
        );

        await expect(initialized).resolves.toMatchObject({ capabilities: { loadSession: true } });
    });

    it("accepts pretty-printed ACP initialize responses", async () => {
        const { child, stdout, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const initialized = transport.initialize();

        expect(JSON.parse(writes[0]).method).toBe("initialize");
        stdout.emit(
            "data",
            Buffer.from(`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true
    }
  }
}
`)
        );

        await expect(initialized).resolves.toMatchObject({ capabilities: { loadSession: true } });
    });

    it("accepts pretty-printed ACP responses for normal requests", async () => {
        const { child, stdout } = makeChild();
        const transport = new NdjsonTransport(child);
        const session = transport.sendRequest("session/new", { cwd: "/tmp/kronterm-workspace", mcpServers: [] });

        stdout.emit(
            "data",
            Buffer.from(`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "session-1"
  }
}
`)
        );

        await expect(session).resolves.toEqual({ sessionId: "session-1" });
    });

    it("rejects pending ACP requests when the child exits before responding", async () => {
        const { child } = makeChild();
        const transport = new NdjsonTransport(child);
        const session = transport.sendRequest("session/new", { cwd: "/tmp/kronterm-workspace", mcpServers: [] });

        child.emit("close", 1, null);

        await expect(session).rejects.toThrow("ACP transport closed before response");
    });

    it("emits disconnect when the ACP child exits without pending requests", () => {
        const { child } = makeChild();
        const transport = new NdjsonTransport(child);
        const handler = vi.fn();
        transport.on("disconnect", handler);

        child.emit("close", 7, "SIGTERM");

        expect(handler).toHaveBeenCalledWith({
            type: "disconnect",
            code: 7,
            signal: "SIGTERM",
        });
    });

    it("delivers agent permission requests that require a JSON-RPC response", () => {
        const { child, stdout } = makeChild();
        const transport = new NdjsonTransport(child);
        const handler = vi.fn();
        transport.on("permission_request", handler);

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":7,"method":"session/request_permission","params":{"sessionId":"s1","options":[],"toolCall":{"toolCallId":"tool-1"}}}\n'
            )
        );

        expect(handler).toHaveBeenCalledWith({
            id: 7,
            params: { sessionId: "s1", options: [], toolCall: { toolCallId: "tool-1" } },
        });
    });

    it("cancels a prompt request when the LLM timeout expires", async () => {
        vi.useFakeTimers();
        const { child, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const prompt = transport.sendRequest("session/prompt", {
            sessionId: "session-1",
            prompt: [{ type: "text", text: "hello" }],
        });

        vi.advanceTimersByTime(300000);

        await expect(prompt).rejects.toThrow("LLM request timed out after 300 seconds");
        expect(JSON.parse(writes[1])).toEqual({
            jsonrpc: "2.0",
            method: "session/cancel",
            params: { sessionId: "session-1" },
        });
        vi.useRealTimers();
    });

    it("resets prompt timeouts when streaming session updates arrive", async () => {
        vi.useFakeTimers();
        const { child, stdout, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const prompt = transport.sendRequest("session/prompt", {
            sessionId: "session-1",
            prompt: [{ type: "text", text: "hello" }],
        });

        vi.advanceTimersByTime(299000);
        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"session-1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"working"}}}}\n'
            )
        );
        vi.advanceTimersByTime(1000);
        expect(writes).toHaveLength(1);

        vi.advanceTimersByTime(300000);

        await expect(prompt).rejects.toThrow("LLM request timed out after 300 seconds");
        expect(JSON.parse(writes[1]).method).toBe("session/cancel");
        vi.useRealTimers();
    });

    it("pauses prompt timeouts while a permission request is awaiting response", async () => {
        vi.useFakeTimers();
        const { child, stdout, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const prompt = transport.sendRequest("session/prompt", {
            sessionId: "session-1",
            prompt: [{ type: "text", text: "hello" }],
        });

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":7,"method":"session/request_permission","params":{"sessionId":"session-1","options":[],"toolCall":{"toolCallId":"tool-1"}}}\n'
            )
        );
        vi.advanceTimersByTime(600000);
        expect(writes).toHaveLength(1);

        transport.sendResponse(7, { outcome: { outcome: "selected", optionId: "allow" } });
        vi.advanceTimersByTime(300000);

        await expect(prompt).rejects.toThrow("LLM request timed out after 300 seconds");
        expect(JSON.parse(writes[2]).method).toBe("session/cancel");
        vi.useRealTimers();
    });

    it("handles workspace-relative ACP read_text_file requests", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "kronterm-acp-read-"));
        await fs.writeFile(path.join(workspace, "notes.txt"), "hello file", "utf-8");
        const { child, stdout, writes } = makeChild();
        new NdjsonTransport(child, false, workspace);

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":9,"method":"fs/read_text_file","params":{"sessionId":"session-1","path":"notes.txt"}}\n'
            )
        );

        await vi.waitFor(() => expect(writes).toHaveLength(1));
        expect(JSON.parse(writes[0])).toEqual({
            jsonrpc: "2.0",
            id: 9,
            result: { content: "hello file" },
        });
    });

    it("rejects ACP read_text_file requests outside the workspace", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "kronterm-acp-read-root-"));
        const outsidePath = path.join(os.tmpdir(), `kronterm-acp-outside-${Date.now()}.txt`);
        await fs.writeFile(outsidePath, "secret", "utf-8");
        const { child, stdout, writes } = makeChild();
        new NdjsonTransport(child, false, workspace);

        stdout.emit(
            "data",
            Buffer.from(
                `{"jsonrpc":"2.0","id":12,"method":"fs/read_text_file","params":{"sessionId":"session-1","path":${JSON.stringify(outsidePath)}}}\n`
            )
        );

        await vi.waitFor(() => expect(writes).toHaveLength(1));
        expect(JSON.parse(writes[0])).toMatchObject({
            jsonrpc: "2.0",
            id: 12,
            error: { code: -32000 },
        });
        expect(JSON.parse(writes[0]).error.message).toContain("outside the workspace");
    });

    it("handles ACP write_text_file requests and creates parent directories", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "kronterm-acp-write-"));
        const { child, stdout, writes } = makeChild();
        new NdjsonTransport(child, false, workspace);

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":10,"method":"fs/write_text_file","params":{"sessionId":"session-1","path":"nested/out.txt","content":"saved"}}\n'
            )
        );
        await vi.waitFor(async () => {
            await expect(fs.readFile(path.join(workspace, "nested", "out.txt"), "utf-8")).resolves.toBe("saved");
        });
        await vi.waitFor(() => expect(writes).toHaveLength(1));

        expect(JSON.parse(writes[0])).toEqual({
            jsonrpc: "2.0",
            id: 10,
            result: null,
        });
    });

    it("rejects ACP write_text_file requests outside the workspace", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "kronterm-acp-write-root-"));
        const outsidePath = path.join(os.tmpdir(), `kronterm-acp-write-outside-${Date.now()}.txt`);
        const { child, stdout, writes } = makeChild();
        new NdjsonTransport(child, false, workspace);

        stdout.emit(
            "data",
            Buffer.from(
                `{"jsonrpc":"2.0","id":13,"method":"fs/write_text_file","params":{"sessionId":"session-1","path":${JSON.stringify(outsidePath)},"content":"escape"}}\n`
            )
        );

        await vi.waitFor(() => expect(writes).toHaveLength(1));
        expect(JSON.parse(writes[0])).toMatchObject({
            jsonrpc: "2.0",
            id: 13,
            error: { code: -32000 },
        });
        await expect(fs.readFile(outsidePath, "utf-8")).rejects.toThrow();
    });

    it("returns ACP errors for failed file requests", async () => {
        const { child, stdout, writes } = makeChild();
        new NdjsonTransport(child, false, "/tmp/missing-kronterm-acp-workspace");

        stdout.emit(
            "data",
            Buffer.from(
                '{"jsonrpc":"2.0","id":11,"method":"fs/read_text_file","params":{"sessionId":"session-1","path":"missing.txt"}}\n'
            )
        );

        await vi.waitFor(() => expect(writes).toHaveLength(1));
        expect(JSON.parse(writes[0])).toMatchObject({
            jsonrpc: "2.0",
            id: 11,
            error: { code: -32000 },
        });
    });

    it("terminates detached ACP process groups that ignore graceful shutdown", () => {
        if (process.platform === "win32") {
            return;
        }
        vi.useFakeTimers();
        const { child } = makeChild();
        child.pid = 45555;
        const killProcess = vi.spyOn(process, "kill").mockReturnValue(true);
        const transport = new NdjsonTransport(child as any, true);

        transport.kill();

        expect(child.stdin.end).toHaveBeenCalled();
        expect(killProcess).toHaveBeenCalledWith(-45555, "SIGTERM");
        vi.advanceTimersByTime(1000);
        expect(killProcess).toHaveBeenCalledWith(-45555, "SIGKILL");
        expect(child.kill).not.toHaveBeenCalled();
        killProcess.mockRestore();
        vi.useRealTimers();
    });
});

describe("AcpAgentManager protocol requests", () => {
    function makeManagerTransport() {
        return {
            isInitialized: () => true,
            sendRequest: vi
                .fn()
                .mockResolvedValueOnce({ sessionId: "session-1" })
                .mockResolvedValueOnce({ stopReason: "end_turn" }),
            sendResponse: vi.fn(),
            sendNotification: vi.fn(),
            kill: vi.fn(),
        };
    }

    it("creates sessions with a valid bundled Wave surface MCP server", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-1",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
        });
        const transport = makeManagerTransport();
        manager.transport = transport as any;
        manager.capabilities = {
            loadSession: false,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: true, http: false, sse: false },
            sessionCapabilities: { fork: null, resume: null, list: null, close: null },
            _meta: {},
        };

        await manager.sendMessage({ conversationId: "conversation-1", content: "hello" });

        expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/new", {
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [
                {
                    type: "stdio",
                    name: "kron-term",
                    command: process.execPath,
                    args: [path.join(process.cwd(), "mcp-kron-term", "dist", "index.js")],
                    env: [
                        { name: "ELECTRON_RUN_AS_NODE", value: "1" },
                        { name: "KRONTERM_WORKSPACE", value: "/tmp/kronterm-workspace" },
                        { name: "KRONTERM_WSH", value: path.join(process.cwd(), "wsh") },
                        { name: "WAVETERM_WSH", value: path.join(process.cwd(), "wsh") },
                    ],
                },
            ],
        });
    });

    it("provides the surface MCP and temporary capability to KronosCode chat without advertised MCP capabilities", async () => {
        vi.mocked(RpcApi.CreateSurfaceTokenCommand).mockResolvedValueOnce({
            token: "surface-token",
            tabid: "tab-1",
            blockid: "block-1",
        } as any);
        const manager = new AcpAgentManager({
            conversationId: "conversation-kronterm-chat",
            backend: "kronoscode",
            workspace: "/tmp/kronterm-workspace",
            surfaceContext: { tabId: "tab-1", blockId: "block-1" },
        });
        const transport = makeManagerTransport();
        manager.transport = transport as any;

        await manager.sendMessage({ conversationId: "conversation-kronterm-chat", content: "inspect surface" });

        expect(RpcApi.CreateSurfaceTokenCommand).toHaveBeenCalledWith(expect.anything(), {
            tabid: "tab-1",
            blockid: "block-1",
        });
        expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/new", {
            cwd: ".",
            mcpServers: [
                {
                    type: "stdio",
                    name: "kron-term",
                    command: process.execPath,
                    args: [path.join(process.cwd(), "mcp-kron-term", "dist", "index.js")],
                    env: [
                        { name: "ELECTRON_RUN_AS_NODE", value: "1" },
                        { name: "KRONTERM_WORKSPACE", value: "/tmp/kronterm-workspace" },
                        { name: "KRONTERM_JWT", value: "surface-token" },
                        { name: "WAVETERM_JWT", value: "surface-token" },
                        { name: "KRONTERM_TABID", value: "tab-1" },
                        { name: "WAVETERM_TABID", value: "tab-1" },
                        { name: "KRONTERM_BLOCKID", value: "block-1" },
                        { name: "WAVETERM_BLOCKID", value: "block-1" },
                        { name: "KRONTERM_WSH", value: path.join(process.cwd(), "wsh") },
                        { name: "WAVETERM_WSH", value: path.join(process.cwd(), "wsh") },
                    ],
                },
            ],
        });
    });

    it("provides Hermes with the scoped surface capability and shared project skills", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "kronterm-hermes-"));
        try {
            const sharedSkills = path.join(workspace, ".agents", "skills");
            await fs.mkdir(sharedSkills, { recursive: true });
            vi.mocked(RpcApi.CreateSurfaceTokenCommand).mockResolvedValueOnce({
                token: "hermes-surface-token",
                tabid: "tab-hermes",
                blockid: "block-hermes",
            } as any);
            const manager = new AcpAgentManager({
                conversationId: "conversation-hermes",
                backend: "hermes",
                workspace,
                surfaceContext: { tabId: "tab-hermes", blockId: "block-hermes" },
            });
            const transport = makeManagerTransport();
            manager.transport = transport as any;
            manager.capabilities = {
                loadSession: false,
                promptCapabilities: { image: false, audio: false, embeddedContext: false },
                mcpCapabilities: { stdio: true, http: false, sse: false },
                sessionCapabilities: { fork: null, resume: null, list: null, close: null },
                _meta: {},
            };

            await manager.sendMessage({ conversationId: "conversation-hermes", content: "inspect surface" });

            expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/new", {
                cwd: ".",
                mcpServers: [
                    {
                        type: "stdio",
                        name: "kron-term",
                        command: process.execPath,
                        args: [path.join(process.cwd(), "mcp-kron-term", "dist", "index.js")],
                        env: [
                            { name: "ELECTRON_RUN_AS_NODE", value: "1" },
                            { name: "KRONTERM_WORKSPACE", value: workspace },
                            { name: "KRONTERM_SHARED_SKILL_DIRS", value: sharedSkills },
                            { name: "KRONTERM_JWT", value: "hermes-surface-token" },
                            { name: "WAVETERM_JWT", value: "hermes-surface-token" },
                            { name: "KRONTERM_TABID", value: "tab-hermes" },
                            { name: "WAVETERM_TABID", value: "tab-hermes" },
                            { name: "KRONTERM_BLOCKID", value: "block-hermes" },
                            { name: "WAVETERM_BLOCKID", value: "block-hermes" },
                            { name: "KRONTERM_WSH", value: path.join(process.cwd(), "wsh") },
                            { name: "WAVETERM_WSH", value: path.join(process.cwd(), "wsh") },
                        ],
                    },
                ],
            });
        } finally {
            await fs.rm(workspace, { recursive: true, force: true });
        }
    });

    it("falls back to session/new resume when session/load fails", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-1",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
        });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest
            .mockRejectedValueOnce(new Error("expired"))
            .mockResolvedValueOnce({ sessionId: "session-2" });
        manager.transport = transport as any;
        manager.capabilities = {
            loadSession: true,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: false, http: false, sse: false },
            sessionCapabilities: { fork: null, resume: null, list: null, close: null },
            _meta: {},
        };

        await (manager as any).ensureSession("session-1", "conversation-1");

        expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/load", {
            sessionId: "session-1",
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [],
        });
        expect(transport.sendRequest).toHaveBeenNthCalledWith(2, "session/new", {
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [],
            resumeSessionId: "session-1",
            forkSession: false,
        });
        expect(manager.sessionId).toBe("session-2");
    });

    it("starts fresh when a stored session belongs to a different conversation", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-b",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
        });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest.mockResolvedValueOnce({ sessionId: "fresh-session" });
        manager.transport = transport as any;
        manager.capabilities = {
            loadSession: true,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: false, http: false, sse: false },
            sessionCapabilities: { fork: null, resume: null, list: null, close: null },
            _meta: {},
        };

        await (manager as any).ensureSession("session-a", "conversation-a");

        expect(transport.sendRequest).toHaveBeenCalledTimes(1);
        expect(transport.sendRequest).toHaveBeenCalledWith("session/new", {
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [],
        });
        expect(manager.sessionId).toBe("fresh-session");
    });

    it("exposes model choices returned when a KronosCode session is created", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-1",
            backend: "kronoscode",
            workspace: "/tmp/kronterm-workspace",
        });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest
            .mockResolvedValueOnce({
                sessionId: "session-1",
                models: {
                    currentModelId: "google/gemini-3-pro-preview",
                    availableModels: [{ modelId: "google/gemini-3-pro-preview", name: "Gemini 3 Pro" }],
                },
            })
            .mockResolvedValueOnce({ stopReason: "end_turn" });
        manager.transport = transport as any;

        await manager.sendMessage({ conversationId: "conversation-1", content: "hello" });

        expect(manager.modelInfo).toEqual({
            currentModelId: "google/gemini-3-pro-preview",
            currentModelLabel: "Gemini 3 Pro",
            canSwitch: true,
            availableModels: [{ id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" }],
        });
    });

    it("emits PromptResponse usage when usage_update notifications are not available", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-usage",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
        });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest
            .mockResolvedValueOnce({ sessionId: "session-1" })
            .mockResolvedValueOnce({ stopReason: "end_turn", usage: { totalTokens: 1234 } });
        manager.transport = transport as any;
        const events: any[] = [];
        manager.on("event", (event) => events.push(event));

        await manager.sendMessage({ conversationId: "conversation-usage", content: "hello" });

        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: "usage",
                    data: { totalTokens: 1234 },
                }),
            ])
        );
    });

    it("emits slash commands advertised by the ACP session", () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-commands",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
        });
        const events: any[] = [];
        manager.on("event", (event) => events.push(event));

        (manager as any).handleSessionUpdate({
            sessionId: "session-1",
            update: {
                sessionUpdate: "available_commands_update",
                availableCommands: [
                    { name: "tests", description: "Run focused tests", input: { hint: "path or test name" } },
                    { name: "  ", description: "ignored" },
                ],
            },
        });

        expect(events).toEqual([
            expect.objectContaining({
                type: "slash_commands",
                data: {
                    commands: {
                        tests: {
                            name: "tests",
                            description: "Run focused tests",
                            hint: "path or test name",
                        },
                    },
                },
            }),
        ]);
    });

    it("adds ordered privacy-safe trace metadata without copying event content", () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-trace",
            backend: "kronoscode",
            workspace: "/tmp/kronterm-workspace",
        });
        const events: any[] = [];
        manager.on("event", (event) => events.push(event));

        (manager as any).handleSessionUpdate({
            sessionId: "session-1",
            update: {
                sessionUpdate: "agent_message_chunk",
                content: { type: "text", text: "private response content" },
            },
        });
        (manager as any).handleSessionUpdate({
            sessionId: "session-1",
            update: {
                sessionUpdate: "tool_call_update",
                toolCallId: "tool-1",
                status: "failed",
                rawInput: { secret: "must-not-appear-in-trace" },
            },
        });

        expect(events[0].trace).toMatchObject({
            schemaVersion: 1,
            sequence: 1,
            backend: "kronoscode",
        });
        expect(events[1].trace).toMatchObject({
            sequence: 2,
            traceId: events[0].trace.traceId,
            failureCategory: "tool_failure",
        });
        expect(JSON.stringify(events.map((event) => event.trace))).not.toContain("private response content");
        expect(JSON.stringify(events.map((event) => event.trace))).not.toContain("must-not-appear-in-trace");
    });

    it("does not send configured MCP servers when the runtime does not advertise stdio MCP", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-mcp-disabled",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
            mcpServers: [{ name: "configured", command: "node", args: ["server.js"], env: [] }],
        });
        const transport = makeManagerTransport();
        manager.transport = transport as any;

        await manager.sendMessage({ conversationId: "conversation-mcp-disabled", content: "hello" });

        expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/new", {
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [],
        });
    });

    it("sends configured HTTP and SSE MCP servers when the runtime advertises those transports", async () => {
        const manager = new AcpAgentManager({
            conversationId: "conversation-mcp-http",
            backend: "codex",
            workspace: "/tmp/kronterm-workspace",
            mcpServers: [
                { name: "configured-stdio", command: "node", args: ["server.js"], env: [] },
                {
                    type: "http",
                    name: "configured-http",
                    url: "http://127.0.0.1:9200/mcp",
                    headers: [{ name: "Authorization", value: "Bearer token" }],
                },
                { type: "sse", name: "configured-sse", url: "http://127.0.0.1:9201/sse" },
            ],
        });
        const transport = makeManagerTransport();
        manager.transport = transport as any;
        manager.capabilities = {
            loadSession: false,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: false, http: true, sse: true },
            sessionCapabilities: { fork: null, resume: null, list: null, close: null },
            _meta: {},
        };

        await manager.sendMessage({ conversationId: "conversation-mcp-http", content: "hello" });

        expect(transport.sendRequest).toHaveBeenNthCalledWith(1, "session/new", {
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [
                {
                    type: "http",
                    name: "configured-http",
                    url: "http://127.0.0.1:9200/mcp",
                    headers: [{ name: "Authorization", value: "Bearer token" }],
                },
                {
                    type: "sse",
                    name: "configured-sse",
                    url: "http://127.0.0.1:9201/sse",
                    headers: undefined,
                },
            ],
        });
    });

    it("keeps separate live managers for concurrent conversations", () => {
        createAgentManager({ conversationId: "conversation-a", backend: "kronoscode" });
        createAgentManager({ conversationId: "conversation-b", backend: "kronoscode" });
        createAgentManager({ conversationId: "conversation-c", backend: "opencode" });

        expect(listAgentManagers().map((runtime) => runtime.conversationId)).toEqual(
            expect.arrayContaining(["conversation-a", "conversation-b", "conversation-c"])
        );

        removeAgentManager("conversation-a");
        removeAgentManager("conversation-b");
        removeAgentManager("conversation-c");
    });

    it("uses the ACP modeId parameter for session mode changes", async () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-1", backend: "kronoscode" });
        const transport = makeManagerTransport();
        manager.transport = transport as any;
        manager.sessionId = "session-1";

        await manager.setMode({ conversationId: "conversation-1", mode: "build" });

        expect(transport.sendRequest).toHaveBeenCalledWith("session/set_mode", {
            sessionId: "session-1",
            modeId: "build",
        });
    });

    it("does not advertise a model switch rejected by the ACP agent", async () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-1", backend: "kronoscode" });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest.mockRejectedValueOnce(new Error("model rejected"));
        manager.transport = transport as any;
        manager.sessionId = "session-1";
        manager.modelInfo = {
            currentModelId: "model-a",
            currentModelLabel: "Model A",
            canSwitch: true,
            availableModels: [
                { id: "model-a", label: "Model A" },
                { id: "model-b", label: "Model B" },
            ],
        };

        await expect(manager.setModel({ conversationId: "conversation-1", modelId: "model-b" })).rejects.toThrow(
            "model rejected"
        );
        expect(manager.modelInfo.currentModelId).toBe("model-a");
    });

    it("responds to permission choices with the ACP outcome envelope", async () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-1", backend: "codex" });
        const transport = makeManagerTransport();
        manager.transport = transport as any;
        manager.confirmations = [
            {
                id: "permission-1",
                msgId: "permission-message-1",
                requestId: 42,
                callId: "tool-1",
                title: "Write file",
                options: [{ optionId: "allow-once", name: "Allow", kind: "allow_once" }],
            },
        ];

        await manager.confirmTool({
            conversationId: "conversation-1",
            msgId: "permission-message-1",
            callId: "tool-1",
            optionId: "allow-once",
        });

        expect(transport.sendResponse).toHaveBeenCalledWith(42, {
            outcome: { outcome: "selected", optionId: "allow-once" },
        });
    });

    it("cancels a running turn as a notification and settles pending permissions", async () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-1", backend: "codex" });
        const transport = makeManagerTransport();
        manager.transport = transport as any;
        manager.sessionId = "session-1";
        manager.confirmations = [
            {
                id: "permission-1",
                msgId: "permission-message-1",
                requestId: 43,
                callId: "tool-2",
                title: "Run command",
                options: [],
            },
        ];

        await manager.stop();

        expect(transport.sendNotification).toHaveBeenCalledWith("session/cancel", {
            sessionId: "session-1",
        });
        expect(transport.sendResponse).toHaveBeenCalledWith(43, {
            outcome: { outcome: "cancelled" },
        });
    });

    it("closes sessions gracefully when the ACP agent advertises session close support", async () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-1", backend: "codex" });
        const transport = makeManagerTransport();
        transport.sendRequest.mockReset();
        transport.sendRequest.mockResolvedValueOnce({});
        manager.transport = transport as any;
        manager.sessionId = "session-1";
        manager.capabilities = {
            loadSession: false,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: false, http: false, sse: false },
            sessionCapabilities: { fork: null, resume: null, list: null, close: {} },
            _meta: {},
        };

        await manager.stop();

        expect(transport.sendRequest).toHaveBeenCalledWith("session/close", { sessionId: "session-1" });
        expect(transport.kill).toHaveBeenCalled();
    });

    it("marks the manager errored when the ACP transport disconnects unexpectedly", () => {
        const manager = new AcpAgentManager({ conversationId: "conversation-disconnect", backend: "codex" });
        const { child } = makeChild();
        const transport = new NdjsonTransport(child);
        const events: any[] = [];
        manager.transport = transport;
        manager.sessionId = "session-1";
        manager.status = "running";
        manager.confirmations = [
            {
                id: "permission-1",
                msgId: "permission-message-1",
                requestId: 44,
                callId: "tool-3",
                title: "Run command",
                options: [],
            },
        ];
        manager.on("event", (event) => events.push(event));
        (manager as any).setupTransportHandlers();

        child.emit("close", 7, "SIGTERM");

        expect(manager.status).toBe("error");
        expect(manager.sessionId).toBeNull();
        expect(manager.transport).toBeNull();
        expect(manager.confirmations).toEqual([]);
        expect(manager.error).toContain("ACP process exited unexpectedly");
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: "status", data: { status: "error" } }),
                expect.objectContaining({
                    type: "error",
                    data: { error: expect.stringContaining("ACP process exited unexpectedly") },
                    trace: expect.objectContaining({ failureCategory: "transport_exit" }),
                }),
            ])
        );
    });
});
