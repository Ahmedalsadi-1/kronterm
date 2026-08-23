// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { isWorkspacePresentation, type WorkspacePresentation } from "@/app/tab/workspace-presentation";
import { applyThemePreset, readStoredThemePresetId } from "@/app/view/kronsettings/kronsettings-theme-presets";
import { createBlock, setActiveTab } from "@/store/global";
import { isMacOS } from "@/util/platformutil";
import { cn } from "@/util/util";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./kronarchy-shell.scss";
import { WorkspaceLayoutModel } from "./workspace-layout-model";

const KronarchyEnabledStorageKey = "kronterm:kronarchy-enabled";
const KronarchyEnabledChangedEvent = "kronterm:kronarchy-enabled-changed";
const LayoutModeStorageKey = "kronterm:layoutmode";
const LayoutModeChangedEvent = "kronterm:layoutmode-changed";

type LauncherItem = {
    id: string;
    label: string;
    description: string;
    icon: string;
    keywords: string;
    shortcut?: string;
    action: () => void | Promise<void>;
};

type LauncherSection = {
    id: string;
    label: string;
    items: LauncherItem[];
};

function readKronarchyEnabled(): boolean {
    try {
        return window.localStorage.getItem(KronarchyEnabledStorageKey) === "true";
    } catch {
        return false;
    }
}

function readLayoutMode(): WorkspacePresentation {
    try {
        const stored = window.localStorage.getItem(LayoutModeStorageKey);
        return isWorkspacePresentation(stored) ? stored : "widgets";
    } catch {
        return "widgets";
    }
}

function publishLayoutMode(mode: WorkspacePresentation): void {
    try {
        window.localStorage.setItem(LayoutModeStorageKey, mode);
        window.dispatchEvent(new CustomEvent(LayoutModeChangedEvent, { detail: { mode } }));
    } catch (error) {
        console.warn("[Kronarchy] local layout preference update failed", error);
    }
    void RpcApi.SetConfigCommand(TabRpcClient, { "app:layoutmode": mode }).catch((error) => {
        console.warn("[Kronarchy] workspace presentation update failed", error);
    });
}

function publishKronarchyEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(KronarchyEnabledStorageKey, String(enabled));
        window.dispatchEvent(new CustomEvent(KronarchyEnabledChangedEvent, { detail: { enabled } }));
    } catch (error) {
        console.warn("[Kronarchy] local mode preference update failed", error);
    }
}

