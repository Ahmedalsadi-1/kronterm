// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block as BlockView } from "@/app/block/block";
import { blockViewToName, resolveBlockIcon } from "@/app/block/blockutil";
import { LayoutModel } from "@/layout/lib/layoutModel";
import { useNodeModel, useTileLayout } from "@/layout/lib/layoutModelHooks";
import { DropDirection, LayoutNode, NodeModel, TileLayoutContents } from "@/layout/lib/types";
import { refocusNode } from "@/store/global";
import * as WOS from "@/store/wos";
import { makeIconClass } from "@/util/util";
import { Atom, atom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
                <span>{displayTitle}</span>
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
    }: {
        node: LayoutNode;
        active: boolean;
        layoutModel: LayoutModel;
        onClose: (nodeId: string) => void;
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

        return (
            <div
                id={`widget-surface-panel-${blockId}`}
                className={`widget-surface-pane ${active ? "is-active" : ""}`}
                role="tabpanel"
                aria-labelledby={`widget-surface-tab-${blockId}`}
                aria-hidden={!active}
            >
                <BlockView key={blockId} nodeModel={nodeModel} preview={false} />
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
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const [dropDirection, setDropDirection] = useState<DropDirection | null>(null);
    nodesRef.current = orderedNodes;
    activeNodeIdRef.current = activeNode?.id;

    useEffect(() => {
        setReady(true);
    }, [setReady]);

    useEffect(() => {
        if (activeNode && focusedNode?.id !== activeNode.id) {
            layoutModel.focusNode(activeNode.id);
        }
    }, [activeNode, focusedNode?.id, layoutModel]);

    const focusNode = useCallback(
        (node: LayoutNode) => {
            layoutModel.focusNode(node.id);
            window.requestAnimationFrame(() => refocusNode(node.data?.blockId));
        },
        [layoutModel]
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
            <div ref={layoutModel.displayContainerRef} className="widget-surface-content">
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
                    />
                ))}
            </div>
            <div className="widget-surface-tabstrip" role="tablist" aria-label="Widgets in this workspace tab">
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
                <span className="widget-surface-tab-divider" aria-hidden="true" />
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
                </button>
                {addButtonRef.current && (
                    <WidgetPickerPopover
                        anchorElement={addButtonRef.current}
                        open={widgetPickerOpen}
                        onClose={() => setWidgetPickerOpen(false)}
                    />
                )}
            </div>
        </div>
    );
});
WidgetTabsLayout.displayName = "WidgetTabsLayout";

export { WidgetTabsLayout };
