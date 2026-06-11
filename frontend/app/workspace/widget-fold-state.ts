// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atom } from "jotai";

const FoldStateStorageKey = "kronoscode:widget-groups:fold-state";

function loadFoldState(): Record<string, boolean> {
    try {
        const stored = window.localStorage.getItem(FoldStateStorageKey);
        if (stored) return JSON.parse(stored);
    } catch {}
    return {};
}

function persistFoldState(state: Record<string, boolean>): void {
    try {
        window.localStorage.setItem(FoldStateStorageKey, JSON.stringify(state));
    } catch {}
}

/**
 * Shared atom for widget group fold state.
 * Used by both the widget sidebar (widgets.tsx) and the tab bar
 * to show folded widget groups as recallable pills.
 */
export const widgetFoldStateAtom = atom<Record<string, boolean>>(loadFoldState());

/** Derived atom: list of currently folded group keys */
export const foldedGroupKeysAtom = atom((get) => {
    const state = get(widgetFoldStateAtom);
    return Object.entries(state)
        .filter(([, isFolded]) => isFolded)
        .map(([key]) => key);
});

/** Update fold state and persist to localStorage */
export function updateFoldState(
    current: Record<string, boolean>,
    updater: (prev: Record<string, boolean>) => Record<string, boolean>
): Record<string, boolean> {
    const next = updater(current);
    persistFoldState(next);
    return next;
}
