// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HealthTimeoutMs = 3_000;
const ApiRequestTimeoutMs = 30_000;
const StartupTimeoutMs = 15_000;
const RestartDelaysMs = [1_000, 2_000, 4_000];
const RequiredProtocolVersion = "1.0";

export type KronosCodeConnectionMode = "managed" | "external";

export type KronosCodeCapabilities = {
    gateway: boolean;
    replay: boolean;
    asyncPrompt: boolean;
    promptIdempotency?: boolean;
    pagedHistory?: boolean;
};

export type KronosCodeConnectionDescriptor = {
    mode: KronosCodeConnectionMode;
    baseUrl: string;
    backendVersion: string;
    protocolVersion: string;
    serverInstanceId: string;
    capabilities: KronosCodeCapabilities;
    managed: boolean;
};

export type KronosCodeBootProgress = {
    phase: "idle" | "resolving" | "validating" | "launching" | "waiting" | "ready" | "recovering" | "error";
    message: string;
    progress: number;
    attempt?: number;
    error?: string;
};

type ManagedReadyDescriptor = {
    type: "KRONOSCODE_BACKEND_READY";
    url: string;
    pid: number;
    protocolVersion: string;
    serverInstanceId: string;
    capabilities: KronosCodeCapabilities;
};

type HealthResponse = {
    healthy: true;
    version: string;
    protocolVersion: string;
    serverInstanceId: string;
    capabilities: KronosCodeCapabilities;
};

type InternalConnection = {
    descriptor: KronosCodeConnectionDescriptor;
    username: string;
    password?: string;
};

type ConnectionSettings = {
    endpoint?: string;
    binary?: string;
    username: string;
    password?: string;
};

export type KronosCodeApiRequest = {
    path: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    directory?: string;
};

export type KronosCodeApiResponse = {
    status: number;
    headers: Record<string, string>;
    body: unknown;
};

function trimUrl(value: string): string {
    return value.replace(/\/+$/, "");
}

function isLoopback(hostname: string): boolean {
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

export function isKronosCodeLoopbackUrl(value: string): boolean {
    try {
        return isLoopback(new URL(value).hostname);
    } catch {
        return false;
    }
}

export function validateKronosCodeEndpoint(value: string): URL {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("KronosCode endpoint must use http or https.");
    }
    if (!isLoopback(url.hostname) && url.protocol !== "https:") {
        throw new Error("Non-loopback KronosCode endpoints require TLS.");
    }
    return url;
}

