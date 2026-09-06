// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type AcpFailureCategory =
    | "transport_exit"
    | "timeout"
    | "permission_denied"
    | "cancelled"
    | "protocol"
    | "initialization"
    | "authentication"
    | "configuration"
    | "tool_failure"
    | "unknown";

export type AcpFailureSource =
    | "transport"
    | "request"
    | "permission"
    | "protocol"
    | "initialization"
    | "authentication"
    | "configuration"
    | "tool"
    | "unknown";

export interface AcpFailureEvidence {
    source?: AcpFailureSource;
    message?: string;
    signal?: string | null;
    permissionOutcome?: "denied" | "cancelled";
}

export interface AcpTraceEnvelope {
    schemaVersion: 1;
    traceId: string;
    operationId?: string;
    sequence: number;
    emittedAtMs: number;
    elapsedMs: number;
    sincePreviousMs: number;
    backend: string;
    failureCategory?: AcpFailureCategory;
}

export interface AcpTraceEventLike {
    type: string;
    timestamp: number;
    trace?: AcpTraceEnvelope;
}

export interface AcpTraceEvaluation {
    eventCount: number;
    durationMs: number;
    timeToFirstActivityMs: number | null;
    toolCallCount: number;
    toolFailureCount: number;
    permissionRequestCount: number;
    completed: boolean;
    failureCategory: AcpFailureCategory | null;
    sequenceValid: boolean;
}

const ActivityEventTypes = new Set(["agent_message_chunk", "agent_thought_chunk", "plan", "tool_call"]);

function classifyAcpFailure(evidence: AcpFailureEvidence): AcpFailureCategory {
    const message = evidence.message?.toLowerCase() ?? "";

    if (evidence.permissionOutcome === "denied" || /permission.*(denied|rejected)|access denied/.test(message)) {
        return "permission_denied";
    }
    if (evidence.permissionOutcome === "cancelled" || /\bcancel(?:led|ed|lation)?\b|\babort(?:ed)?\b/.test(message)) {
        return "cancelled";
    }
    if (evidence.signal === "keepalive-timeout" || /timed out|timeout/.test(message)) {
        return "timeout";
    }
    if (
        evidence.source === "authentication" ||
        /unauthori[sz]ed|authentication|auth required|log[ -]?in/.test(message)
    ) {
        return "authentication";
    }
    if (evidence.source === "configuration" || /invalid config|configuration error|unknown model/.test(message)) {
        return "configuration";
    }
    if (evidence.source === "protocol" || /json-?rpc|malformed|parse error|protocol version/.test(message)) {
        return "protocol";
    }
    if (evidence.source === "tool") {
        return "tool_failure";
    }
    if (evidence.source === "initialization") {
        return "initialization";
    }
    if (evidence.source === "transport") {
        return "transport_exit";
    }
    return "unknown";
}

function makeAcpTraceEnvelope(input: {
    traceId: string;
    operationId?: string;
    sequence: number;
    emittedAtMs: number;
    startedAtMs: number;
    previousEventAtMs: number;
    backend: string;
    failure?: AcpFailureEvidence;
}): AcpTraceEnvelope {
    return {
        schemaVersion: 1,
        traceId: input.traceId,
        operationId: input.operationId,
        sequence: input.sequence,
        emittedAtMs: input.emittedAtMs,
        elapsedMs: Math.max(0, input.emittedAtMs - input.startedAtMs),
        sincePreviousMs: Math.max(0, input.emittedAtMs - input.previousEventAtMs),
        backend: input.backend,
        failureCategory: input.failure ? classifyAcpFailure(input.failure) : undefined,
    };
}

function evaluateAcpTrace(events: AcpTraceEventLike[]): AcpTraceEvaluation {
    const ordered = [...events].sort((a, b) => {
        const sequenceDelta =
            (a.trace?.sequence ?? Number.MAX_SAFE_INTEGER) - (b.trace?.sequence ?? Number.MAX_SAFE_INTEGER);
        return sequenceDelta || a.timestamp - b.timestamp;
    });
    const firstTimestamp = ordered[0]?.timestamp;
    const lastTimestamp = ordered.at(-1)?.timestamp;
    const firstActivity = ordered.find((event) => ActivityEventTypes.has(event.type));
    const failureEvent = [...ordered].reverse().find((event) => event.trace?.failureCategory != null);
    const sequences = ordered.map((event) => event.trace?.sequence).filter((value) => value != null);
    const sequenceValid =
        sequences.length === ordered.length &&
        sequences.every((sequence, index) => index === 0 || sequence === sequences[index - 1] + 1);

    return {
        eventCount: ordered.length,
        durationMs: firstTimestamp == null || lastTimestamp == null ? 0 : Math.max(0, lastTimestamp - firstTimestamp),
        timeToFirstActivityMs:
            firstTimestamp == null || firstActivity == null
                ? null
                : Math.max(0, firstActivity.timestamp - firstTimestamp),
        toolCallCount: ordered.filter((event) => event.type === "tool_call").length,
        toolFailureCount: ordered.filter((event) => event.trace?.failureCategory === "tool_failure").length,
        permissionRequestCount: ordered.filter((event) => event.type === "tool_permission").length,
        completed: ordered.some((event) => event.type === "finish") && failureEvent == null,
        failureCategory: failureEvent?.trace?.failureCategory ?? null,
        sequenceValid,
    };
}

export { classifyAcpFailure, evaluateAcpTrace, makeAcpTraceEnvelope };
