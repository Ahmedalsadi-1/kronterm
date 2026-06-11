// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Audio engine lifecycle management for the Electron main process.
// Spawns the Python voice engine as a child process and relays JSON-RPC
// messages between the renderer (React) and the Python process.

import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import * as readline from "readline";

const AudioEngineDir = path.resolve(homedir(), "kronterm", "audio-engine");
const AudioEngineScript = path.resolve(AudioEngineDir, "main.py");

let audioProc: ChildProcess | null = null;
let audioReadyResolve: (value: boolean) => void;
const audioReady: Promise<boolean> = new Promise((resolve) => {
    audioReadyResolve = resolve;
});

// Event dispatchers registered by the IPC handler
let onTranscript: ((text: string) => void) | null = null;
let onStatusChange: ((status: string) => void) | null = null;
let onError: ((message: string) => void) | null = null;

export function registerAudioCallbacks(cbs: {
    onTranscript?: (text: string) => void;
    onStatusChange?: (status: string) => void;
    onError?: (message: string) => void;
}): void {
    if (cbs.onTranscript) onTranscript = cbs.onTranscript;
    if (cbs.onStatusChange) onStatusChange = cbs.onStatusChange;
    if (cbs.onError) onError = cbs.onError;
}

export function getAudioProc(): ChildProcess | null {
    return audioProc;
}

export function getAudioReady(): Promise<boolean> {
    return audioReady;
}

async function isPythonAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn("python3", ["--version"], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        proc.on("exit", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
    });
}

async function installDeps(): Promise<boolean> {
    return new Promise((resolvePromise) => {
        const reqFile = path.resolve(AudioEngineDir, "requirements.txt");
        if (!existsSync(reqFile)) {
            resolvePromise(true);
            return;
        }
        const proc = spawn("pip3", ["install", "-r", reqFile], {
            cwd: AudioEngineDir,
            stdio: ["ignore", "pipe", "pipe"],
        });
        proc.on("exit", (code) => resolvePromise(code === 0));
        proc.on("error", () => resolvePromise(false));
    });
}

export async function runAudioEngine(): Promise<boolean> {
    if (audioProc != null && audioProc.exitCode == null) {
        console.log("audio engine already running");
        return true;
    }

    const pythonOk = await isPythonAvailable();
    if (!pythonOk) {
        console.log("python3 not found — audio engine unavailable");
        audioReadyResolve(false);
        return false;
    }

    if (!existsSync(AudioEngineScript)) {
        console.log(`audio engine script not found at ${AudioEngineScript}`);
        audioReadyResolve(false);
        return false;
    }

    await installDeps();

    console.log("starting audio engine...");
    const proc = spawn("python3", [AudioEngineScript], {
        cwd: AudioEngineDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    audioProc = proc;

    // Read JSON-RPC messages from stdout
    const rl = readline.createInterface({
        input: proc.stdout,
        terminal: false,
    });

    rl.on("line", (line) => {
        try {
            const msg = JSON.parse(line);
            // Events have null id
            if (msg.id == null && msg.method) {
                switch (msg.method) {
                    case "ready":
                        console.log("audio engine ready:", msg.params?.version);
                        audioReadyResolve(true);
                        break;
                    case "transcript":
                        onTranscript?.(msg.params?.text ?? "");
                        break;
                    case "speaking":
                        onStatusChange?.("speaking");
                        break;
                    case "listening":
                        onStatusChange?.(msg.params?.listening ? "listening" : "idle");
                        break;
                    case "error":
                        onError?.(msg.params?.message ?? "Unknown error");
                        break;
                }
            }
        } catch (e) {
            console.log("audio engine: failed to parse message", line, e);
        }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
            console.log("audio-engine stderr:", text);
        }
    });

    proc.on("error", (err) => {
        console.log("audio engine error:", err.message);
        audioProc = null;
        audioReadyResolve(false);
    });

    proc.on("exit", (code, signal) => {
        console.log(`audio engine exited (code=${code}, signal=${signal})`);
        audioProc = null;
        onStatusChange?.("idle");
    });

    // Wait for ready (up to 10s)
    const timeout = setTimeout(() => {
        console.log("audio engine startup timed out");
        audioReadyResolve(false);
    }, 10000);

    const ready = await audioReady;
    clearTimeout(timeout);
    return ready;
}

function sendCommand(method: string, params?: Record<string, unknown>): void {
    if (audioProc == null || audioProc.stdin == null) {
        console.log("audio engine not running");
        return;
    }
    const msg = JSON.stringify({ id: 1, method, params: params ?? {} });
    audioProc.stdin.write(msg + "\n");
}

// ── Commands exposed to IPC ────────────────────────────────────

export function audioStartListening(): void {
    sendCommand("start_listening");
}

export function audioStopListening(): void {
    sendCommand("stop_listening");
}

export function audioSpeak(text: string): void {
    sendCommand("speak", { text });
}

export function audioSetWakeWord(enabled: boolean): void {
    sendCommand("set_wake_word", { enabled });
}

export function audioGetStatus(): void {
    sendCommand("get_status");
}

export function audioShutdown(): void {
    if (audioProc == null) return;
    sendCommand("shutdown");
    setTimeout(() => {
        if (audioProc && audioProc.exitCode == null) {
            audioProc.kill("SIGKILL");
        }
        audioProc = null;
    }, 3000);
}
