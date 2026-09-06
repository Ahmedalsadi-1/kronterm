import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";

type JsonRpcResponse = {
    id?: number;
    result?: unknown;
    error?: {
        code?: number;
        message?: string;
    };
};

export type KronComputerUseContent =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string };

export type KronComputerUseToolResult = {
    content: KronComputerUseContent[];
    isError?: boolean;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: NodeJS.Timeout;
};

const RequestTimeoutMs = 30_000;

export class KronComputerUseClient {
    private child: ChildProcessWithoutNullStreams | null = null;
    private stdout: Interface | null = null;
    private nextRequestId = 1;
    private pending = new Map<number, PendingRequest>();
    private startPromise: Promise<void> | null = null;
    private stderrTail = "";

    diagnostics(): Record<string, unknown> {
        return {
            name: "kron-computer-use",
            binary: this.resolveBinary(),
            running: this.child != null && !this.child.killed,
            visualCursor: process.env.OPEN_COMPUTER_USE_VISUAL_CURSOR !== "0",
            platform: process.platform,
        };
    }

    async callTool(name: string, args: Record<string, unknown> = {}): Promise<KronComputerUseToolResult> {
        await this.ensureStarted();
        const result = await this.request("tools/call", { name, arguments: args });
        return result as KronComputerUseToolResult;
    }

    async turnEnded(): Promise<void> {
        if (!this.child || this.child.killed) {
            return;
        }
        this.notify("notifications/turn-ended", {});
    }

    close(): void {
        this.stdout?.close();
        this.stdout = null;
        this.child?.kill();
        this.child = null;
        this.startPromise = null;
        this.rejectPending(new Error("kron-computer-use runtime stopped"));
    }

    private async ensureStarted(): Promise<void> {
        if (this.child && !this.child.killed) {
            return;
        }
        if (!this.startPromise) {
            this.startPromise = this.start();
        }
        try {
            await this.startPromise;
        } finally {
            this.startPromise = null;
        }
    }

    private async start(): Promise<void> {
        const binary = this.resolveBinary();
        this.stderrTail = "";
        const child = spawn(binary, ["mcp"], {
            env: {
                ...process.env,
                OPEN_COMPUTER_USE_VISUAL_CURSOR: process.env.OPEN_COMPUTER_USE_VISUAL_CURSOR ?? "1",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.child = child;
        this.stdout = createInterface({ input: child.stdout });
        this.stdout.on("line", (line) => this.handleLine(line));
        child.stderr.on("data", (chunk: Buffer) => {
            this.stderrTail = (this.stderrTail + chunk.toString("utf8")).slice(-4000);
        });
        child.once("error", (error) => {
            this.handleExit(new Error(`unable to start kron-computer-use: ${error.message}`));
        });
        child.once("exit", (code, signal) => {
            const detail = this.stderrTail.trim();
            this.handleExit(
                new Error(
                    `kron-computer-use exited (${signal ?? code ?? "unknown"})${detail ? `: ${detail}` : ""}`
                )
            );
        });
        await this.request("initialize", {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
                name: "kron-term",
                version: "1.0.0",
            },
        });
        this.notify("notifications/initialized", {});
    }

    private resolveBinary(): string {
        const configured = process.env.KRON_COMPUTER_USE_BIN;
        if (configured) {
            return configured;
        }
        const candidates = [
            join(homedir(), ".nvm", "versions", "node", "v24.13.0", "bin", "open-computer-use"),
            "/opt/homebrew/bin/open-computer-use",
            "/usr/local/bin/open-computer-use",
        ];
        return candidates.find((candidate) => existsSync(candidate)) ?? "open-computer-use";
    }

    private request(method: string, params: Record<string, unknown>): Promise<unknown> {
        const child = this.child;
        if (!child || child.killed) {
            return Promise.reject(new Error("kron-computer-use runtime is not running"));
        }
        const id = this.nextRequestId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`kron-computer-use ${method} timed out`));
            }, RequestTimeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
        });
    }

    private notify(method: string, params: Record<string, unknown>): void {
        if (!this.child || this.child.killed) {
            return;
        }
        this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    }

    private handleLine(line: string): void {
        let response: JsonRpcResponse;
        try {
            response = JSON.parse(line) as JsonRpcResponse;
        } catch {
            return;
        }
        if (typeof response.id !== "number") {
            return;
        }
        const pending = this.pending.get(response.id);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pending.delete(response.id);
        if (response.error) {
            pending.reject(new Error(response.error.message ?? `JSON-RPC error ${response.error.code ?? "unknown"}`));
            return;
        }
        pending.resolve(response.result);
    }

    private handleExit(error: Error): void {
        this.stdout?.close();
        this.stdout = null;
        this.child = null;
        this.rejectPending(error);
    }

    private rejectPending(error: Error): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }
}

export function previewImageUrl(result: KronComputerUseToolResult): string | undefined {
    const image = result.content.find((item) => item.type === "image");
    return image?.type === "image" ? `data:${image.mimeType};base64,${image.data}` : undefined;
}