function basicAuth(username: string, password?: string): string | undefined {
    if (!password) {
        return undefined;
    }
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function executable(filePath: string | undefined): filePath is string {
    if (!filePath) {
        return false;
    }
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function findOnPath(name: string): string | undefined {
    const command = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(command, [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (result.status !== 0) {
        return undefined;
    }
    return result.stdout.trim().split(/\r?\n/)[0] || undefined;
}

export function getKronosCodeBinaryCandidates(override?: string): string[] {
    const resourcesPath = (process as typeof process & { resourcesPath?: string }).resourcesPath;
    const candidates = [
        override,
        resourcesPath ? path.join(resourcesPath, "agents", "kronoscode", "bin", "kronoscode") : undefined,
        path.join(process.cwd(), "agents", "kronoscode", "bin", "kronoscode"),
        path.join(process.cwd(), "kronoscoder", "packages", "kronoscode", "bin", "kronoscode"),
        path.resolve(import.meta.dirname, "..", "..", "kronoscoder", "packages", "kronoscode", "bin", "kronoscode"),
        path.join(os.homedir(), ".kronoscode", "bin", "kronoscode"),
        path.join(os.homedir(), ".local", "bin", "kronoscode"),
        path.join(os.homedir(), ".bun", "bin", "kronoscode"),
        findOnPath("kronoscode"),
    ];
    return Array.from(new Set(candidates.filter((candidate): candidate is string => Boolean(candidate))));
}

export function withKronosCodeAttachArgs(args: string[] | undefined, baseUrl: string): string[] {
    const input = args?.length ? args : ["acp"];
    const attachIndex = input.indexOf("--attach");
    const withoutAttach =
        attachIndex === -1 ? input : input.filter((_, index) => index !== attachIndex && index !== attachIndex + 1);
    return [...withoutAttach, "--attach", baseUrl];
}

async function readConnectionSettings(fullConfig?: FullConfigType): Promise<ConnectionSettings> {
    let config = fullConfig;
    if (!config) {
        const [{ RpcApi }, { ElectronWshClient }] = await Promise.all([
            import("../frontend/app/store/wshclientapi"),
            import("./emain-wsh"),
        ]);
        config = await RpcApi.GetFullConfigCommand(ElectronWshClient);
    }
    const endpoint =
        process.env.KRONOSCODE_SERVER_URL?.trim() || config?.settings?.["kronoscode:endpoint"]?.trim() || undefined;
    const binary =
        config?.settings?.["kronoscode:binary"]?.trim() ||
        process.env.KRONOSCODE_BINARY?.trim() ||
        process.env.KRONOSCODE_BIN?.trim() ||
        undefined;
    const username =
        config?.settings?.["kronoscode:username"]?.trim() ||
        process.env.KRONOSCODE_SERVER_USERNAME?.trim() ||
        "kronoscode";
    const secretName = config?.settings?.["kronoscode:passwordsecretname"]?.trim();
    let secrets: Record<string, string> = {};
    if (secretName) {
        const [{ RpcApi }, { ElectronWshClient }] = await Promise.all([
            import("../frontend/app/store/wshclientapi"),
            import("./emain-wsh"),
        ]);
        secrets = await RpcApi.GetSecretsCommand(ElectronWshClient, [secretName]);
    }
    const password =
        (secretName ? secrets[secretName] : undefined) ||
        process.env.KRONOSCODE_SERVER_PASSWORD ||
        process.env.OPENCODE_SERVER_PASSWORD ||
        undefined;
    return { endpoint, binary, username, password };
}

export class KronosCodeRuntimeManager extends EventEmitter {
    private child: ChildProcessWithoutNullStreams | null = null;
    private connection: InternalConnection | null = null;
    private startPromise: Promise<KronosCodeConnectionDescriptor> | null = null;
    private stopping = false;
    private restartAttempt = 0;
    private restartTimer: NodeJS.Timeout | null = null;
    private bootProgress: KronosCodeBootProgress = {
        phase: "idle",
        message: "KronosCode has not started.",
        progress: 0,
    };
    private appliedSettings: ConnectionSettings | null = null;

    constructor(private readonly apiRequestTimeoutMs = ApiRequestTimeoutMs) {
        super();
    }

    get progress(): KronosCodeBootProgress {
        return this.bootProgress;
    }

    get descriptor(): KronosCodeConnectionDescriptor | null {
        return this.connection?.descriptor ?? null;
    }

    private publishProgress(progress: KronosCodeBootProgress): void {
        this.bootProgress = progress;
        this.emit("boot-progress", progress);
    }

    private async validate(
        baseUrl: string,
        mode: KronosCodeConnectionMode,
        username: string,
        password?: string
    ): Promise<InternalConnection> {
        const endpoint = validateKronosCodeEndpoint(baseUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HealthTimeoutMs);
        try {
            const authorization = basicAuth(username, password);
            const response = await fetch(new URL("/global/health", endpoint), {
                headers: authorization ? { Authorization: authorization } : undefined,
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`health check returned HTTP ${response.status}`);
            }
            const health = (await response.json()) as HealthResponse;
            if (
                health.healthy !== true ||
                health.protocolVersion !== RequiredProtocolVersion ||
                !health.serverInstanceId ||
                !health.capabilities?.gateway ||
                !health.capabilities?.asyncPrompt
            ) {
                throw new Error("backend does not support the required KronosCode desktop protocol");
            }
            return {
                descriptor: {
                    mode,
                    baseUrl: trimUrl(endpoint.toString()),
                    backendVersion: health.version,
                    protocolVersion: health.protocolVersion,
                    serverInstanceId: health.serverInstanceId,
                    capabilities: health.capabilities,
                    managed: mode === "managed",
                },
                username,
                password,
            };
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`KronosCode validation failed for ${baseUrl}: ${detail}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    private resolveBinary(override?: string): string {
        for (const candidate of getKronosCodeBinaryCandidates(override)) {
            if (executable(candidate)) {
                return candidate;
            }
        }
        throw new Error(
            `KronosCode executable not found. Checked: ${getKronosCodeBinaryCandidates(override).join(", ")}`
        );
    }

    private async waitForReady(
        filePath: string,
        child: ChildProcessWithoutNullStreams
    ): Promise<ManagedReadyDescriptor> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < StartupTimeoutMs) {
            if (child.exitCode != null || child.killed) {
                throw new Error(`KronosCode exited before readiness (code ${child.exitCode ?? "unknown"}).`);
            }
            try {
                const descriptor = JSON.parse(await fs.promises.readFile(filePath, "utf8")) as ManagedReadyDescriptor;
                if (
                    descriptor.type === "KRONOSCODE_BACKEND_READY" &&
                    descriptor.url &&
                    descriptor.protocolVersion === RequiredProtocolVersion
                ) {
                    return descriptor;
                }
            } catch {
                // The ready file is written atomically after the listener is live.
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(`Timed out waiting for managed KronosCode after ${StartupTimeoutMs / 1_000} seconds.`);
    }

    private attachChildHandlers(child: ChildProcessWithoutNullStreams): void {
        child.stdout.on("data", (chunk) => console.log(`[kronoscode] ${String(chunk).trimEnd()}`));
        child.stderr.on("data", (chunk) => console.log(`[kronoscode:err] ${String(chunk).trimEnd()}`));
        child.once("exit", (code, signal) => {
            if (this.child !== child) {
                return;
            }
            const shouldRestart = this.connection?.descriptor.managed === true;
            this.child = null;
            this.connection = null;
            this.startPromise = null;
            this.emit("exit", { code, signal, managed: true });
            if (!this.stopping && shouldRestart) {
                this.scheduleRestart();
            }
        });
    }

    private scheduleRestart(): void {
        if (this.restartTimer || this.restartAttempt >= RestartDelaysMs.length) {
            if (this.restartAttempt >= RestartDelaysMs.length) {
                this.publishProgress({
                    phase: "error",
                    message: "KronosCode stopped after three recovery attempts.",
                    progress: 100,
                    attempt: this.restartAttempt,
                    error: "Automatic restart limit reached.",
                });
            }
            return;
        }
        const delay = RestartDelaysMs[this.restartAttempt];
        this.restartAttempt += 1;
        this.publishProgress({
            phase: "recovering",
            message: `KronosCode stopped; recovery attempt ${this.restartAttempt} is scheduled.`,
            progress: 20,
            attempt: this.restartAttempt,
        });
        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            void this.ensure().catch((error) => {
                console.log("managed KronosCode recovery failed", error);
                this.scheduleRestart();
            });
        }, delay);
        this.restartTimer.unref();
    }

    private async launchManaged(settings: ConnectionSettings): Promise<InternalConnection> {
        const binary = this.resolveBinary(settings.binary);
        const runtimeDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "kronoscode-runtime-"));
        const readyFile = path.join(runtimeDir, "ready.json");
        const username = "kronoscode";
        const password = randomBytes(32).toString("base64url");
        const bunBinary = path.join(os.homedir(), ".bun", "bin", "bun");
        this.publishProgress({
            phase: "launching",
            message: `Starting managed KronosCode from ${binary}.`,
            progress: 35,
            attempt: this.restartAttempt,
        });
        const child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", "0", "--ready-file", readyFile], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                KRONOSCODE_CLIENT: "desktop",
                KRONOSCODE_DISABLE_AUTOUPDATE: "1",
                KRONOSCODE_SERVER_USERNAME: username,
                KRONOSCODE_SERVER_PASSWORD: password,
                ...(executable(bunBinary) ? { BUN_BINARY: bunBinary } : {}),
                PATH: Array.from(
                    new Set(
                        [
                            path.join(os.homedir(), ".bun", "bin"),
                            "/opt/homebrew/bin",
                            "/usr/local/bin",
                            process.env.PATH ?? "",
                        ].flatMap((entry) => entry.split(path.delimiter))
                    )
                )
                    .filter(Boolean)
                    .join(path.delimiter),
            },
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });
        this.child = child;
        this.attachChildHandlers(child);
        this.publishProgress({
            phase: "waiting",
            message: "Waiting for the KronosCode protocol handshake.",
            progress: 60,
            attempt: this.restartAttempt,
        });
        try {
            const ready = await this.waitForReady(readyFile, child);
            return await this.validate(ready.url, "managed", username, password);
        } catch (error) {
            if (this.child === child) {
                this.child = null;
            }
            this.stopChild(child);
            throw error;
        } finally {
            void fs.promises.unlink(readyFile).catch(() => undefined);
            void fs.promises.rmdir(runtimeDir).catch(() => undefined);
        }
    }

    async ensure(fullConfig?: FullConfigType): Promise<KronosCodeConnectionDescriptor> {
        if (this.connection) {
            return this.connection.descriptor;
        }
        if (this.startPromise) {
            return this.startPromise;
        }
        this.stopping = false;
        this.startPromise = (async () => {
            this.publishProgress({ phase: "resolving", message: "Resolving the KronosCode runtime.", progress: 10 });
            const settings = this.appliedSettings ?? (await readConnectionSettings(fullConfig));
            let connection: InternalConnection;
            if (settings.endpoint) {
                this.publishProgress({
                    phase: "validating",
                    message: "Validating the configured KronosCode endpoint.",
                    progress: 45,
                });
                connection = await this.validate(settings.endpoint, "external", settings.username, settings.password);
            } else {
                connection = await this.launchManaged(settings);
            }
            this.connection = connection;
            this.restartAttempt = 0;
            this.publishProgress({
                phase: "ready",
                message: `Connected to KronosCode ${connection.descriptor.backendVersion}.`,
                progress: 100,
            });
            return connection.descriptor;
        })();
        try {
            return await this.startPromise;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.publishProgress({ phase: "error", message, progress: 100, error: message });
            throw error;
        } finally {
            this.startPromise = null;
        }
    }

    async revalidate(): Promise<KronosCodeConnectionDescriptor> {
        const current = this.connection;
        if (!current) {
            return this.ensure();
        }
        const next = await this.validate(
            current.descriptor.baseUrl,
            current.descriptor.mode,
            current.username,
            current.password
        );
        this.connection = next;
        return next.descriptor;
    }

    async applyConnection(input: {
        endpoint?: string;
        binary?: string;
        username?: string;
        password?: string;
    }): Promise<KronosCodeConnectionDescriptor> {
        const endpoint = input.endpoint?.trim() || undefined;
        const settings: ConnectionSettings = {
            endpoint,
            binary: input.binary?.trim() || undefined,
            username: input.username?.trim() || "kronoscode",
            password: input.password,
        };
        const validated = endpoint
            ? await this.validate(endpoint, "external", settings.username, settings.password)
            : null;
        const oldChild = this.child;
        this.appliedSettings = settings;
        this.connection = validated;
        this.child = null;
        if (oldChild) {
            this.stopChild(oldChild);
        }
        const descriptor = validated?.descriptor ?? (await this.ensure());
        return descriptor;
    }

    async touch(): Promise<boolean> {
        try {
            await this.revalidate();
            return true;
        } catch {
            return false;
        }
    }

    private requireConnection(): InternalConnection {
        if (!this.connection) {
            throw new Error("KronosCode is not connected.");
        }
        return this.connection;
    }

    async getGatewayWsUrl(input: { directory?: string; surfaceId?: string } = {}): Promise<string> {
        await this.ensure();
        const connection = this.requireConnection();
        const authorization = basicAuth(connection.username, connection.password);
        const response = await fetch(`${connection.descriptor.baseUrl}/global/gateway/ticket`, {
            method: "POST",
            signal: AbortSignal.timeout(HealthTimeoutMs),
            headers: {
                "content-type": "application/json",
                ...(authorization ? { Authorization: authorization } : {}),
            },
            body: JSON.stringify({
                directory: input.directory,
                surface_id: input.surfaceId,
            }),
        });
        if (!response.ok) {
            throw new Error(`Unable to mint KronosCode gateway ticket (HTTP ${response.status}).`);
        }
        const result = (await response.json()) as { ticket: string };
        const url = new URL(connection.descriptor.baseUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/global/gateway";
        url.search = new URLSearchParams({ ticket: result.ticket }).toString();
        return url.toString();
    }

    async api(input: KronosCodeApiRequest): Promise<KronosCodeApiResponse> {
        if (!input.path.startsWith("/") || input.path.startsWith("//")) {
            throw new Error("KronosCode API paths must be absolute backend paths.");
        }
        await this.ensure();
        const connection = this.requireConnection();
        const url = new URL(input.path, `${connection.descriptor.baseUrl}/`);
        if (input.directory) {
            url.searchParams.set("directory", input.directory);
        }
        const authorization = basicAuth(connection.username, connection.password);
        const response = await fetch(url, {
            method: input.method ?? "GET",
            signal: AbortSignal.timeout(this.apiRequestTimeoutMs),
            headers: {
                ...(input.body == null ? {} : { "content-type": "application/json" }),
                ...(authorization ? { Authorization: authorization } : {}),
            },
            body: input.body == null ? undefined : JSON.stringify(input.body),
        });
        const contentType = response.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json") ? await response.json() : await response.text();
        return {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body,
        };
    }

    getInternalConnection(): InternalConnection | null {
        return this.connection;
    }

    private stopChild(child: ChildProcessWithoutNullStreams): void {
        if (child.exitCode != null || child.signalCode != null) {
            return;
        }
        if (process.platform !== "win32" && child.pid) {
            try {
                process.kill(-child.pid, "SIGTERM");
            } catch {
                child.kill("SIGTERM");
            }
        } else {
            child.kill("SIGTERM");
        }
        setTimeout(() => {
            if (child.exitCode != null || child.signalCode != null) {
                return;
            }
            if (process.platform !== "win32" && child.pid) {
                try {
                    process.kill(-child.pid, "SIGKILL");
                    return;
                } catch {
                    // Fall through to the direct child.
                }
            }
            child.kill("SIGKILL");
        }, 3_000).unref();
    }

    stop(): void {
        this.stopping = true;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        const child = this.child;
        this.child = null;
        this.connection = null;
        this.startPromise = null;
        if (child) {
            this.stopChild(child);
        }
    }
}

export const KronosCodeRuntime = new KronosCodeRuntimeManager();
