// Adapted from Nous Research Hermes Agent's MIT-licensed JSON-RPC gateway client.
// KronosChamber already carries the same attribution in its imported source.

import type { GatewayEvent } from "../types";

export type GatewayConnectionState = "idle" | "connecting" | "open" | "closed" | "error";
type GatewayRequestId = number | string;

interface JsonRpcFrame {
    error?: { code?: number; message?: string };
    id?: GatewayRequestId | null;
    method?: string;
    params?: GatewayEvent;
    result?: unknown;
}

interface PendingCall {
    reject: (error: Error) => void;
    resolve: (value: unknown) => void;
    timer?: number;
}

export class JsonRpcGatewayClient {
    private nextId = 0;
    private pending = new Map<GatewayRequestId, PendingCall>();
    private socket: WebSocket | null = null;
    private state: GatewayConnectionState = "idle";
    private readonly eventHandlers = new Set<(event: GatewayEvent) => void>();
    private readonly stateHandlers = new Set<(state: GatewayConnectionState) => void>();

    get connectionState(): GatewayConnectionState {
        return this.state;
    }

    async connect(wsUrl: string, timeoutMs = 15_000): Promise<void> {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return;
        }
        if (this.state === "connecting") {
            throw new Error("Gateway connection is already in progress");
        }

        this.setState("connecting");
        const socket = new WebSocket(wsUrl);
        this.socket = socket;

        socket.addEventListener("message", (message) => {
            if (this.socket === socket) {
                this.handleMessage(message.data);
            }
        });
        socket.addEventListener("close", () => {
            if (this.socket !== socket) {
                return;
            }
            this.socket = null;
            this.setState("closed");
            this.rejectAllPending(new Error("KronosCode gateway closed"));
        });

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            const timer = window.setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                socket.close();
                if (this.socket === socket) {
                    this.socket = null;
                }
                this.setState("error");
                reject(new Error("KronosCode gateway connection timed out"));
            }, timeoutMs);
            const cleanup = () => {
                window.clearTimeout(timer);
                socket.removeEventListener("open", onOpen);
                socket.removeEventListener("error", onError);
            };
            const onOpen = () => {
                if (settled || this.socket !== socket) {
                    return;
                }
                settled = true;
                cleanup();
                this.setState("open");
                resolve();
            };
            const onError = () => {
                if (settled || this.socket !== socket) {
                    return;
                }
                settled = true;
                cleanup();
                this.setState("error");
                reject(new Error("KronosCode gateway connection failed"));
            };
            socket.addEventListener("open", onOpen, { once: true });
            socket.addEventListener("error", onError, { once: true });
        });
    }

    close(): void {
        const socket = this.socket;
        this.socket = null;
        socket?.close();
        this.setState("closed");
        this.rejectAllPending(new Error("KronosCode gateway closed"));
    }

    onEvent(handler: (event: GatewayEvent) => void): () => void {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }

    onState(handler: (state: GatewayConnectionState) => void): () => void {
        this.stateHandlers.add(handler);
        handler(this.state);
        return () => this.stateHandlers.delete(handler);
    }

    request<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 120_000): Promise<T> {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error("KronosCode gateway is not connected"));
        }

        const id = `iphone-${++this.nextId}`;
        return new Promise<T>((resolve, reject) => {
            const pending: PendingCall = { resolve: (value) => resolve(value as T), reject };
            if (timeoutMs > 0) {
                pending.timer = window.setTimeout(() => {
                    if (this.pending.delete(id)) {
                        reject(new Error(`KronosCode request timed out: ${method}`));
                    }
                }, timeoutMs);
            }
            this.pending.set(id, pending);
            try {
                socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
            } catch (error) {
                this.clearPending(id);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    private handleMessage(raw: unknown): void {
        let frame: JsonRpcFrame;
        try {
            frame = JSON.parse(typeof raw === "string" ? raw : String(raw)) as JsonRpcFrame;
        } catch {
            return;
        }

        if (frame.id != null) {
            const call = this.pending.get(frame.id);
            if (!call) {
                return;
            }
            this.clearPending(frame.id);
            if (frame.error) {
                call.reject(new Error(frame.error.message || "KronosCode RPC failed"));
            } else {
                call.resolve(frame.result);
            }
            return;
        }

        if (frame.method === "event" && frame.params?.type) {
            for (const handler of this.eventHandlers) {
                handler(frame.params);
            }
        }
    }

    private clearPending(id: GatewayRequestId): void {
        const call = this.pending.get(id);
        if (call?.timer) {
            window.clearTimeout(call.timer);
        }
        this.pending.delete(id);
    }

    private rejectAllPending(error: Error): void {
        for (const [id, call] of this.pending) {
            if (call.timer) {
                window.clearTimeout(call.timer);
            }
            call.reject(error);
            this.pending.delete(id);
        }
    }

    private setState(state: GatewayConnectionState): void {
        if (this.state === state) {
            return;
        }
        this.state = state;
        for (const handler of this.stateHandlers) {
            handler(state);
        }
    }
}
