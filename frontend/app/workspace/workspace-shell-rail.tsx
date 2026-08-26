// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getAdjacentWorkspacePresentation, isWorkspacePresentation } from "@/app/tab/workspace-presentation";
import { hermesSurfaceController } from "@/app/view/hermes/hermes-surface-controller";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { createBlock, getApi, refocusNode } from "@/store/global";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import "./workspace-shell-rail.scss";

type Launcher = {
    id: string;
    icon: string;
    label: string;
    view: string;
    meta?: MetaType;
};

const Launchers: Launcher[] = [
    { id: "browser", icon: "globe", label: "Browser", view: "web" },
    { id: "terminal", icon: "square-terminal", label: "Terminal", view: "term", meta: { controller: "shell" } },
    { id: "files", icon: "folder", label: "Files", view: "preview", meta: { file: "~" } },
];

const WorkspaceMenuItem = memo(
    ({ active, tabId, workspaceId }: { active: boolean; tabId: string; workspaceId: string }) => {
        const tabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)), [tabId]);
        const tab = useAtomValue(tabAtom);

        return (
            <div className={`workspace-selector-item ${active ? "is-active" : ""}`} role="menuitem">
                <button type="button" onClick={() => getApi().setActiveTab(tabId)}>
                    <i className="fa-regular fa-folder" aria-hidden="true" />
                    <span>{tab?.name || "Workspace tab"}</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const name = window.prompt("Rename workspace tab", tab?.name || "");
                        if (name?.trim()) {
                            void RpcApi.UpdateTabNameCommand(TabRpcClient, tabId, name.trim());
                        }
                    }}
                    aria-label={`Rename ${tab?.name || "workspace tab"}`}
                    title="Rename"
                >
                    <i className="fa-solid fa-pen" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => getApi().closeTab(workspaceId, tabId, false)}
                    aria-label={`Close ${tab?.name || "workspace tab"}`}
                    title="Close"
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
            </div>
        );
    }
);
WorkspaceMenuItem.displayName = "WorkspaceMenuItem";

function WorkspaceSelector({ activeTabId, workspace }: { activeTabId: string; workspace: Workspace }) {
    const [open, setOpen] = useState(false);
    const activeTabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", activeTabId)), [activeTabId]);
    const activeTab = useAtomValue(activeTabAtom);

    return (
        <div className="workspace-selector">
            <button
                type="button"
                className="workspace-selector-trigger"
                onClick={() => setOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <i className="fa-regular fa-folder" aria-hidden="true" />
                <span>{activeTab?.name || "Workspace"}</span>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
            </button>
            {open && (
                <div className="workspace-selector-menu" role="menu" aria-label="Workspace tabs">
                    <div className="workspace-selector-menu-heading">
                        <span>Workspace tabs</span>
                        <button
                            type="button"
                            onClick={() => getApi().createTab()}
                            aria-label="New workspace tab"
                            title="New workspace tab"
                        >
                            <i className="fa-solid fa-plus" aria-hidden="true" />
                        </button>
                    </div>
                    {workspace.tabids.map((tabId) => (
                        <WorkspaceMenuItem
                            key={tabId}
                            active={tabId === activeTabId}
                            tabId={tabId}
                            workspaceId={workspace.oid}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const WorkspaceShellRail = memo(({ activeTabId, workspace }: { activeTabId: string; workspace: Workspace }) => {
    const tabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", activeTabId)), [activeTabId]);
    const tab = useAtomValue(tabAtom);
    const surface = useSyncExternalStore(
        hermesSurfaceController.subscribe,
        hermesSurfaceController.getSnapshot,
        hermesSurfaceController.getSnapshot
    );
    const [presentation, setPresentation] = useState(() => {
        const current = (window as any).__krontermLayoutMode;
        return isWorkspacePresentation(current) ? current : "tabs";
    });

    useEffect(() => {
        const onChanged = (event: Event) => {
            const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
            if (isWorkspacePresentation(mode)) {
                setPresentation(mode);
            }
        };
        window.addEventListener("kronterm:layoutmode-changed", onChanged);
        return () => window.removeEventListener("kronterm:layoutmode-changed", onChanged);
    }, []);

    const openLauncher = useCallback(
        async (launcher: Launcher) => {
            const existingBlockId = tab?.blockids?.find((blockId) => {
                const block = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId));
                return globalStore.get(block)?.meta?.view === launcher.view;
            });
            if (existingBlockId) {
                refocusNode(existingBlockId);
                return;
            }
            await createBlock({ meta: { view: launcher.view, ...launcher.meta } });
        },
        [tab?.blockids]
    );

    const cyclePresentation = () => {
        const next = getAdjacentWorkspacePresentation(presentation, 1);
        setPresentation(next);
        window.localStorage.setItem("kronterm:layoutmode", next);
        window.dispatchEvent(new CustomEvent("kronterm:layoutmode-changed", { detail: { mode: next } }));
        void RpcApi.SetConfigCommand(TabRpcClient, { "app:layoutmode": next });
    };

    return (
        <aside className="workspace-launcher-rail" aria-label="Workspace launcher">
            <div className="workspace-launcher-top">
                <WorkspaceSelector activeTabId={activeTabId} workspace={workspace} />
            </div>
            <nav className="workspace-launcher-actions" aria-label="Widget launchers">
                <button
                    type="button"
                    className={surface.presentation === "panel" ? "is-active" : ""}
                    onClick={() =>
                        surface.presentation === "panel"
                            ? hermesSurfaceController.dismiss()
                            : hermesSurfaceController.requestOpenPanel()
                    }
                    aria-label="Kronos"
                    aria-pressed={surface.presentation === "panel"}
                    title="Kronos"
                >
                    <i className="fa-solid fa-sparkles" aria-hidden="true" />
                </button>
                {Launchers.map((launcher) => (
                    <button
                        key={launcher.id}
                        type="button"
                        onClick={() => void openLauncher(launcher)}
                        aria-label={launcher.label}
                        title={launcher.label}
                    >
                        <i className={`fa-solid fa-${launcher.icon}`} aria-hidden="true" />
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => WorkspaceLayoutModel.getInstance().toggleWidgetsPanel()}
                    aria-label="Add widget"
                    title="Add widget"
                >
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                </button>
            </nav>
            <div className="workspace-launcher-bottom">
                <button
                    type="button"
                    onClick={cyclePresentation}
                    aria-label={`Workspace presentation: ${presentation}`}
                    title={`Workspace presentation: ${presentation}`}
                >
                    <i
                        className={`fa-solid fa-${presentation === "tabs" ? "window-restore" : presentation === "canvas" ? "object-group" : presentation === "web" ? "globe" : "table-cells-large"}`}
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        void openLauncher({ id: "settings", icon: "gear", label: "Settings", view: "kronsettings" })
                    }
                    aria-label="Settings"
                    title="Settings"
                >
                    <i className="fa-solid fa-gear" aria-hidden="true" />
                </button>
            </div>
        </aside>
    );
});
WorkspaceShellRail.displayName = "WorkspaceShellRail";
