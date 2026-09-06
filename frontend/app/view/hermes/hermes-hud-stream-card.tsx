// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ComputerUseControlEvent } from "@/app/components/computer-use-status-card";
import { focusOSSession } from "@/app/workspace/command-center-events";
import {
    isAgentActivityActive,
    subscribeAgentActivityStream,
    type AgentActivitySurface,
    type LiveAgentSurfaceActivity,
} from "../../../types/agent-activity";
import { useEffect, useRef, useState } from "react";

const HudStreamHistoryLimit = 6;
const HudStreamVisibleSteps = 4;
const HudStreamCompletionHoldMs = 5_000;

const HudStreamSurfaceIcons: Record<AgentActivitySurface, string> = {
    browser: "globe",
    desktop: "display",
    file: "file-code",
    panel: "sparkles",
    sandbox: "box",
    terminal: "terminal",
};

// Anchored above the Kronos HUD so agent work evidence lives inside HUD mode
// instead of floating over desktop windows. Shows the latest screenshot the
// agent captured on the browser/sandbox/computer-use surface, falling back to
// a compact step list when the surface does not produce screenshots.
export function HermesHudStreamCard({ hudGeometry }: { hudGeometry: { x: number; y: number; width: number } }) {
    const [activities, setActivities] = useState<LiveAgentSurfaceActivity[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string>();
    const [visible, setVisible] = useState(false);
    const startedAtRef = useRef<Record<string, number>>({});
    const hideTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const unsubscribe = subscribeAgentActivityStream((activity) => {
            if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
            const runId = activity.runid ?? "default";
            if (startedAtRef.current[runId] == null || activity.phase === "queued") {
                startedAtRef.current[runId] = activity.timestamp;
            }
            setActivities((current) => [...current, activity].slice(-HudStreamHistoryLimit));
            if (activity.previewimageurl != null && activity.previewimageurl !== "") {
                setPreviewUrl(activity.previewimageurl);
            }
            if (isAgentActivityActive(activity.phase)) {
                setVisible(true);
                return;
            }
            hideTimerRef.current = window.setTimeout(() => setVisible(false), HudStreamCompletionHoldMs);
        });
        return () => {
            unsubscribe();
            if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
        };
    }, []);

    const latest = activities.at(-1);
    if (!visible || !latest) return null;

    const active = isAgentActivityActive(latest.phase);
    const steps = activities
        .filter((activity) => activity.action !== "thinking" && activity.action !== "wait")
        .slice(-HudStreamVisibleSteps);
    const runId = latest.runid ?? "default";
    const elapsedSeconds = Math.max(
        1,
        Math.round((latest.timestamp - (startedAtRef.current[runId] ?? latest.timestamp)) / 1000)
    );

    return (
        <aside
            aria-label="Kronos activity stream"
            className="pointer-events-auto fixed z-[115] flex flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#080a0df2] p-2.5 text-white/90 shadow-2xl backdrop-blur-xl"
            style={{ left: hudGeometry.x, width: hudGeometry.width, bottom: window.innerHeight - hudGeometry.y + 8 }}
        >
            <header className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] text-white/45 uppercase">Kronos activity</span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] capitalize">
                    <i
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-white/40"}`}
                    />
                    {active ? "Live" : latest.phase}
                </span>
            </header>
            {previewUrl != null ? (
                <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/50">
                    <img
                        src={previewUrl}
                        alt={`${latest.appname ?? latest.surface} screenshot`}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            ) : (
                <ol className="grid gap-0.5">
                    {steps.map((activity, index) => (
                        <li
                            key={`${activity.id ?? activity.timestamp}-${index}`}
                            className={`grid min-h-7 grid-cols-[18px_minmax(0,1fr)] items-center gap-1.5 rounded-md px-1.5 text-[10px] ${
                                index === steps.length - 1 ? "bg-white/10 text-white" : "text-white/55"
                            }`}
                        >
                            <i
                                aria-hidden="true"
                                className={`fa-solid fa-${HudStreamSurfaceIcons[activity.surface]} opacity-60`}
                            />
                            <span className="truncate">
                                {activity.detail?.trim() || `${activity.action} ${activity.surface}`}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <p className="truncate px-0.5 text-[10px] text-white/60">
                {active
                    ? latest.detail?.trim() || `Working in your ${latest.surface}`
                    : `${latest.phase} in ${elapsedSeconds}s — ${latest.detail?.trim() || `the ${latest.surface} workflow finished`}`}
            </p>
            <footer className="flex items-center justify-end gap-1.5">
                {latest.blockid != null && (
                    <button
                        type="button"
                        className="cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-white/20"
                        onClick={() => focusOSSession(latest.blockid!)}
                    >
                        Inspect app
                    </button>
                )}
                <button
                    type="button"
                    className="cursor-pointer rounded-lg bg-accent/80 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-accent"
                    onClick={() =>
                        window.dispatchEvent(
                            new CustomEvent(ComputerUseControlEvent, {
                                detail: { action: "takeover", activity: latest },
                            })
                        )
                    }
                >
                    Take control
                </button>
            </footer>
        </aside>
    );
}
