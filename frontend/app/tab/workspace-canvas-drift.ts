// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    screenPointToCanvas,
    type WorkspaceCanvasCamera,
    type WorkspaceCanvasPoint,
    type WorkspaceCanvasRect,
    type WorkspaceCanvasSize,
} from "./workspace-canvas-utils";

export type WorkspaceCanvasSnapResult = {
    rect: WorkspaceCanvasRect;
    snappedTo: string[];
};

type CanvasRectEntry = [string, WorkspaceCanvasRect];

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0;

export function snapWorkspaceCanvasRect(
    moving: WorkspaceCanvasRect,
    others: CanvasRectEntry[],
    gap = 12,
    distance = 24
): WorkspaceCanvasSnapResult {
    let x = moving.x;
    let y = moving.y;
    let bestX = distance + 1;
    let bestY = distance + 1;
    const snappedTo = new Set<string>();

    for (const [id, other] of others) {
        const verticalOverlap = rangesOverlap(
            moving.y - distance,
            moving.y + moving.height + distance,
            other.y,
            other.y + other.height
        );
        const horizontalOverlap = rangesOverlap(
            moving.x - distance,
            moving.x + moving.width + distance,
            other.x,
            other.x + other.width
        );
        const xTargets = verticalOverlap
            ? [other.x - gap - moving.width, other.x + other.width + gap, other.x, other.x + other.width - moving.width]
            : [];
        const yTargets = horizontalOverlap
            ? [
                  other.y - gap - moving.height,
                  other.y + other.height + gap,
                  other.y,
                  other.y + other.height - moving.height,
              ]
            : [];

        for (const target of xTargets) {
            const delta = Math.abs(moving.x - target);
            if (delta <= distance && delta < bestX) {
                x = target;
                bestX = delta;
                snappedTo.add(id);
            }
        }
        for (const target of yTargets) {
            const delta = Math.abs(moving.y - target);
            if (delta <= distance && delta < bestY) {
                y = target;
                bestY = delta;
                snappedTo.add(id);
            }
        }
    }

    return { rect: { ...moving, x, y }, snappedTo: [...snappedTo] };
}

export function findWorkspaceCanvasCluster(
    startId: string,
    rects: Record<string, WorkspaceCanvasRect>,
    gap = 12,
    tolerance = 2
): string[] {
    if (!rects[startId]) {
        return [];
    }
    const cluster = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const current = rects[currentId];
        for (const [candidateId, candidate] of Object.entries(rects)) {
            if (cluster.has(candidateId)) {
                continue;
            }
            const horizontalGap = Math.min(
                Math.abs(candidate.x - (current.x + current.width) - gap),
                Math.abs(current.x - (candidate.x + candidate.width) - gap)
            );
            const verticalGap = Math.min(
                Math.abs(candidate.y - (current.y + current.height) - gap),
                Math.abs(current.y - (candidate.y + candidate.height) - gap)
            );
            const horizontallyJoined =
                horizontalGap <= tolerance &&
                rangesOverlap(current.y, current.y + current.height, candidate.y, candidate.y + candidate.height);
            const verticallyJoined =
                verticalGap <= tolerance &&
                rangesOverlap(current.x, current.x + current.width, candidate.x, candidate.x + candidate.width);
            if (!horizontallyJoined && !verticallyJoined) {
                continue;
            }
            cluster.add(candidateId);
            queue.push(candidateId);
        }
    }
    return [...cluster];
}

export function findDirectionalWorkspaceCanvasRect(
    sourceId: string,
    direction: "left" | "right" | "up" | "down",
    rects: Record<string, WorkspaceCanvasRect>
): string | null {
    const source = rects[sourceId];
    if (!source) {
        return null;
    }
    const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const candidates = Object.entries(rects)
        .filter(([id]) => id !== sourceId)
        .map(([id, rect]) => {
            const dx = rect.x + rect.width / 2 - sourceCenter.x;
            const dy = rect.y + rect.height / 2 - sourceCenter.y;
            const primary = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
            const cross = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
            return { id, primary, cross, score: primary + cross * 0.45 };
        })
        .filter(({ primary, cross }) => primary > 0 && primary >= cross * 0.5)
        .sort((a, b) => a.score - b.score);
    return candidates[0]?.id ?? null;
}

export function centerWorkspaceCanvasCamera(
    rect: WorkspaceCanvasRect,
    viewport: WorkspaceCanvasSize,
    zoom: number
): WorkspaceCanvasCamera {
    return {
        x: Math.round(viewport.width / 2 - (rect.x + rect.width / 2) * zoom),
        y: Math.round(viewport.height / 2 - (rect.y + rect.height / 2) * zoom),
        zoom,
    };
}

export function workspaceCanvasViewportRect(
    camera: WorkspaceCanvasCamera,
    viewport: WorkspaceCanvasSize
): WorkspaceCanvasRect {
    const topLeft = screenPointToCanvas(camera, { x: 0, y: 0 });
    return {
        ...topLeft,
        width: viewport.width / camera.zoom,
        height: viewport.height / camera.zoom,
    };
}

export function workspaceCanvasEdgePanDelta(
    point: WorkspaceCanvasPoint,
    viewport: WorkspaceCanvasSize,
    zone = 56,
    maximum = 18
): WorkspaceCanvasPoint {
    const axisDelta = (value: number, size: number): number => {
        if (value < zone) {
            return maximum * (1 - Math.max(0, value) / zone);
        }
        if (value > size - zone) {
            return -maximum * (1 - Math.max(0, size - value) / zone);
        }
        return 0;
    };
    return { x: axisDelta(point.x, viewport.width), y: axisDelta(point.y, viewport.height) };
}
