// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { memo, useCallback, useState } from "react";
import "./tabgroup.scss";

const TabGroupFoldStorageKey = "kronoscode:tab-groups:fold-state";

const TabGroupColors: Record<string, string> = {
    blue: "#60a5fa",
    green: "#4ade80",
    orange: "#fb923c",
    red: "#f87171",
    purple: "#a78bfa",
    yellow: "#facc15",
};

export type TabGroupDef = {
    id: string;
    name: string;
    color: string;
    tabIds: string[];
};

function loadFoldState(): Record<string, boolean> {
    try {
        const stored = window.localStorage.getItem(TabGroupFoldStorageKey);
        if (stored) return JSON.parse(stored);
    } catch {}
    return {};
}

function saveFoldState(state: Record<string, boolean>): void {
    try {
        window.localStorage.setItem(TabGroupFoldStorageKey, JSON.stringify(state));
    } catch {}
}

type TabGroupHeaderProps = {
    group: TabGroupDef;
    isFolded: boolean;
    onToggleFold: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
};

const TabGroupHeader = memo(({ group, isFolded, onToggleFold, onContextMenu }: TabGroupHeaderProps) => {
    const colorHex = TabGroupColors[group.color] ?? TabGroupColors.blue;

    return (
        <div
            className={cn("tab-group-header", { "tab-group-folded": isFolded })}
            onClick={onToggleFold}
            onContextMenu={onContextMenu}
        >
            <div className="tab-group-color-bar" style={{ backgroundColor: colorHex }} />
            <i className={cn("fa-solid fa-chevron-right tab-group-chevron", !isFolded && "rotate-90")} />
            <span className="tab-group-name">{group.name}</span>
            {isFolded && <span className="tab-group-count">{group.tabIds.length}</span>}
        </div>
    );
});
TabGroupHeader.displayName = "TabGroupHeader";

type TabGroupProps = {
    group: TabGroupDef;
    isFolded: boolean;
    onToggleFold: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    children: React.ReactNode;
};

const TabGroup = memo(({ group, isFolded, onToggleFold, onContextMenu, children }: TabGroupProps) => {
    return (
        <div className={cn("tab-group", { "tab-group-collapsed": isFolded })}>
            <TabGroupHeader
                group={group}
                isFolded={isFolded}
                onToggleFold={onToggleFold}
                onContextMenu={onContextMenu}
            />
            <div className={cn("tab-group-items", { "tab-group-items-hidden": isFolded })}>
                {children}
            </div>
        </div>
    );
});
TabGroupHeader.displayName = "TabGroupHeader";

function buildTabGroupContextMenu(
    group: TabGroupDef,
    onRename: (name: string) => void,
    onSetColor: (color: string) => void,
    onUngroup: () => void,
    onCloseAll: () => void,
): ContextMenuItem[] {
    return [
        {
            label: "Rename Group",
            click: () => {
                const newName = prompt("Group name:", group.name);
                if (newName && newName.trim()) {
                    onRename(newName.trim());
                }
            },
        },
        {
            label: "Group Color",
            type: "submenu",
            submenu: Object.entries(TabGroupColors).map(([name, hex]) => ({
                label: name.charAt(0).toUpperCase() + name.slice(1),
                type: "radio" as const,
                checked: group.color === name,
                click: () => onSetColor(name),
            })),
        },
        { type: "separator" as const },
        {
            label: "Ungroup",
            click: onUngroup,
        },
        {
            label: "Close All in Group",
            click: onCloseAll,
        },
    ];
}

export {
    TabGroup,
    TabGroupHeader,
    loadFoldState,
    saveFoldState,
    TabGroupFoldStorageKey,
    TabGroupColors,
    buildTabGroupContextMenu,
};
