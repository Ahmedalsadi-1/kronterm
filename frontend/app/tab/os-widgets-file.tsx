// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AppIcon } from "@/app/components/app-icon";
import { cn } from "@/util/util";
import { memo } from "react";

import { OSAppDragMimeType, readOSAppDragPayload } from "./os-app-stream";

export type OSWidgetsFileBlock = {
    blockId: string;
    view: string;
    title: string;
    icon?: string;
    collapsed?: boolean;
};

const WidgetCategories: Array<{ id: string; label: string; views: string[] }> = [
    { id: "system", label: "System", views: ["sysinfo", "term", "sandbox"] },
    { id: "productivity", label: "Productivity", views: ["preview", "web", "kronoscanvas"] },
    { id: "agents", label: "Agents", views: ["chathubv2", "hermes", "warpagent"] },
    { id: "applications", label: "Applications", views: ["appstream", "installedapps"] },
];

export function groupWidgetsByCategory(
    blocks: OSWidgetsFileBlock[]
): Array<{ id: string; label: string; blocks: OSWidgetsFileBlock[] }> {
    const groups = WidgetCategories.map((category) => ({
        id: category.id,
        label: category.label,
        blocks: blocks.filter((block) => category.views.includes(block.view)),
    })).filter((group) => group.blocks.length > 0);
    const categorized = new Set(groups.flatMap((group) => group.blocks.map((block) => block.blockId)));
    const other = blocks.filter((block) => !categorized.has(block.blockId));
    if (other.length > 0) groups.push({ id: "other", label: "Other", blocks: other });
    return groups;
}

const OSWidgetsFileView = memo(function OSWidgetsFileView({
    blocks,
    onFocusBlock,
    onCollapseBlock,
}: {
    blocks: OSWidgetsFileBlock[];
    onFocusBlock: (blockId: string) => void;
    onCollapseBlock: (blockId: string) => void;
}) {
    const groups = groupWidgetsByCategory(blocks);
    return (
        <aside
            className="os-widgets-file"
            aria-label="Widgets file view"
            onDragOver={(event) => {
                if (event.dataTransfer.types.includes(OSAppDragMimeType)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                }
            }}
            onDrop={(event) => {
                const payload = readOSAppDragPayload(event.dataTransfer);
                if (payload == null) return;
                event.preventDefault();
                event.stopPropagation();
                if (payload.blockId != null) onCollapseBlock(payload.blockId);
            }}
        >
            <header>
                <strong>Widgets</strong>
                <span>Drag onto the canvas to place · drop here to file</span>
            </header>
            {groups.map((group) => (
                <section key={group.id}>
                    <h3>{group.label}</h3>
                    <div>
                        {group.blocks.map((block) => (
                            <button
                                type="button"
                                key={block.blockId}
                                className={cn("os-widgets-file-row", block.collapsed && "is-filed")}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.setData(
                                        OSAppDragMimeType,
                                        JSON.stringify({ blockId: block.blockId })
                                    );
                                    event.dataTransfer.effectAllowed = "copyMove";
                                }}
                                onClick={() => onFocusBlock(block.blockId)}
                                title={block.collapsed ? "Drag to canvas or click to place" : block.title}
                            >
                                <AppIcon icon={block.icon} />
                                <span className="os-widgets-file-copy">
                                    <strong>{block.title}</strong>
                                    <small>{block.collapsed ? "On file" : block.view}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </aside>
    );
});
OSWidgetsFileView.displayName = "OSWidgetsFileView";

export { OSWidgetsFileView };
