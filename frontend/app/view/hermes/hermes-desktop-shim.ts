// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").
// This shim implements `window.hermesDesktop` inside the KronTerm renderer so the
// vendored Hermes UI (frontend/hermes) can run as a widget without the Electron
// main-process bridge it was built against. REST calls are forwarded to the gateway
// (default http://127.0.0.1:9119) over fetch; the gateway CORS policy allows
// localhost origins. WS uses the token query param. Everything else is an honest
// "not supported" stub so the renderer never mistakes the shim for the real bridge.

import {
    focusAgentWidget,
    listAgentWidgets,
    previewAgentWidget,
    setAgentWidgetInspectMode,
    snapshotAgentWidget,
    subscribeAgentWidgetDesignSelection,
} from "@/app/view/agent-widget-bridge";
import { hermesSurfaceController } from "@/app/view/hermes/hermes-surface-controller";
import type {
    DesktopActiveProfile,
    DesktopAgentRoster,
    DesktopCloudAgentSignInResult,
    DesktopCloudDiscoverResult,
    DesktopCloudStatus,
    DesktopConnectionConfig,
    DesktopConnectionConfigInput,
    DesktopConnectionProbeResult,
    DesktopConnectionTestResult,
    DesktopConnectionsRegistry,
    DesktopOauthLoginResult,
    DesktopOauthLogoutResult,
    DesktopRegistryConnection,
    DesktopRegistryConnectionInput,
    DesktopSshHostsResult,
    HermesApiRequest,
    HermesConnection,
    HermesKronTermSurface,
    HermesNotification,
    HermesPreviewWatch,
    HermesReadDirResult,
    HermesTerminalExit,
    HermesTerminalSession,
    HermesWindowState,
} from "@hermes/global";
import type { WakeIndicatorState } from "@hermes/lib/wake-indicator";
import type { GatewayWsUrlResult } from "@hermes/shared";
import type { PetOverlayBounds, PetOverlayControl, PetOverlayStatePayload } from "@hermes/store/pet-overlay";
import type { QuickEntryStatePush, QuickEntrySubmitPayload } from "@hermes/store/quick-entry";

const DEFAULT_BASE_URL = "http://127.0.0.1:9119";
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

const STORAGE_BASE_URL = "kronterm.hermes.shim.baseUrl";
const LEGACY_STORAGE_TOKEN = "kronterm.hermes.shim.token";
const ShimStateKey = Symbol.for("kronterm.hermes.desktopShimState");

export interface HermesDesktopShimConfig {
    baseUrl?: string;
    token?: string;
}

interface HermesDesktopShimConfigState {
    baseUrl: string;
    token: string;
}

function readStoredShimConfig(): HermesDesktopShimConfigState {
    const state: HermesDesktopShimConfigState = { baseUrl: DEFAULT_BASE_URL, token: "" };

    try {
        const baseUrl = window.localStorage.getItem(STORAGE_BASE_URL);

        if (baseUrl) {
            state.baseUrl = baseUrl;
        }
    } catch {
        // localStorage unavailable (e.g. privacy mode) — keep defaults
    }

    return state;
}

const shimStateHost = globalThis as typeof globalThis & { [ShimStateKey]?: HermesDesktopShimConfigState };
const shimState = (shimStateHost[ShimStateKey] ??= readStoredShimConfig());

function requireSessionToken(): string {
    if (!shimState.token) {
        throw new Error("Kronos connection is not ready. Reopen the widget or retry the connection.");
    }
    return shimState.token;
}

/** Point the shim at a gateway (idempotent). Returns the applied config. */
export function configureHermesDesktopShim(config?: HermesDesktopShimConfig): HermesDesktopShimConfigState {
    if (config) {
        if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
            shimState.baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
        }

        if (typeof config.token === "string") {
            shimState.token = config.token.trim();
        }
    }

    try {
        window.localStorage.setItem(STORAGE_BASE_URL, shimState.baseUrl);
        window.localStorage.removeItem(LEGACY_STORAGE_TOKEN);
    } catch {
        // localStorage unavailable — in-memory config is enough for this session
    }

    return { baseUrl: shimState.baseUrl, token: shimState.token };
}

