// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { RpcApi } from "../frontend/app/store/wshclientapi";
import { getWebServerEndpoint, getWSServerEndpoint } from "../frontend/util/endpoints";
import { AuthKey, WaveAuthKeyEnv } from "./authkey";
import {
    makeRuntimeTokenPayload,
    makeStartupSurfaceContext,
    makeSurfaceTokenRequest,
    preferScopedSurfaceContext,
    type ChatHubV2SurfaceContext,
} from "./chathubv2-context";
import { isKronosChamberReady } from "./chathubv2-health";
import { isChildProcessRunning } from "./chathubv2-process";
import { ensureNodePtySpawnHelperExecutable } from "./chathubv2-pty";
import {
    getElectronAppResourcesPath,
    getElectronAppUnpackedBasePath,
    getWaveConfigDir,
    getWaveDataDir,
} from "./emain-platform";
import {
    getElectronExecPath,
    WaveAppElectronExecPath,
    WaveAppPathVarName,
    WaveAppResourcesPathVarName,
} from "./emain-util";
import { ElectronWshClient } from "./emain-wsh";
import { KronosCodeRuntime } from "./kronoscode-runtime";

type ChatHubV2ServerState = {
    url: string;
    port: number;
    pid?: number;
    serverPath: string;
    distPath: string;
    ready: boolean;
    health: ChatHubV2RuntimeHealth;
};

export type ChatHubV2RuntimeHealth = {
    runtime: "kronoscode-kronoschamber";
    status: "not-found" | "starting" | "ready" | "error" | "stopped";
    checkedAt: number;
    candidateRoots: string[];
    detectedRoot?: string;
    serverPath?: string;
    distPath?: string;
    kronosCodeBinary?: string;
    startupError?: string;
    logExcerpt: string[];
    supportedProviders: string[];
    supportedModels: string[];
    recoveryActions: Array<"retry" | "open-settings" | "inspect-logs">;
};

let child: ChildProcessWithoutNullStreams | null = null;
let state: ChatHubV2ServerState | null = null;
let startPromise: Promise<ChatHubV2ServerState> | null = null;
let lastStartupError: string | undefined;
const logExcerpt: string[] = [];
const surfaceContexts = new Map<string, ChatHubV2SurfaceContext>();
const jwtRefreshTimers = new Map<string, NodeJS.Timeout>();

const DefaultPort = 3107;
const HealthTimeoutMs = 90_000;
const JwtRefreshLeadMs = 10 * 60 * 1000;
const JwtIssueTimeoutMs = 5_000;
const ChamberProtocolVersion = 1;

function repoRoot(): string {
    return process.cwd();
}

function candidateRoots(): string[] {
    const roots = [
        path.join(repoRoot(), "third_party", "kronoschamber-web"),
        path.join(process.resourcesPath ?? "", "kronoschamber-web"),
        path.join(process.resourcesPath ?? "", "app.asar", "third_party", "kronoschamber-web"),
        path.resolve(import.meta.dirname, "..", "..", "third_party", "kronoschamber-web"),
    ];
    return Array.from(new Set(roots.filter(Boolean)));
}

function appendLog(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
        return;
    }
    logExcerpt.push(trimmed);
    while (logExcerpt.length > 16) {
        logExcerpt.shift();
    }
}

function findKronosChamberRoot(): string | undefined {
    return candidateRoots().find((root) => fs.existsSync(path.join(root, "server", "index.js")));
}

function resolveKronosChamberRoot(): string {
    const root = findKronosChamberRoot();
    if (root) {
        return root;
    }
    throw new Error(`KronosChamber server copy not found. Checked: ${candidateRoots().join(", ")}`);
}

function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port, "127.0.0.1");
    });
}

async function pickPort(): Promise<number> {
    if (await isPortAvailable(DefaultPort)) {
        return DefaultPort;
    }
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : DefaultPort;
            server.close(() => resolve(port));
        });
    });
}

