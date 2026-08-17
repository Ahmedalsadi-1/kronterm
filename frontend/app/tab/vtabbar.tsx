// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { getTabBadgeAtom } from "@/app/store/badge";
import { makeORef } from "@/app/store/wos";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { Widgets } from "@/app/workspace/widgets";
import { SidePanelMode, WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { validateCssColor } from "@/util/color-validator";
import { cn, fireAndForget } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { buildTabBarContextMenu, buildTabContextMenu } from "./tabcontextmenu";
import { UpdateStatusBanner } from "./updatebanner";
import { VTab, VTabItem } from "./vtab";
import { VTabBlockTree } from "./vtab-block-tree";
import "./vtabbar.scss";
import { VTabBarEnv } from "./vtabbarenv";
import { WorkspaceSwitcher } from "./workspaceswitcher";
export type { VTabItem } from "./vtab";

const VTabBarWidgetButton = memo(() => {
    const env = useWaveEnv<VTabBarEnv>();
    const layoutModel = WorkspaceLayoutModel.getInstance();
    const widgetsPanelVisible = useAtomValue(layoutModel.widgetsPanelVisibleAtom);
    const hideAiButton = useAtomValue(env.getSettingsKeyAtom("app:hideaibutton"));

    const onClick = () => {
        layoutModel.toggleWidgetsPanel();
    };

    if (hideAiButton) {
        return null;
    }

    return (
        <Tooltip
            content={widgetsPanelVisible ? "Hide widget launcher" : "Open widget launcher"}
            placement="right"
            hideOnClick
        >
            <button
                type="button"
                className={`vtab-header-action ${widgetsPanelVisible ? "is-active" : ""}`}
                onClick={onClick}
                aria-label={widgetsPanelVisible ? "Hide widget launcher" : "Open widget launcher"}
                aria-pressed={widgetsPanelVisible}
            >
                <i className="fa-solid fa-grid-2" />
            </button>
        </Tooltip>
    );
});
VTabBarWidgetButton.displayName = "VTabBarWidgetButton";

const SidePanelModeButton = memo(() => {
    const layoutModel = WorkspaceLayoutModel.getInstance();
    const sidePanelMode = useAtomValue(layoutModel.sidePanelModeAtom);

    const getModeIcon = (mode: SidePanelMode): string => {
        switch (mode) {
            case "hidden":
                return "fa-columns";
            case "compact":
                return "fa-columns";
            case "full":
                return "fa-table-columns";
        }
    };

    const getModeLabel = (mode: SidePanelMode): string => {
        switch (mode) {
            case "hidden":
                return "Compact";
            case "compact":
                return "Compact";
            case "full":
                return "Full";
        }
    };

    const onClick = () => {
        layoutModel.cycleSidePanelMode();
    };

    return (
        <Tooltip content={`Side Panel: ${getModeLabel(sidePanelMode)} (click to cycle)`} placement="right" hideOnClick>
            <button type="button" className="vtab-footer-action" onClick={onClick}>
                <i className={`fa ${getModeIcon(sidePanelMode)}`} style={{ fontSize: "12px" }} />
                <span>{getModeLabel(sidePanelMode)} sidebar</span>
            </button>
        </Tooltip>
    );
});
SidePanelModeButton.displayName = "SidePanelModeButton";

const VTabBarHeader = memo(() => {
    const env = useWaveEnv<VTabBarEnv>();
    const isFullScreen = useAtomValue(env.atoms.isFullScreen);
    return (
        <>
            {env.isMacOS() && !isFullScreen && (
                <div
                    className="w-full shrink-0"
                    style={
                        {
                            height: "calc(25px * var(--zoomfactor-inv))",
                            WebkitAppRegion: "drag",
                        } as React.CSSProperties
                    }
                />
            )}
            <div className="vtab-navigation-header">
                <div className="vtab-workspace-control">
                    <span className="vtab-workspace-kicker">Workspace</span>
                    <Tooltip content="Switch workspace" placement="right" hideOnClick divClassName="min-w-0">
                        <WorkspaceSwitcher showLabel />
                    </Tooltip>
                </div>
                <div className="vtab-header-actions">
                    <VTabBarWidgetButton />
                    <UpdateStatusBanner />
                </div>
            </div>
        </>
    );
});
VTabBarHeader.displayName = "VTabBarHeader";

interface VTabBarProps {
    workspace: Workspace;
    className?: string;
}

interface VTabWrapperProps {
    tabId: string;
    active: boolean;
    showDivider: boolean;
    isDragging: boolean;
    isReordering: boolean;
    hoverResetVersion: number;
    index: number;
    onSelect: () => void;
    onClose: () => void;
    onRename: (newName: string) => void;
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    onHoverChanged: (isHovered: boolean) => void;
}

function VTabWrapper({
    tabId,
    active,
    showDivider,
    isDragging,
    isReordering,
    hoverResetVersion,
    onSelect,
    onClose,
    onRename,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onHoverChanged,
}: VTabWrapperProps) {
    const env = useWaveEnv<VTabBarEnv>();
    const [tabData] = env.wos.useWaveObjectValue<Tab>(makeORef("tab", tabId));
    const badges = useAtomValue(getTabBadgeAtom(tabId, env));
    const renameRef = useRef<(() => void) | null>(null);

    const rawFlagColor = tabData?.meta?.["tab:flagcolor"];
    let flagColor: string | null = null;
    if (rawFlagColor) {
        try {
            validateCssColor(rawFlagColor);
            flagColor = rawFlagColor;
        } catch {
            flagColor = null;
        }
    }

    const tab: VTabItem = {
        id: tabId,
        name: tabData?.name ?? "",
        badges,
        flagColor,
    };

    const handleContextMenu = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = buildTabContextMenu(tabId, renameRef, () => onClose(), env);
            env.showContextMenu(menu, e);
        },
        [tabId, onClose, env]
    );

    return (
        <>
            <VTab
                key={`${tabId}:${hoverResetVersion}`}
                tab={tab}
                active={active}
                showDivider={showDivider}
                isDragging={isDragging}
                isReordering={isReordering}
                onSelect={onSelect}
                onClose={onClose}
                onRename={onRename}
                onContextMenu={handleContextMenu}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onHoverChanged={onHoverChanged}
                renameRef={renameRef}
            />
            <VTabBlockTree tabId={tabId} active={active} />
        </>
    );
}