export function buildGatewayWsUrl(baseUrl: string, token: string, profile?: null | string): string {
    const parsed = new URL(baseUrl);
    const wsScheme = parsed.protocol === "https:" ? "wss" : "ws";
    const prefix = parsed.pathname.replace(/\/+$/, "");
    const query = new URLSearchParams({ token });
    if (profile?.trim()) {
        query.set("profile", profile.trim());
    }
    return `${wsScheme}://${parsed.host}${prefix}/api/ws?${query.toString()}`;
}

export function buildProfileScopedApiUrl(baseUrl: string, requestPath: string, profile?: null | string): string {
    const url = new URL(requestPath.startsWith("/") ? requestPath : `/${requestPath}`, `${baseUrl}/`);
    if (profile?.trim()) {
        url.searchParams.set("profile", profile.trim());
    }
    return url.toString();
}

function resolveTimeoutMs(timeoutMs: number | undefined): number {
    if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        return timeoutMs;
    }

    return DEFAULT_FETCH_TIMEOUT_MS;
}

/** Mirror of the Electron main process fetchJson contract. */
async function apiFetch<T>(request: HermesApiRequest): Promise<T> {
    const token = requireSessionToken();
    const url = buildProfileScopedApiUrl(shimState.baseUrl, request.path, request.profile);
    const timeoutMs = resolveTimeoutMs(request.timeoutMs);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);

    try {
        const isUpload = Boolean(request.upload);
        let body: BodyInit | undefined;
        let contentType: string | undefined;

        if (isUpload && request.upload) {
            const form = new FormData();
            const filename = String(request.upload.filename || "file").replace(/["\r\n]/g, "_");

            form.append(
                "file",
                new Blob([request.upload.bytes], { type: request.upload.contentType || "application/octet-stream" }),
                filename
            );
            body = form;
            // Browser fetch sets the multipart boundary itself — never set
            // Content-Type manually for FormData or the boundary breaks.
        } else {
            contentType = "application/json";
            body = request.body === undefined ? undefined : JSON.stringify(request.body);
        }

        const headers: Record<string, string> = { "X-Hermes-Session-Token": token };

        if (contentType) {
            headers["Content-Type"] = contentType;
        }

        const res = await fetch(url, {
            method: request.method || "GET",
            headers,
            body,
            signal: controller.signal,
        });

        const text = await res.text();

        if (res.status >= 400) {
            throw new Error(`${res.status}: ${text || res.statusText}`);
        }

        if (!text) {
            return null as T;
        }

        const looksHtml = /^\s*<(?:!doctype|html)/i.test(text);
        const contentTypeHeader = String(res.headers.get("content-type") || "");

        if (looksHtml || contentTypeHeader.includes("text/html")) {
            throw new Error(
                `Expected JSON from ${url} but got HTML (status ${res.status}). ` +
                    "The endpoint is likely missing on the Kronos backend."
            );
        }

        try {
            return JSON.parse(text) as T;
        } catch {
            throw new Error(`Invalid JSON from ${url} (status ${res.status}): ${text.slice(0, 200)}`);
        }
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`Timed out connecting to Kronos after ${timeoutMs}ms`);
        }

        throw error;
    } finally {
        window.clearTimeout(timer);
    }
}

async function getConnection(profile?: null | string): Promise<HermesConnection> {
    const token = requireSessionToken();
    const isNamedProfile = typeof profile === "string" && profile.trim() !== "" && profile.trim() !== "default";
    const wsUrl = buildGatewayWsUrl(shimState.baseUrl, token, profile);

    return {
        baseUrl: shimState.baseUrl,
        isFullscreen: false,
        mode: "local",
        authMode: "token",
        source: "local",
        token,
        wsUrl,
        logs: [],
        nativeOverlayWidth: 0,
        windowButtonPosition: null,
        ...(isNamedProfile ? { profile: profile.trim(), sharedPrimary: true } : {}),
    };
}

async function getConnectionFor(payload: {
    connectionId?: null | string;
    profile?: null | string;
}): Promise<HermesConnection> {
    const connectionId = payload.connectionId ?? "";

    if (!connectionId || connectionId === "local") {
        return getConnection(payload.profile);
    }

    throw new Error(`No connection with id "${connectionId}"`);
}

