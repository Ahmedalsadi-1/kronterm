// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { type WebContents } from "electron";
import * as child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type LspSession = {
    sessionId: string;
    language: string;
    proc: child_process.ChildProcess;
    buffer: string;
    webContents: WebContents;
};

const sessions = new Map<string, LspSession>();
let nextId = 1;

function generateSessionId(): string {
    return `lsp-${Date.now()}-${nextId++}`;
}

/**
 * Find an LSP server command for the given language.
 * Uses a simple lookup. In the future this could read from settings.
 */
function findServer(language: string): { command: string; args: string[] } | null {
    const servers: Record<string, { command: string; args: string[] }> = {
        go: { command: "gopls", args: [] },
        python: { command: "pyright-langserver", args: ["--stdio"] },
        rust: { command: "rust-analyzer", args: [] },
        cpp: { command: "clangd", args: [] },
    };
    return servers[language] ?? null;
}

const LspMaxFileBytes = 1024 * 1024;
const LspMaxResults = 200;
const LspMaxStringLength = 16 * 1024;
const LspRequestTimeoutMs = 10_000;
const LspDiagnosticsTimeoutMs = 4_000;
const LspQueries = new Set(["diagnostics", "symbols", "hover", "definition", "references"]);

type LspRpcMessage = {
    id?: number;
    method?: string;
    params?: any;
    result?: any;
    error?: { code?: number; message?: string };
};

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type BoundedValue = {
    value: any;
    truncated: boolean;
};

