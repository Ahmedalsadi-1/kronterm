// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { getWaveDataDir } from "./emain-platform";

let audioProc: ChildProcess = null;
let nextRequestId = 1;
let readyPromise: Promise<boolean> | null = null;
let readyResolve: ((ready: boolean) => void) | null = null;
let status = "idle";
let callbacks: AudioCallbacks = {};

type AudioCallbacks = {
    onStatusChange?: (status: string) => void;
    onTranscript?: (text: string) => void;
    onError?: (message: string) => void;
};

export async function runAudioEngine(): Promise<boolean> {
    if (audioProc) {
        return true;
    }
    const audioEngineDir = resolveAudioEngineDir();
    const mainPy = join(audioEngineDir, "main.py");
    const python = resolvePythonBinary();
    if (!audioEngineDir || !existsSync(mainPy) || !python) {
        callbacks.onError?.("Audio engine is unavailable");
        updateStatus("idle");
        return false;
    }
    readyPromise = new Promise((resolve) => {
        readyResolve = resolve;
    });
    const dataDir = getWaveDataDir();
    const proc = spawn(python, [mainPy], {
        cwd: audioEngineDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
            ...process.env,
            PATH: buildPathEnv(),
            WAVE_DATA_DIR: dataDir,
        },
    });
    audioProc = proc;

    proc.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().trim().split("\n");
        for (const line of lines) {
            try {
                const msg = JSON.parse(line);
                handleAudioMessage(msg);
            } catch {
                console.log("[audio-engine:stdout]", line);
            }
        }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
        console.log("[audio-engine:stderr]", chunk.toString().trim());
    });

    proc.on("error", (err) => {
        console.log("[audio-engine] failed to start", err);
        audioProc = null;
        callbacks.onError?.(err.message);
        updateStatus("idle");
        readyResolve?.(false);
        readyResolve = null;
        readyPromise = null;
    });

    proc.on("exit", (code, signal) => {
        console.log("[audio-engine] exited", code !== null ? `code=${code}` : `signal=${signal}`);
        audioProc = null;
        updateStatus("idle");
        readyResolve?.(false);
        readyResolve = null;
        readyPromise = null;
    });

    return readyPromise;
}

function resolveAudioEngineDir(): string {
    const candidates = [
        join(process.cwd(), "audio-engine"),
        join(__dirname, "..", "audio-engine"),
        join(process.resourcesPath ?? "", "audio-engine"),
    ];
    return candidates.filter((candidate): candidate is string => Boolean(candidate)).find((candidate) => existsSync(join(candidate, "main.py")));
}

function resolvePythonBinary(): string {
    const candidates = [
        process.env.PYTHON,
        process.env.PYTHON3,
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        join(os.homedir(), ".local", "bin", "python3"),
    ];
    return candidates.filter((candidate): candidate is string => Boolean(candidate)).find((candidate) => existsSync(candidate));
}

function buildPathEnv(): string {
    return [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        process.env.PATH ?? "",
    ]
        .filter(Boolean)
        .join(":");
}

function handleAudioMessage(msg: any): void {
    const method = msg.method ?? msg.type;
    const params = msg.params ?? {};
    switch (method) {
        case "ready":
            readyResolve?.(true);
            readyResolve = null;
            readyPromise = null;
            updateStatus("idle");
            break;
        case "listening":
            updateStatus(params.listening ? "listening" : "idle");
            break;
        case "speaking":
            updateStatus(params.text ? "speaking" : "idle");
            break;
        case "transcript":
            callbacks.onTranscript?.(params.text ?? msg.text ?? "");
            updateStatus("idle");
            break;
        case "state":
            updateStatus(params.status ?? msg.status ?? status);
            break;
        case "error":
            callbacks.onError?.(params.message ?? msg.message ?? "Audio engine error");
            updateStatus("error");
            break;
    }
}

function sendAudioCommand(method: string, params: Record<string, any> = {}): void {
    if (!audioProc?.stdin || audioProc.stdin.destroyed) {
        callbacks.onError?.("Audio engine is not running");
        return;
    }
    audioProc.stdin.write(`${JSON.stringify({ id: nextRequestId++, method, params })}\n`);
}

function updateStatus(nextStatus: string): void {
    status = nextStatus;
    callbacks.onStatusChange?.(status);
}

export function registerAudioCallbacks(nextCallbacks: AudioCallbacks): void {
    callbacks = nextCallbacks;
}

export function audioGetStatus(): string {
    return status;
}

export function audioStartListening(): void {
    sendAudioCommand("start_listening");
}

export function audioStopListening(): void {
    sendAudioCommand("stop_listening");
}

export function audioSpeak(text: string): void {
    sendAudioCommand("speak", { text });
}

export function audioSetWakeWord(enabled: boolean): void {
    sendAudioCommand("set_wake_word", { enabled });
}

export function audioShutdown(): void {
    sendAudioCommand("shutdown");
    stopAudioEngine();
}

export function stopAudioEngine(): void {
    if (audioProc) {
        audioProc.kill("SIGTERM");
        setTimeout(() => {
            if (audioProc) audioProc.kill("SIGKILL");
        }, 3000);
    }
}
