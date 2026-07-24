// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { type WebContents } from "electron";
import * as child_process from "node:child_process";

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
