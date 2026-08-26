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

type CanvasSnapCandidate = {
    delta: number;
    id: string;
    value: number;
};

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0;

export function snapWorkspaceCanvasRect(
    moving: WorkspaceCanvasRect,
    others: CanvasRectEntry[],
    gap = 12,
    distance = 24
): WorkspaceCanvasSnapResult {
    let bestX: CanvasSnapCandidate | null = null;
    let bestY: CanvasSnapCandidate | null = null;

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
            if (delta <= distance && (bestX == null || delta < bestX.delta)) {
                bestX = { delta, id, value: target };
            }
        }
        for (const target of yTargets) {
            const delta = Math.abs(moving.y - target);
            if (delta <= distance && (bestY == null || delta < bestY.delta)) {
                bestY = { delta, id, value: target };
            }
        }
    }

    return {
        rect: {
            ...moving,
            x: bestX?.value ?? moving.x,
            y: bestY?.value ?? moving.y,
        },
        snappedTo: [...new Set([bestX?.id, bestY?.id].filter((id): id is string => id != null))],
    };
}

export function translateWorkspaceCanvasRect(
    rect: WorkspaceCanvasRect,
    delta: WorkspaceCanvasPoint
): WorkspaceCanvasRect {
    return { ...rect, x: rect.x + delta.x, y: rect.y + delta.y };
}

export function decayWorkspaceCanvasVelocity(
    velocity: WorkspaceCanvasPoint,
    elapsedMs: number,
    friction = 0.9
): WorkspaceCanvasPoint {
    const decay = Math.pow(friction, Math.max(0, elapsedMs) / 16.67);
    return { x: velocity.x * decay, y: velocity.y * decay };
}

export function shouldContinueWorkspaceCanvasMomentum(
    velocity: WorkspaceCanvasPoint,
    reducedMotion: boolean,
    minimumSpeed = 0.015
): boolean {
    return !reducedMotion && Math.hypot(velocity.x, velocity.y) >= minimumSpeed;
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
