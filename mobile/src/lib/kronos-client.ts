import type {
    BrowserFrame,
    BrowserRuntimeState,
    BrowserSnapshot,
    GatewayEvent,
    HostProfile,
    KronosMessage,
    KronosMessagePart,
    KronosSession,
    MobileUiSession,
    PairingResult,
    PhoneActionResult,
    PhoneAuditEvent,
    PhoneContext,
    PhoneControlLease,
    PhoneControlStatus,
    SandboxRecord,
    SessionStatusEnvelope,
    TerminalStreamEvent,
} from "../types";
import { JsonRpcGatewayClient, type GatewayConnectionState } from "./json-rpc-gateway";

const AbsoluteUrlPattern = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

interface GatewayTicket {
    wsUrl?: string;
    expiresAt?: number;
}

interface GatewayInitialization {
    serverInstanceId: string;
    latestSeq: number;
}

interface PromptSubmitResult {
    accepted: boolean;
    messageID: string;
}

interface TerminalSessionResult {
    sessionId: string;
    cols: number;
    rows: number;
}

interface HealthPayload {
    connected?: boolean;
    ready?: boolean;
    engine?: string;
    service?: string;
    version?: string;
    detail?: string;
    hostName?: string;
    capabilities?: string[];
    phoneControl?: PhoneControlStatus;
    [key: string]: unknown;
}

interface RequestOptions extends RequestInit {
    timeoutMs?: number;
}

export const makeDirectMobileUiUrl = (
    baseUrl: string,
    context: { sessionId?: string; surfaceId?: string } = {}
): string => {
    const rootUrl = normalizeHostUrl(baseUrl);
    const url = new URL(`${rootUrl}/`);
    url.searchParams.set("apiBaseUrl", `${rootUrl}/api`);
    url.searchParams.set("embeddedHost", "kronterm");
    url.searchParams.set("mobileShell", "iphone");
    url.searchParams.set("route", "chat");
    url.searchParams.set("surface", "page");
    url.searchParams.set("layoutMode", "full-page");
    url.searchParams.set("profile", "chat-shell");
    if (context.sessionId) {
        url.searchParams.set("currentSessionId", context.sessionId);
    }
    if (context.surfaceId) {
        url.searchParams.set("surfaceId", context.surfaceId);
    }
    return url.toString();
};

export const normalizeHostUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error("Host address is required");
    }
    const candidate = AbsoluteUrlPattern.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Host address must use HTTPS or HTTP");
    }
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api$/, "") || "/";
    return url.toString().replace(/\/$/, "");
};

const webSocketUrl = (baseUrl: string, candidate: string): string => {
    const url = new URL(candidate, `${baseUrl}/`);
    if (url.protocol === "http:") {
        url.protocol = "ws:";
    } else if (url.protocol === "https:") {
        url.protocol = "wss:";
    }
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
        throw new Error("Host returned an unsupported gateway URL");
    }
    return url.toString();
};

const unwrapArray = <T>(payload: unknown, key: string): T[] => {
    if (Array.isArray(payload)) {
        return payload as T[];
    }
    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        if (Array.isArray(record[key])) {
            return record[key] as T[];
        }
        if (Array.isArray(record.data)) {
            return record.data as T[];
        }
    }
    return [];
};

export const messageText = (parts: KronosMessagePart[]): string =>
    parts
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? part.content ?? part.value ?? "")
        .join("\n")
        .trim();

export class KronosHostClient {
    readonly host: HostProfile;
    private gateway: JsonRpcGatewayClient | null = null;
    private gatewayPromise: Promise<JsonRpcGatewayClient> | null = null;
    private gatewayPromiseDirectory = "";
    private gatewayCursor = 0;
    private gatewayServerInstanceId: string | undefined;
    private gatewayDirectory = "";
    private gatewayGeneration = 0;
    private readonly eventHandlers = new Set<(event: GatewayEvent) => void>();
    private readonly gatewayStateHandlers = new Set<(state: GatewayConnectionState) => void>();

