// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Krondesign daemon lifecycle management for the Electron main process.
// Starts the krondesign Express daemon through the repo manager script so the
// daemon consistently runs under Node 24, which its better-sqlite3 build needs.

import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const KrondesignPort = 7456;
const KrondesignHealthUrl = `http://127.0.0.1:${KrondesignPort}/api/health`;

// Resolve paths relative to user's kronterm checkout
const KrontermHome = resolve(homedir(), "kronterm");
const KrondesignHome = resolve(KrontermHome, "krondesign");
const KrondesignManagerScript = resolve(KrontermHome, "scripts/krondesign-manager.sh");

let krondesignProc: ChildProcess | null = null;
let krondesignReadyResolve = (value: boolean) => {};
const krondesignReady: Promise<boolean> = new Promise((resolve) => {
    krondesignReadyResolve = resolve;
});

export function getKrondesignUrl(): string {
    return `http://127.0.0.1:${KrondesignPort}`;
}

export function getKrondesignProc(): ChildProcess | null {
    return krondesignProc;
}

export async function isKrondesignHealthy(): Promise<boolean> {
    return await healthCheck();
}

export function getKrondesignReady(): Promise<boolean> {
    return krondesignReady;
}

async function healthCheck(): Promise<boolean> {
    try {
        const resp = await fetch(KrondesignHealthUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(2000),
        });
        return resp.ok;
    } catch {
        return false;
    }
}

export async function runKrondesignDaemon(): Promise<boolean> {
    if (await healthCheck()) {
        console.log("krondesign daemon already healthy");
        krondesignReadyResolve(true);
        return true;
    }

    if (krondesignProc != null && krondesignProc.exitCode == null) {
        console.log("krondesign manager already running");
        return false;
    }

    if (!existsSync(KrondesignManagerScript)) {
        console.log(
            `krondesign manager not found at ${KrondesignManagerScript} — skipping auto-start. ` +
                "Run './scripts/krondesign-manager.sh start' from the kronterm checkout."
        );
        krondesignReadyResolve(false);
        return false;
    }

    console.log(`starting krondesign daemon on port ${KrondesignPort}...`);

    const proc = spawn("/bin/bash", [KrondesignManagerScript, "restart"], {
        cwd: KrontermHome,
        env: { ...process.env, KRD_PORT: String(KrondesignPort) },
        stdio: ["ignore", "pipe", "pipe"],
    });

    krondesignProc = proc;

    let stderrBuf = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuf += text;
        process.stderr.write(text); // forward to Electron's stderr
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
        process.stdout.write(chunk.toString());
    });

    proc.on("error", (err) => {
        console.log("krondesign daemon error:", err.message);
        krondesignProc = null;
        krondesignReadyResolve(false);
    });

    proc.on("exit", (code, signal) => {
        console.log(`krondesign manager exited (code=${code}, signal=${signal})`);
        krondesignProc = null;
    });

    // Wait for health check (up to 15s)
    for (let i = 0; i < 15; i++) {
        if (await healthCheck()) {
            console.log(`krondesign daemon ready — http://127.0.0.1:${KrondesignPort}`);
            krondesignReadyResolve(true);
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("krondesign daemon health check timed out.");
    console.log("stderr:", stderrBuf.slice(-500));
    krondesignReadyResolve(false);
    return false;
}

export function stopKrondesignDaemon(): void {
    if (krondesignProc == null) {
        return;
    }
    console.log("stopping krondesign daemon...");
    const proc = krondesignProc;
    krondesignProc = null;

    spawn("/bin/bash", [KrondesignManagerScript, "stop"], {
        cwd: KrontermHome,
        env: { ...process.env, KRD_PORT: String(KrondesignPort) },
        stdio: "ignore",
        detached: true,
    }).unref();

    let killed = false;
    setTimeout(() => {
        if (!killed && proc.exitCode == null) {
            console.log("krondesign manager did not exit, sending SIGKILL");
            proc.kill("SIGKILL");
        }
        killed = true;
    }, 5000);
}
