import { CheckCircle2, CircleEllipsis, PauseCircle, ShieldAlert, TriangleAlert } from "lucide-react";
import type { ChatHubV2ActivityStatus } from "./chathubv2-activity";

const ToneClasses: Record<ChatHubV2ActivityStatus["kind"], string> = {
    queued: "border-border/70 bg-background/94 text-muted-foreground",
    running: "border-accent/35 bg-background/94 text-foreground",
    approval: "border-amber-400/45 bg-amber-950/90 text-amber-100",
    blocked: "border-orange-400/45 bg-orange-950/90 text-orange-100",
    failed: "border-destructive/45 bg-destructive/15 text-foreground",
    recovery: "border-sky-400/40 bg-sky-950/90 text-sky-100",
    completed: "border-border/70 bg-background/94 text-foreground",
    evidence: "border-emerald-400/40 bg-emerald-950/90 text-emerald-100",
};

function StatusIcon({ kind }: { kind: ChatHubV2ActivityStatus["kind"] }) {
    if (kind === "approval") {
        return <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (kind === "blocked" || kind === "failed") {
        return <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (kind === "recovery") {
        return <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (kind === "evidence" || kind === "completed") {
        return <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    return (
        <CircleEllipsis
            className={`h-4 w-4 shrink-0 ${kind === "running" ? "animate-pulse" : ""}`}
            aria-hidden="true"
        />
    );
}

export function ChatHubV2ActivityStatusBar({
    onOpenEvidence,
    status,
}: {
    onOpenEvidence: (blockId: string) => void;
    status: ChatHubV2ActivityStatus;
}) {
    const evidenceBlockId = status.kind === "evidence" ? status.activity.blockid : undefined;
    return (
        <div
            className={`pointer-events-auto flex max-w-[min(720px,calc(100%-24px))] items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-xl backdrop-blur-md ${ToneClasses[status.kind]}`}
            data-chathubv2-activity={status.kind}
            role={
                status.kind === "approval" || status.kind === "blocked" || status.kind === "failed" ? "alert" : "status"
            }
            aria-live={status.kind === "approval" || status.kind === "failed" ? "assertive" : "polite"}
        >
            <StatusIcon kind={status.kind} />
            <div className="min-w-0">
                <div className="font-semibold">{status.label}</div>
                <div className="mt-0.5 line-clamp-2 opacity-85">{status.detail}</div>
                {status.recovery && <div className="mt-1 font-medium opacity-95">{status.recovery}</div>}
            </div>
            {evidenceBlockId && (
                <button
                    type="button"
                    className="ml-1 shrink-0 cursor-pointer rounded border border-current/25 px-2 py-1 font-semibold transition-colors hover:bg-white/10"
                    onClick={() => onOpenEvidence(evidenceBlockId)}
                >
                    Open evidence
                </button>
            )}
        </div>
    );
}
