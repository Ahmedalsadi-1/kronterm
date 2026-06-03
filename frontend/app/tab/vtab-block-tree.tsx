// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToIcon, blockViewToName } from "@/app/block/blockutil";
import { getFoldedBlockIds, FoldChangedEvent } from "@/app/block/folded-store";
import * as WOS from "@/store/wos";
import { makeORef } from "@/app/store/wos";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { refocusNode } from "@/store/global";
import { atom, useAtomValue } from "jotai";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./vtab-block-tree.scss";

interface BlockEntry {
    blockId: string;
    viewType: string;
    viewName: string;
    viewIcon: string;
    folded: boolean;
}

interface BlockGroup {
    viewType: string;
    viewName: string;
    viewIcon: string;
    blocks: BlockEntry[];
    expanded: boolean;
    foldedCount: number;
}

function makeTabBlockGroupsAtom(tabId: string) {
    const tabOref = makeORef("tab", tabId);
    const tabAtom = WOS.getWaveObjectAtom<Tab>(tabOref);
    return atom((get) => {
        const tabData = get(tabAtom);
        const blockIds = tabData?.blockids ?? [];
        if (blockIds.length === 0) return [] as [string, string][];

        return blockIds.map((blockId) => {
            const blockOref = makeORef("block", blockId);
            const blockAtom = WOS.getWaveObjectAtom<Block>(blockOref);
            const blockData = get(blockAtom);
            const viewType = (blockData?.meta?.["view"] as string) ?? "term";
            return [blockId, viewType] as [string, string];
        });
    });
}

const VTabBlockTree = React.memo(({ tabId, active }: { tabId: string; active: boolean }) => {
    const [foldedIds, setFoldedIds] = useState<Set<string>>(() => getFoldedBlockIds());
    const blockEntriesAtom = useMemo(() => makeTabBlockGroupsAtom(tabId), [tabId]);
    const blockEntries = useAtomValue(blockEntriesAtom);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handler = () => {
            setFoldedIds(getFoldedBlockIds());
        };
        window.addEventListener(FoldChangedEvent, handler);
        return () => window.removeEventListener(FoldChangedEvent, handler);
    }, []);

    const groups = useMemo(() => {
        const groupMap = new Map<string, BlockGroup>();
        for (const [blockId, viewType] of blockEntries) {
            const viewName = blockViewToName(viewType);
            const viewIcon = blockViewToIcon(viewType);
            const folded = foldedIds.has(blockId);

            if (!groupMap.has(viewType)) {
                groupMap.set(viewType, {
                    viewType,
                    viewName,
                    viewIcon,
                    blocks: [],
                    expanded: true,
                    foldedCount: 0,
                });
            }

            const group = groupMap.get(viewType)!;
            group.blocks.push({ blockId, viewType, viewName, viewIcon, folded });
            if (folded) {
                group.foldedCount++;
            }
        }

        return Array.from(groupMap.values());
    }, [blockEntries, foldedIds]);

    const toggleGroup = useCallback((viewType: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(viewType)) {
                next.delete(viewType);
            } else {
                next.add(viewType);
            }
            return next;
        });
    }, []);

    const handleBlockClick = useCallback(
        (blockId: string, folded: boolean) => {
            if (folded) {
                const layoutModel = getLayoutModelForStaticTab();
                if (layoutModel) {
                    const node = layoutModel.getNodeByBlockId(blockId);
                    if (node?.id) {
                        layoutModel.foldNodeToggle(node.id);
                    }
                }
            }
            refocusNode(blockId);
        },
        []
    );

    if (!active || groups.length === 0) {
        return null;
    }

    return (
        <div className="vtab-block-tree">
            {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.viewType);
                return (
                    <div key={group.viewType} className="vtab-block-group">
                        <div
                            className="vtab-block-group-header"
                            onClick={() => toggleGroup(group.viewType)}
                        >
                            <i className={`fa-solid fa-chevron-right vtab-block-group-chevron ${isExpanded ? "expanded" : ""}`} />
                            <i className={`fa-solid fa-${group.viewIcon} vtab-block-group-icon`} />
                            <span className="vtab-block-group-name">{group.viewName}</span>
                            <span className="vtab-block-group-count">{group.blocks.length}</span>
                            {group.foldedCount > 0 && (
                                <span className="vtab-block-group-folded-badge" title={`${group.foldedCount} folded`}>
                                    {group.foldedCount}
                                </span>
                            )}
                        </div>
                        {(isExpanded || group.blocks.length <= 1) && (
                            <div className="vtab-block-items">
                                {group.blocks.map((block) => (
                                    <div
                                        key={block.blockId}
                                        className={`vtab-block-item ${block.folded ? "folded" : ""}`}
                                        onClick={() => handleBlockClick(block.blockId, block.folded)}
                                        title={block.folded ? "Unfold block" : "Focus block"}
                                    >
                                        <i className={`fa-solid fa-${block.viewIcon} vtab-block-item-icon`} />
                                        <span className="vtab-block-item-name">{block.viewName}</span>
                                        {block.folded && <i className="fa-solid fa-arrow-right-to-bracket vtab-block-item-fold-icon" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

VTabBlockTree.displayName = "VTabBlockTree";

export { VTabBlockTree };
