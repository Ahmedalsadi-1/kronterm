// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

type BrowserTabOrientation = "horizontal" | "vertical";

function getNextBrowserTabIndex(
    key: string,
    currentIndex: number,
    tabCount: number,
    orientation: BrowserTabOrientation
): number | null {
    if (tabCount <= 0 || currentIndex < 0 || currentIndex >= tabCount) {
        return null;
    }
    if (key === "Home") {
        return 0;
    }
    if (key === "End") {
        return tabCount - 1;
    }
    const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    if (key === previousKey) {
        return (currentIndex - 1 + tabCount) % tabCount;
    }
    if (key === nextKey) {
        return (currentIndex + 1) % tabCount;
    }
    return null;
}

function getBrowserTabIdAfterClose(tabIds: string[], activeTabId: string, closedTabId: string): string | null {
    if (tabIds.length <= 1) {
        return null;
    }
    if (activeTabId !== closedTabId) {
        return activeTabId;
    }
    const closedIndex = tabIds.indexOf(closedTabId);
    if (closedIndex < 0) {
        return activeTabId;
    }
    return tabIds[Math.max(0, closedIndex - 1)] ?? null;
}

export { getBrowserTabIdAfterClose, getNextBrowserTabIndex };
export type { BrowserTabOrientation };
