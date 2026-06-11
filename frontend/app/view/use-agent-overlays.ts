// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { subscribeAgentActivityStream, type LiveAgentSurfaceActivity } from "../../types/agent-activity";
import { useEffect, useState } from "react";

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
}

/**
 * Subscribe to agent activity events and derive WaterFlow + ActionMarker state.
 *
 * - WaterFlow active during "running" / "thinking" phases
 * - Action markers created from action events with coordinates (click, type, hotkey)
 * - Markers auto-dismiss after their timeout via ActionMarker component
 * - Markers are cleared on new run or terminal/desktop surface switch
 */
export function useAgentOverlays(surface?: string): AgentOverlayState {
    const [waterflowActive, setWaterflowActive] = useState(false);
    const [markers, setMarkers] = useState<OverlayMarker[]>([]);

    useEffect(() => {
        const unsub = subscribeAgentActivityStream((activity: LiveAgentSurfaceActivity) => {
            if (activity.phase === "queued") {
                setMarkers([]);
                setWaterflowActive(true);
                return;
            }
            if (activity.phase === "running" || activity.phase === "verifying") {
                setWaterflowActive(true);
                if (activity.point && activity.surface !== "terminal") {
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
            if (
                activity.phase === "succeeded" ||
                activity.phase === "failed" ||
                activity.phase === "cancelled"
            ) {
                setWaterflowActive(false);
                return;
            }
        });
        return unsub;
    }, [surface]);

    return { waterflowActive, markers };
}
