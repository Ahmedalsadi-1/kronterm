export type AgentActivitySource = "acp" | "kronoscode-tui" | "wave" | "mcp" | "plugin" | "surface-runtime";

export type AgentActivityPhase =
    | "queued"
    | "awaiting-approval"
    | "running"
    | "verifying"
    | "succeeded"
    | "degraded"
    | "failed"
    | "cancelled"
    | "paused";

export type LegacyAgentActivityPhase = "start" | "update" | "finish" | "error";

export type AgentActivitySurface = "browser" | "sandbox" | "desktop" | "terminal" | "file" | "panel";

export type AgentActivityAction =
    | "open"
    | "focus"
    | "inspect"
    | "move"
    | "click"
    | "doubleClick"
    | "type"
    | "press"
    | "scroll"
    | "drag"
    | "screenshot"
    | "thinking"
    | "verify"
    | "wait";

export type AgentActivityRisk = "read" | "write" | "sensitive" | "dangerous";

export type AgentActivityPoint = { x: number; y: number };
export type AgentActivityTarget = AgentActivityPoint & { width: number; height: number };
export type AgentActivityCursorAction = "idle" | "click" | "type" | "scroll" | "hover" | null;

export type AgentActivityPresentationHints = {
    cursorAction?: AgentActivityCursorAction;
    overlayAction?: AgentActivityAction;
};

export type AgentActivityEvent = {
    id?: string;
    runid?: string;
    parentid?: string;
    sessionid?: string;
    source: AgentActivitySource;
    phase: AgentActivityPhase | LegacyAgentActivityPhase;
    blockid?: string;
    surface: AgentActivitySurface;
    action: AgentActivityAction;
    capabilityid?: string;
    connectorid?: string;
    detail?: string;
    thought?: string;
    reasoningSteps?: string[];
    risk?: AgentActivityRisk;
    point?: AgentActivityPoint;
    target?: AgentActivityTarget;
    path?: AgentActivityPoint[];
    previewimageurl?: string;
    petactivityurl?: string;
    appname?: string;
    presentationHints?: AgentActivityPresentationHints;
};

export type NormalizedAgentActivityEvent = Omit<AgentActivityEvent, "phase"> & {
    phase: AgentActivityPhase;
};

export type TimedAgentActivityEvent = NormalizedAgentActivityEvent & {
    timestamp: number;
};

export type LiveAgentSurfaceActivity = TimedAgentActivityEvent;

export const AgentSurfaceUiActivityEvent = "agent-surface-ui-activity";

export type AgentActivityContext = "idle" | "terminal" | "browser" | "desktop" | "file" | "thinking";

export function normalizeAgentActivityPhase(phase: AgentActivityEvent["phase"]): AgentActivityPhase {
    if (phase === "start" || phase === "update") {
        return "running";
    }
    if (phase === "finish") {
        return "succeeded";
    }
    if (phase === "error") {
        return "failed";
    }
    return phase;
}

export function normalizeAgentActivity(activity: AgentActivityEvent): NormalizedAgentActivityEvent {
    return {
        ...activity,
        phase: normalizeAgentActivityPhase(activity.phase),
    };
}

export function createAgentActivityTimeline(maxEntries = 120) {
    const entriesByRun = new Map<string, TimedAgentActivityEvent[]>();

    return {
        record(activity: AgentActivityEvent, timestamp = Date.now()): TimedAgentActivityEvent {
            const entry = { ...normalizeAgentActivity(activity), timestamp };
            const runid = entry.runid ?? "default";
            const entries = entriesByRun.get(runid) ?? [];
            entries.push(entry);
            if (entries.length > maxEntries) {
                entries.splice(0, entries.length - maxEntries);
            }
            entriesByRun.set(runid, entries);
            return entry;
        },
        get(runid = "default"): TimedAgentActivityEvent[] {
            return [...(entriesByRun.get(runid) ?? [])];
        },
        clear(runid?: string) {
            if (runid == null) {
                entriesByRun.clear();
                return;
            }
            entriesByRun.delete(runid);
        },
    };
}

export const agentActivityTimeline = createAgentActivityTimeline();

export function publishAgentActivity(activity: AgentActivityEvent): LiveAgentSurfaceActivity {
    const normalized = agentActivityTimeline.record(activity);
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent<LiveAgentSurfaceActivity>(AgentSurfaceUiActivityEvent, {
                detail: normalized,
            })
        );
    }
    return normalized;
}