async function getGatewayWsUrl(profile?: null | string): Promise<GatewayWsUrlResult> {
    const token = requireSessionToken();

    return { ok: true, wsUrl: buildGatewayWsUrl(shimState.baseUrl, token, profile) };
}

async function getGatewayWsUrlFor(payload: {
    connectionId?: null | string;
    profile?: null | string;
}): Promise<GatewayWsUrlResult> {
    const connectionId = payload.connectionId ?? "";

    if (!connectionId || connectionId === "local") {
        return getGatewayWsUrl(payload.profile);
    }

    return { ok: false, error: `No connection with id "${connectionId}"` };
}

async function getAgentRoster(): Promise<DesktopAgentRoster> {
    return { agents: [], sources: [] };
}

const EMPTY_REGISTRY: DesktopConnectionsRegistry = {
    version: 1,
    primary: "local",
    secureTokenStorage: true,
    connections: [],
};

function deriveRegistryConnection(input: DesktopRegistryConnectionInput): DesktopRegistryConnection {
    return {
        id: input.id || "local",
        kind: input.kind,
        label: input.label,
        url: input.url,
        authMode: input.authMode ?? "token",
        org: input.org,
        host: input.host,
        user: input.user,
        port: input.port ?? undefined,
        keyPath: input.keyPath,
        remoteHermesPath: input.remoteHermesPath,
        remoteProfile: input.remoteProfile,
        tokenSet: Boolean(input.token),
        tokenPreview: input.token ? input.token.slice(0, 4) : null,
    };
}

function localConnectionConfig(profile?: null | string): DesktopConnectionConfig {
    return {
        envOverride: false,
        mode: "local",
        profile: profile ?? null,
        remoteAuthMode: "token",
        remoteOauthConnected: false,
        remoteTokenPreview: null,
        remoteTokenSet: false,
        secureTokenStorage: true,
        remoteTokenPlainText: false,
        remoteUrl: "",
        cloudOrg: "",
        sshHost: "",
        sshUser: "",
        sshPort: null,
        sshKeyPath: "",
        sshRemoteHermesPath: "",
        sshRemoteProfile: "",
    };
}

async function listKronTermSurfaces(): Promise<HermesKronTermSurface[]> {
    return listAgentWidgets();
}

async function focusKronTermSurface(blockId: string): Promise<{ ok: boolean; error?: string }> {
    return focusAgentWidget(blockId);
}

