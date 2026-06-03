// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import * as jotai from "jotai";

export interface BlockHighlightType {
    blockId: string;
    icon: string;
}

export class BlockModel {
    private static instance: BlockModel | null = null;
    private blockHighlightAtomCache = new Map<string, jotai.Atom<BlockHighlightType | null>>();

    blockHighlightAtom: jotai.PrimitiveAtom<BlockHighlightType> = jotai.atom(null) as jotai.PrimitiveAtom<BlockHighlightType>;
    blockHighlightsAtom: jotai.PrimitiveAtom<BlockHighlightType[]> = jotai.atom([]) as jotai.PrimitiveAtom<BlockHighlightType[]>;

    private constructor() {}

    getBlockHighlightAtom(blockId: string): jotai.Atom<BlockHighlightType | null> {
        let atom = this.blockHighlightAtomCache.get(blockId);
        if (!atom) {
            atom = jotai.atom((get) => {
                const single = get(this.blockHighlightAtom);
                if (single?.blockId === blockId) {
                    return single;
                }
                const highlights = get(this.blockHighlightsAtom);
                const found = highlights.find((h) => h.blockId === blockId);
                return found ?? null;
            });
            this.blockHighlightAtomCache.set(blockId, atom);
        }
        return atom;
    }

    setBlockHighlight(highlight: BlockHighlightType | null) {
        globalStore.set(this.blockHighlightAtom, highlight);
    }

    addBlockHighlight(highlight: BlockHighlightType) {
        const current = globalStore.get(this.blockHighlightsAtom);
        const exists = current.some((h) => h.blockId === highlight.blockId);
        if (!exists) {
            globalStore.set(this.blockHighlightsAtom, [...current, highlight]);
        }
    }

    removeBlockHighlight(blockId: string) {
        const current = globalStore.get(this.blockHighlightsAtom);
        globalStore.set(this.blockHighlightsAtom, current.filter((h) => h.blockId !== blockId));
    }

    clearBlockHighlights() {
        globalStore.set(this.blockHighlightsAtom, []);
    }

    getBlockHighlights(): BlockHighlightType[] {
        return globalStore.get(this.blockHighlightsAtom);
    }

    static getInstance(): BlockModel {
        if (!BlockModel.instance) {
            BlockModel.instance = new BlockModel();
        }
        return BlockModel.instance;
    }

    static resetInstance(): void {
        BlockModel.instance = null;
    }
}
