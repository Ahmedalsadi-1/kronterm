// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const StartupTimeoutMs = 90_000;
const HealthTimeoutMs = 10_000;

export type HermesConnectionDescriptor = {
    baseUrl: string;
    wsUrl: string;
    token: string;
    pid: number;
};

function existingExecutable(candidate: string | undefined): string | undefined {
    if (!candidate) {
        return undefined;
    }
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
    } catch {
        return undefined;
    }
}

export function parseHermesReadyPort(output: string): number | undefined {
    const match = /(?:^|\n)HERMES_(?:BACKEND|DASHBOARD)_READY port=(\d+)(?:\r?$|\s)/m.exec(output);
    if (!match) {
        return undefined;
    }
    const port = Number(match[1]);
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined;
}

function resolveHermesBinary(): string {
    const homeDir = os.homedir();
    const executable = process.platform === "win32" ? "hermes.exe" : "hermes";
    const candidates = [
        process.env.KRONTERM_HERMES_BIN,
        process.env.HERMES_BIN,
        path.join(
            homeDir,
            ".hermes",
            "venvs",
            "kronterm-hermes",
            process.platform === "win32" ? "Scripts" : "bin",
            executable
        ),
        path.join(homeDir, ".hermes", "bin", executable),
        path.join(homeDir, ".local", "bin", executable),
        process.platform === "darwin" ? `/opt/homebrew/bin/${executable}` : undefined,
        process.platform === "darwin" ? `/usr/local/bin/${executable}` : undefined,
    ];
    for (const candidate of candidates) {
        const resolved = existingExecutable(candidate);
        if (resolved) {
            return resolved;
        }
    }

    const lookup = spawnSync(process.platform === "win32" ? "where" : "which", [executable], {
        encoding: "utf8",
        windowsHide: true,
    });
    const fromPath = lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/, 1)[0] : undefined;
    const resolved = existingExecutable(fromPath);
    if (resolved) {
        return resolved;
    }

    throw new Error(
        "Hermes is not installed. Run the KronTerm Hermes installer or set KRONTERM_HERMES_BIN to the Hermes executable."
    );
}

function makeHermesPath(binary: string): string {
    const entries = [path.dirname(binary), process.env.PATH].filter(Boolean);
    return entries.join(path.delimiter);
}

class ManagedHermesRuntime extends EventEmitter {
    private child: ChildProcessWithoutNullStreams | null = null;
    private connection: HermesConnectionDescriptor | null = null;
    private startPromise: Promise<HermesConnectionDescriptor> | null = null;
    private restartTimer: NodeJS.Timeout | null = null;
    private stopping = false;

    ensure(): Promise<HermesConnectionDescriptor> {
        if (this.connection && this.child && this.child.exitCode == null) {
            return Promise.resolve(this.connection);
        }
        if (this.startPromise) {
            return this.startPromise;
        }
        this.startPromise = this.start()
            .catch((error) => {
                this.scheduleRestart();
                throw error;
            })
            .finally(() => {
                this.startPromise = null;
            });
        return this.startPromise;
    }

    private scheduleRestart(): void {
        if (this.stopping || this.restartTimer) {
            return;
        }
        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            void this.ensure().catch((error) => console.log("Hermes automatic restart failed", error));
        }, 1_000);
    }

    private async start(): Promise<HermesConnectionDescriptor> {
        const binary = resolveHermesBinary();
        const token = randomBytes(32).toString("base64url");
        const child = spawn(binary, ["serve", "--host", "127.0.0.1", "--port", "0"], {
            env: {
                ...process.env,
                HERMES_DASHBOARD_SESSION_TOKEN: token,
                HERMES_DESKTOP: "1",
                HERMES_PARENT_PID: String(process.pid),
                PATH: makeHermesPath(binary),
            },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });
        this.child = child;
        this.stopping = false;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
            stderr = `${stderr}${chunk}`.slice(-8_000);
            console.log(`[hermes] ${chunk.trimEnd()}`);
        });

        const port = await new Promise<number>((resolve, reject) => {
            let settled = false;
            const finish = (error?: Error, readyPort?: number) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                child.removeListener("error", onError);
                child.removeListener("exit", onEarlyExit);
                if (error) {
                    reject(error);
                    return;
                }
                resolve(readyPort!);
            };
            const onError = (error: Error) => finish(error);
            const onEarlyExit = (code: number | null, signal: NodeJS.Signals | null) =>
                finish(
                    new Error(
                        `Hermes exited before becoming ready (code ${String(code)}, signal ${String(signal)}). ${stderr.trim()}`
                    )
                );
            const timer = setTimeout(() => {
                child.kill();
                finish(
                    new Error(`Hermes did not become ready within ${StartupTimeoutMs / 1000} seconds. ${stderr.trim()}`)
                );
            }, StartupTimeoutMs);

            child.on("error", onError);
            child.on("exit", onEarlyExit);
            child.stdout.on("data", (chunk: string) => {
                stdout = `${stdout}${chunk}`.slice(-8_000);
                console.log(`[hermes] ${chunk.trimEnd()}`);
                const readyPort = parseHermesReadyPort(stdout);
                if (readyPort) {
                    finish(undefined, readyPort);
                }
            });
        });

        const baseUrl = `http://127.0.0.1:${port}`;
        try {
            const response = await fetch(`${baseUrl}/api/status`, {
                headers: { "X-Hermes-Session-Token": token },
                signal: AbortSignal.timeout(HealthTimeoutMs),
            });
            if (!response.ok) {
                throw new Error(`Hermes health check failed with HTTP ${response.status}.`);
            }
        } catch (error) {
            child.kill();
            if (this.child === child) {
                this.child = null;
            }
            throw error;
        }

        const descriptor: HermesConnectionDescriptor = {
            baseUrl,
            wsUrl: `ws://127.0.0.1:${port}/api/ws?token=${encodeURIComponent(token)}`,
            token,
            pid: child.pid!,
        };
        this.connection = descriptor;
        this.emit("connection", descriptor);
        child.once("exit", (code, signal) => {
            this.child = null;
            this.connection = null;
            if (!this.stopping) {
                console.log(`[hermes] backend exited (code ${String(code)}, signal ${String(signal)})`);
                this.scheduleRestart();
            }
        });
        console.log(`[hermes] managed backend ready at ${baseUrl} (pid ${descriptor.pid})`);
        return descriptor;
    }

    stop(): void {
        this.stopping = true;
        this.connection = null;
        this.startPromise = null;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        const child = this.child;
        this.child = null;
        if (!child || child.exitCode != null) {
            return;
        }
        child.kill("SIGTERM");
    }
}

export const HermesRuntime = new ManagedHermesRuntime();
