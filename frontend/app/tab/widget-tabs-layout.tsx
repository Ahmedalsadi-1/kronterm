// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block as BlockView } from "@/app/block/block";
import { blockViewToName, resolveBlockIcon } from "@/app/block/blockutil";
import { globalStore } from "@/app/store/jotaiStore";
import { LayoutModel } from "@/layout/lib/layoutModel";
import { useNodeModel, useTileLayout } from "@/layout/lib/layoutModelHooks";
import { DropDirection, LayoutNode, NodeModel, TileLayoutContents } from "@/layout/lib/types";
import { refocusNode } from "@/store/global";
import * as WOS from "@/store/wos";
import { makeIconClass } from "@/util/util";
import { Atom, atom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    isAgentActivityActive,
    subscribeAgentActivityStream,
    type LiveAgentSurfaceActivity,
} from "../../types/agent-activity";
import {
    isAgentChatView,
    TabsAgentCompanionRequestEvent,
    type TabsAgentCompanionRequest,
} from "./tabs-agent-workspace";
import { WidgetPickerPopover } from "./widget-picker-popover";
import { getWidgetFocusAfterClose, getWidgetTabCloseAccessibility, moveWidgetTab } from "./widget-tabs-layout-utils";
import "./widget-tabs-layout.scss";

interface WidgetTabsLayoutProps {
    tabAtom: Atom<Tab>;
    contents: TileLayoutContents;
}

interface WidgetTabProps {
    node: LayoutNode;
    active: boolean;
    onSelect: () => void;
    onClose: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
}

type AgentWorkbenchPair = {
    agentNodeId: string;
    companionNodeId: string;
};

type WorkbenchPaneRole = "agent" | "companion" | undefined;

function readNodeView(node?: LayoutNode): string {
    const blockId = node?.data?.blockId;
    if (!blockId) {
        return "";
    }
    const block = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)));
    return String(block?.meta?.view ?? "term");
}

function activityLabel(activity?: LiveAgentSurfaceActivity): string {
    if (!activity) {
        return "Ready";
    }
    if (activity.phase === "awaiting-approval") {
        return "Approval needed";
    }
    if (activity.phase === "failed") {
        return "Action failed";
    }
    if (isAgentActivityActive(activity.phase)) {
        return activity.phase === "verifying" ? "Verifying" : "Live";
    }
    return "Complete";
}

const SplitDropTargets = [
    { direction: DropDirection.Top, name: "top", icon: "arrow-up", label: "Split above" },
    { direction: DropDirection.Right, name: "right", icon: "arrow-right", label: "Split right" },
    { direction: DropDirection.Bottom, name: "bottom", icon: "arrow-down", label: "Split below" },
    { direction: DropDirection.Left, name: "left", icon: "arrow-left", label: "Split left" },
];

const WidgetTab = memo(({ node, active, onSelect, onClose, onKeyDown, onDragStart, onDragEnd }: WidgetTabProps) => {
    const blockId = node.data?.blockId;
    const blockAtom = useMemo(() => WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)), [blockId]);
    const blockData = useAtomValue(blockAtom);
    const viewType = String(blockData?.meta?.view ?? "term");
    const viewName = blockViewToName(viewType);
    const title = String(blockData?.meta?.["frame:title"] ?? "").trim() || viewName;
    const displayTitle = viewType === "chathubv2" ? "Chamber V2" : title;
    const icon = resolveBlockIcon(viewType, blockData?.meta);
    const closeAccessibility = getWidgetTabCloseAccessibility(active);

    return (
        <div
            className={`widget-surface-tab ${active ? "is-active" : ""} ${viewType === "chathubv2" ? "is-chamber" : ""}`}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <button
                type="button"
                id={`widget-surface-tab-${blockId}`}
                className="widget-surface-tab-main"
                role="tab"
                aria-selected={active}
                aria-controls={`widget-surface-panel-${blockId}`}
                tabIndex={active ? 0 : -1}
                onClick={onSelect}
                onKeyDown={onKeyDown}
                title={displayTitle}
            >
                <i className={makeIconClass(icon, true, { defaultIcon: "square" })} aria-hidden="true" />
                <span className="widget-surface-tab-copy">
                    <span>{displayTitle}</span>
                    <span>{viewName}</span>
                </span>
            </button>
            <button
                type="button"
                className="widget-surface-tab-close"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
                aria-label={`Close ${displayTitle}`}
                aria-hidden={closeAccessibility.ariaHidden}
                tabIndex={closeAccessibility.tabIndex}
                title={`Close ${displayTitle}`}
            >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
        </div>
    );
});
WidgetTab.displayName = "WidgetTab";

