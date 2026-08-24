// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type ChathubV2StatePushStatus = "idle" | "starting" | "ready" | "error" | "stopped";

type StatePushHealthLike = {
    status?: string;
    startupError?: string;
};

export type ChathubV2StatePush = {
    status: ChathubV2StatePushStatus;
    url?: string;
    error?: string;
    health?: StatePushHealthLike;
};

export type ChathubV2LogLevel = "info" | "warn" | "error";

export type ChathubV2LogLine = {
    level: ChathubV2LogLevel;
    ts: number;
    line: string;
};

const JwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{5,}\b/g;

// Child output can echo surface tokens on failure paths; never let them reach the
// renderer's log surfaces (repair panel shows these lines verbatim).
export function redactSecrets(line: string): string {
    return line.replace(JwtPattern, "[redacted-jwt]");
}

export function classifyChathubLogLine(line: string, source: "out" | "err"): ChathubV2LogLevel {
    const text = line.toLowerCase();
    if (/\b(error|failed|failure|fatal|exception|unhandled)\b/.test(text)) {
        return "error";
    }
    if (/\b(warn|warning|deprecat)/.test(text)) {
        return source === "err" ? "error" : "warn";
    }
    // stderr is reserved for diagnostics by the bundled server, so unclassified
    // stderr lines are treated as warnings rather than dropped into info noise.
    return source === "err" ? "warn" : "info";
}

export function makeChathubLogLine(line: string, source: "out" | "err", ts: number): ChathubV2LogLine {
    return { level: classifyChathubLogLine(line, source), ts, line: redactSecrets(line.trim()) };
}

// health payloads carry volatile timestamps (checkedAt) and growing log rings, so
// transition equality compares only the fields a renderer reacts to.
export function chathubV2StatePushKey(push: ChathubV2StatePush): string {
    return JSON.stringify([push.status, push.url ?? "", push.error ?? "", push.health?.status ?? ""]);
}

export function shouldEmitStatePush(previous: ChathubV2StatePush | null, next: ChathubV2StatePush): boolean {
    if (!previous) {
        return true;
    }
    return chathubV2StatePushKey(previous) !== chathubV2StatePushKey(next);
}
