export type HostKind = "managed" | "sandbox" | "computer";
export type HostConnectionState = "idle" | "connecting" | "online" | "degraded" | "offline";
export type SurfaceKind = "browser" | "terminal" | "file" | "app" | "run" | "preview";
export type SurfaceStatus = "live" | "working" | "waiting" | "suspended" | "failed" | "closed";
export type SurfaceAttention = "none" | "progress" | "approval" | "blocked" | "failed" | "complete";
export type SurfaceControlMode = "watch" | "takeover";

export interface HostProfile {
    id: string;
    label: string;
    baseUrl: string;
    kind: HostKind;
    color: string;
    capabilities: string[];
    uiBaseUrl?: string;
    token?: string;
    createdAt: number;
    lastConnectedAt?: number;
}

export interface HostRuntimeState {
    profile: HostProfile;
    connection: HostConnectionState;
    detail?: string;
    version?: string;
    lastCheckedAt?: number;
}

export interface KronosSession {
    id: string;
    title?: string;
    directory?: string;
    parentID?: string;
    time?: {
        created?: number;
        updated?: number;
    };
    [key: string]: unknown;
}

export interface KronosMessageInfo {
    id: string;
    role: "user" | "assistant" | "system" | string;
    agent?: string;
    modelID?: string;
    providerID?: string;
    time?: {
        created?: number;
        completed?: number;
    };
    [key: string]: unknown;
}

export interface ToolPartState {
    status?: "pending" | "running" | "completed" | "success" | "failed" | "error" | string;
    input?: unknown;
    output?: unknown;
    error?: string;
    [key: string]: unknown;
}

export interface KronosMessagePart {
    id?: string;
    type: "text" | "reasoning" | "tool" | "tool-call" | "tool-result" | "image" | "file" | string;
    text?: string;
    content?: string;
    value?: string;
    tool?: string;
    name?: string;
    input?: unknown;
    output?: unknown;
    state?: ToolPartState;
    url?: string;
    mime?: string;
    filename?: string;
    synthetic?: boolean;
    [key: string]: unknown;
}

export interface KronosMessage {
    info: KronosMessageInfo;
    parts: KronosMessagePart[];
}

export interface SessionStatusEnvelope {
    type: "idle" | "busy" | "retry" | string;
    attempt?: number;
    message?: string;
    activeTool?: string;
    workType?: string;
    runtimeTarget?: string;
    runHealth?: {
        status?: string;
        confidence?: number;
        recoverable?: boolean;
        suggested_next_action?: string;
    };
}

export interface BrowserRuntimePage {
    id: string;
    index: number;
    title: string;
    url: string;
    active: boolean;
    createdAt: number;
    canGoBack?: boolean;
    canGoForward?: boolean;
    isLoading?: boolean;
    lastError?: string;
}

export interface BrowserRuntimeState {
    enabled: boolean;
    sessionID: string;
    provider: string;
    backend: string;
    capabilities: {
        tabs: boolean;
        history: boolean;
        selection: boolean;
        highFidelityScreenshot: boolean;
        downloads: boolean;
    };
    pages: BrowserRuntimePage[];
    activePageID: string | null;
    windowLabel?: string;
    error?: string;
    lastError?: string;
}

export interface BrowserFrame {
    mime: string;
    base64: string;
    title?: string;
    pageID?: string;
}

export interface SandboxRecord {
    id: string;
    provider?: string;
    status: string;
    sessionState?: string;
    connectionUrl?: string;
    streamUrl?: string;
    terminalUrl?: string;
    resolution?: string;
    createdAt?: number;
    timeCreated?: number;
    destroyedAt?: number;
    lastError?: string;
    [key: string]: unknown;
}

export interface PhoneControlLease {
    active: boolean;
    id?: string;
    actor?: string;
    expiresAt?: number;
}

export interface PhoneControlStatus {
    available: boolean;
    provider: string;
    endpoint?: string;
    capabilities?: string[];
    lease?: PhoneControlLease;
    foundations?: {
        execution?: string;
        verification?: string;
        policy?: string;
    };
}

export interface PhoneContext {
    screenshot_base64?: string;
    tree?: string;
    metadata?: {
        width?: number;
        height?: number;
    };
}

export interface PhoneActionResult {
    result?: Record<string, unknown>;
    verification?: PhoneContext;
    policy?: {
        allowed?: boolean;
        approvalLease?: PhoneControlLease;
        risk?: string;
        riskScore?: number;
    };
}

export interface PhoneAuditEvent {
    id: string;
    timestamp: string;
    method: string;
    actor: string;
    risk: string;
    riskScore: number;
    outcome: string;
}

export interface Surface {
    id: string;
    kind: SurfaceKind;
    hostId: string;
    hostLabel: string;
    hostColor: string;
    title: string;
    subtitle: string;
    status: SurfaceStatus;
    attention: SurfaceAttention;
    updatedAt: number;
    sessionId?: string;
    pageId?: string;
    pageIndex?: number;
    sandboxId?: string;
    url?: string;
    previewUrl?: string;
    streamUrl?: string;
    terminalUrl?: string;
    terminalSessionId?: string;
    initialCommand?: string;
    phoneControl?: boolean;
    phoneProvider?: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
    capabilities: string[];
}

export interface TerminalStreamEvent {
    type: "connected" | "data" | "exit" | "error";
    data?: string;
    message?: string;
    exitCode?: number;
    signal?: number;
}

export interface ClosedSurface {
    surface: Surface;
    closedAt: number;
}

export interface HostSnapshot {
    host: HostRuntimeState;
    sessions: KronosSession[];
    statuses: Record<string, SessionStatusEnvelope>;
    browserStates: BrowserRuntimeState[];
    sandboxes: SandboxRecord[];
    phoneControl?: PhoneControlStatus;
    surfaces: Surface[];
}

export interface GatewayEvent {
    type: string;
    session_id?: string;
    directory: string;
    payload?: unknown;
    seq: number;
    server_instance_id: string;
}

export interface PairingResult {
    token: string;
    hostName: string;
    capabilities?: string[];
}

export interface MobileUiSession {
    url: string;
    expiresAt?: number;
}

export interface BrowserSnapshotItem {
    uid: string;
    role: string;
    name: string;
    value?: string;
    href?: string;
}

export interface BrowserSnapshot {
    items: BrowserSnapshotItem[];
    text: string;
}

export interface ToastMessage {
    id: string;
    tone: "neutral" | "success" | "error";
    title: string;
    detail?: string;
}
