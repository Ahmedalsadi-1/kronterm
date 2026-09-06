// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    classifyAcpFailure,
    evaluateAcpTrace,
    makeAcpTraceEnvelope,
    type AcpTraceEventLike,
} from "./acp-observability";

describe("ACP observability", () => {
    it.each([
        [{ source: "transport", signal: "SIGTERM" }, "transport_exit"],
        [{ source: "transport", signal: "keepalive-timeout" }, "timeout"],
        [{ source: "request", message: "LLM request timed out after 300 seconds" }, "timeout"],
        [{ source: "permission", permissionOutcome: "denied" }, "permission_denied"],
        [{ source: "permission", permissionOutcome: "cancelled" }, "cancelled"],
        [{ source: "protocol", message: "malformed JSON-RPC response" }, "protocol"],
        [{ source: "initialization", message: "agent failed to start" }, "initialization"],
        [{ source: "initialization", message: "authentication required; log in" }, "authentication"],
        [{ source: "configuration", message: "invalid config" }, "configuration"],
        [{ source: "tool", message: "process failed" }, "tool_failure"],
        [{ source: "unknown", message: "unexpected" }, "unknown"],
    ] as const)("classifies %o as %s", (evidence, category) => {
        expect(classifyAcpFailure(evidence)).toBe(category);
    });

    it("builds an operational envelope without accepting event payload content", () => {
        expect(
            makeAcpTraceEnvelope({
                traceId: "trace-1",
                operationId: "operation-1",
                sequence: 3,
                emittedAtMs: 1_250,
                startedAtMs: 1_000,
                previousEventAtMs: 1_200,
                backend: "kronoscode",
                failure: { source: "tool" },
            })
        ).toEqual({
            schemaVersion: 1,
            traceId: "trace-1",
            operationId: "operation-1",
            sequence: 3,
            emittedAtMs: 1_250,
            elapsedMs: 250,
            sincePreviousMs: 50,
            backend: "kronoscode",
            failureCategory: "tool_failure",
        });
    });

    it("calculates deterministic outcome and latency metrics", () => {
        const events: AcpTraceEventLike[] = [
            makeEvent("status", 1, 1_000),
            makeEvent("tool_permission", 2, 1_020),
            makeEvent("agent_message_chunk", 3, 1_080),
            makeEvent("tool_call", 4, 1_100),
            makeEvent("finish", 5, 1_240),
        ];

        expect(evaluateAcpTrace(events)).toEqual({
            eventCount: 5,
            durationMs: 240,
            timeToFirstActivityMs: 80,
            toolCallCount: 1,
            toolFailureCount: 0,
            permissionRequestCount: 1,
            completed: true,
            failureCategory: null,
            sequenceValid: true,
        });
    });

    it("detects failed and non-contiguous traces", () => {
        const events = [
            makeEvent("status", 2, 1_000),
            makeEvent("tool_call", 4, 1_020, "tool_failure"),
            makeEvent("error", 5, 1_030, "unknown"),
        ];

        expect(evaluateAcpTrace(events)).toMatchObject({
            completed: false,
            failureCategory: "unknown",
            sequenceValid: false,
            toolFailureCount: 1,
        });
    });
});

function makeEvent(
    type: string,
    sequence: number,
    timestamp: number,
    failureCategory?: ReturnType<typeof classifyAcpFailure>
): AcpTraceEventLike {
    return {
        type,
        timestamp,
        trace: {
            schemaVersion: 1,
            traceId: "trace-1",
            sequence,
            emittedAtMs: timestamp,
            elapsedMs: timestamp - 1_000,
            sincePreviousMs: 0,
            backend: "kronoscode",
            failureCategory,
        },
    };
}
