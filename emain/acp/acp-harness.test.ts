// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    classifyHarnessTask,
    formatAcpCapabilityLease,
    getAcpHarnessProfile,
    makeAcpCapabilityLease,
} from "./acp-harness";

describe("ACP harness profiles", () => {
    it("describes the execution patterns KronosCode can borrow from specialist harnesses", () => {
        expect(getAcpHarnessProfile("hermes").patterns.map((pattern) => pattern.id)).toContain("prompt-tiers");
        expect(getAcpHarnessProfile("codex").patterns.map((pattern) => pattern.id)).toContain("bounded-workflows");
        expect(getAcpHarnessProfile("claude").patterns.map((pattern) => pattern.id)).toContain("lifecycle-hooks");
    });

    it("falls back to a live-discovery profile for unknown ACP backends", () => {
        const profile = getAcpHarnessProfile("future-agent");
        expect(profile.backend).toBe("future-agent");
        expect(profile.summary).toContain("live protocol handshake");
    });
});

describe("ACP capability leases", () => {
    it("classifies workspace control before generic coding", () => {
        expect(classifyHarnessTask("Fix the KronosChamber canvas widget bug").taskClass).toBe("workspace-control");
        expect(classifyHarnessTask("Debug a failing TypeScript test").taskClass).toBe("debugging");
    });

    it("grants only advertised protocol and scoped surface capabilities", () => {
        const lease = makeAcpCapabilityLease({
            backend: "hermes",
            capabilities: {
                loadSession: true,
                promptCapabilities: { image: false, audio: false, embeddedContext: true },
                mcpCapabilities: { stdio: true, http: false, sse: false },
                sessionCapabilities: { fork: null, resume: {}, list: null, close: {} },
                _meta: {},
            },
            content: "Research the runtime and review its architecture",
            surfaceAvailable: true,
            workspace: "/tmp/kronterm-project",
            ttlMs: 60_000,
        });

        expect(lease.capabilities).toContain("kronterm:surface");
        expect(lease.capabilities).toContain("mcp:stdio");
        expect(lease.capabilities).not.toContain("mcp:http");
        expect(lease.protocol.session).toEqual(["resume", "close"]);
        expect(lease.constraints).toMatchObject({
            filesystem: "workspace",
            writes: "approval-required",
            credentialAccess: "brokered-only",
        });
    });

    it("formats an explicit upper-bound policy for the specialist prompt", () => {
        const lease = makeAcpCapabilityLease({
            backend: "codex",
            capabilities: null,
            content: "Implement the parser",
            surfaceAvailable: false,
            workspace: "/tmp/project",
        });
        const prompt = formatAcpCapabilityLease(lease);
        expect(prompt).toContain("KronTerm Specialist Capability Lease");
        expect(prompt).toContain("approval-required");
        expect(prompt).toContain("Treat the lease as an upper bound");
    });
});
