import { isAgentActivityActive, subscribeAgentActivityStream, type LiveAgentSurfaceActivity } from "../../types/agent-activity";
import { useEffect, useMemo, useState } from "react";

export const ComputerUseControlEvent = "kronterm:computer-use-control";

function emitControl(action: "focus" | "takeover" | "stop" | "retry" | "inspect", activity?: LiveAgentSurfaceActivity) {
    window.dispatchEvent(new CustomEvent(ComputerUseControlEvent, { detail: { action, activity } }));
}

export function ComputerUseStatusCard() {
    const [activities, setActivities] = useState<Record<string, LiveAgentSurfaceActivity>>({});
    const [selectedSurface, setSelectedSurface] = useState("");

    useEffect(
        () =>
            subscribeAgentActivityStream((activity) => {
                if (activity.surface !== "desktop" && activity.surface !== "sandbox" && activity.surface !== "browser") {
                    return;
                }
                const key = activity.surfaceid ?? activity.blockid ?? `${activity.surface}:${activity.appname ?? "default"}`;
                setActivities((current) => ({ ...current, [key]: activity }));
                setSelectedSurface((current) => current || key);
            }),
        []
    );

    const entries = useMemo(() => Object.entries(activities).sort((a, b) => b[1].timestamp - a[1].timestamp), [activities]);
    const selected = activities[selectedSurface] ?? entries[0]?.[1];
    const active = selected ? isAgentActivityActive(selected.phase) : false;

    return (
        <section className="overflow-hidden rounded-xl border border-[#1E90FF]/25 bg-card/80 shadow-sm">
            <header className="flex items-center justify-between border-b border-[#1E90FF]/15 px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Computer Use</h3>
                    <p className="text-xs text-muted-foreground">Verified KronTerm, Bytebot, and Open Computer Use activity</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E90FF]/25 bg-[#1E90FF]/10 px-2 py-1 text-[11px] text-[#1E90FF]">
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-[#1E90FF]" : "bg-muted-foreground/50"}`} />
                    {active ? "In control" : selected ? selected.phase : "Ready"}
                </span>
            </header>
            {entries.length > 1 && (
                <div className="flex gap-1 overflow-x-auto border-b border-border/50 p-2">
                    {entries.map(([key, activity]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedSurface(key)}
                            className={`cursor-pointer rounded-md px-2 py-1 text-xs ${key === selectedSurface ? "bg-[#1E90FF]/15 text-[#1E90FF]" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            {activity.appname ?? activity.surface}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-black/90">
                    {selected?.previewimageurl ? (
                        <img src={selected.previewimageurl} alt={`${selected.appname ?? selected.surface} live preview`} className="max-h-64 w-full object-contain" />
                    ) : (
                        <div className="text-center text-xs text-zinc-500">
                            <i className="fa-solid fa-display mb-2 block text-xl text-[#1E90FF]/70" />
                            A verified frame appears when computer use begins.
                        </div>
                    )}
                    {active && <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-[#1E90FF]/70" />}
                </div>
                <div className="space-y-3 text-xs">
                    <dl className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Surface</dt><dd>{selected?.appname ?? selected?.surface ?? "None"}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Action</dt><dd>{selected?.action ?? "Idle"}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Evidence</dt><dd className={selected?.verificationstatus === "failed" ? "text-red-400" : "text-[#1E90FF]"}>{selected?.verificationstatus ?? "Waiting"}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Frame</dt><dd>{selected?.previewimageurl ? "Current" : "Unavailable"}</dd></div>
                    </dl>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(["focus", "takeover", "stop", "retry", "inspect"] as const).map((action) => (
                            <button key={action} type="button" onClick={() => emitControl(action, selected)} className="cursor-pointer rounded-md border border-border/70 bg-background px-2 py-1.5 capitalize hover:border-[#1E90FF]/50 hover:text-[#1E90FF]">
                                {action}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
