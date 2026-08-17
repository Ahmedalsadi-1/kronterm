// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import { subscribeAgentActivityStream, type LiveAgentSurfaceActivity } from "../../types/agent-activity";

interface OverlayMarker {
    id: string;
    actionType: string;
    label?: string;
    x: number;
    y: number;
}

interface AgentOverlayState {
    waterflowActive: boolean;
    markers: OverlayMarker[];
    cursorPoint: { x: number; y: number } | null;
    cursorActive: boolean;
    clickFlashCount?: number;
}

export function matchesAgentOverlayTarget(
    activity: Pick<LiveAgentSurfaceActivity, "surface" | "blockid">,
    surface?: string,
    blockId?: string
): boolean {
    if (surface != null && activity.surface !== surface) {
        return false;
    }
    if (blockId != null && activity.blockid != null && activity.blockid !== blockId) {
        return false;
    }
    return true;
}

export function useAgentOverlays(surface?: string, blockId?: string): AgentOverlayState {
    const [waterflowActive, setWaterflowActive] = useState(false);
    const [markers, setMarkers] = useState<OverlayMarker[]>([]);
    const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
    const [cursorActive, setCursorActive] = useState(false);
    const [clickFlashCount, setClickFlashCount] = useState<number>();

    useEffect(() => {
        const unsub = subscribeAgentActivityStream((activity: LiveAgentSurfaceActivity) => {
            if (!matchesAgentOverlayTarget(activity, surface, blockId)) {
                return;
            }
            const isToolAction = activity.action !== "thinking" && activity.action !== "wait";

            if (
                activity.phase === "succeeded" ||
                activity.phase === "failed" ||
                activity.phase === "cancelled" ||
                activity.phase === "paused" ||
                activity.phase === "degraded" ||
                activity.phase === "awaiting-approval"
            ) {
                setWaterflowActive(false);
                setCursorActive(false);
                return;
            }

            if (!isToolAction) {
                return;
            }

            if (activity.phase === "queued") {
                setMarkers([]);
                setWaterflowActive(true);
                return;
            }

            if (activity.phase === "running" || activity.phase === "verifying") {
                setWaterflowActive(true);
                if (activity.point && activity.surface !== "terminal") {
                    setCursorPoint(activity.point);
                    setCursorActive(true);
                    if (activity.action === "click" || activity.action === "doubleClick") {
                        setClickFlashCount((count) => (count ?? 0) + 1);
                    }
                    setMarkers((prev) => {
                        const marker = {
                            id: activity.id ?? `${activity.action}-${Date.now()}`,
                            actionType: activity.action,
                            label: activity.detail,
                            x: activity.point!.x,
                            y: activity.point!.y,
                        };
                        if (prev.length >= 8) {
                            return [...prev.slice(-7), marker];
                        }
                        return [...prev, marker];
                    });
                }
                return;
            }
        });
        return unsub;
    }, [surface, blockId]);

    return { waterflowActive, markers, cursorPoint, cursorActive, clickFlashCount };
}