    constructor(host: HostProfile) {
        this.host = { ...host, baseUrl: normalizeHostUrl(host.baseUrl) };
    }

    get rootUrl(): string {
        return this.host.baseUrl;
    }

    get apiUrl(): string {
        return `${this.rootUrl}/api`;
    }

    close(): void {
        this.gatewayGeneration += 1;
        this.gateway?.close();
        this.gateway = null;
        this.gatewayPromise = null;
        this.gatewayPromiseDirectory = "";
    }

    onEvent(handler: (event: GatewayEvent) => void): () => void {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }

    onGatewayState(handler: (state: GatewayConnectionState) => void): () => void {
        this.gatewayStateHandlers.add(handler);
        handler(this.gateway?.connectionState ?? "idle");
        return () => this.gatewayStateHandlers.delete(handler);
    }

    async health(): Promise<HealthPayload> {
        return this.requestAbsolute<HealthPayload>(`${this.rootUrl}/health`, { timeoutMs: 8_000 });
    }

    async createMobileUiSession(context: { sessionId?: string; surfaceId?: string } = {}): Promise<MobileUiSession> {
        const uiRootUrl = this.host.uiBaseUrl ? normalizeHostUrl(this.host.uiBaseUrl) : this.rootUrl;
        try {
            const session = await this.requestAbsolute<MobileUiSession>(`${this.rootUrl}/v1/ui-ticket`, {
                method: "POST",
                body: JSON.stringify(context),
                timeoutMs: 10_000,
            });
            if (!session.url) {
                throw new Error("Host did not return a KronosChamber URL");
            }
            return {
                ...session,
                url: new URL(session.url, `${this.rootUrl}/`).toString(),
            };
        } catch (error) {
            if (this.host.token) {
                throw error;
            }
            return { url: makeDirectMobileUiUrl(uiRootUrl, context) };
        }
    }

    async connectGateway(directory = ""): Promise<JsonRpcGatewayClient> {
        if (this.gateway?.connectionState === "open" && this.gatewayDirectory === directory) {
            return this.gateway;
        }
        if (this.gateway?.connectionState === "open" && this.gatewayDirectory !== directory) {
            this.gateway.close();
            this.gateway = null;
        }
        if (this.gatewayPromise) {
            if (this.gatewayPromiseDirectory === directory) {
                return this.gatewayPromise;
            }
            await this.gatewayPromise.catch(() => undefined);
            return this.connectGateway(directory);
        }

        const generation = this.gatewayGeneration;
        this.gatewayPromiseDirectory = directory;
        const gatewayPromise = (async () => {
            const ticket = await this.request<GatewayTicket>("/kronoscode/gateway-ticket", {
                method: "POST",
                body: JSON.stringify({ directory, surfaceId: `iphone:${this.host.id}` }),
                timeoutMs: 8_000,
            });
            if (!ticket.wsUrl) {
                throw new Error("Host does not expose the KronosCode gateway");
            }

            const gateway = new JsonRpcGatewayClient();
            try {
                gateway.onState((state) => {
                    for (const handler of this.gatewayStateHandlers) {
                        handler(state);
                    }
                });
                gateway.onEvent((event) => {
                    this.gatewayCursor = Math.max(this.gatewayCursor, event.seq || 0);
                    this.gatewayServerInstanceId = event.server_instance_id || this.gatewayServerInstanceId;
                    for (const handler of this.eventHandlers) {
                        handler(event);
                    }
                });
                await gateway.connect(webSocketUrl(this.rootUrl, ticket.wsUrl));
                if (generation !== this.gatewayGeneration) {
                    throw new Error("Gateway connection was superseded");
                }
                const initialized = await gateway.request<GatewayInitialization>(
                    "connection.initialize",
                    {
                        directory,
                        cursor: this.gatewayCursor,
                        server_instance_id: this.gatewayServerInstanceId,
                    },
                    15_000
                );
                if (generation !== this.gatewayGeneration) {
                    throw new Error("Gateway connection was superseded");
                }
                this.gatewayServerInstanceId = initialized.serverInstanceId;
                this.gatewayDirectory = directory;
                this.gateway = gateway;
                return gateway;
            } catch (error) {
                gateway.close();
                throw error;
            }
        })();
        this.gatewayPromise = gatewayPromise;

        try {
            return await gatewayPromise;
        } finally {
            if (this.gatewayPromise === gatewayPromise) {
                this.gatewayPromise = null;
                this.gatewayPromiseDirectory = "";
            }
        }
    }