function formatClock(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function shouldOpenKronarchyLauncher(
    event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey">,
    enabled: boolean
): boolean {
    const isCommandSpace = event.code === "Space" && event.metaKey && !event.altKey && !event.ctrlKey;
    return isCommandSpace && (event.shiftKey || enabled);
}

const KronarchyShell = ({ workspace, activeTabId }: { workspace: Workspace; activeTabId: string }) => {
    const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
    const [enabled, setEnabled] = useState(readKronarchyEnabled);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeItemId, setActiveItemId] = useState<string>();
    const [layoutMode, setLayoutMode] = useState<WorkspacePresentation>(readLayoutMode);
    const [clock, setClock] = useState(() => formatClock(new Date()));
    const [online, setOnline] = useState(() => window.navigator.onLine);
    const [addConnOpen, setAddConnOpen] = useState(false);
    const [connValue, setConnValue] = useState("");
    const [addingConn, setAddingConn] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const workspaceName = workspace?.name?.trim() || "workspace";
    const tabIds = workspace?.tabids ?? [];

    const setKronarchyMode = useCallback((nextEnabled: boolean) => {
        setEnabled(nextEnabled);
        publishKronarchyEnabled(nextEnabled);
    }, []);

    const chooseLayout = useCallback((mode: WorkspacePresentation) => {
        publishLayoutMode(mode);
        setLayoutMode(mode);
        setOpen(false);
    }, []);

    const openSettings = useCallback(async (section: "theme" | "visual" | "shortcuts") => {
        await createBlock({
            meta: {
                view: "kronsettings",
                "kronsettings:section": section,
            } as MetaType,
        });
        setOpen(false);
    }, []);

    const launchWidget = useCallback(async (blockDef: BlockDef, ephemeral = false) => {
        await createBlock(blockDef, false, ephemeral);
        setOpen(false);
    }, []);

    const openConnectionsEditor = useCallback(() => {
        void launchWidget({ meta: { view: "waveconfig", file: "connections.json" } });
        setAddConnOpen(false);
    }, [launchWidget]);

    const handleAddConnection = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            const host = connValue.trim();
            if (!host || addingConn) {
                return;
            }
            setAddingConn(true);
            try {
                await RpcApi.SetConnectionsConfigCommand(TabRpcClient, { host, metamaptype: {} });
                RpcApi.ConnConnectCommand(TabRpcClient, { host }, { timeout: 60000 }).catch((error) =>
                    console.warn("[Kronarchy] connection attempt failed", error)
                );
                setConnValue("");
                setAddConnOpen(false);
            } catch (error) {
                console.warn("[Kronarchy] failed to save connection profile", error);
            } finally {
                setAddingConn(false);
            }
        },
        [addingConn, connValue]
    );

    const sections = useMemo<LauncherSection[]>(
        () => [
            {
                id: "workspace-tabs",
                label: "Workspace tabs",
                items: tabIds.map((tabId, index) => ({
                    id: `workspace-tab-${tabId}`,
                    label: `Workspace tab ${index + 1}`,
                    description: tabId === activeTabId ? "Current workspace tab" : "Switch to this workspace tab",
                    icon: tabId === activeTabId ? "fa-folder-open" : "fa-folder",
                    keywords: `workspace tab ${index + 1} switch open`,
                    shortcut: index < 9 ? `Super + ${index + 1}` : undefined,
                    action: () => {
                        setActiveTab(tabId);
                        setOpen(false);
                    },
                })),
            },
            {
                id: "apps",
                label: "Apps",
                items: [
                    {
                        id: "terminal",
                        label: "Terminal",
                        description: "Open a local shell",
                        icon: "fa-square-terminal",
                        keywords: "shell command cli",
                        shortcut: "Super + Enter",
                        action: () => launchWidget({ meta: { view: "term", controller: "shell" } }),
                    },
                    {
                        id: "browser",
                        label: "Browser",
                        description: "Open a web widget",
                        icon: "fa-globe",
                        keywords: "web internet",
                        shortcut: "Super + Shift + Enter",
                        action: () => launchWidget({ meta: { view: "web" } }),
                    },
                    {
                        id: "files",
                        label: "Files",
                        description: "Browse your home directory",
                        icon: "fa-folder",
                        keywords: "preview directory explorer",
                        shortcut: "Super + Shift + F",
                        action: () => launchWidget({ meta: { view: "preview", file: "~" } }),
                    },
                    {
                        id: "agents",
                        label: "AI Agents",
                        description: "Open KronosChamber",
                        icon: "fa-circle-nodes",
                        keywords: "kronoscode chamber chat ai",
                        shortcut: "Super + Shift + A",
                        action: () => launchWidget({ meta: { view: "chathubv2" } }),
                    },
                    {
                        id: "system-monitor",
                        label: "Activity",
                        description: "Inspect live machine metrics",
                        icon: "fa-chart-line",
                        keywords: "system monitor cpu memory network sysinfo btop",
                        shortcut: "Super + Ctrl + T",
                        action: () => launchWidget({ meta: { view: "sysinfo" } }),
                    },
                ],
            },
            {
                id: "trigger",
                label: "Trigger",
                items: [
                    {
                        id: "scratchpad",
                        label: "Scratchpad",
                        description: "Open a temporary terminal overlay",
                        icon: "fa-layer-group",
                        keywords: "floating ephemeral terminal overlay",
                        shortcut: "Super + S",
                        action: () => launchWidget({ meta: { view: "term", controller: "shell" } }, true),
                    },
                    {
                        id: "layout-widgets",
                        label: "Tiled Widgets",
                        description: "Omarchy-style resizable splits",
                        icon: "fa-table-cells-large",
                        keywords: "windows tile split grid layout",
                        action: () => chooseLayout("widgets"),
                    },
                    {
                        id: "layout-tabs",
                        label: "Widget Tabs",
                        description: "One focused widget with a tab strip",
                        icon: "fa-window-restore",
                        keywords: "tabs focused window layout",
                        action: () => chooseLayout("tabs"),
                    },
                    {
                        id: "layout-canvas",
                        label: "Canvas",
                        description: "Spatial pan-and-zoom workspace",
                        icon: "fa-object-group",
                        keywords: "spatial infinite layout",
                        action: () => chooseLayout("canvas"),
                    },
                    {
                        id: "sidebar-full",
                        label: "Full Sidebar",
                        description: "Show workspace names and widget tree",
                        icon: "fa-table-columns",
                        keywords: "sidebar panel full expand names",
                        action: () => {
                            workspaceLayoutModel.setSidePanelMode("full");
                            setOpen(false);
                        },
                    },
                    {
                        id: "sidebar-compact",
                        label: "Sidebar Icon Rail",
                        description: "Collapse workspace tabs to a skinny icon line",
                        icon: "fa-sidebar",
                        keywords: "sidebar compact icons skinny collapse",
                        action: () => {
                            workspaceLayoutModel.setSidePanelMode("compact");
                            setOpen(false);
                        },
                    },
                    {
                        id: "sidebar-hidden",
                        label: "Hide Sidebar",
                        description: "Use the bottom-left button to restore it",
                        icon: "fa-sidebar-flip",
                        keywords: "sidebar hidden disappear fullscreen",
                        action: () => {
                            workspaceLayoutModel.setSidePanelMode("hidden");
                            setOpen(false);
                        },
                    },
                ],
            },
            {
                id: "style",
                label: "Style",
                items: [
                    {
                        id: "themes",
                        label: "Themes",
                        description: "Choose colors and appearance",
                        icon: "fa-swatchbook",
                        keywords: "omarchy kronarchy wallpaper color style",
                        action: () => openSettings("theme"),
                    },
                    {
                        id: "kronarchy-mode",
                        label: "Kronarchy Shell",
                        description: enabled
                            ? "Disable the Omarchy-inspired shell"
                            : "Enable the Omarchy-inspired shell",
                        icon: "fa-border-all",
                        keywords: "toggle mode shell top bar square chrome",
                        action: () => setKronarchyMode(!enabled),
                    },
                ],
            },
            {
                id: "setup",
                label: "Setup",
                items: [
                    {
                        id: "settings",
                        label: "Settings",
                        description: "Configure the workspace",
                        icon: "fa-sliders",
                        keywords: "preferences options visual setup",
                        action: () => openSettings("visual"),
                    },
                    {
                        id: "connections",
                        label: "Connections",
                        description: "Manage hosts and credentials",
                        icon: "fa-network-wired",
                        keywords: "ssh remote host setup",
                        action: () => launchWidget({ meta: { view: "waveconfig" } }),
                    },
                    {
                        id: "keyboard-shortcuts",
                        label: "Keyboard Shortcuts",
                        description: "See every command binding",
                        icon: "fa-keyboard",
                        keywords: "keys hotkeys super space setup",
                        shortcut: "Super + K",
                        action: () => openSettings("shortcuts"),
                    },
                ],
            },
        ],
        [activeTabId, chooseLayout, enabled, launchWidget, openSettings, setKronarchyMode, tabIds]
    );

    const normalizedQuery = query.trim().toLowerCase();
    const visibleSections = useMemo(
        () =>
            sections
                .map((section) => ({
                    ...section,
                    items: section.items.filter((item) =>
                        `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(normalizedQuery)
                    ),
                }))
                .filter((section) => section.items.length > 0),
        [normalizedQuery, sections]
    );
    const visibleItems = useMemo(() => visibleSections.flatMap((section) => section.items), [visibleSections]);

    useEffect(() => {
        document.documentElement.classList.toggle("kronarchy-mode", enabled);
        return () => document.documentElement.classList.remove("kronarchy-mode");
    }, [enabled]);

    useEffect(() => {
        if (enabled) {
            applyThemePreset(readStoredThemePresetId());
        }
    }, [enabled]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (shouldOpenKronarchyLauncher(event, enabled)) {
                event.preventDefault();
                event.stopPropagation();
                setOpen((current) => !current);
                return;
            }
            if (event.key === "Escape") {
                setOpen(false);
                return;
            }
            if (!enabled || !event.metaKey || event.repeat) {
                return;
            }

            const run = (action: () => void | Promise<void>) => {
                event.preventDefault();
                event.stopPropagation();
                void action();
            };
            const key = event.key.toLowerCase();

            if (event.code === "Enter" && !event.altKey && !event.ctrlKey) {
                run(() =>
                    event.shiftKey
                        ? launchWidget({ meta: { view: "web" } })
                        : launchWidget({ meta: { view: "term", controller: "shell" } })
                );
                return;
            }
            if (key === "s" && !event.altKey && !event.ctrlKey && !event.shiftKey) {
                run(() => launchWidget({ meta: { view: "term", controller: "shell" } }, true));
                return;
            }
            if (key === "f" && event.shiftKey && !event.altKey && !event.ctrlKey) {
                run(() => launchWidget({ meta: { view: "preview", file: "~" } }));
                return;
            }
            if (key === "a" && event.shiftKey && !event.altKey && !event.ctrlKey) {
                run(() => launchWidget({ meta: { view: "chathubv2" } }));
                return;
            }
            if (key === "t" && event.ctrlKey && !event.altKey && !event.shiftKey) {
                run(() => launchWidget({ meta: { view: "sysinfo" } }));
                return;
            }
            if (key === "k" && !event.altKey && !event.ctrlKey && !event.shiftKey) {
                run(() => openSettings("shortcuts"));
                return;
            }
            if (/^Digit[1-9]$/.test(event.code) && !event.altKey && !event.ctrlKey && !event.shiftKey) {
                const tabId = tabIds[Number(event.code.slice(-1)) - 1];
                if (tabId) {
                    run(() => setActiveTab(tabId));
                }
                return;
            }
            if (event.code === "Tab" && !event.altKey && !event.ctrlKey) {
                const activeIndex = Math.max(0, tabIds.indexOf(activeTabId));
                const direction = event.shiftKey ? -1 : 1;
                const nextIndex = (activeIndex + direction + tabIds.length) % tabIds.length;
                const nextTabId = tabIds[nextIndex];
                if (nextTabId) {
                    run(() => setActiveTab(nextTabId));
                }
            }
        };
        const handleLayoutChanged = (event: Event) => {
            const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
            if (isWorkspacePresentation(mode)) {
                setLayoutMode(mode);
            }
        };
        const handleEnabledChanged = (event: Event) => {
            const nextEnabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
            if (typeof nextEnabled === "boolean") {
                setEnabled(nextEnabled);
            }
        };
        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener(LayoutModeChangedEvent, handleLayoutChanged);
        window.addEventListener(KronarchyEnabledChangedEvent, handleEnabledChanged);
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener(LayoutModeChangedEvent, handleLayoutChanged);
            window.removeEventListener(KronarchyEnabledChangedEvent, handleEnabledChanged);
        };
    }, [activeTabId, enabled, launchWidget, openSettings, tabIds]);

    useEffect(() => {
        const interval = window.setInterval(() => setClock(formatClock(new Date())), 30_000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!open) {
            setQuery("");
            setActiveItemId(undefined);
            return;
        }
        window.requestAnimationFrame(() => searchRef.current?.focus());
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        setActiveItemId((current) => {
            if (current && visibleItems.some((item) => item.id === current)) {
                return current;
            }
            return visibleItems[0]?.id;
        });
    }, [open, visibleItems]);

    const handleLauncherKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === "Enter") {
                const activeItem = visibleItems.find((item) => item.id === activeItemId) ?? visibleItems[0];
                if (activeItem) {
                    event.preventDefault();
                    void activeItem.action();
                }
                return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                return;
            }
            event.preventDefault();
            if (visibleItems.length === 0) {
                return;
            }
            const currentIndex = Math.max(
                0,
                visibleItems.findIndex((item) => item.id === activeItemId)
            );
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = (currentIndex + direction + visibleItems.length) % visibleItems.length;
            setActiveItemId(visibleItems[nextIndex]?.id);
        },
        [activeItemId, visibleItems]
    );

    return (
        <>
            {enabled && addConnOpen && (
                <div
                    className="kronarchy-popover-backdrop"
                    role="presentation"
                    onMouseDown={() => setAddConnOpen(false)}
                />
            )}
            {enabled && (
                <header className={cn("kronarchy-bar", isMacOS() && "is-macos")}>
                    <div className="kronarchy-bar-section kronarchy-bar-left">
                        <button
                            type="button"
                            className="kronarchy-menu-trigger"
                            onClick={() => setOpen(true)}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                void launchWidget({ meta: { view: "term", controller: "shell" } });
                            }}
                            aria-label="Open Kronarchy launcher"
                            title="Launcher · right-click for terminal"
                        >
                            <span aria-hidden="true">K</span>
                        </button>
                    </div>
                    <div className="kronarchy-bar-title">
                        <strong>Kronarchy</strong>
                        <span aria-hidden="true">/</span>
                        <span>{workspaceName}</span>
                    </div>
                    <div className="kronarchy-bar-section kronarchy-bar-right">
                        <button
                            type="button"
                            className="kronarchy-layout-status"
                            onClick={() => setOpen(true)}
                            title="Change workspace layout"
                        >
                            {layoutMode}
                        </button>
                        <button
                            type="button"
                            className={cn("kronarchy-connected", !online && "is-offline")}
                            onClick={() => void launchWidget({ meta: { view: "waveconfig" } })}
                            title="Open connections"
                        >
                            <span aria-hidden="true" /> {online ? "online" : "offline"}
                        </button>
                        <div className="kronarchy-add-connection-wrap">
                            <button
                                type="button"
                                className={cn("kronarchy-add-connection", addConnOpen && "is-open")}
                                onClick={() => setAddConnOpen((open) => !open)}
                                aria-label="New connection profile"
                                aria-expanded={addConnOpen}
                                title="New connection profile"
                            >
                                <span aria-hidden="true">+</span>
                            </button>
                            {addConnOpen && (
                                <div
                                    className="kronarchy-connection-pop"
                                    role="dialog"
                                    aria-label="New connection profile"
                                >
                                    <form onSubmit={(event) => void handleAddConnection(event)}>
                                        <input
                                            value={connValue}
                                            onChange={(event) => setConnValue(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Escape") {
                                                    setAddConnOpen(false);
                                                }
                                            }}
                                            placeholder="user@host"
                                            aria-label="Connection host"
                                            autoFocus
                                            spellCheck={false}
                                        />
                                        <button type="submit" disabled={!connValue.trim() || addingConn}>
                                            {addingConn ? "…" : "Add"}
                                        </button>
                                    </form>
                                    <button
                                        type="button"
                                        className="kronarchy-connection-pop-secondary"
                                        onClick={openConnectionsEditor}
                                    >
                                        Edit connections
                                    </button>
                                </div>
                            )}
                        </div>
                        <time title={new Date().toLocaleDateString()}>{clock}</time>
                    </div>
                </header>
            )}

            {open && (
                <div
                    className="kronarchy-launcher-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setOpen(false);
                        }
                    }}
                >
                    <section
                        className="kronarchy-launcher"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Kronarchy"
                        onKeyDown={handleLauncherKeyDown}
                    >
                        <header className="kronarchy-launcher-header">
                            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Type to search..."
                                aria-label="Search widgets, settings, and layouts"
                            />
                            <kbd>Shift + Super + Space</kbd>
                        </header>
                        <div className="kronarchy-launcher-results">
                            {visibleSections.length > 0 ? (
                                visibleSections.map((section) => (
                                    <div key={section.id} className="kronarchy-launcher-section">
                                        <h2>{section.label}</h2>
                                        {section.items.map((item) => {
                                            const selectedLayout =
                                                item.id === `layout-${layoutMode}` ||
                                                (item.id === "layout-widgets" && layoutMode === "widgets");
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className={cn(
                                                        selectedLayout && "is-selected",
                                                        activeItemId === item.id && "is-active"
                                                    )}
                                                    onClick={() => void item.action()}
                                                    onMouseEnter={() => setActiveItemId(item.id)}
                                                >
                                                    <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                                                    <span>
                                                        <strong>{item.label}</strong>
                                                        <small>{item.description}</small>
                                                    </span>
                                                    {selectedLayout && (
                                                        <i
                                                            className="fa-solid fa-check kronarchy-item-check"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    {!selectedLayout && item.shortcut && (
                                                        <kbd className="kronarchy-item-shortcut">{item.shortcut}</kbd>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            ) : (
                                <p className="kronarchy-launcher-empty">No matching command</p>
                            )}
                        </div>
                        <footer className="kronarchy-launcher-footer">
                            <button
                                type="button"
                                className={enabled ? "is-enabled" : ""}
                                onClick={() => setKronarchyMode(!enabled)}
                                aria-pressed={enabled}
                            >
                                <i className="fa-solid fa-border-all" aria-hidden="true" />
                                Kronarchy mode {enabled ? "on" : "off"}
                            </button>
                            <span>Esc to close</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export {
    KronarchyEnabledChangedEvent,
    KronarchyEnabledStorageKey,
    KronarchyShell,
    publishKronarchyEnabled,
    readKronarchyEnabled,
    shouldOpenKronarchyLauncher,
};
