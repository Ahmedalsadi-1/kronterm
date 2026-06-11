// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type PaneState = {
    open?: boolean;
    widthOverride?: number;
};

const PaneStates = new Map<string, PaneState>();

export function getPaneStates(): Record<string, PaneState> {
    return Object.fromEntries(PaneStates.entries());
}

export function ensurePaneRegistered(id: string, initial?: PaneState) {
    if (!PaneStates.has(id)) {
        PaneStates.set(id, initial ?? {});
    }
}

export function setPaneWidthOverride(id: string, widthOverride: number | null) {
    ensurePaneRegistered(id);
    PaneStates.set(id, widthOverride == null ? {} : { widthOverride });
}