    async listSessions(): Promise<KronosSession[]> {
        const payload = await this.request<unknown>("/session", { timeoutMs: 15_000 });
        return unwrapArray<KronosSession>(payload, "sessions");
    }

    async createSession(title = "KronTerm iPhone"): Promise<KronosSession> {
        try {
            const gateway = await this.connectGateway();
            return await gateway.request<KronosSession>("session.create", { title });
        } catch (gatewayError) {
            const payload = await this.request<unknown>("/session", {
                method: "POST",
                body: JSON.stringify({ title }),
                timeoutMs: 15_000,
            }).catch(() => {
                throw gatewayError;
            });
            const session = (payload as { data?: KronosSession })?.data ?? (payload as KronosSession);
            if (!session?.id) {
                throw new Error("Host did not create a KronosCode session");
            }
            return session;
        }
    }

    async listMessages(sessionId: string): Promise<KronosMessage[]> {
        const payload = await this.request<unknown>(`/session/${encodeURIComponent(sessionId)}/message`, {
            timeoutMs: 20_000,
        });
        return unwrapArray<KronosMessage>(payload, "messages").filter(
            (message) => Boolean(message?.info?.id) && Array.isArray(message.parts)
        );
    }

    async sendMessage(sessionId: string, text: string, directory = ""): Promise<string> {
        const messageID = `iphone_${Date.now().toString(16)}_${crypto.randomUUID().slice(0, 8)}`;
        const prompt = {
            session_id: sessionId,
            messageID,
            parts: [{ type: "text", text }],
        };

        try {
            const gateway = await this.connectGateway(directory);
            const result = await gateway.request<PromptSubmitResult>("prompt.submit", prompt);
            if (!result.accepted) {
                throw new Error("KronosCode did not accept the objective");
            }
            return result.messageID || messageID;
        } catch (gatewayError) {
            await this.request<unknown>(`/session/${encodeURIComponent(sessionId)}/prompt_async`, {
                method: "POST",
                body: JSON.stringify({ messageID, parts: prompt.parts }),
                timeoutMs: 20_000,
            }).catch(() => {
                throw gatewayError;
            });
            return messageID;
        }
    }

    async abortSession(sessionId: string, directory = ""): Promise<boolean> {
        try {
            const gateway = await this.connectGateway(directory);
            return await gateway.request<boolean>("session.abort", { session_id: sessionId });
        } catch {
            const payload = await this.request<unknown>(`/session/${encodeURIComponent(sessionId)}/abort`, {
                method: "POST",
                timeoutMs: 15_000,
            });
            return payload === true || (payload as { data?: boolean })?.data === true;
        }
    }

