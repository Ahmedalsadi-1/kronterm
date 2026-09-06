import { cn } from "@/util/util";
import { memo, useEffect, useRef, useState } from "react";
import {
    isAgentActivityActive,
    subscribeAgentActivityStream,
    type AgentActivityPhase,
    type LiveAgentSurfaceActivity,
} from "../../types/agent-activity";
import { WaveAIModel } from "./waveai-model";

const TerminalPhaseDisplayMs = 2400;

const phaseStyles: Record<AgentActivityPhase, { label: string; dot: string }> = {
    queued: { label: "Queued", dot: "bg-sky-400" },
    "awaiting-approval": { label: "Review needed", dot: "bg-amber-400" },
    running: { label: "Running", dot: "bg-sky-400" },
    verifying: { label: "Verifying", dot: "bg-violet-400" },
    succeeded: { label: "Complete", dot: "bg-emerald-400" },
    degraded: { label: "Degraded", dot: "bg-amber-400" },
    failed: { label: "Failed", dot: "bg-red-400" },
    cancelled: { label: "Cancelled", dot: "bg-red-400" },
    paused: { label: "Paused", dot: "bg-amber-400" },
};

export const AgentRunStrip = memo(({ onInspect }: { onInspect: () => void }) => {
    const [activity, setActivity] = useState<LiveAgentSurfaceActivity | null>(null);
    const clearTimer = useRef<number>(null);

    useEffect(() => {
        const unsubscribe = subscribeAgentActivityStream((nextActivity) => {
            setActivity(nextActivity);
            if (clearTimer.current != null) {
                window.clearTimeout(clearTimer.current);
                clearTimer.current = null;
            }
            if (!isAgentActivityActive(nextActivity.phase)) {
                clearTimer.current = window.setTimeout(() => setActivity(null), TerminalPhaseDisplayMs);
            }
        });
        return () => {
            unsubscribe();
            if (clearTimer.current != null) {
                window.clearTimeout(clearTimer.current);
            }
        };
    }, []);

    if (!activity) {
        return null;
    }

    const phase = phaseStyles[activity.phase];
    const inspect = () => {
        onInspect();
        window.setTimeout(() => WaveAIModel.getInstance().focusInput(), 50);
    };
    return (
        <div
            className="fixed bottom-3 left-1/2 z-[80] flex max-w-[min(620px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#11151ddd] px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur-xl"
            data-agent-run-strip="true"
        >
            <span
                className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    phase.dot,
                    isAgentActivityActive(activity.phase) && "animate-pulse"
                )}
            />
            <span className="font-semibold text-white/90">{phase.label}</span>
            <span className="text-white/35">/</span>
            <span className="capitalize text-white/60">{activity.surface}</span>
            <span className="min-w-0 truncate text-white/85">{activity.detail ?? activity.action}</span>
            <button
                type="button"
                onClick={inspect}
                className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-semibold text-white/90 hover:bg-white/20"
            >
                {activity.phase === "awaiting-approval" ? "Review" : "Inspect"}
            </button>
        </div>
    );
});
AgentRunStrip.displayName = "AgentRunStrip";