function requestHealth(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`${url}/health`, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                try {
                    resolve(res.statusCode === 200 && isKronosChamberReady(JSON.parse(body)));
                } catch {
                    resolve(false);
                }
            });
        });
        req.once("error", () => resolve(false));
        req.setTimeout(2_000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function postRuntimeJwt(url: string, token: CommandCreateSurfaceTokenRtnData, surfaceId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(makeRuntimeTokenPayload(token, surfaceId));
        const request = http.request(`${url}/api/kronterm/runtime-token`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
                "x-authkey": AuthKey,
            },
        });
        request.once("response", (response) => {
            response.resume();
            if (response.statusCode === 204) {
                resolve();
                return;
            }
            reject(new Error(`KronosChamber rejected the refreshed JWT (${response.statusCode ?? "unknown"})`));
        });
        request.once("error", reject);
        request.setTimeout(2_000, () => request.destroy(new Error("KronosChamber JWT refresh timed out")));
        request.end(body);
    });
}

async function issueSurfaceJwt(context: ChatHubV2SurfaceContext): Promise<CommandCreateSurfaceTokenRtnData | null> {
    if (!context.tabId) {
        return null;
    }
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("KronTerm JWT issuance timed out")), JwtIssueTimeoutMs);
        timeout.unref();
        void RpcApi.CreateSurfaceTokenCommand(ElectronWshClient, makeSurfaceTokenRequest(context)).then(
            (token) => {
                clearTimeout(timeout);
                resolve(token);
            },
            (err) => {
                clearTimeout(timeout);
                reject(err);
            }
        );
    });
}

function surfaceKey(context: ChatHubV2SurfaceContext): string {
    return context.surfaceId ?? `${context.tabId ?? "global"}:${context.blockId ?? ""}`;
}

function rememberSurfaceContext(context: ChatHubV2SurfaceContext): ChatHubV2SurfaceContext {
    const key = surfaceKey(context);
    const current = surfaceContexts.get(key) ?? null;
    const scoped = preferScopedSurfaceContext(current, context) ?? makeStartupSurfaceContext(context);
    surfaceContexts.set(key, scoped);
    return scoped;
}

function clearJwtRefreshTimers(): void {
    for (const timer of jwtRefreshTimers.values()) {
        clearTimeout(timer);
    }
    jwtRefreshTimers.clear();
}

function scheduleJwtRefresh(expiresAt: number, context: ChatHubV2SurfaceContext): void {
    const key = surfaceKey(context);
    const current = jwtRefreshTimers.get(key);
    if (current) {
        clearTimeout(current);
    }
    const delay = Math.max(30_000, expiresAt - Date.now() - JwtRefreshLeadMs);
    const timer = setTimeout(() => {
        void refreshRuntimeJwt(context);
    }, delay);
    timer.unref();
    jwtRefreshTimers.set(key, timer);
}

async function refreshRuntimeJwt(context: ChatHubV2SurfaceContext): Promise<void> {
    if (!context.tabId) {
        return;
    }
    try {
        const sessionToken = await issueSurfaceJwt(context);
        if (!sessionToken) {
            return;
        }
        if (state?.url && child && !child.killed) {
            await postRuntimeJwt(state.url, sessionToken, context.surfaceId);
        }
        scheduleJwtRefresh(sessionToken.expiresat, context);
    } catch (err) {
        appendLog(`JWT refresh failed: ${err instanceof Error ? err.message : String(err)}`);
        const timer = setTimeout(() => void refreshRuntimeJwt(context), 30_000);
        timer.unref();
        jwtRefreshTimers.set(surfaceKey(context), timer);
    }
}

