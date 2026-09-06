// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DropDirection,
    LayoutNode,
    LayoutTreeActionType,
    type LayoutTreeComputeMoveNodeAction,
} from "@/layout/lib/types";

interface WidgetTabMoveLayout {
    treeReducer: (action: LayoutTreeComputeMoveNodeAction) => void;
    onDrop: () => void;
    focusNode: (nodeId: string) => void;
}

interface WidgetTabCloseAccessibility {
    ariaHidden: boolean;
    tabIndex: 0 | -1;
}

interface WidgetWorkbenchPair {
    agentNodeId: string;
    companionNodeId: string;
}

function getVisibleWidgetPaneIds(
    activeNodeId: string | undefined,
    workbenchPair: WidgetWorkbenchPair | null
): Set<string> {
    if (workbenchPair) {
        return new Set([workbenchPair.agentNodeId, workbenchPair.companionNodeId]);
    }
    return new Set(activeNodeId ? [activeNodeId] : []);
}

function getWidgetTabCloseAccessibility(active: boolean): WidgetTabCloseAccessibility {
    return {
        ariaHidden: !active,
        tabIndex: active ? 0 : -1,
    };
}

function getWidgetFocusAfterClose(
    nodes: LayoutNode[],
    closingNodeId: string,
    activeNodeId: string | undefined
): string | null {
    if (closingNodeId !== activeNodeId) {
        return activeNodeId ?? null;
    }
    const closingIndex = nodes.findIndex((node) => node.id === closingNodeId);
    if (closingIndex === -1) {
        return activeNodeId ?? null;
    }
    return nodes[closingIndex + 1]?.id ?? nodes[closingIndex - 1]?.id ?? null;
}

function moveWidgetTab(
    layout: WidgetTabMoveLayout,
    movingNodeId: string,
    targetNodeId: string,
    direction: DropDirection
): boolean {
    if (!movingNodeId || !targetNodeId || movingNodeId === targetNodeId) {
        return false;
    }
    layout.treeReducer({
        type: LayoutTreeActionType.ComputeMove,
        nodeId: targetNodeId,
        nodeToMoveId: movingNodeId,
        direction,
    });
    layout.onDrop();
    layout.focusNode(movingNodeId);
    return true;
}

export { getVisibleWidgetPaneIds, getWidgetFocusAfterClose, getWidgetTabCloseAccessibility, moveWidgetTab };