const shim: Window["hermesDesktop"] = {
    getConnection,
    getConnectionFor,
    getGatewayWsUrl,
    getGatewayWsUrlFor,
    getAgentRoster,
    krontermSurfaces: {
        list: listKronTermSurfaces,
        focus: focusKronTermSurface,
        preview: previewAgentWidget,
        snapshot: snapshotAgentWidget,
        inspect: async (blockId, enabled) => setAgentWidgetInspectMode(blockId, enabled),
        onSelection: subscribeAgentWidgetDesignSelection,
    },
    revalidateConnection: async () => ({ ok: true, rebuilt: false }),
    touchBackend: async () => ({ ok: true }),
    claimAmbientCue: async () => true,
    openSessionWindow: async () => ({ ok: false, error: "not-supported" }),
    openSessionInTerminal: async () => ({ ok: false, error: "not-supported" }),
    openWindow: async () => ({ ok: false, error: "not-supported" }),

    hud: {
        open: async (request) => {
            hermesSurfaceController.requestOpenHud(request?.sessionId);
            return { ok: true };
        },
        close: async () => {
            try {
                await hermesSurfaceController.expandToWidget();
                return { ok: true };
            } catch {
                return { ok: false };
            }
        },
        dock: async () => {
            hermesSurfaceController.requestOpenPanel();
            return { ok: true };
        },
        expand: async () => {
            try {
                await hermesSurfaceController.expandToWidget();
                return { ok: true };
            } catch {
                return { ok: false };
            }
        },
        dismiss: async () => {
            hermesSurfaceController.dismiss();
            return { ok: true };
        },
        setIgnoreMouse: (_ignore: boolean) => undefined,
        moveBy: (delta) => hermesSurfaceController.moveBy(delta),
        setBounds: (bounds) => hermesSurfaceController.setGeometry(bounds),
        setVibrancy: async (_on: boolean) => ({ ok: true }),
        setSession: (sessionId) => hermesSurfaceController.setSession(sessionId),
        onGoto: (_callback) => () => undefined,
        onChanged: (callback) => {
            const publish = () => {
                const state = hermesSurfaceController.getSnapshot();
                callback({
                    open: state.presentation === "hud",
                    sessionId: state.sessionId,
                });
            };
            publish();
            return hermesSurfaceController.subscribe(publish);
        },
        onCursor: (_callback) => () => undefined,
    },

    wakeIndicator: {
        getState: async () => "hidden" as WakeIndicatorState,
        setState: () => undefined,
        onState: () => () => undefined,
    },

    petOverlay: {
        open: async () => ({ ok: false }),
        close: async () => ({ ok: true }),
        setBounds: (_bounds: PetOverlayBounds) => undefined,
        setIgnoreMouse: (_ignore: boolean) => undefined,
        setFocusable: (_focusable: boolean) => undefined,
        pushState: (_payload: PetOverlayStatePayload) => undefined,
        control: (_payload: PetOverlayControl) => undefined,
        onState: () => () => undefined,
        onControl: () => () => undefined,
    },

    quickEntry: {
        getSettings: async () => ({
            enabled: false,
            error: null,
            registered: false,
            shortcut: "CommandOrControl+Shift+Space",
        }),
        setSettings: async () => ({
            enabled: false,
            error: null,
            registered: false,
            shortcut: "CommandOrControl+Shift+Space",
        }),
        submit: (_payload: QuickEntrySubmitPayload) => undefined,
        dismiss: () => undefined,
        pushState: (_payload: QuickEntryStatePush) => undefined,
        onState: () => () => undefined,
        onSubmit: () => () => undefined,
        onShown: () => () => undefined,
    },

    getBootProgress: async () => ({
        error: null,
        fakeMode: false,
        message: "",
        phase: "complete",
        progress: 100,
        running: false,
        timestamp: Date.now(),
    }),

    getConnectionConfig: (profile?: null | string) => Promise.resolve(localConnectionConfig(profile)),
    saveConnectionConfig: (payload: DesktopConnectionConfigInput) =>
        Promise.resolve(localConnectionConfig(payload.profile ?? null)),
    applyConnectionConfig: (payload: DesktopConnectionConfigInput) =>
        Promise.resolve(localConnectionConfig(payload.profile ?? null)),
    testConnectionConfig: async (payload: DesktopConnectionConfigInput) =>
        payload.mode === "local"
            ? { ok: true, reachable: true, version: null, baseUrl: shimState.baseUrl }
            : { ok: false, reachable: false, version: null, error: "not-supported", baseUrl: payload.remoteUrl },

    connections: {
        list: async () => ({ ...EMPTY_REGISTRY }),
        save: async (payload: DesktopRegistryConnectionInput) => ({
            ok: false,
            connection: deriveRegistryConnection(payload),
            registry: { ...EMPTY_REGISTRY },
        }),
        remove: async (id: string) => ({ ok: false, registry: { ...EMPTY_REGISTRY }, ...(id === "local" ? {} : {}) }),
        setPrimary: async (id: string) => ({ ok: id === "local", registry: { ...EMPTY_REGISTRY } }),
        test: async (id: string): Promise<DesktopConnectionTestResult> =>
            id === "local"
                ? { ok: true, reachable: true, version: null, baseUrl: shimState.baseUrl }
                : { ok: false, reachable: false, version: null, error: "not-supported", baseUrl: shimState.baseUrl },
    },

    sshConfigHosts: async () => ({ hosts: [] }) as DesktopSshHostsResult,
    sshResolveHost: async () => ({ hostname: null, identityFile: null, port: null, user: null }),
    probeConnectionConfig: async (remoteUrl: string): Promise<DesktopConnectionProbeResult> => ({
        baseUrl: remoteUrl,
        reachable: false,
        authMode: "unknown",
        providers: [],
        version: null,
        error: "not-supported",
    }),
    oauthLoginConnectionConfig: async (remoteUrl: string): Promise<DesktopOauthLoginResult> => ({
        ok: false,
        baseUrl: remoteUrl,
        connected: false,
    }),
    oauthLogoutConnectionConfig: async (): Promise<DesktopOauthLogoutResult> => ({ ok: false, connected: false }),

    cloud: {
        status: async (): Promise<DesktopCloudStatus> => ({ portalBaseUrl: "", signedIn: false }),
        login: async () => ({ ok: false, portalBaseUrl: "", signedIn: false }),
        logout: async () => ({ ok: false, portalBaseUrl: "", signedIn: false }),
        discover: async (): Promise<DesktopCloudDiscoverResult> => ({
            agents: [],
            org: null,
            needsOrgSelection: false,
        }),
        agentSignIn: async (dashboardUrl: string): Promise<DesktopCloudAgentSignInResult> => ({
            baseUrl: dashboardUrl,
            connected: false,
        }),
    },

    profile: {
        get: async (): Promise<DesktopActiveProfile> => {
            const profile = await apiFetch<{ active?: string; current?: string }>({ path: "/api/profiles/active" });
            return { profile: profile.active || profile.current || null };
        },
        set: async (name: string | null): Promise<DesktopActiveProfile> => {
            const target = name?.trim() || "default";
            const profile = await apiFetch<{ active?: string }>({
                path: "/api/profiles/active",
                method: "POST",
                body: { name: target },
            });
            return { profile: profile.active || target };
        },
    },

    api: apiFetch,

    notify: async (payload: HermesNotification): Promise<boolean> => {
        try {
            if (typeof Notification === "undefined") {
                return false;
            }

            if (Notification.permission === "denied") {
                return false;
            }

            if (Notification.permission === "default") {
                const granted = await Notification.requestPermission();

                if (granted !== "granted") {
                    return false;
                }
            }

            const title = payload.title || "Kronos";

            if (typeof payload.body === "string" && payload.body) {
                new Notification(title, { body: payload.body });
            } else {
                new Notification(title);
            }

            return true;
        } catch {
            return false;
        }
    },

    requestMicrophoneAccess: async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            stream.getTracks().forEach((track) => track.stop());

            return true;
        } catch {
            return false;
        }
    },

    readFileDataUrl: async () => {
        throw new Error("readFileDataUrl is not supported by the Hermes shim");
    },
    readFileText: async () => {
        throw new Error("readFileText is not supported by the Hermes shim");
    },
    selectPaths: async () => [],
    writeClipboard: async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);

            return true;
        } catch {
            return false;
        }
    },
    readClipboard: async () => {
        try {
            return await navigator.clipboard.readText();
        } catch {
            return "";
        }
    },
    saveImageFromUrl: async () => false,
    saveImageBuffer: async () => "",
    saveClipboardImage: async () => "",
    getPathForFile: (file: File) => {
        const webUtils = (window as unknown as { webUtils?: { getPathForFile?: (f: File) => string } }).webUtils;

        return webUtils?.getPathForFile?.(file) ?? file.name;
    },
    normalizePreviewTarget: async () => null,
    watchPreviewFile: async (url: string): Promise<HermesPreviewWatch> => ({ id: crypto.randomUUID(), path: url }),
    stopPreviewFileWatch: async () => true,

    openExternal: async (url: string): Promise<void> => {
        window.open(url, "_blank", "noopener");
    },
    fetchLinkTitle: async (url: string): Promise<string> => {
        try {
            const res = await fetch(url, { method: "GET" });
            const text = await res.text();
            const match = /<title[^>]*>([^<]+)<\/title>/i.exec(text);

            return match?.[1]?.trim() ?? "";
        } catch {
            return "";
        }
    },
    sanitizeWorkspaceCwd: async (cwd?: null | string) => ({ cwd: cwd ?? "", sanitized: false }),

    settings: {
        getDefaultProjectDir: async () => ({ defaultLabel: "Default", dir: null, resolvedCwd: "" }),
        pickDefaultProjectDir: async () => ({ canceled: true, dir: null }),
        setDefaultProjectDir: async (dir: null | string) => ({ dir }),
    },

    revealLogs: async () => ({ ok: false, path: "", error: "not-supported" }),
    getRecentLogs: async () => ({ path: "", lines: [] }),
    reportRendererError: (report: { label: string; boundary: string; message: string; componentStack: string }) => {
        console.warn(`[hermes-shim] renderer error boundary ${report.boundary}: ${report.message}`);
    },
    readDir: async (): Promise<HermesReadDirResult> => ({ entries: [], error: "not-supported" }),

    terminal: {
        cwd: async () => null,
        dispose: async () => false,
        onData: () => () => undefined,
        onExit: () => () => undefined,
        resize: async () => false,
        start: async (): Promise<HermesTerminalSession> => {
            throw new Error("Terminal sessions are not supported by the Hermes shim");
        },
        write: async () => false,
    },

    onClosePreviewRequested: () => () => undefined,
    onOpenFolderRequested: () => () => undefined,
    onOpenUpdatesRequested: () => () => undefined,
    onDeepLink: () => () => undefined,
    signalDeepLinkReady: async () => ({ ok: true }),
    onWindowStateChanged: (_callback: (payload: HermesWindowState) => void) => () => undefined,
    onFocusSession: () => () => undefined,
    onNotificationAction: () => () => undefined,
    onPreviewFileChanged: () => () => undefined,
    onBackendExit: (_callback: (payload: HermesTerminalExit) => void) => () => undefined,
    onConnectionApplied: () => () => undefined,
    onPowerResume: () => () => undefined,
    getOnBattery: async () => false,
    onBatteryChanged: () => () => undefined,
    onBootProgress: () => () => undefined,

    getBootstrapState: async () => ({
        active: false,
        manifest: null,
        stages: {},
        error: null,
        log: [],
        startedAt: null,
        completedAt: null,
        setupChoice: null,
        unsupportedPlatform: null,
    }),
    continueBootstrapLocal: async () => ({ ok: false }),
    resetBootstrap: async () => ({ ok: false }),
    repairBootstrap: async () => ({ ok: false }),
    cancelBootstrap: async () => ({ ok: false, cancelled: false }),
    onBootstrapEvent: () => () => undefined,

    getVersion: async () => ({
        appVersion: "kronterm-hermes",
        electronVersion: "",
        nodeVersion: "",
        platform: typeof navigator !== "undefined" ? navigator.platform : "",
        hermesRoot: "",
    }),

    updates: {
        check: async () => ({ supported: false }),
        apply: async () => ({ ok: false, error: "not-supported" }),
        getBranch: async () => ({ branch: "stable" }),
        setBranch: async (branch: string) => ({ branch }),
        onProgress: () => () => undefined,
    },

    uninstall: {
        summary: async () => ({
            hermes_home: "",
            agent_installed: false,
            gui_installed: false,
            source_built_artifacts: [],
            packaged_app_paths: [],
            userdata_dir: "",
            userdata_exists: false,
            platform: typeof navigator !== "undefined" ? navigator.platform : "",
        }),
        run: async () => ({ ok: false, error: "not-supported" }),
    },

    themes: {
        fetchMarketplace: async () => {
            throw new Error("Theme marketplace is not supported by the Hermes shim");
        },
        searchMarketplace: async () => [],
    },

    findInPage: async () => ({ count: 0 }),
    stopFindInPage: async () => undefined,
    onFoundInPage: () => () => undefined,
    onOpenFindBarRequested: () => () => undefined,
};

/** Installs the Hermes desktop bridge shim (idempotent). */
export function installHermesDesktopShim(config?: HermesDesktopShimConfig): void {
    configureHermesDesktopShim(config);

    if (!window.hermesDesktop) {
        window.hermesDesktop = shim;
    }
}

/** Replaces the Hermes desktop bridge shim regardless of prior install. */
export function replaceHermesDesktopShim(config?: HermesDesktopShimConfig): void {
    configureHermesDesktopShim(config);
    window.hermesDesktop = shim;
}
