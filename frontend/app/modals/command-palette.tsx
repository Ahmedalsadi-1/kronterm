// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { modalsModel } from "@/app/store/modalmodel";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { createBlock } from "@/store/global";
import type { LucideIcon } from "lucide-react";
import { Bot, FolderOpen, Globe2, MessageSquareText, Search, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { filterCommandPaletteActions } from "./command-palette-utils";
import "./command-palette.scss";

interface CommandPaletteAction {
    id: string;
    label: string;
    detail: string;
    keywords: string[];
    icon: LucideIcon;
    run: () => void;
}

const CommandPaletteActions: CommandPaletteAction[] = [
    {
        id: "ask-kronos",
        label: "Ask Kronos",
        detail: "Focus the agent composer in this workspace",
        keywords: ["agent", "chat", "ai", "codex", "assistant"],
        icon: Bot,
        run: () => {
            WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
            setTimeout(() => WaveAIModel.getInstance().focusInput(), 50);
        },
    },
    {
        id: "open-chamber",
        label: "Open KronosChamber",
        detail: "Launch the durable agent workspace",
        keywords: ["agent", "chat", "control", "session", "evidence"],
        icon: MessageSquareText,
        run: () => void createBlock({ meta: { view: "chathubv2" } }),
    },
    {
        id: "new-terminal",
        label: "New terminal",
        detail: "Open a local shell widget",
        keywords: ["shell", "command", "cli", "cursor"],
        icon: TerminalSquare,
        run: () => void createBlock({ meta: { view: "term", controller: "shell" } }),
    },
    {
        id: "open-browser",
        label: "Open browser",
        detail: "Research or navigate the web",
        keywords: ["web", "comet", "url", "research"],
        icon: Globe2,
        run: () => void createBlock({ meta: { view: "web" } }),
    },
    {
        id: "open-files",
        label: "Open files",
        detail: "Browse files from your home directory",
        keywords: ["folder", "project", "editor", "preview"],
        icon: FolderOpen,
        run: () => void createBlock({ meta: { view: "preview", file: "~" } }),
    },
];

function CommandPaletteModal() {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const actions = useMemo(() => filterCommandPaletteActions(CommandPaletteActions, query), [query]);
    const close = useCallback(() => modalsModel.popModal(), []);
    const runAction = useCallback(
        (action: CommandPaletteAction) => {
            close();
            action.run();
        },
        [close]
    );

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((index) => (actions.length === 0 ? 0 : (index + 1) % actions.length));
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((index) => (actions.length === 0 ? 0 : (index - 1 + actions.length) % actions.length));
            return;
        }
        if (event.key === "Enter" && actions[selectedIndex]) {
            event.preventDefault();
            runAction(actions[selectedIndex]);
        }
    };

    const palette = (
        <div className="command-palette-wrapper" role="presentation">
            <div className="command-palette-backdrop" onMouseDown={close} />
            <section className="command-palette" role="dialog" aria-modal="true" aria-label="KronTerm commands">
                <div className="command-palette-search">
                    <Search aria-hidden="true" size={19} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask, open, or create…"
                        aria-label="Search commands"
                        aria-controls={listId}
                        aria-activedescendant={
                            actions[selectedIndex] ? `${listId}-${actions[selectedIndex].id}` : undefined
                        }
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd>esc</kbd>
                </div>
                <div id={listId} className="command-palette-results" role="listbox" aria-label="Commands">
                    {actions.length === 0 ? (
                        <div className="command-palette-empty">No matching commands</div>
                    ) : (
                        actions.map((action, index) => {
                            const Icon = action.icon;
                            const selected = index === selectedIndex;
                            return (
                                <button
                                    type="button"
                                    id={`${listId}-${action.id}`}
                                    key={action.id}
                                    className="command-palette-item cursor-pointer"
                                    role="option"
                                    aria-selected={selected}
                                    data-selected={selected || undefined}
                                    onMouseMove={() => setSelectedIndex(index)}
                                    onClick={() => runAction(action)}
                                >
                                    <span className="command-palette-icon">
                                        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                                    </span>
                                    <span className="command-palette-copy">
                                        <strong>{action.label}</strong>
                                        <span>{action.detail}</span>
                                    </span>
                                    {selected ? <kbd>↵</kbd> : null}
                                </button>
                            );
                        })
                    )}
                </div>
                <footer className="command-palette-footer">
                    <span>One workspace for agents, code, terminals, and the web</span>
                    <span>⌘⇧P</span>
                </footer>
            </section>
        </div>
    );

    return ReactDOM.createPortal(palette, document.getElementById("main")!);
}

CommandPaletteModal.displayName = "CommandPaletteModal";

export { CommandPaletteModal };
