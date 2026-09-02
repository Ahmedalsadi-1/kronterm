// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AppIcon } from "@/app/components/app-icon";
import type { AppDescriptor } from "@/app/store/app-registry";
import { cn } from "@/util/util";
import { memo } from "react";

export type OSAppStreamBlock = {
    blockId: string;
    view: string;
    title: string;
    icon?: string;
};

export type OSAppDragPayload = {
    blockId?: string;
    view?: string;
    appid?: string;
    appname?: string;
};

export const OSAppDragMimeType = "application/x-kronterm-os-app";

const DragMimeType = OSAppDragMimeType;

function writeDragPayload(event: React.DragEvent, payload: OSAppDragPayload) {
    event.dataTransfer.setData(DragMimeType, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copyMove";
}

export function readOSAppDragPayload(dataTransfer: DataTransfer): OSAppDragPayload | undefined {
    const raw = dataTransfer.getData(DragMimeType);
    if (raw === "") return undefined;
    try {
        const payload = JSON.parse(raw) as OSAppDragPayload;
        if (payload.blockId == null && payload.view == null && payload.appid == null) return undefined;
        return payload;
    } catch {
        return undefined;
    }
}

const OSAppStreamRail = memo(function OSAppStreamRail({
    blocks,
    activeBlockId,
    onFocusBlock,
}: {
    blocks: OSAppStreamBlock[];
    activeBlockId: string | undefined;
    onFocusBlock: (blockId: string) => void;
}) {
    return (
        <aside className="os-app-stream" aria-label="App stream">
            <header>App Stream</header>
            <div className="os-app-stream-cards">
                {blocks.length === 0 && <div className="os-app-stream-empty">No running applications</div>}
                {blocks.map((block) => {
                    const active = block.blockId === activeBlockId;
                    return (
                        <button
                            type="button"
                            key={block.blockId}
                            className={cn("os-app-stream-card", active && "is-active")}
                            onClick={() => onFocusBlock(block.blockId)}
                            draggable
                            onDragStart={(event) => writeDragPayload(event, { blockId: block.blockId })}
                            aria-pressed={active}
                            title={block.title}
                        >
                            <AppIcon icon={block.icon} />
                            <span className="os-app-stream-copy">
                                <strong>{block.title}</strong>
                                <small>{block.view}</small>
                            </span>
                            <span className="os-app-stream-dot" aria-hidden="true" />
                        </button>
                    );
                })}
            </div>
        </aside>
    );
});
OSAppStreamRail.displayName = "OSAppStreamRail";

const OSAppIconRail = memo(function OSAppIconRail({
    installedApps,
    onLaunchApp,
}: {
    installedApps: AppDescriptor[];
    onLaunchApp: (descriptor: AppDescriptor) => void;
}) {
    return (
        <aside className="os-app-icon-rail" aria-label="Installed applications">
            {installedApps.slice(0, 7).map((descriptor) => (
                <button
                    type="button"
                    key={descriptor.id}
                    className={cn("os-app-icon", descriptor.runningBlockIds.length > 0 && "is-running")}
                    onClick={() => onLaunchApp(descriptor)}
                    draggable
                    onDragStart={(event) =>
                        writeDragPayload(event, { appid: descriptor.installedAppId, appname: descriptor.name })
                    }
                    aria-label={`Open ${descriptor.name}`}
                    title={descriptor.name}
                >
                    <AppIcon icon={descriptor.icon} />
                    <span className="os-app-icon-dot" aria-hidden="true" />
                </button>
            ))}
        </aside>
    );
});
OSAppIconRail.displayName = "OSAppIconRail";

export { OSAppIconRail, OSAppStreamRail };
