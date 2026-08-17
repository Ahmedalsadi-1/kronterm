// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

function getAdjacentWidgetFocus(
    leafOrder: LeafOrderEntry[],
    focusedNodeId: string | undefined,
    offset: -1 | 1
): LeafOrderEntry | null {
    if (leafOrder.length === 0) {
        return null;
    }
    const currentIndex = leafOrder.findIndex((entry) => entry.nodeid === focusedNodeId);
    if (currentIndex === -1) {
        return leafOrder[0];
    }
    return leafOrder[(currentIndex + offset + leafOrder.length) % leafOrder.length];
}

export { getAdjacentWidgetFocus };
