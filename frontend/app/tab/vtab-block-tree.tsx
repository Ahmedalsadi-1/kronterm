// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToName, resolveBlockIcon } from "@/app/block/blockutil";
import { AppIcon } from "@/app/components/app-icon";
import { FoldChangedEvent, getFoldedBlockIds } from "@/app/block/folded-store";
import { makeORef } from "@/app/store/wos";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { refocusNode } from "@/store/global";
import * as WOS from "@/store/wos";
import { atom, useAtomValue } from "jotai";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./vtab-block-tree.scss";

interface BlockEntry {
    blockId: string;
    viewType: string;
    viewName: string;
    viewIcon: string;
    title: string;
    folded: boolean;
}

function makeTabBlockEntriesAtom(tabId: string) {
    const tabOref = makeORef("tab", tabId);
    const tabAtom = WOS.getWaveObjectAtom<Tab>(tabOref);
    return atom((get) => {
        const tabData = get(tabAtom);
        const blockIds = tabData?.blockids ?? [];
        if (blockIds.length === 0) {
            return [] as BlockEntry[];
        }

        return blockIds.map((blockId) => {
            const blockOref = makeORef("block", blockId);
            const blockAtom = WOS.getWaveObjectAtom<Block>(blockOref);
            const blockData = get(blockAtom);
            const viewType = (blockData?.meta?.["view"] as string) ?? "term";
            const viewName = blockViewToName(viewType);
            const title = String(blockData?.meta?.["frame:title"] ?? "").trim();
            return {
                blockId,
                viewType,
                viewName,
                viewIcon: resolveBlockIcon(viewType, blockData?.meta),
                title: title || viewName,
                folded: false,
            };
        });
    });
}

const VTabBlockTree = React.memo(({ tabId, active }: { tabId: string; active: boolean }) => {
    const layoutModel = getLayoutModelForStaticTab();
    const focusedNode = useAtomValue(layoutModel.focusedNode);
    const [foldedIds, setFoldedIds] = useState<Set<string>>(() => getFoldedBlockIds());
    const blockEntriesAtom = useMemo(() => makeTabBlockEntriesAtom(tabId), [tabId]);
    const rawBlockEntries = useAtomValue(blockEntriesAtom);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        const handler = () => {
            setFoldedIds(getFoldedBlockIds());
        };
        window.addEventListener(FoldChangedEvent, handler);
        return () => window.removeEventListener(FoldChangedEvent, handler);
    }, []);

    const blockEntries = useMemo(
        () => rawBlockEntries.map((entry) => ({ ...entry, folded: foldedIds.has(entry.blockId) })),
        [foldedIds, rawBlockEntries]
    );

    const handleBlockClick = useCallback((blockId: string, folded: boolean) => {
        const layoutModel = getLayoutModelForStaticTab();
        const node = layoutModel?.getNodeByBlockId(blockId);
        if (folded) {
            if (node?.id) {
                layoutModel.foldNodeToggle(node.id);
            }
        }
        if (node?.id) {
            layoutModel.focusNode(node.id);
        }
        window.requestAnimationFrame(() => refocusNode(blockId));
    }, []);

    if (!active || blockEntries.length === 0) {
        return null;
    }

    return (
        <div className="vtab-block-tree" aria-label="Widgets in this workspace tab">
            <button
                type="button"
                className="vtab-block-tree-header"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
            >
                <i className={`fa-solid fa-chevron-right vtab-block-tree-chevron ${expanded ? "expanded" : ""}`} />
                <i className={`fa-solid ${expanded ? "fa-folder-open" : "fa-folder"} vtab-block-tree-folder`} />
                <span className="vtab-block-tree-name">Widgets</span>
                <span className="vtab-block-tree-count">{blockEntries.length}</span>
            </button>
            {expanded && (
                <div className="vtab-block-items" role="group" aria-label="Tab widgets">
                    {blockEntries.map((block) => (
                        <button
                            type="button"
                            key={block.blockId}
                            className={`vtab-block-item ${block.blockId === focusedNode?.data?.blockId ? "is-active" : ""} ${block.folded ? "folded" : ""}`}
                            onClick={() => handleBlockClick(block.blockId, block.folded)}
                            title={block.folded ? `Unfold ${block.title}` : `Focus ${block.title}`}
                        >
                            <span className="vtab-block-branch" aria-hidden="true" />
                            <AppIcon icon={block.viewIcon} className="vtab-block-item-icon" />
                            <span className="vtab-block-item-name">{block.title}</span>
                            <span className="vtab-block-item-type">{block.viewName}</span>
                            {block.folded && (
                                <i
                                    className="fa-solid fa-arrow-right-to-bracket vtab-block-item-fold-icon"
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

VTabBlockTree.displayName = "VTabBlockTree";

export { VTabBlockTree };
