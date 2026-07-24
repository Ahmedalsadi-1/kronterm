// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type DeveloperMemoryLayer = "short_term" | "long_term" | "archive";
export type DeveloperMemoryStatus = "active" | "superseded" | "tombstoned";
export type DeveloperMemoryProcessingState = "pending" | "processed" | "blocked";

export type DeveloperMemorySourceType =
    | "workspace_session"
    | "terminal"
    | "browser"
    | "file"
    | "agent"
    | "sandbox"
    | "desktop"
    | "manual";

export type DeveloperMemoryScope = {
    workspaceId?: string;
    tabId?: string;
    blockId?: string;
    repoPath?: string;
    branch?: string;
};

export type DeveloperMemoryEvidence = {
    sourceType: DeveloperMemorySourceType;
    sourceId?: string;
    blockId?: string;
    path?: string;
    url?: string;
    command?: string;
    excerpt?: string;
    createdAt: string;
};

export type DeveloperMemoryPromotion = {
    fromLayer: DeveloperMemoryLayer;
    toLayer: DeveloperMemoryLayer;
    reason: string;
    at: string;
    by: "user" | "agent" | "system";
};

export type DeveloperMemoryRecord = {
    id: string;
    content: string;
    layer: DeveloperMemoryLayer;
    status: DeveloperMemoryStatus;
    processingState: DeveloperMemoryProcessingState;
    category: "project" | "system" | "manual" | "workflow" | "integration" | "other";
    scope: DeveloperMemoryScope;
    evidence: DeveloperMemoryEvidence[];
    sourceId?: string;
    promotion?: DeveloperMemoryPromotion;
    ttl?: string;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
};

export type DeveloperSessionStatus = "in_progress" | "processing" | "completed" | "discarded";
export type DeveloperSessionEventType =
    | "terminal_command"
    | "terminal_error"
    | "browser_navigation"
    | "file_change"
    | "agent_tool"
    | "sandbox_event"
    | "manual_note";

export type DeveloperSessionEvent = {
    id: string;
    type: DeveloperSessionEventType;
    title?: string;
    detail?: string;
    blockId?: string;
    command?: string;
    path?: string;
    url?: string;
    exitCode?: number;
    createdAt: string;
};

export type DeveloperWorkspaceSession = {
    id: string;
    title: string;
    status: DeveloperSessionStatus;
    scope: DeveloperMemoryScope;
    summary?: string;
    events: DeveloperSessionEvent[];
    memoryIds: string[];
    actionItemIds: string[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
};

export type DeveloperActionItemStatus = "pending" | "in_progress" | "done" | "cancelled";
export type DeveloperActionItemPriority = "low" | "medium" | "high" | "urgent";

export type DeveloperActionItem = {
    id: string;
    title: string;
    description?: string;
    status: DeveloperActionItemStatus;
    priority: DeveloperActionItemPriority;
    dueAt?: string;
    scope: DeveloperMemoryScope;
    sourceSessionId?: string;
    sourceMemoryId?: string;
    evidence: DeveloperMemoryEvidence[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
};

export type WidgetActionRisk = "read" | "write" | "sensitive" | "dangerous";
export type WidgetActionSurface = "workspace" | "terminal" | "browser" | "file" | "sandbox" | "desktop" | "agent";

export type WidgetActionDefinition = {
    id: string;
    surface: WidgetActionSurface;
    title: string;
    description: string;
    risk: WidgetActionRisk;
    parameters: Record<string, unknown>;
    examples: string[];
    requiresApproval: boolean;
};

export const DefaultDeveloperMemoryActions: WidgetActionDefinition[] = [
    {
        id: "memory.create",
        surface: "workspace",
        title: "Create Memory",
        description: "Save a scoped developer memory with evidence.",
        risk: "write",
        parameters: { content: "string", layer: "short_term | long_term | archive", evidence: "array" },
        examples: ["Remember that this repo requires pnpm install before task dev."],
        requiresApproval: false,
    },
    {
        id: "session.append_event",
        surface: "workspace",
        title: "Append Session Event",
        description: "Record a terminal, browser, file, sandbox, or agent event in the current workspace session.",
        risk: "write",
        parameters: { sessionId: "string", type: "DeveloperSessionEventType", detail: "string" },
        examples: ["Record that npm test failed with exit code 1."],
        requiresApproval: false,
    },
    {
        id: "action_item.create",
        surface: "workspace",
        title: "Create Action Item",
        description: "Create a task linked to session or memory evidence.",
        risk: "write",
        parameters: { title: "string", priority: "low | medium | high | urgent" },
        examples: ["Create an action item to add regression tests for widget_snapshot."],
        requiresApproval: false,
    },
];

export function isLegalDeveloperMemoryState(
    layer: DeveloperMemoryLayer,
    status: DeveloperMemoryStatus,
    processingState: DeveloperMemoryProcessingState
): boolean {
    if (layer === "short_term") {
        return true;
    }
    if (layer === "long_term") {
        return processingState === "processed";
    }
    return status !== "superseded" && processingState === "processed";
}