    async getSessionStatuses(): Promise<Record<string, SessionStatusEnvelope>> {
        const payload = await this.request<unknown>("/session/status", { timeoutMs: 10_000 });
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return {};
        }
        return payload as Record<string, SessionStatusEnvelope>;
    }

    async getBrowserState(sessionID: string): Promise<BrowserRuntimeState> {
        return this.request<BrowserRuntimeState>(
            `/experimental/browser/state?sessionID=${encodeURIComponent(sessionID)}`,
            { timeoutMs: 12_000 }
        );
    }

    async getBrowserFrame(sessionID: string): Promise<BrowserFrame> {
        return this.request<BrowserFrame>(`/experimental/browser/frame?sessionID=${encodeURIComponent(sessionID)}`, {
            timeoutMs: 15_000,
        });
    }

    async runBrowserAction(sessionID: string, action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
        return this.request<unknown>("/experimental/browser/action", {
            method: "POST",
            body: JSON.stringify({ sessionID, action, payload }),
            timeoutMs: 45_000,
        });
    }

    async getBrowserSnapshot(sessionID: string): Promise<BrowserSnapshot> {
        const result = await this.runBrowserAction(sessionID, "snapshot");
        if (!result || typeof result !== "object" || !Array.isArray((result as BrowserSnapshot).items)) {
            throw new Error("Host did not return browser controls");
        }
        return result as BrowserSnapshot;
    }

    async createTerminal(cwd: string): Promise<TerminalSessionResult> {
        if (!cwd.trim()) {
            throw new Error("A project directory is required to open a terminal");
        }
        return this.request<TerminalSessionResult>("/terminal/create", {
            method: "POST",
            body: JSON.stringify({ cwd, cols: 48, rows: 24 }),
            timeoutMs: 20_000,
        });
    }

    subscribeTerminal(sessionId: string, onEvent: (event: TerminalStreamEvent) => void): () => void {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(`${this.apiUrl}/terminal/${encodeURIComponent(sessionId)}/stream`, {
                    headers: {
                        Accept: "text/event-stream",
                        ...(this.host.token ? { Authorization: `Bearer ${this.host.token}` } : {}),
                    },
                    signal: controller.signal,
                });
                if (!response.ok || !response.body) {
                    throw new Error(`Terminal stream failed (${response.status})`);
                }
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
                    const blocks = buffer.split("\n\n");
                    buffer = blocks.pop() ?? "";
                    for (const block of blocks) {
                        const serialized = block
                            .split("\n")
                            .filter((line) => line.startsWith("data:"))
                            .map((line) => line.slice(5).trimStart())
                            .join("\n");
                        if (serialized) {
                            onEvent(JSON.parse(serialized) as TerminalStreamEvent);
                        }
                    }
                }
            } catch (reason) {
                if (!controller.signal.aborted) {
                    onEvent({ type: "error", message: reason instanceof Error ? reason.message : String(reason) });
                }
            }
        })();
        return () => controller.abort();
    }

    async sendTerminalInput(sessionId: string, data: string): Promise<void> {
        await this.request(`/terminal/${encodeURIComponent(sessionId)}/input`, {
            method: "POST",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: data,
            timeoutMs: 10_000,
        });
    }

    async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
        await this.request(`/terminal/${encodeURIComponent(sessionId)}/resize`, {
            method: "POST",
            body: JSON.stringify({ cols, rows }),
            timeoutMs: 10_000,
        });
    }

    async destroyTerminal(sessionId: string): Promise<void> {
        await this.request(`/terminal/${encodeURIComponent(sessionId)}`, {
            method: "DELETE",
            timeoutMs: 10_000,
        });
    }

    async listSandboxes(): Promise<SandboxRecord[]> {
        const payload = await this.request<unknown>("/desktop-sandbox", { timeoutMs: 15_000 });
        return unwrapArray<SandboxRecord>(payload, "sandboxes");
    }

    async createSandbox(): Promise<SandboxRecord> {
        const payload = await this.request<{ sandbox?: SandboxRecord }>("/desktop-sandbox/create", {
            method: "POST",
            body: JSON.stringify({ provider: "sandbox-mcp", resolution: "1280x800" }),
            timeoutMs: 90_000,
        });
        if (!payload.sandbox?.id) {
            throw new Error("Host did not provision a Kron Sandbox");
        }
        return payload.sandbox;
    }

    async destroySandbox(sandboxId: string): Promise<void> {
        await this.request(`/desktop-sandbox/${encodeURIComponent(sandboxId)}/destroy`, {
            method: "POST",
            timeoutMs: 45_000,
        });
    }

    async getSandboxScreenshot(sandboxId: string): Promise<{ image: string; width?: number; height?: number }> {
        return this.request(`/desktop-sandbox/${encodeURIComponent(sandboxId)}/screenshot`, {
            method: "POST",
            body: JSON.stringify({}),
            timeoutMs: 20_000,
        });
    }

    async runSandboxAction(sandboxId: string, action: Record<string, unknown>): Promise<unknown> {
        return this.request(`/desktop-sandbox/${encodeURIComponent(sandboxId)}/execute`, {
            method: "POST",
            body: JSON.stringify(action),
            timeoutMs: 45_000,
        });
    }

    async getPhoneStatus(): Promise<PhoneControlStatus> {
        return this.requestAbsolute<PhoneControlStatus>(`${this.rootUrl}/v1/phone/status`, { timeoutMs: 5_000 });
    }

    async getPhoneContext(): Promise<PhoneContext> {
        const response = await this.requestAbsolute<PhoneActionResult>(`${this.rootUrl}/v1/phone/context`, {
            timeoutMs: 30_000,
        });
        return (response.result ?? {}) as PhoneContext;
    }

    async runPhoneAction(
        method: string,
        params: Record<string, unknown> = {},
        confirmCritical = false
    ): Promise<PhoneActionResult> {
        return this.requestAbsolute<PhoneActionResult>(`${this.rootUrl}/v1/phone/action`, {
            method: "POST",
            body: JSON.stringify({ method, params, confirmCritical }),
            timeoutMs: 45_000,
        });
    }

    async startPhoneControlLease(durationMs: number): Promise<PhoneControlLease> {
        return this.requestAbsolute<PhoneControlLease>(`${this.rootUrl}/v1/phone/lease`, {
            method: "POST",
            body: JSON.stringify({ durationMs }),
            timeoutMs: 10_000,
        });
    }

    async releasePhoneControlLease(): Promise<PhoneControlLease> {
        return this.requestAbsolute<PhoneControlLease>(`${this.rootUrl}/v1/phone/lease`, {
            method: "DELETE",
            timeoutMs: 10_000,
        });
    }

    async getPhoneAudit(): Promise<PhoneAuditEvent[]> {
        const response = await this.requestAbsolute<{ events?: PhoneAuditEvent[] }>(`${this.rootUrl}/v1/phone/audit`, {
            timeoutMs: 10_000,
        });
        return response.events ?? [];
    }

    private request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        return this.requestAbsolute<T>(`${this.apiUrl}${path}`, options);
    }

    private async requestAbsolute<T>(url: string, options: RequestOptions = {}): Promise<T> {
        const { timeoutMs = 30_000, headers, ...requestOptions } = options;
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...requestOptions,
                headers: {
                    Accept: "application/json",
                    ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
                    ...(this.host.token ? { Authorization: `Bearer ${this.host.token}` } : {}),
                    ...headers,
                },
                signal: controller.signal,
            });
            const contentType = response.headers.get("content-type") ?? "";
            const payload = contentType.includes("application/json")
                ? await response.json().catch(() => null)
                : await response.text().catch(() => "");
            if (!response.ok) {
                const detail =
                    payload && typeof payload === "object" && "error" in payload
                        ? String((payload as { error?: unknown }).error)
                        : typeof payload === "string" && payload.trim()
                          ? payload.slice(0, 300)
                          : `HTTP ${response.status}`;
                throw new Error(detail);
            }
            return payload as T;
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new Error(`Host request timed out after ${Math.round(timeoutMs / 1000)}s`);
            }
            throw error;
        } finally {
            window.clearTimeout(timer);
        }
    }

    static async pair(baseUrl: string, code: string): Promise<PairingResult> {
        const normalized = normalizeHostUrl(baseUrl);
        const response = await fetch(`${normalized}/v1/pair`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ code: code.replace(/\D/g, "") }),
            signal: AbortSignal.timeout(12_000),
        });
        const payload = (await response.json().catch(() => null)) as {
            token?: string;
            hostName?: string;
            macName?: string;
            capabilities?: string[];
            error?: string;
        } | null;
        if (!response.ok || !payload?.token) {
            throw new Error(payload?.error || "The computer rejected this pairing code");
        }
        return {
            token: payload.token,
            hostName: payload.hostName || payload.macName || "KronTerm Computer",
            capabilities: payload.capabilities,
        };
    }
}
