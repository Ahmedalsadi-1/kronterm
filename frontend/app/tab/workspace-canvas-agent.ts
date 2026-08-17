// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type {
    AgentActivityAction,
    AgentActivityPhase,
    AgentActivitySource,
    AgentActivitySurface,
    LiveAgentSurfaceActivity,
} from "../../types/agent-activity";
import type { WorkspaceCanvasRect } from "./workspace-canvas-utils";

export type CanvasContextMode = "follow" | "quote";
export type WorkspaceCanvasAgentNodeKind = "request" | "decision" | "action" | "evidence" | "approval" | "output";

export type WorkspaceCanvasAgentData = {
    action: AgentActivityAction;
    blockid?: string;
    contextids?: string[];
    createdts: number;
    detail: string;
    errorcode?: LiveAgentSurfaceActivity["errorcode"];
    eventid?: string;
    phase: AgentActivityPhase;
    nodekind: WorkspaceCanvasAgentNodeKind;
    previewimageurl?: string;
    reasoningsteps?: string[];
    runid: string;
    source: AgentActivitySource;
    surface: AgentActivitySurface;
    title: string;
    updatedts: number;
    verificationstatus?: LiveAgentSurfaceActivity["verificationstatus"];
};

export type WorkspaceCanvasAgentCard = WorkspaceCanvasRect & {
    agent: WorkspaceCanvasAgentData;
    id: string;
    kind: "agent";
};

export type CanvasComposerContextNode = {
    action: AgentActivityAction;
    blockid?: string;
    detail: string;
    id: string;
    phase: AgentActivityPhase;
    previewimageurl?: string;
    reasoningsteps?: string[];
    surface: AgentActivitySurface;
    title: string;
    verificationstatus?: LiveAgentSurfaceActivity["verificationstatus"];
};

const AgentCardWidth = 320;
const AgentCardHeight = 172;
const MaxReasoningSteps = 20;
const SurfaceActionIds = new Set<AgentActivityAction>([
    "move",
    "click",
    "doubleClick",
    "type",
    "press",
    "scroll",
    "drag",
]);

