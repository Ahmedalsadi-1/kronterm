// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    KronarchyEnabledChangedEvent,
    publishKronarchyEnabled,
    readKronarchyEnabled,
} from "@/app/workspace/kronarchy-shell";
import { SidePanelMode, WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { setActiveTab } from "@/store/global";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspacePresentations, type WorkspacePresentation } from "./workspace-presentation";
import "./workspace-presentation-switcher.scss";

const PresentationDetails: Record<WorkspacePresentation, { icon: string; label: string; description: string }> = {
    widgets: { icon: "fa-table-cells-large", label: "Widgets", description: "Resizable tiled splits" },
    tabs: { icon: "fa-window-restore", label: "Tabs", description: "Focused widgets with a tab strip" },
    canvas: { icon: "fa-object-group", label: "Canvas", description: "Spatial pan-and-zoom workspace" },
    web: { icon: "fa-globe", label: "Web", description: "Full-screen web surface" },
};

const SidePanelDetails: Record<SidePanelMode, { icon: string; label: string; description: string }> = {
    full: { icon: "fa-table-columns", label: "Full sidebar", description: "Names, workspace tree, and controls" },
    compact: { icon: "fa-sidebar", label: "Icon rail", description: "A skinny vertical line of workspace icons" },
    hidden: { icon: "fa-sidebar-flip", label: "Hide sidebar", description: "Reopen it from the bottom-left button" },
};

const WorkspacePresentationSwitcher = ({
    value,
    onChange,
    workspace,
    activeTabId,
}: {
    value: WorkspacePresentation;
    onChange: (value: WorkspacePresentation) => void;
    workspace: Workspace;
    activeTabId: string;
}) => {
    const layoutModel = WorkspaceLayoutModel.getInstance();
    const sidePanelMode = useAtomValue(layoutModel.sidePanelModeAtom);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [kronarchyEnabled, setKronarchyEnabled] = useState(readKronarchyEnabled);
    const rootRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKronarchyChanged = (event: Event) => {
            const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
            if (typeof enabled === "boolean") setKronarchyEnabled(enabled);
        };
        window.addEventListener(KronarchyEnabledChangedEvent, handleKronarchyChanged);
        return () => window.removeEventListener(KronarchyEnabledChangedEvent, handleKronarchyChanged);
    }, []);

    useEffect(() => {
        if (!open) {
            setQuery("");
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();
    const matches = useMemo(
        () => (label: string, description: string) => `${label} ${description}`.toLowerCase().includes(normalizedQuery),
        [normalizedQuery]
    );
    const visiblePresentations = WorkspacePresentations.filter((presentation) => {
        const detail = PresentationDetails[presentation];
        return matches(detail.label, detail.description);
    });
    const visibleSidePanels = (["full", "compact", "hidden"] as SidePanelMode[]).filter((mode) => {
        const detail = SidePanelDetails[mode];
        return matches(detail.label, detail.description);
    });
    const showKronarchy = matches("Kronarchy mode", "Omarchy-inspired keyboard-first shell");
    const visibleWorkspaceTabs = (workspace?.tabids ?? [])
        .map((tabId, index) => ({ tabId, index }))
        .filter(({ index }) => matches(`Workspace tab ${index + 1}`, "Switch open active workspace"));

    return (
        <nav ref={rootRef} className="workspace-presentation-switcher" aria-label="Workspace layout">
            <button
                type="button"
                className={cn("workspace-layout-trigger", open && "is-open")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                title="Workspace layout and sidebar"
            >
                <i className={`fa-solid ${PresentationDetails[value].icon}`} aria-hidden="true" />
                <span>Layout</span>
                <i className="fa-solid fa-chevron-down workspace-layout-chevron" aria-hidden="true" />
            </button>
            {open && (
                <section className="workspace-layout-popover" role="dialog" aria-label="Workspace commands">
                    <header className="workspace-layout-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search layouts and workspace controls..."
                            aria-label="Search workspace commands"
                        />
                        <kbd>Esc</kbd>
                    </header>
                    <div className="workspace-layout-results">
                        {visibleWorkspaceTabs.length > 0 && (
                            <div className="workspace-layout-section">
                                <h2>Workspace tabs</h2>
                                {visibleWorkspaceTabs.map(({ tabId, index }) => (
                                    <button
                                        key={tabId}
                                        type="button"
                                        className={activeTabId === tabId ? "is-selected" : ""}
                                        onClick={() => {
                                            setActiveTab(tabId);
                                            setOpen(false);
                                        }}
                                    >
                                        <i
                                            className={`fa-solid ${activeTabId === tabId ? "fa-folder-open" : "fa-folder"}`}
                                            aria-hidden="true"
                                        />
                                        <span>
                                            <strong>Workspace tab {index + 1}</strong>
                                            <small>
                                                {activeTabId === tabId
                                                    ? "Current workspace tab"
                                                    : "Switch workspace tab"}
                                            </small>
                                        </span>
                                        {activeTabId === tabId && (
                                            <i className="fa-solid fa-check" aria-hidden="true" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {visiblePresentations.length > 0 && (
                            <div className="workspace-layout-section">
                                <h2>Layout</h2>
                                {visiblePresentations.map((presentation) => {
                                    const detail = PresentationDetails[presentation];
                                    return (
                                        <button
                                            key={presentation}
                                            type="button"
                                            className={value === presentation ? "is-selected" : ""}
                                            onClick={() => {
                                                onChange(presentation);
                                                setOpen(false);
                                            }}
                                        >
                                            <i className={`fa-solid ${detail.icon}`} aria-hidden="true" />
                                            <span>
                                                <strong>{detail.label}</strong>
                                                <small>{detail.description}</small>
                                            </span>
                                            {value === presentation && (
                                                <i className="fa-solid fa-check" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {visibleSidePanels.length > 0 && (
                            <div className="workspace-layout-section">
                                <h2>Sidebar</h2>
                                {visibleSidePanels.map((mode) => {
                                    const detail = SidePanelDetails[mode];
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            className={sidePanelMode === mode ? "is-selected" : ""}
                                            onClick={() => {
                                                layoutModel.setSidePanelMode(mode);
                                                setOpen(false);
                                            }}
                                        >
                                            <i className={`fa-solid ${detail.icon}`} aria-hidden="true" />
                                            <span>
                                                <strong>{detail.label}</strong>
                                                <small>{detail.description}</small>
                                            </span>
                                            {sidePanelMode === mode && (
                                                <i className="fa-solid fa-check" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {showKronarchy && (
                            <div className="workspace-layout-section">
                                <h2>Mode</h2>
                                <button
                                    type="button"
                                    className={kronarchyEnabled ? "is-selected" : ""}
                                    onClick={() => {
                                        publishKronarchyEnabled(!kronarchyEnabled);
                                        if (!kronarchyEnabled) layoutModel.setSidePanelMode("compact");
                                        setOpen(false);
                                    }}
                                >
                                    <span className="workspace-kronarchy-mark" aria-hidden="true">
                                        K
                                    </span>
                                    <span>
                                        <strong>Kronarchy mode</strong>
                                        <small>Omarchy-inspired keyboard-first shell</small>
                                    </span>
                                    {kronarchyEnabled && <i className="fa-solid fa-check" aria-hidden="true" />}
                                </button>
                            </div>
                        )}
                        {visibleWorkspaceTabs.length === 0 &&
                            visiblePresentations.length === 0 &&
                            visibleSidePanels.length === 0 &&
                            !showKronarchy && <p className="workspace-layout-empty">No matching workspace command</p>}
                    </div>
                </section>
            )}
        </nav>
    );
};

export { WorkspacePresentationSwitcher };