export function subscribeAgentActivityStream(callback: (activity: LiveAgentSurfaceActivity) => void): () => void {
    if (typeof window === "undefined") {
        return () => {};
    }
    const handleActivity = (event: Event) => {
        callback((event as CustomEvent<LiveAgentSurfaceActivity>).detail);
    };
    window.addEventListener(AgentSurfaceUiActivityEvent, handleActivity);
    return () => window.removeEventListener(AgentSurfaceUiActivityEvent, handleActivity);
}

export function isAgentActivityActive(phase: AgentActivityEvent["phase"]): boolean {
    const normalized = normalizeAgentActivityPhase(phase);
    return (
        normalized === "queued" ||
        normalized === "awaiting-approval" ||
        normalized === "running" ||
        normalized === "verifying"
    );
}

export function inferAgentActivityAction(detail: string): AgentActivityAction {
    if (/screenshot|snapshot|capture/i.test(detail)) {
        return "screenshot";
    }
    if (/type|paste|keyboard|input|set_value|clipboard_set/i.test(detail)) {
        return "type";
    }
    if (/scroll/i.test(detail)) {
        return "scroll";
    }
    if (/double.?click/i.test(detail)) {
        return "doubleClick";
    }
    if (/click|mouse_press|long_press|toggle|select/i.test(detail)) {
        return "click";
    }
    if (/drag/i.test(detail)) {
        return "drag";
    }
    if (/hover|move|trace|cursor/i.test(detail)) {
        return "move";
    }
    if (/inspect/i.test(detail)) {
        return "inspect";
    }
    if (/verify/i.test(detail)) {
        return "verify";
    }
    if (/wait/i.test(detail)) {
        return "wait";
    }
    if (/open|navigate|browse|goto/i.test(detail)) {
        return "open";
    }
    return "focus";
}

export function inferAgentActivitySurface(detail: string, blockId?: string): AgentActivitySurface {
    if (/term|bash|shell|command/i.test(detail)) {
        return "terminal";
    }
    if (/file|read|write|edit|patch|directory|grep|glob|search/i.test(detail)) {
        return "file";
    }
    if (/sandbox/i.test(detail)) {
        return "sandbox";
    }
    if (/desktop|computer|mouse|keyboard|screen/i.test(detail)) {
        return "desktop";
    }
    if (/browser|widget|web|navigate|url/i.test(detail) || blockId) {
        return "browser";
    }
    return "panel";
}

export function contextForAgentActivity(
    activity: Pick<AgentActivityEvent, "surface" | "action">
): AgentActivityContext {
    if (activity.action === "thinking") {
        return "thinking";
    }
    if (activity.surface === "terminal" || activity.surface === "browser" || activity.surface === "file") {
        return activity.surface;
    }
    if (activity.surface === "sandbox" || activity.surface === "desktop") {
        return "desktop";
    }
    return "thinking";
}

export function cursorActionForAgentActivity(
    activity: Pick<AgentActivityEvent, "action" | "presentationHints">
): AgentActivityCursorAction {
    if (activity.presentationHints?.cursorAction != null) {
        return activity.presentationHints.cursorAction;
    }
    if (activity.action === "type" || activity.action === "press") {
        return "type";
    }
    if (activity.action === "scroll") {
        return "scroll";
    }
    if (activity.action === "click" || activity.action === "doubleClick") {
        return "click";
    }
    if (activity.action === "move" || activity.action === "drag") {
        return "hover";
    }
    return "idle";
}

export function pointFromAgentActivityInput(input?: Record<string, unknown>): AgentActivityPoint | undefined {
    const coordinates =
        input?.coordinates && typeof input.coordinates === "object"
            ? (input.coordinates as Record<string, unknown>)
            : undefined;
    const x =
        input?.x ??
        input?.originX ??
        input?.startX ??
        input?.fromX ??
        input?.from_x ??
        input?.endX ??
        input?.toX ??
        input?.to_x ??
        coordinates?.x;
    const y =
        input?.y ??
        input?.originY ??
        input?.startY ??
        input?.fromY ??
        input?.from_y ??
        input?.endY ??
        input?.toY ??
        input?.to_y ??
        coordinates?.y;
    return typeof x === "number" && typeof y === "number" ? { x, y } : undefined;
}
