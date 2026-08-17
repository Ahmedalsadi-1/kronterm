// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import type { LiveAgentSurfaceActivity } from "../../types/agent-activity";
import {
    agentActivityCardId,
    buildCanvasContextPrompt,
    makeCanvasRequestCard,
    nodeKindForAgentActivity,
    resolveAgentActivityContextIds,
    shouldRecordAgentActivity,
    toComposerContextNode,
    toggleCanvasContextSelection,
    upsertAgentActivityCard,
} from "./workspace-canvas-agent";

function activity(overrides: Partial<LiveAgentSurfaceActivity> = {}): LiveAgentSurfaceActivity {
    return {
        action: "open",
        phase: "running",
        source: "acp",
        surface: "browser",
        timestamp: 100,
        ...overrides,
    };
}

describe("workspace canvas agent graph", () => {
    it("keeps one card while an activity advances through phases", () => {
        const running = activity({ id: "tool-1", detail: "Opening docs" });
        const first = upsertAgentActivityCard([], running, { x: 20, y: 30, width: 320, height: 172 }, [
            "agent:request:1",
        ]);
        const verified = upsertAgentActivityCard(
            first.cards,
            activity({
                id: "tool-1",
                action: "verify",
                detail: "Docs loaded",
                phase: "succeeded",
                verificationstatus: "verified",
            }),
            { x: 999, y: 999, width: 320, height: 172 }
        );

        expect(verified.cards).toHaveLength(1);
        expect(verified.card).toMatchObject({
            id: "agent:tool-1",
            x: 20,
            y: 30,
            agent: {
                contextids: ["agent:request:1"],
                detail: "Docs loaded",
                phase: "succeeded",
                verificationstatus: "verified",
            },
        });
    });

    it("uses explicit activity parentage before fallback context", () => {
        const result = upsertAgentActivityCard(
            [],
            activity({ id: "child", parentid: "parent" }),
            { x: 0, y: 0, width: 320, height: 172 },
            ["agent:fallback"]
        );
        expect(result.card.agent.contextids).toEqual(["agent:parent", "agent:fallback"]);
    });

    it("collapses high-frequency surface gestures into one evolving card", () => {
        const click = activity({
            action: "click",
            id: "gesture-1",
            runid: "run-1",
            surfaceid: "browser-1",
        });
        const typed = activity({
            action: "type",
            id: "gesture-2",
            runid: "run-1",
            surfaceid: "browser-1",
        });
        expect(agentActivityCardId(click)).toBe(agentActivityCardId(typed));
        expect(agentActivityCardId(click)).toBe("agent:run-1:browser:browser-1:interaction");
    });

    it("builds follow and quote prompts from selected cards", () => {
        const nodes = [
            {
                action: "inspect" as const,
                blockid: "block-browser",
                detail: "Found the account settings.",
                id: "agent:browser",
                phase: "succeeded" as const,
                surface: "browser" as const,
                title: "Browser",
            },
        ];
        expect(buildCanvasContextPrompt("Continue", "follow", nodes)).toContain(
            "Treat it and its lineage as the primary working context."
        );
        expect(buildCanvasContextPrompt("Summarize", "quote", nodes)).toContain(
            "Use the selected canvas nodes together as quoted working context."
        );
        expect(buildCanvasContextPrompt("Continue", "follow", nodes)).toContain("KronTerm block: block-browser");
        expect(buildCanvasContextPrompt("  Plain request  ", "follow", [])).toBe("Plain request");
    });

    it("supports single follow selection and additive quote selection", () => {
        expect(toggleCanvasContextSelection(["a"], "b", "follow")).toEqual(["b"]);
        expect(toggleCanvasContextSelection(["a"], "b", "quote")).toEqual(["a", "b"]);
        expect(toggleCanvasContextSelection(["a", "b"], "a", "quote")).toEqual(["b"]);
    });

    it("creates an optimistic request card with its selected context", () => {
        vi.stubGlobal("crypto", { randomUUID: () => "request-1" });
        const card = makeCanvasRequestCard("Inspect this", ["agent:browser"], { x: 40, y: 60 }, 200);
        expect(card).toMatchObject({
            id: "agent:request:request-1",
            x: 40,
            y: 60,
            agent: {
                contextids: ["agent:browser"],
                detail: "Inspect this",
                phase: "queued",
            },
        });
        expect(agentActivityCardId(activity({ id: "tool:1" }))).toBe("agent:tool:1");
        vi.unstubAllGlobals();
    });

    it("keeps real canvas reply details when creating composer context", () => {
        const result = upsertAgentActivityCard(
            [],
            activity({
                blockid: "block-browser",
                detail: "Browser evidence is ready",
                id: "evidence",
                previewimageurl: "data:image/png;base64,preview",
                reasoningSteps: ["Inspected the page", "Captured the result"],
                verificationstatus: "verified",
            }),
            { x: 0, y: 0, width: 320, height: 172 }
        );

        expect(toComposerContextNode(result.card)).toMatchObject({
            blockid: "block-browser",
            previewimageurl: "data:image/png;base64,preview",
            reasoningsteps: ["Inspected the page", "Captured the result"],
            verificationstatus: "verified",
        });
    });

    it("accumulates activity thoughts as fallback reasoning without duplicates", () => {
        const first = upsertAgentActivityCard([], activity({ id: "thought", thought: "Checked the task context" }), {
            x: 0,
            y: 0,
            width: 320,
            height: 172,
        });
        const duplicate = upsertAgentActivityCard(
            first.cards,
            activity({ id: "thought", thought: "Checked the task context", timestamp: 101 }),
            { x: 0, y: 0, width: 320, height: 172 }
        );
        const second = upsertAgentActivityCard(
            duplicate.cards,
            activity({ id: "thought", thought: "Prepared the browser evidence", timestamp: 102 }),
            { x: 0, y: 0, width: 320, height: 172 }
        );

        expect(second.card.agent.reasoningsteps).toEqual(["Checked the task context", "Prepared the browser evidence"]);
    });

    it("labels real execution nodes by their role in the task", () => {
        expect(nodeKindForAgentActivity(activity({ action: "thinking", surface: "panel" }))).toBe("decision");
        expect(nodeKindForAgentActivity(activity({ action: "screenshot", previewimageurl: "data:image/png,x" }))).toBe(
            "evidence"
        );
        expect(nodeKindForAgentActivity(activity({ action: "wait", phase: "awaiting-approval" }))).toBe("approval");
        expect(nodeKindForAgentActivity(activity({ action: "focus", surface: "panel" }))).toBe("output");
    });

    it("branches tool work from the latest AI decision", () => {
        const decision = upsertAgentActivityCard(
            [],
            activity({ action: "thinking", id: "decision-1", runid: "task-1", surface: "panel" }),
            { x: 0, y: 0, width: 320, height: 172 }
        ).card;
        const firstTool = upsertAgentActivityCard(
            [decision],
            activity({ action: "open", id: "tool-1", runid: "task-1" }),
            { x: 400, y: 0, width: 320, height: 172 },
            [decision.id]
        ).card;

        expect(
            resolveAgentActivityContextIds(
                [decision, firstTool],
                activity({ action: "inspect", id: "tool-2", runid: "task-1", surface: "file" })
            )
        ).toEqual([decision.id]);
    });

    it("connects the final reply to every live branch leaf", () => {
        const decision = upsertAgentActivityCard(
            [],
            activity({ action: "thinking", id: "decision", runid: "task-1", surface: "panel" }),
            { x: 0, y: 0, width: 320, height: 172 }
        ).card;
        const browser = upsertAgentActivityCard(
            [decision],
            activity({ id: "browser", runid: "task-1" }),
            { x: 400, y: 0, width: 320, height: 172 },
            [decision.id]
        ).card;
        const terminal = upsertAgentActivityCard(
            [decision, browser],
            activity({ id: "terminal", runid: "task-1", surface: "terminal" }),
            { x: 400, y: 220, width: 320, height: 172 },
            [decision.id]
        ).card;

        expect(
            resolveAgentActivityContextIds(
                [decision, browser, terminal],
                activity({ action: "focus", id: "reply", runid: "task-1", surface: "panel" })
            )
        ).toEqual([browser.id, terminal.id]);
    });

    it("ignores uncorrelated ACP chrome while keeping real task activity", () => {
        expect(shouldRecordAgentActivity(activity({ detail: "KronosCode ready", phase: "succeeded" }))).toBe(false);
        expect(shouldRecordAgentActivity(activity({ detail: "Opening browser", runid: "task-1" }))).toBe(true);
    });
});
