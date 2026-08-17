// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { createHash, randomUUID } from "crypto";
import path from "path";
import type { AcpAgentCapabilities } from "./acp-types";

export type AcpHarnessTaskClass =
    | "architecture"
    | "automation"
    | "coding"
    | "debugging"
    | "research"
    | "review"
    | "workspace-control";

export type AcpHarnessPattern = {
    id: string;
    label: string;
    description: string;
};

export type AcpHarnessProfile = {
    backend: string;
    summary: string;
    specialties: AcpHarnessTaskClass[];
    patterns: AcpHarnessPattern[];
    source: "builtin" | "reference";
};

export type AcpCapabilityLease = {
    id: string;
    backend: string;
    issuedAt: number;
    expiresAt: number;
    taskClass: AcpHarnessTaskClass;
    reason: string;
    workspace: string;
    capabilities: string[];
    constraints: {
        filesystem: "workspace";
        writes: "approval-required";
        destructiveActions: "approval-required";
        externalSideEffects: "approval-required";
        credentialAccess: "brokered-only";
        surface: "none" | "tab";
    };
    protocol: {
        loadSession: boolean;
        embeddedContext: boolean;
        mcp: Array<"http" | "sse" | "stdio">;
        session: Array<"close" | "fork" | "list" | "resume">;
    };
};

const CommonPatterns: AcpHarnessPattern[] = [
    {
        id: "scoped-tools",
        label: "Scoped tools",
        description: "Expose only the capabilities needed for the current task and workspace.",
    },
    {
        id: "durable-session",
        label: "Durable session",
        description: "Keep task state resumable and report lifecycle changes to KronosChamber.",
    },
];

const Profiles: Record<string, Omit<AcpHarnessProfile, "backend">> = {
    kronoscode: {
        summary: "Native KronTerm orchestrator for coding, workspace surfaces, and specialist delegation.",
        specialties: ["coding", "debugging", "workspace-control", "automation"],
        patterns: [
            ...CommonPatterns,
            {
                id: "workspace-native",
                label: "Workspace-native execution",
                description: "Use KronTerm blocks, browser, terminal, files, sandbox, and live surface evidence.",
            },
            {
                id: "capability-router",
                label: "Capability routing",
                description: "Route by task fit and live connector health while KronosCode remains in control.",
            },
        ],
        source: "builtin",
    },
    hermes: {
        summary: "Persistent multi-provider specialist with strong tools, skills, memory, and automation patterns.",
        specialties: ["automation", "research", "coding"],
        patterns: [
            ...CommonPatterns,
            {
                id: "prompt-tiers",
                label: "Prompt tiers",
                description: "Separate stable, contextual, and volatile prompt material for cache-friendly runs.",
            },
            {
                id: "progressive-skills",
                label: "Progressive skills",
                description: "Discover compact skill metadata first and load full instructions only when needed.",
            },
            {
                id: "toolsets",
                label: "Toolsets",
                description: "Group tools into task-specific sets instead of advertising a flat catalog.",
            },
        ],
        source: "reference",
    },
    codex: {
        summary: "Tool-efficient coding specialist for implementation, repository investigation, and verification.",
        specialties: ["coding", "debugging", "review"],
        patterns: [
            ...CommonPatterns,
            {
                id: "lean-context",
                label: "Lean context",
                description: "Keep prompts and visible tools small, explicit, and stable across turns.",
            },
            {
                id: "bounded-workflows",
                label: "Bounded workflows",
                description:
                    "Use deterministic tool-heavy stages when every intermediate result needs no model decision.",
            },
            {
                id: "measured-parallelism",
                label: "Measured parallelism",
                description: "Parallelize independent work and validate quality, latency, token, and retry changes.",
            },
        ],
        source: "reference",
    },
    claude: {
        summary: "Large-context reasoning specialist for architecture, debugging, review, and isolated subagent work.",
        specialties: ["architecture", "debugging", "review", "coding"],
        patterns: [
            ...CommonPatterns,
            {
                id: "lifecycle-hooks",
                label: "Lifecycle hooks",
                description: "Observe and gate tool, permission, session, and subagent transitions with typed hooks.",
            },
            {
                id: "isolated-specialists",
                label: "Isolated specialists",
                description: "Give subagents explicit tools, skills, memory, model, turn, and isolation limits.",
            },
            {
                id: "permission-modes",
                label: "Permission modes",
                description: "Make planning, edits, automatic review, and approval behavior visually distinct.",
            },
        ],
        source: "reference",
    },
    opencode: {
        summary: "Open-source coding specialist with broad provider support and ACP-native sessions.",
        specialties: ["coding", "debugging"],
        patterns: [...CommonPatterns],
        source: "reference",
    },
    goose: {
        summary: "Open-source task specialist for extensible development and automation workflows.",
        specialties: ["coding", "automation"],
        patterns: [...CommonPatterns],
        source: "reference",
    },
};

