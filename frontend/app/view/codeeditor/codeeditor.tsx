// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { startLspClient, stopLspClient } from "@/app/lsp/lsp-client-manager";
import { LspService } from "@/app/lsp/lsp-service";
import { MonacoCodeEditor } from "@/app/monaco/monaco-react";
import { useOverrideConfigAtom } from "@/app/store/global";
import { boundNumber } from "@/util/util";
import type * as MonacoTypes from "monaco-editor";
import * as MonacoModule from "monaco-editor";
import { useEffect, useMemo, useRef } from "react";

function defaultEditorOptions(): MonacoTypes.editor.IEditorOptions {
    const opts: MonacoTypes.editor.IEditorOptions = {
        scrollBeyondLastLine: false,
        fontSize: 12,
        fontFamily: "Hack",
        smoothScrolling: true,
        scrollbar: {
            useShadows: false,
            verticalScrollbarSize: 5,
            horizontalScrollbarSize: 5,
        },
        minimap: {
            enabled: true,
        },
        stickyScroll: {
            enabled: false,
        },
    };
    return opts;
}

interface CodeEditorProps {
    blockId: string;
    text: string;
    readonly: boolean;
    language?: string;
    fileName?: string;
    onChange?: (text: string) => void;
    onMount?: (monacoPtr: MonacoTypes.editor.IStandaloneCodeEditor, monaco: typeof MonacoModule) => () => void;
}

export function CodeEditor({ blockId, text, language, fileName, readonly, onChange, onMount }: CodeEditorProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const unmountRef = useRef<() => void>(null);
    const lspLanguageRef = useRef<string | undefined>(undefined);
    const minimapEnabled = useOverrideConfigAtom(blockId, "editor:minimapenabled") ?? false;
    const stickyScrollEnabled = useOverrideConfigAtom(blockId, "editor:stickyscrollenabled") ?? false;
    const wordWrap = useOverrideConfigAtom(blockId, "editor:wordwrap") ?? false;
    const fontSize = boundNumber(useOverrideConfigAtom(blockId, "editor:fontsize"), 6, 64);
    const uuidRef = useRef(crypto.randomUUID()).current;
    let editorPath: string;
    if (fileName) {
        const separator = fileName.startsWith("/") ? "" : "/";
        editorPath = blockId + separator + fileName;
    } else {
        editorPath = uuidRef;
    }

    // Initialize LSP service once
    useEffect(() => {
        LspService.init();
    }, []);

    useEffect(() => {
        return () => {
            // unmount function: stop LSP and run user cleanup
            if (lspLanguageRef.current) {
                stopLspClient(lspLanguageRef.current);
                lspLanguageRef.current = undefined;
            }
            if (unmountRef.current) {
                unmountRef.current();
            }
        };
    }, []);

    function handleEditorChange(text: string) {
        if (onChange) {
            onChange(text);
        }
    }

    function handleEditorOnMount(
        editor: MonacoTypes.editor.IStandaloneCodeEditor,
        monaco: typeof MonacoModule
    ): () => void {
        // Start LSP client for the current language
        if (language && !readonly) {
            const model = editor.getModel();
            if (model) {
                lspLanguageRef.current = language;
                startLspClient(model, language).catch((err) =>
                    console.warn(`[lsp] could not start client for "${language}":`, err)
                );
            }
        }

        if (onMount) {
            const cleanup = onMount(editor, monaco);
            unmountRef.current = cleanup;
            return cleanup;
        }
        return undefined;
    }

    const editorOpts = useMemo(() => {
        const opts = defaultEditorOptions();
        opts.minimap.enabled = minimapEnabled;
        opts.stickyScroll.enabled = stickyScrollEnabled;
        opts.wordWrap = wordWrap ? "on" : "off";
        opts.fontSize = fontSize;
        opts.copyWithSyntaxHighlighting = false;
        return opts;
    }, [minimapEnabled, stickyScrollEnabled, wordWrap, fontSize, readonly]);

    return (
        <div className="flex flex-col w-full h-full overflow-hidden items-center justify-center">
            <div className="flex flex-col h-full w-full" ref={divRef}>
                <MonacoCodeEditor
                    readonly={readonly}
                    text={text}
                    options={editorOpts}
                    onChange={handleEditorChange}
                    onMount={handleEditorOnMount}
                    path={editorPath}
                    language={language}
                />
            </div>
        </div>
    );
}