function safeIdPart(value: string): string {
    return value.replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function agentActivityCardId(activity: LiveAgentSurfaceActivity): string {
    if (activity.id && !SurfaceActionIds.has(activity.action)) {
        return `agent:${safeIdPart(activity.id)}`;
    }
    const capability =
        SurfaceActionIds.has(activity.action) && !activity.capabilityid && !activity.connectorid
            ? "interaction"
            : activity.capabilityid || activity.connectorid || activity.action;
    const identity = [
        activity.runid || "default",
        activity.surface,
        activity.surfaceid || activity.blockid || activity.appname || "surface",
        capability,
    ].join(":");
    return `agent:${safeIdPart(identity)}`;
}

export function agentActivityParentCardId(activity: LiveAgentSurfaceActivity): string | undefined {
    return activity.parentid ? `agent:${safeIdPart(activity.parentid)}` : undefined;
}

export function nodeKindForAgentActivity(activity: LiveAgentSurfaceActivity): WorkspaceCanvasAgentNodeKind {
    if (activity.phase === "awaiting-approval") {
        return "approval";
    }
    if (activity.action === "thinking") {
        return "decision";
    }
    if (
        activity.action === "verify" ||
        activity.action === "screenshot" ||
        activity.previewimageurl ||
        activity.verificationstatus
    ) {
        return "evidence";
    }
    if (activity.surface === "panel" && activity.action === "focus") {
        return "output";
    }
    return "action";
}

export function shouldRecordAgentActivity(activity: LiveAgentSurfaceActivity): boolean {
    if (activity.source !== "acp") {
        return true;
    }
    if (!activity.runid) {
        return false;
    }
    return !(
        activity.surface === "panel" &&
        activity.action === "focus" &&
        /(?:ready|connected|idle)$/i.test(activity.detail?.trim() ?? "")
    );
}

export function titleForAgentActivity(activity: LiveAgentSurfaceActivity): string {
    const nodeKind = nodeKindForAgentActivity(activity);
    if (nodeKind === "decision") {
        return "AI decision";
    }
    if (nodeKind === "approval") {
        return "Approval needed";
    }
    if (nodeKind === "output") {
        return activity.phase === "succeeded" ? "Task output" : "Kronos reply";
    }
    if (nodeKind === "evidence") {
        if (activity.surface === "browser") {
            return "Browser evidence";
        }
        if (activity.surface === "file") {
            return "File evidence";
        }
        return "Verification evidence";
    }
    if (activity.surface === "browser") {
        return activity.appname || "Browser";
    }
    if (activity.surface === "sandbox") {
        return activity.appname || "Sandbox";
    }
    if (activity.surface === "desktop") {
        return activity.appname || "Desktop";
    }
    if (activity.surface === "terminal") {
        return "Terminal";
    }
    if (activity.surface === "file") {
        return "Workspace files";
    }
    return activity.appname || "Kronos agent";
}

function compareByRecentActivity(a: WorkspaceCanvasAgentCard, b: WorkspaceCanvasAgentCard): number {
    return b.agent.updatedts - a.agent.updatedts || b.agent.createdts - a.agent.createdts;
}

export function resolveAgentActivityContextIds(
    current: WorkspaceCanvasAgentCard[],
    activity: LiveAgentSurfaceActivity,
    pendingRequestId?: string
): string[] {
    const id = agentActivityCardId(activity);
    const existing = current.find((card) => card.id === id);
    if (existing) {
        return existing.agent.contextids ?? [];
    }
    const explicitParentId = agentActivityParentCardId(activity);
    if (explicitParentId) {
        return [explicitParentId];
    }
    if (pendingRequestId) {
        return [pendingRequestId];
    }
    const runid = activity.runid || "default";
    const runCards = current.filter((card) => card.agent.runid === runid).sort(compareByRecentActivity);
    if (runCards.length === 0) {
        return [];
    }
    const nodeKind = nodeKindForAgentActivity(activity);
    if (nodeKind === "output") {
        const referencedIds = new Set(runCards.flatMap((card) => card.agent.contextids ?? []));
        const leaves = runCards.filter((card) => !referencedIds.has(card.id));
        return (leaves.length > 0 ? leaves : runCards.slice(0, 1)).map((card) => card.id);
    }
    if (nodeKind === "action" || nodeKind === "evidence" || nodeKind === "approval") {
        const latestDecision = runCards.find((card) => card.agent.nodekind === "decision");
        if (latestDecision) {
            return [latestDecision.id];
        }
    }
    return [runCards[0].id];
}

function mergeReasoningSteps(existing: string[] | undefined, activity: LiveAgentSurfaceActivity): string[] | undefined {
    const explicitSteps = activity.reasoningSteps?.map((step) => step.trim()).filter(Boolean);
    if (explicitSteps?.length) {
        return explicitSteps.slice(-MaxReasoningSteps);
    }
    const thought = activity.thought?.trim();
    if (!thought) {
        return existing;
    }
    const current = existing ?? [];
    if (current[current.length - 1] === thought) {
        return current;
    }
    return [...current, thought].slice(-MaxReasoningSteps);
}

export function upsertAgentActivityCard(
    current: WorkspaceCanvasAgentCard[],
    activity: LiveAgentSurfaceActivity,
    placement: WorkspaceCanvasRect,
    fallbackContextIds: string[] = []
): { cards: WorkspaceCanvasAgentCard[]; card: WorkspaceCanvasAgentCard; created: boolean } {
    const id = agentActivityCardId(activity);
    const existingIndex = current.findIndex((card) => card.id === id);
    const eventParentId = agentActivityParentCardId(activity);
    const contextids = Array.from(
        new Set([eventParentId, ...fallbackContextIds].filter((value): value is string => Boolean(value)))
    );
    const existing = existingIndex >= 0 ? current[existingIndex] : undefined;
    const now = activity.timestamp || Date.now();
    const nodekind =
        existing?.agent.nodekind === "approval" && activity.action === "wait"
            ? "approval"
            : nodeKindForAgentActivity(activity);
    const card: WorkspaceCanvasAgentCard = {
        ...(existing ?? placement),
        id,
        kind: "agent",
        agent: {
            action: activity.action,
            blockid: activity.blockid || existing?.agent.blockid,
            contextids: contextids.length > 0 ? contextids : existing?.agent.contextids,
            createdts: existing?.agent.createdts ?? now,
            detail: activity.detail || activity.thought || activity.action,
            errorcode: activity.errorcode,
            eventid: activity.id,
            nodekind,
            phase: activity.phase,
            previewimageurl: activity.previewimageurl || existing?.agent.previewimageurl,
            reasoningsteps: mergeReasoningSteps(existing?.agent.reasoningsteps, activity),
            runid: activity.runid || existing?.agent.runid || "default",
            source: activity.source,
            surface: activity.surface,
            title: titleForAgentActivity(activity),
            updatedts: now,
            verificationstatus: activity.verificationstatus || existing?.agent.verificationstatus,
        },
    };
    if (!existing) {
        return { cards: [...current, card], card, created: true };
    }
    const cards = [...current];
    cards[existingIndex] = card;
    return { cards, card, created: false };
}

export function makeCanvasRequestCard(
    prompt: string,
    contextids: string[],
    placement: Pick<WorkspaceCanvasRect, "x" | "y">,
    now = Date.now()
): WorkspaceCanvasAgentCard {
    const id = `agent:request:${crypto.randomUUID()}`;
    return {
        id,
        kind: "agent",
        x: placement.x,
        y: placement.y,
        width: AgentCardWidth,
        height: AgentCardHeight,
        agent: {
            action: "thinking",
            contextids: [...contextids],
            createdts: now,
            detail: prompt,
            nodekind: "request",
            phase: "queued",
            runid: id,
            source: "wave",
            surface: "panel",
            title: "Canvas request",
            updatedts: now,
        },
    };
}

export function updateCanvasRequestPhase(
    card: WorkspaceCanvasAgentCard,
    phase: AgentActivityPhase,
    detail?: string,
    now = Date.now()
): WorkspaceCanvasAgentCard {
    return {
        ...card,
        agent: {
            ...card.agent,
            detail: detail || card.agent.detail,
            phase,
            updatedts: now,
        },
    };
}

export function buildCanvasContextPrompt(
    prompt: string,
    mode: CanvasContextMode,
    nodes: CanvasComposerContextNode[]
): string {
    if (nodes.length === 0) {
        return prompt.trim();
    }
    const instruction =
        mode === "follow"
            ? "Continue from the selected canvas node. Treat it and its lineage as the primary working context."
            : "Use the selected canvas nodes together as quoted working context. Compare or combine them as needed.";
    const context = nodes
        .map(
            (node, index) =>
                `${index + 1}. ${node.title} [${node.surface}/${node.phase}/${node.action}]${
                    node.blockid ? `\nKronTerm block: ${node.blockid}` : ""
                }\n${node.detail.trim()}`
        )
        .join("\n\n");
    return `${instruction}\n\nCanvas context:\n${context}\n\nUser request:\n${prompt.trim()}`;
}

export function toComposerContextNode(card: WorkspaceCanvasAgentCard): CanvasComposerContextNode {
    return {
        action: card.agent.action,
        blockid: card.agent.blockid,
        detail: card.agent.detail,
        id: card.id,
        phase: card.agent.phase,
        previewimageurl: card.agent.previewimageurl,
        reasoningsteps: card.agent.reasoningsteps,
        surface: card.agent.surface,
        title: card.agent.title,
        verificationstatus: card.agent.verificationstatus,
    };
}

export function toggleCanvasContextSelection(
    selectedIds: string[],
    id: string,
    mode: CanvasContextMode,
    additive = false
): string[] {
    if (mode === "follow" && !additive) {
        return [id];
    }
    if (selectedIds.includes(id)) {
        return selectedIds.filter((selectedId) => selectedId !== id);
    }
    return [...selectedIds, id];
}

export const WorkspaceAgentCardSize = {
    width: AgentCardWidth,
    height: AgentCardHeight,
};
