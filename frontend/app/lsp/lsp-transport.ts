// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Disposable, Message, MessageWriter } from "vscode-jsonrpc";
import * as JsonRpc from "vscode-jsonrpc";
import type { LspSession } from "./lsp-service";

/**
 * A MessageReader backed by our Electron IPC LSP session.
 * The AbstractMessageReader base class provides onError, onClose, and
 * onPartialMessage as Event<T> properties (implemented via Emitter).
 * We only need to implement listen() and call fireError/fireClose.
 */
export class IpcMessageReader extends JsonRpc.AbstractMessageReader {
    private session: LspSession;
    private callback: ((message: Message) => void) | null = null;

    constructor(session: LspSession) {
        super();
        this.session = session;
    }

    listen(callback: (message: Message) => void): Disposable {
        this.callback = callback;

        this.session.onMessage((content: string) => {
            if (!this.callback) return;
            try {
                const parsed = JSON.parse(content) as Message;
                this.callback(parsed);
            } catch (e) {
                this.fireError(e);
            }
        });

        this.session.onError((error: Error) => {
            this.fireError(error);
        });

        this.session.onClose(() => {
            this.fireClose();
        });

        return {
            dispose: () => {
                this.callback = null;
            },
        };
    }
}

/**
 * A MessageWriter backed by our Electron IPC LSP session.
 * The AbstractMessageWriter base class provides onError and onClose
 * as Event<T> properties. We only need to implement write() and end().
 */
export class IpcMessageWriter extends JsonRpc.AbstractMessageWriter implements MessageWriter {
    private session: LspSession;

    constructor(session: LspSession) {
        super();
        this.session = session;
    }

    async write(msg: Message): Promise<void> {
        try {
            const content = JSON.stringify(msg);
            this.session.send(content);
        } catch (e) {
            this.fireError(e, msg);
        }
    }

    end(): void {
        // Session manages its own lifecycle via LspService
    }
}
