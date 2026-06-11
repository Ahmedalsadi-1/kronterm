// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { promises as fs } from "fs";
import path from "path";
import {
    AcpAgentInfo,
    AcpInitializeResult,
    AcpJsonRpcMessage,
    AcpSessionUpdate,
    JSONRPC_VERSION,
    parseInitializeResult,
} from "./acp-types";

export type NdjsonTransportEvent =
    | { type: "initialize"; result: AcpInitializeResult }
    | { type: "session_update"; update: AcpSessionUpdate }
    | { type: "permission_request"; id: number; params: any }
    | { type: "notification"; method: string; params: any }
    | { type: "response"; id: number; result: any; error?: { code: number; message: string } }
    | { type: "disconnect"; code: number | null; signal: NodeJS.Signals | string | null }
    | { type: "error"; error: string }
    | { type: "stderr"; data: string };

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer?: NodeJS.Timeout;
    method: string;
    params?: Record<string, unknown>;
    timeoutMs: number;
    paused: boolean;
}

const MaxPendingJsonBytes = 128_000;
const MaxPendingJsonLines = 256;
const DefaultRequestTimeoutMs = 60_000;
const InitializeRequestTimeoutMs = 180_000;
const PromptRequestTimeoutMs = 300_000;

export class NdjsonTransport extends EventEmitter {
    private child: ChildProcess;
    private detached: boolean;
    private workspace: string;
    private nextId = 1;
    private pending = new Map<number, PendingRequest>();
    private initialized = false;
    private initResolve?: (result: AcpInitializeResult) => void;
    private initReject?: (error: Error) => void;
    private initPromise: Promise<AcpInitializeResult>;
    private stderrBuffer = "";

    constructor(child: ChildProcess, detached = false, workspace = process.cwd()) {
        super();
        this.child = child;
        this.detached = detached;
        this.workspace = workspace;
        this.initPromise = new Promise<AcpInitializeResult>((resolve, reject) => {
            this.initResolve = resolve;
            this.initReject = reject;
        });

        this.setupStdout();
        this.setupStderr();
        this.setupChildHandlers();
    }

