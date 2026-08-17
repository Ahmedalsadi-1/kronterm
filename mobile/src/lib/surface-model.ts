import type {
    BrowserRuntimeState,
    HostProfile,
    KronosSession,
    PhoneControlStatus,
    SandboxRecord,
    SessionStatusEnvelope,
    Surface,
    SurfaceAttention,
    SurfaceStatus,
} from "../types";

const sessionTimestamp = (session: KronosSession): number => session.time?.updated ?? session.time?.created ?? 0;

const runPresentation = (
    status: SessionStatusEnvelope | undefined
): { status: SurfaceStatus; attention: SurfaceAttention; subtitle: string } => {
    if (!status || status.type === "idle") {
        return { status: "live", attention: "none", subtitle: "KronosCode session" };
    }
    if (status.runHealth?.status === "error") {
        return {
            status: "failed",
            attention: "failed",
            subtitle: status.runHealth.suggested_next_action || status.message || "Run needs attention",
        };
    }
    if (status.type === "retry") {
        return {
            status: "waiting",
            attention: "blocked",
            subtitle: status.message || `Retry ${status.attempt ?? ""}`.trim(),
        };
    }
    return {
        status: "working",
        attention: "progress",
        subtitle: status.activeTool ? `Using ${status.activeTool}` : status.message || "Kronos is working",
    };
};

const sandboxStatus = (sandbox: SandboxRecord): SurfaceStatus => {
    const state = `${sandbox.sessionState ?? ""} ${sandbox.status ?? ""}`.toLowerCase();
    if (/error|failed/.test(state)) {
        return "failed";
    }
    if (/stopped|expired|destroyed/.test(state)) {
        return "suspended";
    }
    if (/pending|start|provision|boot/.test(state)) {
        return "working";
    }
    return "live";
};

const makeBrowserSurfaces = (host: HostProfile, states: BrowserRuntimeState[]): Surface[] =>
    states.flatMap((state) =>
        state.pages.map((page) => ({
            id: `${host.id}:browser:${state.sessionID}:${page.id}`,
            kind: "browser" as const,
            hostId: host.id,
            hostLabel: host.label,
            hostColor: host.color,
            title: page.title || "Untitled page",
            subtitle: page.isLoading ? "Loading…" : page.url,
            status: page.lastError ? ("failed" as const) : page.isLoading ? ("working" as const) : ("live" as const),
            attention: page.lastError
                ? ("failed" as const)
                : page.isLoading
                  ? ("progress" as const)
                  : ("none" as const),
            updatedAt: page.createdAt || Date.now(),
            sessionId: state.sessionID,
            pageId: page.id,
            pageIndex: page.index,
            url: page.url,
            canGoBack: page.canGoBack,
            canGoForward: page.canGoForward,
            capabilities: ["focus", "navigate", "back", "forward", "reload", "takeover", "close"],
        }))
    );

const makeSandboxSurfaces = (host: HostProfile, sandboxes: SandboxRecord[]): Surface[] =>
    sandboxes.flatMap((sandbox) => {
        const status = sandboxStatus(sandbox);
        const attention: SurfaceAttention = status === "failed" ? "failed" : status === "working" ? "progress" : "none";
        const updatedAt = sandbox.createdAt ?? sandbox.timeCreated ?? Date.now();
        const base: Surface = {
            id: `${host.id}:app:${sandbox.id}`,
            kind: "app",
            hostId: host.id,
            hostLabel: host.label,
            hostColor: host.color,
            title: "Kron Sandbox",
            subtitle: sandbox.lastError || sandbox.resolution || "Isolated computer",
            status,
            attention,
            updatedAt,
            sandboxId: sandbox.id,
            streamUrl: sandbox.streamUrl || sandbox.connectionUrl,
            terminalUrl: sandbox.terminalUrl,
            capabilities: ["focus", "inspect", "takeover", "screenshot", "stop"],
        };
        if (!sandbox.terminalUrl) {
            return [base];
        }
        return [
            base,
            {
                ...base,
                id: `${host.id}:terminal:${sandbox.id}`,
                kind: "terminal" as const,
                title: "Sandbox shell",
                subtitle: "Persistent terminal",
                capabilities: ["focus", "input", "signal", "stop"],
            },
        ];
    });

const makeRunSurfaces = (
    host: HostProfile,
    sessions: KronosSession[],
    statuses: Record<string, SessionStatusEnvelope>
): Surface[] =>
    sessions.map((session) => {
        const presentation = runPresentation(statuses[session.id]);
        return {
            id: `${host.id}:run:${session.id}`,
            kind: "run" as const,
            hostId: host.id,
            hostLabel: host.label,
            hostColor: host.color,
            title: session.title?.trim() || "Untitled Kronos run",
            subtitle: presentation.subtitle,
            status: presentation.status,
            attention: presentation.attention,
            updatedAt: sessionTimestamp(session),
            sessionId: session.id,
            capabilities: ["focus", "steer", "stop", "branch"],
        };
    });

const makePhoneSurfaces = (host: HostProfile, phoneControl?: PhoneControlStatus): Surface[] => {
    if (!phoneControl?.available) {
        return [];
    }
    return [
        {
            id: `${host.id}:app:phoneagent`,
            kind: "app",
            hostId: host.id,
            hostLabel: host.label,
            hostColor: host.color,
            title: "This iPhone",
            subtitle: `${phoneControl.provider} · approval-gated control`,
            status: "live",
            attention: "none",
            updatedAt: Date.now(),
            phoneControl: true,
            phoneProvider: phoneControl.provider,
            capabilities: ["focus", "inspect", "takeover", "screenshot", "input", "swipe"],
        },
    ];
};

const AttentionRank: Record<SurfaceAttention, number> = {
    approval: 0,
    failed: 1,
    blocked: 2,
    progress: 3,
    complete: 4,
    none: 5,
};

export const buildSurfaces = (
    host: HostProfile,
    sessions: KronosSession[],
    statuses: Record<string, SessionStatusEnvelope>,
    browserStates: BrowserRuntimeState[],
    sandboxes: SandboxRecord[],
    phoneControl?: PhoneControlStatus
): Surface[] =>
    [
        ...makeBrowserSurfaces(host, browserStates),
        ...makePhoneSurfaces(host, phoneControl),
        ...makeSandboxSurfaces(host, sandboxes),
        ...makeRunSurfaces(host, sessions, statuses),
    ].sort(
        (left, right) =>
            AttentionRank[left.attention] - AttentionRank[right.attention] || right.updatedAt - left.updatedAt
    );

export const surfaceMatchesQuery = (surface: Surface, query: string): boolean => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return true;
    }
    return [surface.title, surface.subtitle, surface.hostLabel, surface.kind, surface.url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
};

export const findPreferredSurface = (
    surfaces: Surface[],
    kind: Surface["kind"],
    preferredHostId?: string
): Surface | undefined =>
    surfaces.find((surface) => surface.kind === kind && surface.hostId === preferredHostId) ??
    surfaces.find((surface) => surface.kind === kind);

export const makePreviewDataUrl = (mime: string | undefined, base64: string): string =>
    base64.startsWith("data:") ? base64 : `data:${mime || "image/png"};base64,${base64}`;

export const hostCapabilitiesForKind = (kind: HostProfile["kind"]): string[] => {
    if (kind === "managed") {
        return ["kronoscode", "browser", "sandbox", "terminal", "files", "apps"];
    }
    if (kind === "sandbox") {
        return ["kronoscode", "browser", "sandbox", "terminal", "files"];
    }
    return ["kronoscode", "browser", "terminal", "files", "apps"];
};
