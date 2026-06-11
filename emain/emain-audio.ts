// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { getWaveDataDir } from "./emain-platform";

const AUDIO_ENGINE_DIR = join(__dirname, "..", "audio-engine");
const MAIN_PY = join(AUDIO_ENGINE_DIR, "main.py");

let audioProc: ChildProcess = null;

export async function runAudioEngine(): Promise<void> {
    if (audioProc) return;
    const dataDir = getWaveDataDir();
    const proc = spawn("python3", [MAIN_PY], {
        cwd: AUDIO_ENGINE_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            ...process.env,
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

    proc.on("exit", (code, signal) => {
        console.log("[audio-engine] exited", code !== null ? `code=${code}` : `signal=${signal}`);
        audioProc = null;
    });
}

function handleAudioMessage(msg: any): void {
    switch (msg.type) {
        case "transcript":
        case "state":
            break;
        case "error":
            console.log("[audio-engine:error]", msg.message);
            break;
    }
}

export function stopAudioEngine(): void {
    if (audioProc) {
        audioProc.kill("SIGTERM");
        setTimeout(() => {
            if (audioProc) audioProc.kill("SIGKILL");
        }, 3000);
    }
}