async function waitForHealth(url: string, isProcessRunning: () => boolean): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < HealthTimeoutMs) {
        if (!isProcessRunning()) {
            throw new Error("KronosChamber exited before its backend became ready");
        }
        if (await requestHealth(url)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for KronosChamber backend at ${url}`);
}

function buildPathEnv(): string {
    const segments = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        path.join(os.homedir(), ".kronoscode", "bin"),
        path.join(os.homedir(), ".local", "bin"),
        path.join(os.homedir(), ".bun", "bin"),
        path.join(os.homedir(), ".cargo", "bin"),
        path.join(os.homedir(), "bin"),
        getWshBinDir(),
        process.env.PATH ?? "",
    ];
    return Array.from(new Set(segments.flatMap((segment) => segment.split(path.delimiter)).filter(Boolean))).join(
        path.delimiter
    );
}

function resolveKronosCodeBinary(): string | undefined {
    for (const key of ["KRONOSCODE_BINARY", "KRONOSCODE_PATH", "OPENCHAMBER_KRONOSCODE_BIN"]) {
        const value = process.env[key]?.trim();
        if (value) {
            return value;
        }
    }
    const candidates = [
        path.join(os.homedir(), ".kronoscode", "bin", "kronoscode"),
        path.join(os.homedir(), ".bun", "bin", "kronoscode"),
        path.join(os.homedir(), ".local", "bin", "kronoscode"),
        "/opt/homebrew/bin/kronoscode",
        "/usr/local/bin/kronoscode",
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
}

function makeRuntimeHealth(status: ChatHubV2RuntimeHealth["status"], startupError?: string): ChatHubV2RuntimeHealth {
    const detectedRoot = findKronosChamberRoot();
    const serverPath = detectedRoot ? path.join(detectedRoot, "server", "index.js") : undefined;
    const distPath = detectedRoot ? path.join(detectedRoot, "dist") : undefined;
    const kronosCodeBinary = resolveKronosCodeBinary();
    const error = startupError ?? lastStartupError;

    return {
        runtime: "kronoscode-kronoschamber",
        status,
        checkedAt: Date.now(),
        candidateRoots: candidateRoots(),
        ...(detectedRoot ? { detectedRoot } : {}),
        ...(serverPath ? { serverPath } : {}),
        ...(distPath ? { distPath } : {}),
        ...(kronosCodeBinary ? { kronosCodeBinary } : {}),
        ...(error ? { startupError: error } : {}),
        logExcerpt: logExcerpt.slice(-8),
        supportedProviders: ["KronosCode runtime defaults"],
        supportedModels: ["KronosCode runtime defaults"],
        recoveryActions: ["retry", "open-settings", "inspect-logs"],
    };
}

function getWshBinDir(): string {
    return path.join(getWaveDataDir(), "bin");
}

function getWaveSockPath(): string {
    return path.join(getWaveDataDir(), "wave.sock");
}

export async function startChatHubV2Server(context: ChatHubV2SurfaceContext = {}): Promise<ChatHubV2ServerState> {
    const startupContext = makeStartupSurfaceContext(context);
    const scopedContext = rememberSurfaceContext(context);
    if (state && child && !child.killed) {
        if (context.tabId) {
            await refreshRuntimeJwt(scopedContext);
        }
        return state;
    }
    if (startPromise) {
        const serverState = await startPromise;
        if (context.tabId) {
            await refreshRuntimeJwt(scopedContext);
        }
        return serverState;
    }

    startPromise = (async () => {
        let root: string;
        try {
            root = resolveKronosChamberRoot();
        } catch (err) {
            lastStartupError = err instanceof Error ? err.message : String(err);
            appendLog(lastStartupError);
            throw err;
        }
        const serverPath = path.join(root, "server", "index.js");
        const distPath = path.join(root, "dist");
        for (const helper of ensureNodePtySpawnHelperExecutable(root)) {
            appendLog(`repaired node-pty helper permissions: ${helper}`);
        }
        const port = await pickPort();
        const url = `http://127.0.0.1:${port}`;
        const connection = await KronosCodeRuntime.ensure();
        const internalConnection = KronosCodeRuntime.getInternalConnection();
        const backendUrl = new URL(connection.baseUrl);
        const canForwardDesktopCapabilities =
            backendUrl.hostname === "127.0.0.1" ||
            backendUrl.hostname === "localhost" ||
            backendUrl.hostname === "::1" ||
            backendUrl.hostname === "[::1]";
        const kronosCodeBinary = resolveKronosCodeBinary();
        const workspace = process.cwd();
        let sessionToken: CommandCreateSurfaceTokenRtnData | null = null;
        try {
            sessionToken = canForwardDesktopCapabilities
                ? await issueSurfaceJwt(scopedContext ?? startupContext)
                : null;
        } catch (err) {
            appendLog(`initial JWT unavailable: ${err instanceof Error ? err.message : String(err)}`);
        }
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            OPENCHAMBER_HOST: "127.0.0.1",
            OPENCHAMBER_DIST_DIR: distPath,
            OPENCHAMBER_RUNTIME: "desktop",
            OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER: "sandbox-mcp",
            OPENCHAMBER_DESKTOP_SANDBOX_USE_BROKER: "false",
            OPENCHAMBER_SANDBOX_MCP_AUTO_INSTALL: "true",
            KRONOSCHAMBER_DESKTOP_NOTIFY: "true",
            KRONOSCODE_CLIENT: "desktop",
            KRONOSCODE_DISABLE_AUTOUPDATE: "1",
            KRONOSCODE_ENABLE_AI_BROWSER: "true",
            OPENCHAMBER_DISABLE_OPENCODE_AUTODETECT: "true",
            OPENCHAMBER_SKIP_OPENCODE_START: "true",
            OPENCODE_SKIP_START: "true",
            KRONOSCODE_SERVER_URL: connection.baseUrl,
            OPENCODE_SERVER_URL: connection.baseUrl,
            KRONOSCODE_SERVER_USERNAME: internalConnection?.username ?? "kronoscode",
            OPENCODE_SERVER_USERNAME: internalConnection?.username ?? "kronoscode",
            ...(internalConnection?.password
                ? {
                      KRONOSCODE_SERVER_PASSWORD: internalConnection.password,
                      OPENCODE_SERVER_PASSWORD: internalConnection.password,
                  }
                : {}),
            ...(backendUrl.port ? { OPENCHAMBER_OPENCODE_PORT: backendUrl.port } : {}),
            KRONTERM_CHATHUB_CHAT_ONLY: "true",
            OPENCHAMBER_CHAT_ONLY: "true",
            KRONTERM_CHAMBER_PROTOCOL_VERSION: String(ChamberProtocolVersion),
            ...(fs.existsSync(path.join(workspace, ".git")) ? { KRONTERM_WORKSPACE: workspace } : {}),
            WAVETERM: "1",
            KRONTERM: "1",
            [WaveAuthKeyEnv]: AuthKey,
            KRONTERM_DATA_HOME: getWaveDataDir(),
            KRONTERM_CONFIG_HOME: getWaveConfigDir(),
            WAVETERM_DATA_HOME: getWaveDataDir(),
            WAVETERM_CONFIG_HOME: getWaveConfigDir(),
            [WaveAppPathVarName]: getElectronAppUnpackedBasePath(),
            [WaveAppResourcesPathVarName]: getElectronAppResourcesPath(),
            [WaveAppElectronExecPath]: getElectronExecPath(),
            WAVETERM_WSH_BIN: path.join(getWshBinDir(), "wsh"),
            WAVETERM_WSH_BIN_DIR: getWshBinDir(),
            WAVETERM_WSH_SOCKET: getWaveSockPath(),
            WAVETERM_WEB_ENDPOINT: getWebServerEndpoint(),
            WAVETERM_WS_ENDPOINT: getWSServerEndpoint(),
            KRONTERM_WEB_ENDPOINT: getWebServerEndpoint(),
            KRONTERM_WS_ENDPOINT: getWSServerEndpoint(),
            NO_PROXY: "localhost,127.0.0.1",
            no_proxy: "localhost,127.0.0.1",
            PATH: buildPathEnv(),
        };
        if (kronosCodeBinary) {
            env.KRONOSCODE_BINARY = kronosCodeBinary;
        }
        const krondesignCliPath = path.join(repoRoot(), "krondesign", "apps", "daemon", "dist", "cli.js");
        if (fs.existsSync(krondesignCliPath)) {
            env.KRONDESIGN_CLI_PATH = krondesignCliPath;
            env.KRONDESIGN_DAEMON_URL = "http://127.0.0.1:7456";
        }

        const spawnedChild = spawn(process.execPath, [serverPath, "--port", String(port)], {
            cwd: root,
            env,
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        child = spawnedChild;
        child.on("message", (message) => {
            if (typeof message !== "object" || message == null) {
                return;
            }
            const event = message as { type?: string; port?: number };
            if (event.type === "openchamber:ready") {
                appendLog(`backend listening on port ${event.port ?? port}`);
            }
        });
        child.stdout.on("data", (chunk) => {
            const line = String(chunk).trimEnd();
            appendLog(line);
            if (process.env.NODE_ENV !== "production") {
                console.log(`[chathubv2] ${line}`);
            }
        });
        child.stderr.on("data", (chunk) => {
            const line = String(chunk).trimEnd();
            appendLog(line);
            if (process.env.NODE_ENV !== "production") {
                console.log(`[chathubv2:err] ${line}`);
            }
        });
        child.on("exit", (code, signal) => {
            const exitLine = `backend exited code=${code ?? "null"} signal=${signal ?? "none"}`;
            appendLog(exitLine);
            if (code !== 0 && code !== null) {
                console.warn(`[chathubv2] ${exitLine}`);
            }
            if (state?.port === port) {
                state = null;
            }
            child = null;
            startPromise = null;
        });

        state = {
            url,
            port,
            pid: child.pid,
            serverPath,
            distPath,
            ready: false,
            health: makeRuntimeHealth("starting"),
        };
        try {
            await waitForHealth(
                url,
                () => child === spawnedChild && spawnedChild.exitCode == null && !spawnedChild.killed
            );
        } catch (err) {
            lastStartupError = err instanceof Error ? err.message : String(err);
            appendLog(`readiness failed: ${lastStartupError}`);
            const failedChild = child;
            child = null;
            state = null;
            if (failedChild && !failedChild.killed) {
                failedChild.kill("SIGTERM");
            }
            throw err;
        }
        if (!child || child.killed || state?.port !== port) {
            throw new Error("KronosChamber exited before its backend became ready");
        }
        lastStartupError = undefined;
        state = { ...state, ready: true, health: makeRuntimeHealth("ready") };
        if (sessionToken) {
            await postRuntimeJwt(url, sessionToken, scopedContext.surfaceId);
            scheduleJwtRefresh(sessionToken.expiresat, scopedContext);
        } else if (canForwardDesktopCapabilities && scopedContext.tabId) {
            await refreshRuntimeJwt(scopedContext);
        }
        return state;
    })();

    try {
        return await startPromise;
    } finally {
        startPromise = null;
    }
}

export function getChatHubV2ServerStatus(): ChatHubV2ServerState | null {
    return state;
}

export function getChatHubV2RuntimeHealth(): ChatHubV2RuntimeHealth {
    if (state?.ready) {
        return makeRuntimeHealth("ready");
    }
    if (state) {
        return makeRuntimeHealth("starting");
    }
    if (lastStartupError) {
        return makeRuntimeHealth("error", lastStartupError);
    }
    return makeRuntimeHealth(findKronosChamberRoot() ? "stopped" : "not-found");
}

export function stopChatHubV2Server(): void {
    clearJwtRefreshTimers();
    surfaceContexts.clear();
    const current = child;
    child = null;
    state = null;
    startPromise = null;
    if (!current || !isChildProcessRunning(current)) {
        return;
    }
    current.kill("SIGTERM");
    setTimeout(() => {
        if (isChildProcessRunning(current)) {
            current.kill("SIGKILL");
        }
    }, 2_000).unref();
}