function isContainedPath(parentPath: string, childPath: string): boolean {
    const relative = path.relative(parentPath, childPath);
    return (
        relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
}

export function resolveLspQueryPaths(
    workspacePath: string,
    filePath: string
): {
    workspacePath: string;
    filePath: string;
} {
    if (!workspacePath || !filePath) {
        throw new Error("workspacepath and filepath are required");
    }
    const resolvedWorkspace = fs.realpathSync(path.resolve(workspacePath));
    const requestedFile = path.isAbsolute(filePath) ? filePath : path.join(resolvedWorkspace, filePath);
    const resolvedFile = fs.realpathSync(path.resolve(requestedFile));
    if (!isContainedPath(resolvedWorkspace, resolvedFile)) {
        throw new Error("LSP file must be contained by the KronTerm workspace");
    }
    const stat = fs.statSync(resolvedFile);
    if (!stat.isFile()) {
        throw new Error("LSP filepath must identify a regular file");
    }
    if (stat.size > LspMaxFileBytes) {
        throw new Error(`LSP file exceeds ${LspMaxFileBytes} byte limit`);
    }
    return { workspacePath: resolvedWorkspace, filePath: resolvedFile };
}

export function boundLspResult(value: any, maxResults = LspMaxResults, depth = 0): BoundedValue {
    if (depth >= 8) {
        return { value: "[maximum depth reached]", truncated: true };
    }
    if (typeof value === "string") {
        if (value.length <= LspMaxStringLength) {
            return { value, truncated: false };
        }
        return { value: `${value.slice(0, LspMaxStringLength)}…`, truncated: true };
    }
    if (Array.isArray(value)) {
        const limited = value.slice(0, maxResults).map((entry) => boundLspResult(entry, maxResults, depth + 1));
        return {
            value: limited.map((entry) => entry.value),
            truncated: value.length > maxResults || limited.some((entry) => entry.truncated),
        };
    }
    if (value && typeof value === "object") {
        let truncated = false;
        const bounded: Record<string, any> = {};
        for (const [key, entry] of Object.entries(value)) {
            const result = boundLspResult(entry, maxResults, depth + 1);
            bounded[key] = result.value;
            truncated ||= result.truncated;
        }
        return { value: bounded, truncated };
    }
    return { value, truncated: false };
}

class LspQueryTransport {
    private buffer = Buffer.alloc(0);
    private nextRequestId = 1;
    private pending = new Map<number, PendingRequest>();
    private queuedNotifications = new Map<string, any[]>();
    private notificationWaiters = new Map<string, Array<(params: any) => void>>();

    constructor(private proc: child_process.ChildProcessWithoutNullStreams) {
        proc.stdout.on("data", (chunk: Buffer) => this.handleData(chunk));
        proc.on("error", (error) => this.rejectPending(error));
        proc.on("exit", (code, signal) => {
            this.rejectPending(new Error(`LSP server exited before responding (code=${code}, signal=${signal})`));
        });
    }

    private rejectPending(error: Error): void {
        for (const request of this.pending.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        this.pending.clear();
    }

    private handleData(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const headerEnd = this.buffer.indexOf("\r\n\r\n");
            if (headerEnd < 0) {
                return;
            }
            const header = this.buffer.subarray(0, headerEnd).toString("ascii");
            const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
            if (!lengthMatch) {
                this.buffer = this.buffer.subarray(headerEnd + 4);
                continue;
            }
            const contentLength = Number.parseInt(lengthMatch[1], 10);
            const messageEnd = headerEnd + 4 + contentLength;
            if (this.buffer.length < messageEnd) {
                return;
            }
            const body = this.buffer.subarray(headerEnd + 4, messageEnd).toString("utf8");
            this.buffer = this.buffer.subarray(messageEnd);
            try {
                this.handleMessage(JSON.parse(body) as LspRpcMessage);
            } catch (error) {
                this.rejectPending(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    private handleMessage(message: LspRpcMessage): void {
        if (message.method && message.id != null) {
            const result =
                message.method === "workspace/configuration"
                    ? ((message.params?.items ?? []) as unknown[]).map(() => null)
                    : null;
            this.send({ id: message.id, result });
            return;
        }
        if (message.id != null) {
            const request = this.pending.get(message.id);
            if (!request) {
                return;
            }
            clearTimeout(request.timer);
            this.pending.delete(message.id);
            if (message.error) {
                request.reject(
                    new Error(message.error.message ?? `LSP request failed (${message.error.code ?? "unknown"})`)
                );
                return;
            }
            request.resolve(message.result);
            return;
        }
        if (!message.method) {
            return;
        }
        const waiters = this.notificationWaiters.get(message.method);
        const waiter = waiters?.shift();
        if (waiter) {
            waiter(message.params);
            return;
        }
        const queued = this.queuedNotifications.get(message.method) ?? [];
        queued.push(message.params);
        this.queuedNotifications.set(message.method, queued);
    }

    private send(message: LspRpcMessage): void {
        if (this.proc.stdin.destroyed || !this.proc.stdin.writable) {
            throw new Error("LSP server input is unavailable");
        }
        const content = JSON.stringify({ jsonrpc: "2.0", ...message });
        const header = `Content-Length: ${Buffer.byteLength(content, "utf8")}\r\n\r\n`;
        this.proc.stdin.write(header + content);
    }

    request(method: string, params: any, timeoutMs = LspRequestTimeoutMs): Promise<any> {
        const id = this.nextRequestId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`LSP ${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            try {
                this.send({ id, method, params });
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    notify(method: string, params: any): void {
        this.send({ method, params });
    }

    waitForNotification(method: string, timeoutMs: number): Promise<any> {
        const queued = this.queuedNotifications.get(method);
        if (queued?.length) {
            return Promise.resolve(queued.shift());
        }
        return new Promise((resolve, reject) => {
            const waiters = this.notificationWaiters.get(method) ?? [];
            const wrappedResolve = (params: any) => {
                clearTimeout(timer);
                resolve(params);
            };
            const timer = setTimeout(() => {
                const current = this.notificationWaiters.get(method) ?? [];
                this.notificationWaiters.set(
                    method,
                    current.filter((waiter) => waiter !== wrappedResolve)
                );
                reject(new Error(`LSP ${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            waiters.push(wrappedResolve);
            this.notificationWaiters.set(method, waiters);
        });
    }
}

export async function queryLanguageServer(data: CommandLspQueryData): Promise<CommandLspQueryRtnData> {
    if (!LspQueries.has(data.query)) {
        throw new Error(`unsupported LSP query "${data.query}"`);
    }
    const line = data.line ?? 0;
    const character = data.character ?? 0;
    if (line < 0 || character < 0) {
        throw new Error("LSP line and character must be zero-based non-negative integers");
    }
    const server = findServer(data.language);
    if (!server) {
        throw new Error(`No LSP server configured for language "${data.language}"`);
    }
    const resolved = resolveLspQueryPaths(data.workspacepath, data.filepath);
    const text = fs.readFileSync(resolved.filePath, "utf8");
    const uri = pathToFileURL(resolved.filePath).href;
    const proc = child_process.spawn(server.command, server.args, {
        cwd: resolved.workspacePath,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
    });
    const transport = new LspQueryTransport(proc);
    let initialized = false;
    proc.stderr.on("data", (chunk: Buffer) => console.error(`[lsp-query:${data.language}] ${chunk.toString().trim()}`));
    try {
        await transport.request("initialize", {
            processId: null,
            rootUri: pathToFileURL(resolved.workspacePath).href,
            capabilities: { textDocument: { publishDiagnostics: {} } },
            workspaceFolders: [
                { uri: pathToFileURL(resolved.workspacePath).href, name: path.basename(resolved.workspacePath) },
            ],
        });
        initialized = true;
        transport.notify("initialized", {});
        transport.notify("textDocument/didOpen", {
            textDocument: { uri, languageId: data.language, version: 1, text },
        });

        const textDocument = { uri };
        const position = { line, character };
        let result: any;
        if (data.query === "diagnostics") {
            const deadline = Date.now() + LspDiagnosticsTimeoutMs;
            let notification: any;
            do {
                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) {
                    throw new Error(`LSP diagnostics timed out after ${LspDiagnosticsTimeoutMs}ms`);
                }
                notification = await transport.waitForNotification("textDocument/publishDiagnostics", remainingMs);
            } while (notification?.uri !== uri);
            result = notification?.diagnostics ?? [];
        } else if (data.query === "symbols") {
            result = await transport.request("textDocument/documentSymbol", { textDocument });
        } else if (data.query === "hover") {
            result = await transport.request("textDocument/hover", { textDocument, position });
        } else if (data.query === "definition") {
            result = await transport.request("textDocument/definition", { textDocument, position });
        } else {
            result = await transport.request("textDocument/references", {
                textDocument,
                position,
                context: { includeDeclaration: true },
            });
        }
        const maxResults = Math.min(Math.max(data.maxresults || 100, 1), LspMaxResults);
        const bounded = boundLspResult(result ?? [], maxResults);
        return {
            resultjson: JSON.stringify({
                query: data.query,
                language: data.language,
                filepath: path.relative(resolved.workspacePath, resolved.filePath),
                result: bounded.value,
                truncated: bounded.truncated,
            }),
            truncated: bounded.truncated,
        };
    } finally {
        if (initialized) {
            await transport.request("shutdown", null, 1000).catch(() => undefined);
        }
        try {
            transport.notify("exit", {});
        } catch {
            proc.kill("SIGTERM");
        }
        const forceKillTimer = setTimeout(() => proc.kill("SIGTERM"), 1000);
        forceKillTimer.unref();
    }
}

/**
 * Send a JSON-RPC message from the LSP server back to the renderer.
 */
function sendToRenderer(webContents: WebContents, sessionId: string, content: string) {
    if (webContents.isDestroyed()) return;
    webContents.send("lsp-message", { sessionId, content });
}

/**
 * Start a language server for the given language.
 * Returns the sessionId, or throws on failure.
 */
export function startLanguageServer(webContents: WebContents, language: string): string {
    const server = findServer(language);
    if (!server) {
        throw new Error(`No LSP server configured for language "${language}"`);
    }

    const sessionId = generateSessionId();

    const proc = child_process.spawn(server.command, server.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
    });

    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        // LSP uses Content-Length headers
        // Process complete messages from the buffer
        let idx: number;
        while ((idx = buffer.indexOf("\r\n\r\n")) !== -1) {
            const header = buffer.substring(0, idx);
            const contentStart = idx + 4;
            const match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
                buffer = buffer.substring(contentStart);
                continue;
            }
            const length = parseInt(match[1], 10);
            if (buffer.length < contentStart + length) {
                break; // wait for more data
            }
            const body = buffer.substring(contentStart, contentStart + length);
            buffer = buffer.substring(contentStart + length);

            const session = sessions.get(sessionId);
            if (session) {
                sendToRenderer(session.webContents, sessionId, body);
            }
        }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
        console.error(`[lsp:${sessionId}] stderr:`, chunk.toString().trim());
    });

    proc.on("error", (err) => {
        console.error(`[lsp:${sessionId}] process error:`, err.message);
        const session = sessions.get(sessionId);
        if (session) {
            sendToRenderer(session.webContents, sessionId, JSON.stringify({ error: err.message }));
        }
        sessions.delete(sessionId);
    });

    proc.on("exit", (code, signal) => {
        console.log(`[lsp:${sessionId}] exited code=${code} signal=${signal}`);
        sessions.delete(sessionId);
    });

    sessions.set(sessionId, { sessionId, language, proc, buffer, webContents });

    console.log(`[lsp] started ${server.command} for "${language}" (session=${sessionId})`);
    return sessionId;
}

/**
 * Send a raw JSON-RPC string to a running LSP server.
 */
export function sendLspMessage(sessionId: string, content: string): void {
    const session = sessions.get(sessionId);
    if (!session) {
        console.warn(`[lsp] cannot send to unknown session: ${sessionId}`);
        return;
    }
    const header = `Content-Length: ${Buffer.byteLength(content, "utf-8")}\r\n\r\n`;
    session.proc.stdin?.write(header + content);
}

/**
 * Stop a running LSP server.
 */
export function stopLanguageServer(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) {
        return;
    }
    console.log(`[lsp] stopping session: ${sessionId}`);
    session.proc.kill("SIGTERM");
    // Force kill after 3s if it doesn't exit cleanly
    setTimeout(() => {
        const s = sessions.get(sessionId);
        if (s) {
            s.proc.kill("SIGKILL");
            sessions.delete(sessionId);
        }
    }, 3000);
}

/**
 * Stop all running LSP sessions.
 */
export function stopAllLanguageServers(): void {
    for (const [sessionId] of sessions) {
        stopLanguageServer(sessionId);
    }
}
