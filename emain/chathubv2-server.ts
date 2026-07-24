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
    makeSurfaceEnvironment,
    makeSurfaceTokenRequest,
    type ChatHubV2SurfaceContext,
} from "./chathubv2-context";
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
let surfaceContext: ChatHubV2SurfaceContext | null = null;
let jwtRefreshTimer: NodeJS.Timeout | null = null;

const DefaultPort = 3107;
const DefaultKronosCodePort = 4096;
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
        const req = http.get(`${url}/readyz`, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                try {
                    const health = JSON.parse(body) as { ready?: boolean; protocolVersion?: number };
                    resolve(
                        res.statusCode === 200 &&
                            health.ready === true &&
                            health.protocolVersion === ChamberProtocolVersion
                    );
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

function postRuntimeJwt(url: string, token: CommandCreateSurfaceTokenRtnData): Promise<void> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(makeRuntimeTokenPayload(token));
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

function clearJwtRefreshTimer(): void {
    if (jwtRefreshTimer) {
        clearTimeout(jwtRefreshTimer);
        jwtRefreshTimer = null;
    }
}

function scheduleJwtRefresh(expiresAt: number): void {
    clearJwtRefreshTimer();
    const delay = Math.max(30_000, expiresAt - Date.now() - JwtRefreshLeadMs);
    jwtRefreshTimer = setTimeout(() => {
        void refreshRuntimeJwt();
    }, delay);
    jwtRefreshTimer.unref();
}

async function refreshRuntimeJwt(): Promise<void> {
    if (!surfaceContext?.tabId) {
        return;
    }
    try {
        const sessionToken = await issueSurfaceJwt(surfaceContext);
        if (!sessionToken) {
            return;
        }
        if (state?.url && child && !child.killed) {
            await postRuntimeJwt(state.url, sessionToken);
        }
        scheduleJwtRefresh(sessionToken.expiresat);
    } catch (err) {
        appendLog(`JWT refresh failed: ${err instanceof Error ? err.message : String(err)}`);
        jwtRefreshTimer = setTimeout(() => void refreshRuntimeJwt(), 30_000);
        jwtRefreshTimer.unref();
    }
}

async function waitForHealth(url: string): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < HealthTimeoutMs) {
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
    if (context.tabId) {
        surfaceContext = makeStartupSurfaceContext(context);
    }
    if (state && child && !child.killed) {
        if (context.tabId) {
            void refreshRuntimeJwt();
        }
        return state;
    }
    if (startPromise) {
        return startPromise.then((serverState) => {
            if (context.tabId) {
                void refreshRuntimeJwt();
            }
            return serverState;
        });
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
        const port = await pickPort();
        const url = `http://127.0.0.1:${port}`;
        const kronosCodeBinary = resolveKronosCodeBinary();
        let sessionToken: CommandCreateSurfaceTokenRtnData | null = null;
        try {
            sessionToken = await issueSurfaceJwt(startupContext);
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
            OPENCHAMBER_OPENCODE_PORT: process.env.OPENCHAMBER_OPENCODE_PORT ?? String(DefaultKronosCodePort),
            KRONTERM_CHATHUB_CHAT_ONLY: "true",
            OPENCHAMBER_CHAT_ONLY: "true",
            KRONTERM_CHAMBER_PROTOCOL_VERSION: String(ChamberProtocolVersion),
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
        if (sessionToken) {
            Object.assign(env, makeSurfaceEnvironment(sessionToken));
        }
        if (kronosCodeBinary) {
            env.KRONOSCODE_BINARY = kronosCodeBinary;
        }

        child = spawn(process.execPath, [serverPath, "--port", String(port)], {
            cwd: root,
            env,
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
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
            await waitForHealth(url);
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
            scheduleJwtRefresh(sessionToken.expiresat);
        } else if (surfaceContext?.tabId) {
            void refreshRuntimeJwt();
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
    clearJwtRefreshTimer();
    const current = child;
    child = null;
    state = null;
    startPromise = null;
    if (!current || current.killed) {
        return;
    }
    current.kill("SIGTERM");
    setTimeout(() => {
        if (!current.killed) {
            current.kill("SIGKILL");
        }
    }, 5_000).unref();
}