export function VTabBar({ workspace, className }: VTabBarProps) {
    const env = useWaveEnv<VTabBarEnv>();
    const activeTabId = useAtomValue(env.atoms.staticTabId);
    const reinitVersion = useAtomValue(env.atoms.reinitVersion);
    const documentHasFocus = useAtomValue(env.atoms.documentHasFocus);
    const tabIds = workspace?.tabids ?? [];

    const [orderedTabIds, setOrderedTabIds] = useState<string[]>(tabIds);
    const [dragTabId, setDragTabId] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const [dropLineTop, setDropLineTop] = useState<number | null>(null);
    const [hoverResetVersion, setHoverResetVersion] = useState(0);
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
    const dragSourceRef = useRef<string | null>(null);
    const didResetHoverForDragRef = useRef(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollAnimFrameRef = useRef<number | null>(null);
    const scrollDirectionRef = useRef<number>(0);
    const scrollSpeedRef = useRef<number>(0);

    useEffect(() => {
        setOrderedTabIds(tabIds);
    }, [workspace?.tabids]);

    useEffect(() => {
        if (reinitVersion > 0) {
            setOrderedTabIds(workspace?.tabids ?? []);
        }
    }, [reinitVersion]);

    useEffect(() => {
        if (activeTabId == null || scrollContainerRef.current == null) {
            return;
        }
        const el = scrollContainerRef.current.querySelector(`[data-tabid="${activeTabId}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [activeTabId]);

    useEffect(() => {
        if (!documentHasFocus || activeTabId == null || scrollContainerRef.current == null) {
            return;
        }
        const el = scrollContainerRef.current.querySelector(`[data-tabid="${activeTabId}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [documentHasFocus]);

    const stopScrollLoop = useCallback(() => {
        if (scrollAnimFrameRef.current != null) {
            cancelAnimationFrame(scrollAnimFrameRef.current);
            scrollAnimFrameRef.current = null;
        }
        scrollDirectionRef.current = 0;
    }, []);

    const startScrollLoop = useCallback(() => {
        if (scrollAnimFrameRef.current != null) {
            return;
        }
        const loop = () => {
            const container = scrollContainerRef.current;
            if (container == null || scrollDirectionRef.current === 0) {
                scrollAnimFrameRef.current = null;
                return;
            }
            container.scrollTop += scrollDirectionRef.current * scrollSpeedRef.current;
            scrollAnimFrameRef.current = requestAnimationFrame(loop);
        };
        scrollAnimFrameRef.current = requestAnimationFrame(loop);
    }, []);

    const updateScrollFromDragY = useCallback(
        (clientY: number) => {
            const container = scrollContainerRef.current;
            if (container == null) {
                return;
            }
            const EdgeZone = 60;
            const MaxScrollSpeed = 12;
            const rect = container.getBoundingClientRect();
            const relY = clientY - rect.top;
            const height = rect.height;
            if (relY < EdgeZone) {
                scrollDirectionRef.current = -1;
                scrollSpeedRef.current = MaxScrollSpeed * (1 - relY / EdgeZone);
                startScrollLoop();
            } else if (relY > height - EdgeZone) {
                scrollDirectionRef.current = 1;
                scrollSpeedRef.current = MaxScrollSpeed * (1 - (height - relY) / EdgeZone);
                startScrollLoop();
            } else {
                scrollDirectionRef.current = 0;
                stopScrollLoop();
            }
        },
        [startScrollLoop, stopScrollLoop]
    );

    const clearDragState = () => {
        stopScrollLoop();
        if (dragSourceRef.current != null && !didResetHoverForDragRef.current) {
            didResetHoverForDragRef.current = true;
            setHoverResetVersion((version) => version + 1);
        }
        dragSourceRef.current = null;
        setDragTabId(null);
        setDropIndex(null);
        setDropLineTop(null);
    };

    const reorder = (targetIndex: number) => {
        const sourceTabId = dragSourceRef.current;
        if (sourceTabId == null) {
            return;
        }
        const sourceIndex = orderedTabIds.findIndex((id) => id === sourceTabId);
        if (sourceIndex === -1) {
            return;
        }
        const boundedTargetIndex = Math.max(0, Math.min(targetIndex, orderedTabIds.length));
        const adjustedTargetIndex = sourceIndex < boundedTargetIndex ? boundedTargetIndex - 1 : boundedTargetIndex;
        if (sourceIndex === adjustedTargetIndex) {
            return;
        }
        const nextTabIds = [...orderedTabIds];
        const [movedId] = nextTabIds.splice(sourceIndex, 1);
        nextTabIds.splice(adjustedTargetIndex, 0, movedId);
        setOrderedTabIds(nextTabIds);
        fireAndForget(() => env.rpc.UpdateWorkspaceTabIdsCommand(TabRpcClient, workspace.oid, nextTabIds));
    };

    const handleTabBarContextMenu = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            const menu = buildTabBarContextMenu(env);
            env.showContextMenu(menu, e);
        },
        [env]
    );

    return (
        <div
            className={cn("vtab-navigation flex h-full flex-col overflow-hidden", className)}
            onContextMenu={handleTabBarContextMenu}
        >
            <VTabBarHeader />
            <div className="vtab-section-header">
                <div className="vtab-section-title">
                    <span>Workspace tabs</span>
                    <span className="vtab-section-count">{orderedTabIds.length}</span>
                </div>
                <Tooltip content="New tab" placement="right">
                    <button
                        type="button"
                        className="vtab-section-action"
                        onClick={() => env.electron.createTab()}
                        aria-label="New tab"
                    >
                        <i className="fa-solid fa-plus" />
                    </button>
                </Tooltip>
            </div>
            <div
                ref={scrollContainerRef}
                className="vtab-scroll-region relative flex min-h-0 flex-col overflow-y-auto"
                role="tablist"
                aria-label="Workspace tabs"
                onDragOver={(event) => {
                    event.preventDefault();
                    updateScrollFromDragY(event.clientY);
                    if (event.target === event.currentTarget) {
                        setDropIndex(orderedTabIds.length);
                        setDropLineTop(event.currentTarget.scrollHeight);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (dropIndex != null) {
                        reorder(dropIndex);
                    }
                    clearDragState();
                }}
            >
                {orderedTabIds.map((tabId, index) => {
                    const isActive = tabId === activeTabId;
                    const isHovered = tabId === hoveredTabId;
                    const isLast = index === orderedTabIds.length - 1;
                    const nextTabId = orderedTabIds[index + 1];
                    const isNextActive = nextTabId === activeTabId;
                    const isNextHovered = nextTabId === hoveredTabId;
                    return (
                        <VTabWrapper
                            key={`${tabId}:${hoverResetVersion}`}
                            tabId={tabId}
                            active={isActive}
                            showDivider={!isActive && !isNextActive && !isHovered && !isNextHovered && !isLast}
                            isDragging={dragTabId === tabId}
                            isReordering={dragTabId != null}
                            hoverResetVersion={hoverResetVersion}
                            index={index}
                            onSelect={() => env.electron.setActiveTab(tabId)}
                            onClose={() => fireAndForget(() => env.electron.closeTab(workspace.oid, tabId, false))}
                            onRename={(newName) =>
                                fireAndForget(() => env.rpc.UpdateTabNameCommand(TabRpcClient, tabId, newName))
                            }
                            onDragStart={(event) => {
                                didResetHoverForDragRef.current = false;
                                dragSourceRef.current = tabId;
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", tabId);
                                setDragTabId(tabId);
                                setDropIndex(index);
                                setDropLineTop(event.currentTarget.offsetTop);
                            }}
                            onDragOver={(event) => {
                                event.preventDefault();
                                const rect = event.currentTarget.getBoundingClientRect();
                                const relativeY = event.clientY - rect.top;
                                const midpoint = event.currentTarget.offsetHeight / 2;
                                const insertBefore = relativeY < midpoint;
                                setDropIndex(insertBefore ? index : index + 1);
                                setDropLineTop(
                                    insertBefore
                                        ? event.currentTarget.offsetTop
                                        : event.currentTarget.offsetTop + event.currentTarget.offsetHeight
                                );
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (dropIndex != null) {
                                    reorder(dropIndex);
                                }
                                clearDragState();
                            }}
                            onDragEnd={clearDragState}
                            onHoverChanged={(isHovered) => setHoveredTabId(isHovered ? tabId : null)}
                        />
                    );
                })}
                {dragTabId != null && dropIndex != null && dropLineTop != null && (
                    <div
                        className="pointer-events-none absolute left-0 right-0 border-t-2 border-accent/80"
                        style={{ top: dropLineTop, transform: "translateY(-1px)" }}
                    />
                )}
            </div>
            <Widgets compact />
            <SidePanelModeButton />
        </div>
    );
}