    private setupStdout() {
        let buffer = "";
        let pendingJson = "";
        let pendingJsonLineCount = 0;

        const resetPendingJson = () => {
            pendingJson = "";
            pendingJsonLineCount = 0;
        };

        const parseAndHandle = (value: string): boolean => {
            let msg: AcpJsonRpcMessage;
            try {
                msg = JSON.parse(value);
            } catch {
                return false;
            }
            this.handleMessage(msg);
            return true;
        };

        const handleLine = (line: string) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }
            if (pendingJson) {
                const nextPendingJson = `${pendingJson}\n${trimmed}`;
                if (parseAndHandle(nextPendingJson)) {
                    resetPendingJson();
                    return;
                }
                pendingJsonLineCount += 1;
                if (nextPendingJson.length <= MaxPendingJsonBytes && pendingJsonLineCount <= MaxPendingJsonLines) {
                    pendingJson = nextPendingJson;
                    return;
                }
                resetPendingJson();
            }
            if (parseAndHandle(trimmed)) {
                return;
            }
            if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
                pendingJson = trimmed;
                pendingJsonLineCount = 1;
            }
        };

        this.child.stdout?.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf-8");
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                handleLine(line);
            }
        });

        this.child.stdout?.on("end", () => {
            if (buffer.trim()) {
                handleLine(buffer);
            }
            if (pendingJson) {
                parseAndHandle(pendingJson);
            }
        });
    }

    private setupStderr() {
        this.child.stderr?.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf-8");
            this.stderrBuffer += text;
            this.emit("stderr", text);
        });
    }

    private setupChildHandlers() {
        this.child.on("error", (err: Error) => {
            this.rejectAllPending(err);
            if (this.listenerCount("error") > 0) {
                this.emit("error", err);
            }
        });

        this.child.on("close", (code, signal) => {
            if (this.pending.size > 0) {
                this.rejectAllPending(
                    new Error(
                        `ACP transport closed before response (code=${code ?? "null"}, signal=${signal ?? "none"})`
                    )
                );
            }
            this.emit("disconnect", {
                type: "disconnect",
                code,
                signal,
            });
        });
    }

    private handleRequestTimeout(id: number, pending: PendingRequest) {
        if (pending.paused) {
            return;
        }
        this.pending.delete(id);
        if (pending.method === "session/prompt") {
            const sessionId = typeof pending.params?.sessionId === "string" ? pending.params.sessionId : undefined;
            if (sessionId) {
                this.sendNotification("session/cancel", { sessionId });
            }
            pending.reject(new Error(`LLM request timed out after ${pending.timeoutMs / 1000} seconds`));
            return;
        }
        pending.reject(new Error(`Request ${pending.method} timed out after ${pending.timeoutMs / 1000} seconds`));
    }

    private startPendingTimer(id: number, pending: PendingRequest) {
        pending.timer = setTimeout(() => {
            this.handleRequestTimeout(id, pending);
        }, pending.timeoutMs);
    }

    private pausePromptTimeouts() {
        for (const pending of this.pending.values()) {
            if (pending.method !== "session/prompt" || pending.paused) {
                continue;
            }
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = undefined;
            }
            pending.paused = true;
        }
    }

    private resumePromptTimeouts() {
        for (const [id, pending] of this.pending) {
            if (pending.method !== "session/prompt" || !pending.paused) {
                continue;
            }
            pending.paused = false;
            this.startPendingTimer(id, pending);
        }
    }

    private resetPromptTimeouts() {
        for (const [id, pending] of this.pending) {
            if (pending.method !== "session/prompt" || pending.paused) {
                continue;
            }
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
            this.startPendingTimer(id, pending);
        }
    }

    private handleMessage(msg: AcpJsonRpcMessage) {
        if ("method" in msg) {
            const request = msg as any;
            if (request.method === "session/request_permission" && request.id != null) {
                this.pausePromptTimeouts();
                this.emit("permission_request", {
                    id: request.id,
                    params: request.params,
                });
            } else if (request.method === "fs/read_text_file" && request.id != null) {
                void this.handleReadTextFile(request.id, request.params);
            } else if (request.method === "fs/write_text_file" && request.id != null) {
                void this.handleWriteTextFile(request.id, request.params);
            } else if (request.id != null) {
                this.sendError(request.id, -32601, `Unsupported ACP client method: ${request.method}`);
            } else if (request.method === "session/update") {
                this.resetPromptTimeouts();
                this.emit("session_update", request.params);
            }
            this.emit("notification", {
                method: request.method,
                params: request.params,
            });
            return;
        }

        if ("id" in msg && msg.id != null && ("result" in msg || "error" in msg)) {
            const response = msg as any;
            const pending = this.pending.get(response.id);
            if (pending) {
                if (pending.timer) {
                    clearTimeout(pending.timer);
                }
                this.pending.delete(response.id);
                if (response.error) {
                    pending.reject(new Error(response.error.message));
                } else {
                    pending.resolve(response.result);
                }
            }

            if (response.id === 1 && response.result) {
                const parsed = parseInitializeResult(response.result);
                this.initialized = true;
                this.initResolve?.(parsed);
                this.emit("initialize", parsed);
            } else {
                this.emit("response", {
                    type: "response",
                    id: response.id,
                    result: response.result,
                    error: response.error,
                });
            }
        }
    }

    private resolveWorkspacePath(targetPath: unknown): string {
        if (typeof targetPath !== "string" || !targetPath) {
            throw new Error("File path is required");
        }
        const workspaceRoot = path.resolve(this.workspace);
        const resolvedPath = path.isAbsolute(targetPath)
            ? path.resolve(targetPath)
            : path.resolve(workspaceRoot, targetPath);
        const relativePath = path.relative(workspaceRoot, resolvedPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            throw new Error(`Path not allowed: ${targetPath} is outside the workspace`);
        }
        return resolvedPath;
    }

    private async handleReadTextFile(id: number, params: any) {
        try {
            const resolvedPath = this.resolveWorkspacePath(params?.path);
            const content = await fs.readFile(resolvedPath, "utf-8");
            this.sendResponse(id, { content });
        } catch (err) {
            this.sendError(id, -32000, `Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async handleWriteTextFile(id: number, params: any) {
        try {
            const resolvedPath = this.resolveWorkspacePath(params?.path);
            if (typeof params?.content !== "string") {
                throw new Error("File content is required");
            }
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, params.content, "utf-8");
            this.sendResponse(id, null);
        } catch (err) {
            this.sendError(id, -32000, `Failed to write file: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async initialize(capabilities: Record<string, unknown> = {}): Promise<AcpInitializeResult> {
        const result = await this.sendRequest("initialize", {
            clientInfo: { name: "KronTerm", version: "0.14.3" },
            protocolVersion: 1,
            clientCapabilities: {
                fs: { readTextFile: true, writeTextFile: true },
                terminal: false,
                ...capabilities,
            },
        });
        return parseInitializeResult(result);
    }

    async sendRequest(method: string, params?: Record<string, unknown>): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timeoutMs =
                method === "initialize"
                    ? InitializeRequestTimeoutMs
                    : method === "session/prompt"
                      ? PromptRequestTimeoutMs
                      : DefaultRequestTimeoutMs;
            const pending: PendingRequest = { resolve, reject, method, params, timeoutMs, paused: false };
            this.startPendingTimer(id, pending);
            this.pending.set(id, pending);

            const request = {
                jsonrpc: JSONRPC_VERSION,
                id,
                method,
                params,
            };

            try {
                if (!this.child.stdin) {
                    throw new Error("ACP child stdin is unavailable");
                }
                this.child.stdin.write(JSON.stringify(request) + "\n");
            } catch (err) {
                if (pending.timer) {
                    clearTimeout(pending.timer);
                }
                this.pending.delete(id);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    sendResponse(id: number, result: unknown) {
        this.resumePromptTimeouts();
        const response = {
            jsonrpc: JSONRPC_VERSION,
            id,
            result,
        };
        this.child.stdin?.write(JSON.stringify(response) + "\n");
    }

    sendError(id: number, code: number, message: string) {
        this.resumePromptTimeouts();
        const response = {
            jsonrpc: JSONRPC_VERSION,
            id,
            error: { code, message },
        };
        this.child.stdin?.write(JSON.stringify(response) + "\n");
    }

    sendNotification(method: string, params?: Record<string, unknown>) {
        const notification = {
            jsonrpc: JSONRPC_VERSION,
            method,
            params,
        };
        this.child.stdin?.write(JSON.stringify(notification) + "\n");
    }

    async waitForInit(): Promise<AcpInitializeResult> {
        return this.initPromise;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getAgentInfo(): AcpAgentInfo | null {
        return null;
    }

    kill() {
        this.rejectAllPending(new Error("Transport closed"));
        try {
            this.child.stdin?.end();
        } catch {
            // Best effort; process termination below still owns cleanup.
        }
        if (this.detached && process.platform !== "win32" && this.child.pid) {
            const processGroupId = -this.child.pid;
            try {
                process.kill(processGroupId, "SIGTERM");
                const forceKillTimer = setTimeout(() => {
                    if (this.child.exitCode != null || this.child.signalCode != null) {
                        return;
                    }
                    try {
                        process.kill(processGroupId, "SIGKILL");
                    } catch {
                        // The process group exited after the graceful termination request.
                    }
                }, 1000);
                forceKillTimer.unref();
                return;
            } catch {
                // The process group may have already exited; fall back to the wrapper handle.
            }
        }
        this.child.kill();
    }

    private rejectAllPending(err: Error) {
        for (const [id, pending] of this.pending) {
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
            pending.reject(err);
            this.pending.delete(id);
        }
    }
}
