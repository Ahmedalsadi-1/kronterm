// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

type LayoutCloseNode = {
    id: string;
};

type BlockCloseRoute = "layout" | "owner";

function routeBlockClose(
    layoutNode: LayoutCloseNode | undefined,
    closeLayoutNode: (nodeId: string) => void,
    closeOwnedNode: () => void
): BlockCloseRoute {
    if (layoutNode == null) {
        closeOwnedNode();
        return "owner";
    }

    closeLayoutNode(layoutNode.id);
    return "layout";
}

export { routeBlockClose };
