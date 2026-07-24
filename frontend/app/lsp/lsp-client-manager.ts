// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { LspService } from "@/app/lsp/lsp-service";
import { IpcMessageReader, IpcMessageWriter } from "@/app/lsp/lsp-transport";
import type * as MonacoTypes from "monaco-editor";
import { MonacoLanguageClient } from "monaco-languageclient";
import type { MessageReader, MessageWriter } from "vscode-jsonrpc";
import { BUILTIN_LSP_CONFIGS, LspLanguageConfig } from "../../types/lsp-types";

/**
 * Maps Monaco language IDs to running LSP clients.
 */
const activeClients = new Map<string, MonacoLanguageClient>();

/**
 * Resolve the LspLanguageConfig for a given Monaco language ID.
 */
function getConfigForLanguage(language: string): LspLanguageConfig | undefined {
    return BUILTIN_LSP_CONFIGS.find((c) => c.language === language);
}

/**
 * Start an LSP client for the given Monaco model and language.
 * Returns true if a client was started, false if the language has no configured server.
 */
export async function startLspClient(
    model: MonacoTypes.editor.ITextModel,
    language: string
): Promise<MonacoLanguageClient | null> {
    // Don't start if there's already a client for this language
    if (activeClients.has(language)) {
        return activeClients.get(language)!;
    }

    const config = getConfigForLanguage(language);
    if (!config) {
        return null; // no LSP configured for this language (e.g. plaintext, markdown)
    }

    try {
        const session = await LspService.startLanguageServer(language);

        // Create transports backed by our IPC LSP session
        const reader: MessageReader = new IpcMessageReader(session);
        const writer: MessageWriter = new IpcMessageWriter(session);

        const client = new MonacoLanguageClient({
            name: `${config.displayName} Language Client`,
            clientOptions: {
                documentSelector: [{ language }],
                // Synchronize the text document with the server
                synchronize: {
                    configurationSection: language,
                },
                // Initialization options — send the workspace URI
                initializationOptions: {
                    capabilities: {
                        textDocument: {
                            hover: {
                                contentFormat: ["markdown", "plaintext"],
                            },
                            completion: {
                                completionItem: {
                                    snippetSupport: true,
                                },
                            },
                        },
                    },
                },
            },
            messageTransports: {
                reader,
                writer,
            },
        });

        client.start();
        activeClients.set(language, client);

        // Notify the server about the open document
        client.sendNotification("textDocument/didOpen", {
            textDocument: {
                uri: model.uri.toString(),
                languageId: language,
                version: 1,
                text: model.getValue(),
            },
        });

        // Listen for document changes
        const changeSub = model.onDidChangeContent(() => {
            client.sendNotification("textDocument/didChange", {
                textDocument: {
                    uri: model.uri.toString(),
                    version: model.getVersionId(),
                },
                contentChanges: [
                    {
                        text: model.getValue(),
                    },
                ],
            });
        });

        // Clean up on client stop
        client.onDidChangeState((stateChange) => {
            if (stateChange.newState === 3) {
                // Stopped state
                changeSub.dispose();
                activeClients.delete(language);
            }
        });

        return client;
    } catch (err) {
        console.error(`[lsp] failed to start client for "${language}":`, err);
        return null;
    }
}

/**
 * Stop the LSP client for a given language.
 */
export function stopLspClient(language: string): void {
    const client = activeClients.get(language);
    if (!client) return;
    client.stop();
    activeClients.delete(language);
}

/**
 * Stop all active LSP clients.
 */
export function stopAllLspClients(): void {
    for (const [language] of activeClients) {
        stopLspClient(language);
    }
}
