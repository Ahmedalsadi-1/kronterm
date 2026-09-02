// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { AppIcon } from "@/app/components/app-icon";
import { getBuiltinViewDescriptors, useInstalledAppDescriptors } from "@/app/store/app-registry";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { createBlock, getApi } from "@/store/global";
import type { LucideIcon } from "lucide-react";
import { Bot, Layers, LayoutGrid, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { filterCommandPaletteActions } from "./command-palette-utils";
import "./command-palette.scss";

type CommandPaletteGroup = "applications" | "commands" | "workspaces";

interface CommandPaletteAction {
    id: string;
    label: string;
    detail: string;
    keywords: string[];
    group: CommandPaletteGroup;
    icon?: LucideIcon;
    iconUrl?: string;
    run: () => void;
}

const CommandActions: CommandPaletteAction[] = [
    {
        id: "ask-kronos",
        label: "Ask Kronos",
        detail: "Focus the agent composer in this workspace",
        keywords: ["agent", "chat", "ai", "codex", "assistant", "hermes"],
        group: "commands",
        icon: Bot,
        run: () => {
            WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
            setTimeout(() => WaveAIModel.getInstance().focusInput(), 50);
        },
    },
    {
        id: "os-mode",
        label: "Open OS Mode",
        detail: "Switch to the spatial desktop",
        keywords: ["spatial", "desktop", "canvas", "os", "fullscreen"],
        group: "commands",
        icon: LayoutGrid,
        run: () => {
            window.localStorage.setItem("kronterm:layoutmode", "os");
            window.dispatchEvent(new CustomEvent("kronterm:layoutmode-changed", { detail: { mode: "os" } }));
            void RpcApi.SetConfigCommand(TabRpcClient, { "app:layoutmode": "os" });
        },
    },
];

const ApplicationViews = ["term", "web", "chathubv2", "preview", "sysinfo", "sandbox"];

function makeApplicationResults(): CommandPaletteAction[] {
    const byView = new Map(getBuiltinViewDescriptors([]).map((descriptor) => [descriptor.view, descriptor]));
    return ApplicationViews.flatMap((view) => {
        const descriptor = byView.get(view);
        if (descriptor == null) return [];
        return [
            {
                id: descriptor.id,
                label: descriptor.name,
                detail: descriptor.category ?? "Application",
                keywords: descriptor.aliases,
                group: "applications" as const,
                iconUrl: descriptor.icon,
                run: () => void createBlock({ meta: { view } }),
            },
        ];
    });
}

const ApplicationResults = makeApplicationResults();

const GroupLabels: Record<CommandPaletteGroup, string> = {
    applications: "Applications",
    commands: "Commands",
    workspaces: "Workspaces",
};

function CommandPaletteModal() {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [workspaceItems, setWorkspaceItems] = useState<CommandPaletteAction[]>([]);
    const installedApps = useInstalledAppDescriptors();
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const installedResults = useMemo<CommandPaletteAction[]>(
        () =>
            installedApps.map((descriptor) => ({
                id: descriptor.id,
                label: descriptor.name,
                detail: descriptor.category ?? "Native app",
                keywords: descriptor.aliases,
                group: "applications" as const,
                iconUrl: descriptor.icon,
                run: () => {
                    void createBlock({
                        meta: {
                            view: "appstream",
                            "appstream:appid": descriptor.installedAppId ?? descriptor.id,
                            "appstream:appname": descriptor.name,
                        } as unknown as MetaType,
                    });
                },
            })),
        [installedApps]
    );
    const actions = useMemo(
        () =>
            filterCommandPaletteActions(
                [...ApplicationResults, ...installedResults, ...CommandActions, ...workspaceItems],
                query
            ),
        [installedResults, workspaceItems, query]
    );
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

    useEffect(() => {
        let cancelled = false;
        void RpcApi.WorkspaceListCommand(TabRpcClient, {})
            .then((items) => {
                if (cancelled || items == null) return;
                setWorkspaceItems(
                    items.map((item, index) => ({
                        id: `workspace-${item.workspacedata.oid}`,
                        label: item.workspacedata.name || `Workspace ${index + 1}`,
                        detail: "Switch workspace",
                        keywords: ["workspace", "switch", "space", "go to"],
                        group: "workspaces" as const,
                        icon: Layers,
                        run: () => getApi().switchWorkspace(item.workspacedata.oid),
                    }))
                );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

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
                        aria-label="Search commands and applications"
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
                            const previous = index > 0 ? actions[index - 1] : undefined;
                            const showHeader = previous == null || previous.group !== action.group;
                            const headerLabel =
                                showHeader && index === 0 && query.trim() !== "" ? "Top Results" : GroupLabels[action.group];
                            const Icon = action.icon;
                            const selected = index === selectedIndex;
                            return (
                                <Fragment key={action.id}>
                                    {showHeader && (
                                        <div className="command-palette-group" role="presentation">
                                            {headerLabel}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        id={`${listId}-${action.id}`}
                                        className="command-palette-item cursor-pointer"
                                        role="option"
                                        aria-selected={selected}
                                        data-selected={selected || undefined}
                                        onMouseMove={() => setSelectedIndex(index)}
                                        onClick={() => runAction(action)}
                                    >
                                        <span className="command-palette-icon">
                                            {action.iconUrl != null ? (
                                                <AppIcon icon={action.iconUrl} size={18} />
                                            ) : (
                                                Icon != null && <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                                            )}
                                        </span>
                                        <span className="command-palette-copy">
                                            <strong>{action.label}</strong>
                                            <span>{action.detail}</span>
                                        </span>
                                        {selected ? <kbd>↵</kbd> : null}
                                    </button>
                                </Fragment>
                            );
                        })
                    )}
                </div>
                <footer className="command-palette-footer">
                    <span>One workspace for agents, code, terminals, and the web</span>
                    <span>⌘⇧Space</span>
                </footer>
            </section>
        </div>
    );

    return ReactDOM.createPortal(palette, document.getElementById("main")!);
}

CommandPaletteModal.displayName = "CommandPaletteModal";

export { CommandPaletteModal };
