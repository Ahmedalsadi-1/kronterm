// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { AgentActivityPhase } from "../../types/agent-activity";
import type { WorkspaceCanvasAgentCard } from "./workspace-canvas-agent";

export type WorkspaceCanvasTaskGraphEdge = {
    id: string;
    sourceid: string;
    targetid: string;
};

export type WorkspaceCanvasTaskGraph = {
    cards: WorkspaceCanvasAgentCard[];
    edges: WorkspaceCanvasTaskGraphEdge[];
};

export type WorkspaceCanvasRunAggregate = {
    cards: WorkspaceCanvasAgentCard[];
    completed: number;
    current?: WorkspaceCanvasAgentCard;
    progress: number;
    queued: number;
    runid: string;
    total: number;
    updatedts: number;
};

const TerminalTaskPhases = new Set<AgentActivityPhase>(["succeeded", "degraded", "failed", "cancelled"]);
const CurrentTaskPhases = new Set<AgentActivityPhase>(["awaiting-approval", "running", "verifying", "paused"]);

function compareCardsByCreatedTime(a: WorkspaceCanvasAgentCard, b: WorkspaceCanvasAgentCard): number {
    return a.agent.createdts - b.agent.createdts || a.agent.updatedts - b.agent.updatedts || a.id.localeCompare(b.id);
}

function compareCardsByRecentUpdate(a: WorkspaceCanvasAgentCard, b: WorkspaceCanvasAgentCard): number {
    return b.agent.updatedts - a.agent.updatedts || b.agent.createdts - a.agent.createdts || a.id.localeCompare(b.id);
}

export function isWorkspaceCanvasTaskComplete(phase: AgentActivityPhase): boolean {
    return TerminalTaskPhases.has(phase);
}

export function buildWorkspaceCanvasTaskGraph(cards: WorkspaceCanvasAgentCard[]): WorkspaceCanvasTaskGraph {
    const cardIds = new Set(cards.map((card) => card.id));
    const edges = cards.flatMap((card) =>
        (card.agent.contextids ?? [])
            .filter((sourceid) => cardIds.has(sourceid))
            .map((sourceid) => ({
                id: `edge:${sourceid}->${card.id}`,
                sourceid,
                targetid: card.id,
            }))
    );
    return {
        cards: [...cards].sort(compareCardsByCreatedTime),
        edges,
    };
}

export function aggregateWorkspaceCanvasRuns(cards: WorkspaceCanvasAgentCard[]): WorkspaceCanvasRunAggregate[] {
    const cardsByRun = new Map<string, WorkspaceCanvasAgentCard[]>();
    for (const card of cards) {
        const runid = card.agent.runid || "default";
        const runCards = cardsByRun.get(runid) ?? [];
        runCards.push(card);
        cardsByRun.set(runid, runCards);
    }

    return Array.from(cardsByRun, ([runid, runCards]) => {
        const orderedCards = [...runCards].sort(compareCardsByCreatedTime);
        const completed = orderedCards.filter((card) => isWorkspaceCanvasTaskComplete(card.agent.phase)).length;
        const queued = orderedCards.filter((card) => card.agent.phase === "queued").length;
        const current = [...orderedCards]
            .filter((card) => CurrentTaskPhases.has(card.agent.phase))
            .sort(compareCardsByRecentUpdate)[0];
        const updatedts = Math.max(...orderedCards.map((card) => card.agent.updatedts));
        return {
            cards: orderedCards,
            completed,
            current,
            progress: Math.round((completed / orderedCards.length) * 100),
            queued,
            runid,
            total: orderedCards.length,
            updatedts,
        };
    }).sort((a, b) => b.updatedts - a.updatedts || a.runid.localeCompare(b.runid));
}
