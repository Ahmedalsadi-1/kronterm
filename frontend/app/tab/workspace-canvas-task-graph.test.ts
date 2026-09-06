// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import type { AgentActivityPhase } from "../../types/agent-activity";
import type { WorkspaceCanvasAgentCard } from "./workspace-canvas-agent";
import { aggregateWorkspaceCanvasRuns, buildWorkspaceCanvasTaskGraph } from "./workspace-canvas-task-graph";

function card(
    id: string,
    runid: string,
    phase: AgentActivityPhase,
    createdts: number,
    updatedts = createdts
): WorkspaceCanvasAgentCard {
    return {
        id,
        kind: "agent",
        x: 0,
        y: 0,
        width: 320,
        height: 172,
        agent: {
            action: "thinking",
            createdts,
            detail: id,
            nodekind: "decision",
            phase,
            runid,
            source: "wave",
            surface: "panel",
            title: id,
            updatedts,
        },
    };
}

describe("workspace canvas task graph", () => {
    it("only creates graph edges between cards in the supplied graph", () => {
        const parent = card("parent", "run", "succeeded", 1);
        const child = {
            ...card("child", "run", "running", 2),
            agent: { ...card("child", "run", "running", 2).agent, contextids: ["parent", "outside"] },
        };
        const graph = buildWorkspaceCanvasTaskGraph([child, parent]);

        expect(graph.cards.map((entry) => entry.id)).toEqual(["parent", "child"]);
        expect(graph.edges).toEqual([{ id: "edge:parent->child", sourceid: "parent", targetid: "child" }]);
    });

    it("aggregates batch progress, current work, and queued work by run", () => {
        const cards = [
            card("a-queued", "run-a", "queued", 1, 10),
            card("a-done", "run-a", "succeeded", 2, 20),
            card("a-running-old", "run-a", "running", 3, 30),
            card("a-running-current", "run-a", "verifying", 4, 40),
            card("b-done", "run-b", "failed", 1, 50),
            card("b-cancelled", "run-b", "cancelled", 2, 60),
        ];

        expect(aggregateWorkspaceCanvasRuns(cards)).toMatchObject([
            {
                runid: "run-b",
                completed: 2,
                total: 2,
                progress: 100,
                queued: 0,
                current: undefined,
                updatedts: 60,
            },
            {
                runid: "run-a",
                completed: 1,
                total: 4,
                progress: 25,
                queued: 1,
                current: { id: "a-running-current" },
                updatedts: 40,
            },
        ]);
    });

    it("returns no aggregates for an empty canvas", () => {
        expect(aggregateWorkspaceCanvasRuns([])).toEqual([]);
    });
});
