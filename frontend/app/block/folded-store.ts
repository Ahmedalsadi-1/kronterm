// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const FOLD_STORAGE_KEY = "kronoscode:folded-blocks";
const FOLD_CHANGED_EVENT = "kronoscode:fold-changed";
const UNFOLD_EVENT = "kronoscode:unfold-block";

function getFoldedBlockIds(): Set<string> {
    try {
        const raw = window.localStorage.getItem(FOLD_STORAGE_KEY);
        if (raw == null) return new Set();
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

function saveFoldedBlockIds(ids: Set<string>): void {
    window.localStorage.setItem(FOLD_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    window.dispatchEvent(new CustomEvent(FOLD_CHANGED_EVENT, { detail: { ids: Array.from(ids) } }));
}

function setBlockFolded(blockId: string, folded: boolean): void {
    const ids = getFoldedBlockIds();
    if (folded) {
        ids.add(blockId);
    } else {
        ids.delete(blockId);
    }
    saveFoldedBlockIds(ids);
}

function isBlockFolded(blockId: string): boolean {
    return getFoldedBlockIds().has(blockId);
}

function requestUnfoldBlock(blockId: string): void {
    window.dispatchEvent(new CustomEvent(UNFOLD_EVENT, { detail: { blockId } }));
}

export {
    FOLD_CHANGED_EVENT as FoldChangedEvent,
    UNFOLD_EVENT as UnfoldBlockEvent,
    getFoldedBlockIds,
    saveFoldedBlockIds,
    setBlockFolded,
    isBlockFolded,
    requestUnfoldBlock,
};
