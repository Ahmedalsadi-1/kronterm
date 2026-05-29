// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
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
    | { type: "error"; error: string }
    | { type: "stderr"; data: string };

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

export class NdjsonTransport extends EventEmitter {
    private child: ChildProcess;
    private detached: boolean;
    private nextId = 1;
    private pending = new Map<number, PendingRequest>();
    private initialized = false;
    private initResolve?: (result: AcpInitializeResult) => void;
    private initReject?: (error: Error) => void;
    private initPromise: Promise<AcpInitializeResult>;
    private stderrBuffer = "";

    constructor(child: ChildProcess, detached = false) {
        super();
        this.child = child;
        this.detached = detached;
        this.initPromise = new Promise<AcpInitializeResult>((resolve, reject) => {
            this.initResolve = resolve;
            this.initReject = reject;
        });

        this.setupStdout();
        this.setupStderr();
    }

    private setupStdout() {
        let buffer = "";

        this.child.stdout?.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf-8");
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                this.handleLine(trimmed);
            }
        });

        this.child.stdout?.on("end", () => {
            if (buffer.trim()) {
                this.handleLine(buffer.trim());
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

    private handleLine(line: string) {
        let msg: AcpJsonRpcMessage;
        try {
            msg = JSON.parse(line);
        } catch {
            return;
        }

        if ("method" in msg) {
            const request = msg as any;
            if (request.method === "session/request_permission" && request.id != null) {
                this.emit("permission_request", {
                    id: request.id,
                    params: request.params,
                });
            } else if (request.id != null) {
                this.sendError(request.id, -32601, `Unsupported ACP client method: ${request.method}`);
            } else if (request.method === "session/update") {
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
                clearTimeout(pending.timer);
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

    async initialize(capabilities: Record<string, unknown> = {}): Promise<AcpInitializeResult> {
        const result = await this.sendRequest("initialize", {
            protocolVersion: 1,
            clientCapabilities: {
                fs: { readTextFile: false, writeTextFile: false },
                terminal: false,
                ...capabilities,
            },
        });
        return parseInitializeResult(result);
    }

    async sendRequest(method: string, params?: Record<string, unknown>): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, 120000);

            this.pending.set(id, { resolve, reject, timer });

            const request = {
                jsonrpc: JSONRPC_VERSION,
                id,
                method,
                params,
            };

            this.child.stdin?.write(JSON.stringify(request) + "\n");
        });
    }

    sendResponse(id: number, result: unknown) {
        const response = {
            jsonrpc: JSONRPC_VERSION,
            id,
            result,
        };
        this.child.stdin?.write(JSON.stringify(response) + "\n");
    }

    sendError(id: number, code: number, message: string) {
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
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error("Transport closed"));
            this.pending.delete(id);
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
}
