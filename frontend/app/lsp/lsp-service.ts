// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi } from "@/app/store/global";
import type { LspIpcMessage } from "../../types/lsp-types";

/**
 * Manages a single LSP session via Electron IPC.
 * Provides a monaco-languageclient compatible transport interface.
 */
export class LspSession {
    readonly sessionId: string;
    readonly language: string;

    // callback storage (using different names from the methods)
    private dataCb: ((data: string) => void) | null = null;
    private errorCb: ((error: Error) => void) | null = null;
    private closeCb: (() => void) | null = null;
    private _closed = false;

    constructor(sessionId: string, language: string) {
        this.sessionId = sessionId;
        this.language = language;
    }

    get closed(): boolean {
        return this._closed;
    }

    /** Register a callback when a JSON-RPC message arrives from the server. */
    onMessage(callback: (data: string) => void): void {
        this.dataCb = callback;
    }

    /** Register a callback for transport errors. */
    onError(callback: (error: Error) => void): void {
        this.errorCb = callback;
    }

    /** Register a callback when the session closes. */
    onClose(callback: () => void): void {
        this.closeCb = callback;
    }

    /** Handle an incoming raw message from the LSP server (via IPC). */
    handleMessage(content: string): void {
        if (this._closed) return;
        try {
            this.dataCb?.(content);
        } catch (err) {
            console.error(`[lsp:${this.sessionId}] handler error:`, err);
        }
    }

    /** Send a raw JSON-RPC string to the LSP server. */
    send(content: string): void {
        if (this._closed) return;
        const api = getApi();
        if (api?.lspSend) {
            api.lspSend(this.sessionId, content);
        } else {
            console.warn("[lsp] lspSend not available (running outside Electron?)");
        }
    }

    /** Stop the LSP session. */
    stop(): void {
        if (this._closed) return;
        this._closed = true;
        const api = getApi();
        api?.lspStop?.(this.sessionId);
        this.closeCb?.();
        LspService.removeSession(this.sessionId);
    }

    /** Handle an error from the transport layer. */
    handleError(error: Error): void {
        this.errorCb?.(error);
    }
}

/**
 * Singleton LSP service managing all active LSP sessions.
 */
class LspServiceImpl {
    private sessions = new Map<string, LspSession>();
    private cleanupFn: (() => void) | null = null;

    /**
     * Initialize the LSP service. Call once at app startup.
     * Registers the IPC message listener.
     */
    init(): void {
        if (this.cleanupFn) return;

        const api = getApi();
        if (api?.onLspMessage) {
            this.cleanupFn = api.onLspMessage((msg: LspIpcMessage) => {
                const session = this.sessions.get(msg.sessionId);
                if (session) {
                    session.handleMessage(msg.content);
                }
            });
        }
    }

    /**
     * Start a new LSP session for the given language.
     * Returns a session object. Reuses an existing session if one is already running.
     */
    async startLanguageServer(language: string): Promise<LspSession> {
        for (const session of this.sessions.values()) {
            if (session.language === language && !session.closed) {
                return session;
            }
        }

        const api = getApi();
        if (!api?.lspStart) {
            throw new Error("LSP IPC not available (running outside Electron?)");
        }

        const sessionId = await api.lspStart(language);
        const session = new LspSession(sessionId, language);

        // Register cleanup on close
        const origClose = session.onClose.bind(session);
        session.onClose(() => {
            this.sessions.delete(sessionId);
        });

        this.sessions.set(sessionId, session);
        return session;
    }

    /** Get an existing session by ID. */
    getSession(sessionId: string): LspSession | undefined {
        return this.sessions.get(sessionId);
    }

    /** Get the active session for a language. */
    getSessionForLanguage(language: string): LspSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.language === language && !session.closed) {
                return session;
            }
        }
        return undefined;
    }

    /** Stop all active LSP sessions. */
    stopAll(): void {
        for (const session of this.sessions.values()) {
            session.stop();
        }
        this.sessions.clear();
    }

    /** Internal: remove a session by ID. */
    removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (!session.closed) {
                session.stop();
            }
            this.sessions.delete(sessionId);
        }
    }

    /** Clean up the service — remove IPC listener and stop all sessions. */
    dispose(): void {
        this.stopAll();
        this.cleanupFn?.();
        this.cleanupFn = null;
    }
}

export const LspService = new LspServiceImpl();
