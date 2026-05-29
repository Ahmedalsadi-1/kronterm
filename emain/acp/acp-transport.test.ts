// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from "events";
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
    const child = {
        stdout,
        stderr,
        stdin: {
            write: (value: string) => writes.push(value),
        },
        exitCode: null,
        signalCode: null,
        kill: vi.fn(),
    };
    return { child: child as any, stdout, writes };
}

describe("NdjsonTransport", () => {
    it("advertises only client methods implemented by Kronterm", async () => {
        const { child, stdout, writes } = makeChild();
        const transport = new NdjsonTransport(child);
        const initialized = transport.initialize();

        const request = JSON.parse(writes[0]);
        expect(request.params.clientCapabilities).toEqual({
            fs: { readTextFile: false, writeTextFile: false },
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
                    name: "kron-term",
                    command: process.execPath,
                    args: [path.join(process.cwd(), "mcp-kron-term", "dist", "index.js")],
                    env: [{ name: "ELECTRON_RUN_AS_NODE", value: "1" }],
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
            cwd: "/tmp/kronterm-workspace",
            mcpServers: [
                {
                    name: "kron-term",
                    command: process.execPath,
                    args: [path.join(process.cwd(), "mcp-kron-term", "dist", "index.js")],
                    env: [
                        { name: "ELECTRON_RUN_AS_NODE", value: "1" },
                        { name: "KRONTERM_JWT", value: "surface-token" },
                        { name: "KRONTERM_TABID", value: "tab-1" },
                        { name: "KRONTERM_BLOCKID", value: "block-1" },
                    ],
                },
            ],
        });
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
});