export function getAcpHarnessProfile(backend: string): AcpHarnessProfile {
    const normalized = backend.trim().toLowerCase();
    const profile = Profiles[normalized] ?? {
        summary: "ACP-compatible specialist with capabilities discovered from its live protocol handshake.",
        specialties: ["coding"] as AcpHarnessTaskClass[],
        patterns: CommonPatterns,
        source: "reference" as const,
    };
    return { backend: normalized || backend, ...profile };
}

export function classifyHarnessTask(content: string): { taskClass: AcpHarnessTaskClass; reason: string } {
    const text = content.toLowerCase();
    const candidates: Array<{ taskClass: AcpHarnessTaskClass; pattern: RegExp; reason: string }> = [
        {
            taskClass: "workspace-control",
            pattern: /\b(kronterm|kronoschamber|workspace|widget|block|canvas|desktop|browser tab)\b/,
            reason: "The request targets a live KronTerm or desktop workspace surface.",
        },
        {
            taskClass: "debugging",
            pattern: /\b(debug|bug|broken|failure|failing|crash|hang|regression|root cause)\b/,
            reason: "The request asks for diagnosis or failure recovery.",
        },
        {
            taskClass: "review",
            pattern: /\b(review|audit|critique|security|pull request|\bpr\b)\b/,
            reason: "The request asks for independent review or risk analysis.",
        },
        {
            taskClass: "architecture",
            pattern: /\b(architecture|design|roadmap|system design|refactor plan)\b/,
            reason: "The request needs architectural reasoning before execution.",
        },
        {
            taskClass: "research",
            pattern: /\b(research|compare|sources|documentation|look up|web search)\b/,
            reason: "The request depends on research or source comparison.",
        },
        {
            taskClass: "automation",
            pattern: /\b(automate|automation|scheduled|cron|recurring|workflow|pipeline)\b/,
            reason: "The request describes an automated or repeatable workflow.",
        },
    ];
    return (
        candidates.find((candidate) => candidate.pattern.test(text)) ?? {
            taskClass: "coding",
            reason: "The request is best handled as a repository coding task.",
        }
    );
}

function protocolCapabilities(capabilities: AcpAgentCapabilities | null): AcpCapabilityLease["protocol"] {
    const mcp = (["stdio", "http", "sse"] as const).filter((type) => capabilities?.mcpCapabilities?.[type]);
    const session = (["fork", "resume", "list", "close"] as const).filter(
        (type) => capabilities?.sessionCapabilities?.[type]
    );
    return {
        loadSession: Boolean(capabilities?.loadSession),
        embeddedContext: Boolean(capabilities?.promptCapabilities?.embeddedContext),
        mcp,
        session,
    };
}

export function makeAcpCapabilityLease(input: {
    backend: string;
    capabilities: AcpAgentCapabilities | null;
    content: string;
    surfaceAvailable: boolean;
    workspace: string;
    ttlMs?: number;
}): AcpCapabilityLease {
    const now = Date.now();
    const classification = classifyHarnessTask(input.content);
    const profile = getAcpHarnessProfile(input.backend);
    const capabilities = [
        `task:${classification.taskClass}`,
        "filesystem:workspace",
        "skills:shared-read",
        ...(input.surfaceAvailable ? ["kronterm:surface"] : []),
        ...protocolCapabilities(input.capabilities).mcp.map((type) => `mcp:${type}`),
    ];
    const workspace = path.resolve(input.workspace);
    const digest = createHash("sha256")
        .update(`${input.backend}\0${workspace}\0${classification.taskClass}\0${now}`)
        .digest("hex")
        .slice(0, 12);
    return {
        id: `${randomUUID()}:${digest}`,
        backend: input.backend,
        issuedAt: now,
        expiresAt: now + (input.ttlMs ?? 30 * 60 * 1000),
        taskClass: classification.taskClass,
        reason: `${classification.reason} ${profile.summary}`,
        workspace,
        capabilities,
        constraints: {
            filesystem: "workspace",
            writes: "approval-required",
            destructiveActions: "approval-required",
            externalSideEffects: "approval-required",
            credentialAccess: "brokered-only",
            surface: input.surfaceAvailable ? "tab" : "none",
        },
        protocol: protocolCapabilities(input.capabilities),
    };
}

export function formatAcpCapabilityLease(lease: AcpCapabilityLease): string {
    return `[KronTerm Specialist Capability Lease]
Lease: ${lease.id}
Backend: ${lease.backend}
Task class: ${lease.taskClass}
Workspace: ${lease.workspace}
Granted capabilities: ${lease.capabilities.join(", ")}
Constraints: filesystem=${lease.constraints.filesystem}; writes=${lease.constraints.writes}; destructive=${lease.constraints.destructiveActions}; external-side-effects=${lease.constraints.externalSideEffects}; credentials=${lease.constraints.credentialAccess}; surface=${lease.constraints.surface}
Expires: ${new Date(lease.expiresAt).toISOString()}

Stay inside this task and workspace. Treat the lease as an upper bound, not a requirement to use every capability. Request explicit approval through ACP before writes, destructive actions, credential access, or external side effects. Return concise evidence, verification, and any fallback reason to KronosCode/KronosChamber.`;
}