const WidgetTabPane = memo(
    ({
        node,
        active,
        layoutModel,
        onClose,
        onExpandCompanion,
        onReturnToAgent,
        recentActivity,
        workbenchRole,
    }: {
        node: LayoutNode;
        active: boolean;
        layoutModel: LayoutModel;
        onClose: (nodeId: string) => void;
        onExpandCompanion: () => void;
        onReturnToAgent: () => void;
        recentActivity: LiveAgentSurfaceActivity[];
        workbenchRole: WorkbenchPaneRole;
    }) => {
        const baseNodeModel = useNodeModel(layoutModel, node);
        const nodeModel = useMemo<NodeModel>(
            () => ({
                ...baseNodeModel,
                innerRect: atom(null),
                numLeafs: atom(1),
                isResizing: atom(false),
                isMagnified: atom(false),
                anyMagnified: atom(false),
                isFolded: atom(false),
                toggleMagnify: () => {},
                toggleFold: () => {},
                onClose: () => onClose(node.id),
            }),
            [baseNodeModel, node.id, onClose]
        );
        const blockId = node.data?.blockId;
        const blockAtom = useMemo(() => WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)), [blockId]);
        const blockData = useAtomValue(blockAtom);
        const viewType = String(blockData?.meta?.view ?? "term");
        const title = String(blockData?.meta?.["frame:title"] ?? "").trim() || blockViewToName(viewType);
        const latestActivity = recentActivity.at(-1);
        const visible = active || workbenchRole != null;

        return (
            <div
                id={`widget-surface-panel-${blockId}`}
                className={`widget-surface-pane ${visible ? "is-active" : ""} ${workbenchRole ? `is-workbench-${workbenchRole}` : ""}`}
                role="tabpanel"
                aria-labelledby={`widget-surface-tab-${blockId}`}
                aria-hidden={!visible}
            >
                {workbenchRole === "companion" && (
                    <div className="widget-agent-workbench-header">
                        <div className="widget-agent-workbench-heading">
                            <span
                                className={`widget-agent-workbench-live ${isAgentActivityActive(latestActivity?.phase) ? "is-active" : ""}`}
                            />
                            <div>
                                <strong>{title}</strong>
                                <span>{activityLabel(latestActivity)}</span>
                            </div>
                        </div>
                        <div className="widget-agent-workbench-actions">
                            <button type="button" onClick={onExpandCompanion} title="Show work widget only">
                                <i className="fa-solid fa-expand" aria-hidden="true" />
                                <span>Expand</span>
                            </button>
                            <button type="button" onClick={onReturnToAgent} title="Close work panel and return to chat">
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}
                <div className="widget-agent-workbench-content">
                    <BlockView key={blockId} nodeModel={nodeModel} preview={false} />
                </div>
                {workbenchRole === "companion" && recentActivity.length > 0 && (
                    <div className="widget-agent-workbench-timeline" aria-label="Recent agent tool activity">
                        {recentActivity.slice(-4).map((activity, index) => (
                            <div
                                key={`${activity.id ?? activity.timestamp}-${index}`}
                                className={`widget-agent-workbench-step ${isAgentActivityActive(activity.phase) ? "is-active" : ""}`}
                                title={activity.detail}
                            >
                                <i
                                    className={`fa-solid fa-${activity.surface === "browser" ? "globe" : activity.surface === "file" ? "file-code" : activity.surface === "terminal" ? "terminal" : "display"}`}
                                    aria-hidden="true"
                                />
                                <span>{activity.detail?.trim() || `${activity.action} ${activity.surface}`}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);
WidgetTabPane.displayName = "WidgetTabPane";

const WidgetTabsLayout = memo(({ tabAtom, contents }: WidgetTabsLayoutProps) => {
    const layoutModel = useTileLayout(tabAtom, contents);
    const leafs = useAtomValue(layoutModel.leafs);
    const leafOrder = useAtomValue(layoutModel.leafOrder);
    const focusedNode = useAtomValue(layoutModel.focusedNode);
    const setReady = useSetAtom(layoutModel.ready);
    const orderedNodes = useMemo(
        () => leafOrder.map((entry) => leafs.find((node) => node.id === entry.nodeid)).filter(Boolean) as LayoutNode[],
        [leafOrder, leafs]
    );
    const activeNode = orderedNodes.find((node) => node.id === focusedNode?.id) ?? orderedNodes[0];
    const nodesRef = useRef(orderedNodes);
    const activeNodeIdRef = useRef(activeNode?.id);
    const pendingCompanionRef = useRef<{ agentNodeId: string; blockId: string } | null>(null);
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const [dropDirection, setDropDirection] = useState<DropDirection | null>(null);
    const [workbenchPair, setWorkbenchPair] = useState<AgentWorkbenchPair | null>(null);
    const [workbenchWidth, setWorkbenchWidth] = useState(42);
    const [recentActivity, setRecentActivity] = useState<LiveAgentSurfaceActivity[]>([]);
    nodesRef.current = orderedNodes;
    activeNodeIdRef.current = activeNode?.id;

    const nodeByBlockId = useCallback((blockId: string) => {
        return nodesRef.current.find((node) => node.data?.blockId === blockId);
    }, []);

    const openAgentWorkbench = useCallback(
        (companionBlockId: string) => {
            const companionNode = nodeByBlockId(companionBlockId);
            const active = nodesRef.current.find((node) => node.id === activeNodeIdRef.current);
            const existingAgent = workbenchPair
                ? nodesRef.current.find((node) => node.id === workbenchPair.agentNodeId)
                : undefined;
            const agentNode = isAgentChatView(readNodeView(active)) ? active : existingAgent;
            if (
                !agentNode ||
                !companionNode ||
                agentNode.id === companionNode.id ||
                isAgentChatView(readNodeView(companionNode))
            ) {
                return;
            }
            setWorkbenchPair({ agentNodeId: agentNode.id, companionNodeId: companionNode.id });
        },
        [nodeByBlockId, workbenchPair]
    );

    useEffect(() => {
        setReady(true);
    }, [setReady]);

    useEffect(() => {
        const handleCompanionRequest = (event: Event) => {
            const blockId = (event as CustomEvent<TabsAgentCompanionRequest>).detail?.blockId;
            if (blockId) {
                openAgentWorkbench(blockId);
            }
        };
        window.addEventListener(TabsAgentCompanionRequestEvent, handleCompanionRequest);
        return () => window.removeEventListener(TabsAgentCompanionRequestEvent, handleCompanionRequest);
    }, [openAgentWorkbench]);

    useEffect(() => {
        return subscribeAgentActivityStream((activity) => {
            const targetNode = activity.blockid ? nodeByBlockId(activity.blockid) : undefined;
            const active = nodesRef.current.find((node) => node.id === activeNodeIdRef.current);
            if (activity.blockid && isAgentChatView(readNodeView(active)) && isAgentActivityActive(activity.phase)) {
                if (targetNode) {
                    openAgentWorkbench(activity.blockid);
                } else if (active) {
                    pendingCompanionRef.current = { agentNodeId: active.id, blockId: activity.blockid };
                }
            }
            setRecentActivity((current) => {
                const companionBlockId = workbenchPair
                    ? nodesRef.current.find((node) => node.id === workbenchPair.companionNodeId)?.data?.blockId
                    : activity.blockid;
                if (!companionBlockId || activity.blockid !== companionBlockId) {
                    return current;
                }
                const withoutPrior = current.filter((entry) => entry.id == null || entry.id !== activity.id);
                return [...withoutPrior, activity].slice(-12);
            });
        });
    }, [nodeByBlockId, openAgentWorkbench, workbenchPair]);

    useEffect(() => {
        const pending = pendingCompanionRef.current;
        if (!pending) {
            return;
        }
        const agentNode = orderedNodes.find((node) => node.id === pending.agentNodeId);
        const companionNode = orderedNodes.find((node) => node.data?.blockId === pending.blockId);
        if (!agentNode || !companionNode || isAgentChatView(readNodeView(companionNode))) {
            return;
        }
        pendingCompanionRef.current = null;
        setWorkbenchPair({ agentNodeId: agentNode.id, companionNodeId: companionNode.id });
    }, [orderedNodes]);

    useEffect(() => {
        if (!workbenchPair) {
            return;
        }
        const pairStillExists =
            orderedNodes.some((node) => node.id === workbenchPair.agentNodeId) &&
            orderedNodes.some((node) => node.id === workbenchPair.companionNodeId);
        if (!pairStillExists) {
            setWorkbenchPair(null);
            setRecentActivity([]);
        }
    }, [orderedNodes, workbenchPair]);

    useEffect(() => {
        if (activeNode && focusedNode?.id !== activeNode.id) {
            layoutModel.focusNode(activeNode.id);
        }
    }, [activeNode, focusedNode?.id, layoutModel]);

    useEffect(() => {
        if (
            !workbenchPair ||
            !focusedNode ||
            focusedNode.id === workbenchPair.agentNodeId ||
            focusedNode.id === workbenchPair.companionNodeId
        ) {
            return;
        }
        if (isAgentChatView(readNodeView(focusedNode))) {
            setWorkbenchPair(null);
            setRecentActivity([]);
            return;
        }
        setWorkbenchPair((current) => current && { ...current, companionNodeId: focusedNode.id });
        setRecentActivity([]);
    }, [focusedNode, workbenchPair]);

    const focusNode = useCallback(
        (node: LayoutNode) => {
            if (workbenchPair && !isAgentChatView(readNodeView(node))) {
                setWorkbenchPair((current) => current && { ...current, companionNodeId: node.id });
                setRecentActivity([]);
            }
            layoutModel.focusNode(node.id);
            window.requestAnimationFrame(() => refocusNode(node.data?.blockId));
        },
        [layoutModel, workbenchPair]
    );

    const closeNode = useCallback(
        (nodeId: string) => {
            const nodes = nodesRef.current;
            const nextNodeId = getWidgetFocusAfterClose(nodes, nodeId, activeNodeIdRef.current);
            if (nextNodeId) {
                layoutModel.focusNode(nextNodeId);
            }
            void layoutModel.closeNode(nodeId);
        },
        [layoutModel]
    );

    const focusByIndex = useCallback(
        (index: number) => {
            if (orderedNodes.length === 0) {
                return;
            }
            const normalizedIndex = (index + orderedNodes.length) % orderedNodes.length;
            focusNode(orderedNodes[normalizedIndex]);
        },
        [focusNode, orderedNodes]
    );

    const splitDraggedNode = useCallback(
        (direction: DropDirection) => {
            const targetNodeId = activeNodeIdRef.current;
            if (!draggedNodeId || !targetNodeId || draggedNodeId === targetNodeId) {
                return;
            }
            moveWidgetTab(layoutModel, draggedNodeId, targetNodeId, direction);
            setDraggedNodeId(null);
            setDropDirection(null);
        },
        [draggedNodeId, layoutModel]
    );

    return (
        <div className="widget-tabs-layout">
            <aside className="widget-surface-sidebar" aria-label="Widget tabs">
                <div className="widget-surface-sidebar-header">
                    <span className="widget-surface-sidebar-title">
                        <span className="widget-surface-sidebar-mark" aria-hidden="true">
                            <i className="fa-solid fa-window-restore" />
                        </span>
                    </span>
                </div>
                <div
                    className="widget-surface-tabstrip"
                    role="tablist"
                    aria-label="Widgets in this workspace tab"
                    aria-orientation="horizontal"
                >
                    {orderedNodes.map((node, index) => (
                        <WidgetTab
                            key={node.id}
                            node={node}
                            active={node.id === activeNode?.id}
                            onSelect={() => focusNode(node)}
                            onClose={() => closeNode(node.id)}
                            onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", node.id);
                                setDraggedNodeId(node.id);
                                setWidgetPickerOpen(false);
                            }}
                            onDragEnd={() => {
                                setDraggedNodeId(null);
                                setDropDirection(null);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "ArrowRight") {
                                    event.preventDefault();
                                    focusByIndex(index + 1);
                                } else if (event.key === "ArrowLeft") {
                                    event.preventDefault();
                                    focusByIndex(index - 1);
                                } else if (event.key === "Home") {
                                    event.preventDefault();
                                    focusByIndex(0);
                                } else if (event.key === "End") {
                                    event.preventDefault();
                                    focusByIndex(orderedNodes.length - 1);
                                }
                            }}
                        />
                    ))}
                </div>
                <div className="widget-surface-sidebar-footer">
                    <button
                        ref={addButtonRef}
                        type="button"
                        className={`widget-surface-add ${widgetPickerOpen ? "is-open" : ""}`}
                        onClick={() => setWidgetPickerOpen((current) => !current)}
                        aria-haspopup="menu"
                        aria-expanded={widgetPickerOpen}
                        aria-label="Add widget"
                        title="Add widget"
                    >
                        <i className="fa-solid fa-plus" aria-hidden="true" />
                        <span>New widget</span>
                    </button>
                    {addButtonRef.current && (
                        <WidgetPickerPopover
                            anchorElement={addButtonRef.current}
                            open={widgetPickerOpen}
                            onClose={() => setWidgetPickerOpen(false)}
                        />
                    )}
                </div>
            </aside>
            <div
                ref={layoutModel.displayContainerRef}
                className={`widget-surface-content ${workbenchPair ? "is-agent-workbench" : ""}`}
                style={{ "--agent-workbench-chat-width": `${workbenchWidth}%` } as React.CSSProperties}
            >
                {draggedNodeId && draggedNodeId !== activeNode?.id && (
                    <div className="widget-surface-split-overlay" aria-label="Choose where to split the focused widget">
                        {SplitDropTargets.map((target) => (
                            <div
                                key={target.name}
                                className={`widget-surface-split-target is-${target.name} ${dropDirection === target.direction ? "is-hovered" : ""}`}
                                onDragEnter={() => setDropDirection(target.direction)}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    setDropDirection(target.direction);
                                }}
                                onDragLeave={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                                        setDropDirection(null);
                                    }
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    splitDraggedNode(target.direction);
                                }}
                            >
                                <i className={`fa-solid fa-${target.icon}`} aria-hidden="true" />
                                <span>{target.label}</span>
                            </div>
                        ))}
                    </div>
                )}
                {orderedNodes.map((node) => (
                    <WidgetTabPane
                        key={node.id}
                        node={node}
                        active={node.id === activeNode?.id}
                        layoutModel={layoutModel}
                        onClose={closeNode}
                        workbenchRole={
                            node.id === workbenchPair?.agentNodeId
                                ? "agent"
                                : node.id === workbenchPair?.companionNodeId
                                  ? "companion"
                                  : undefined
                        }
                        recentActivity={node.id === workbenchPair?.companionNodeId ? recentActivity : []}
                        onExpandCompanion={() => {
                            setWorkbenchPair(null);
                            setRecentActivity([]);
                            focusNode(node);
                        }}
                        onReturnToAgent={() => {
                            const agentNode = orderedNodes.find((entry) => entry.id === workbenchPair?.agentNodeId);
                            setWorkbenchPair(null);
                            setRecentActivity([]);
                            if (agentNode) {
                                focusNode(agentNode);
                            }
                        }}
                    />
                ))}
                {workbenchPair && (
                    <div
                        className="widget-agent-workbench-resizer"
                        role="separator"
                        aria-label="Resize chat and work widget"
                        aria-orientation="vertical"
                        aria-valuemin={28}
                        aria-valuemax={68}
                        aria-valuenow={workbenchWidth}
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                                return;
                            }
                            event.preventDefault();
                            setWorkbenchWidth((current) =>
                                Math.min(68, Math.max(28, current + (event.key === "ArrowRight" ? 2 : -2)))
                            );
                        }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                                return;
                            }
                            const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                            if (!bounds?.width) {
                                return;
                            }
                            setWorkbenchWidth(
                                Math.min(68, Math.max(28, ((event.clientX - bounds.left) / bounds.width) * 100))
                            );
                        }}
                    />
                )}
            </div>
        </div>
    );
});
WidgetTabsLayout.displayName = "WidgetTabsLayout";

export { WidgetTabsLayout };
