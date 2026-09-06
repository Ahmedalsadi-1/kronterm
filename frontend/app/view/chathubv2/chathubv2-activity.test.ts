import { describe, expect, it } from "vitest";
import type { LiveAgentSurfaceActivity } from "../../../types/agent-activity";
import {
    isActivityForChatHubSurface,
    projectChatHubActivity,
    rememberChatHubActivityIdentity,
} from "./chathubv2-activity";

function makeActivity(overrides: Partial<LiveAgentSurfaceActivity> = {}): LiveAgentSurfaceActivity {
    return {
        action: "inspect",
        detail: "Inspect production logs",
        phase: "running",
        source: "acp",
        surface: "panel",
        timestamp: 42,
        ...overrides,
    };
}

describe("KronosChamber activity projection", () => {
    it("explains approval consequence and keeps the state until the runtime advances", () => {
        const status = projectChatHubActivity(makeActivity({ phase: "awaiting-approval", risk: "dangerous" }));

        expect(status).toMatchObject({
            kind: "approval",
            label: "Approval needed",
            detail: expect.stringContaining("difficult to reverse"),
        });
        expect(status).not.toHaveProperty("dismissAfterMs");
    });

    it("classifies degraded and failed activity with different recovery guidance", () => {
        expect(projectChatHubActivity(makeActivity({ phase: "degraded" }))).toMatchObject({
            kind: "blocked",
            label: "Agent blocked",
            recovery: expect.stringContaining("dependency"),
        });
        expect(projectChatHubActivity(makeActivity({ phase: "failed", errorcode: "permission" }))).toMatchObject({
            kind: "failed",
            label: "Action failed",
            detail: expect.stringContaining("permission"),
            recovery: expect.stringContaining("retry"),
        });
    });

    it("turns verified completion into short-lived evidence feedback", () => {
        expect(
            projectChatHubActivity(
                makeActivity({ phase: "succeeded", verificationstatus: "verified", blockid: "evidence-block" })
            )
        ).toMatchObject({
            kind: "evidence",
            label: "Evidence verified",
            dismissAfterMs: 6_000,
        });
    });

    it("keeps unevidenced completion visually distinct from evidence", () => {
        expect(projectChatHubActivity(makeActivity({ phase: "succeeded" }))).toMatchObject({
            kind: "completed",
            label: "Action completed",
            detail: "The action completed successfully.",
            dismissAfterMs: 6_000,
        });
    });

    it("distinguishes cancellation recovery from failure", () => {
        expect(projectChatHubActivity(makeActivity({ phase: "cancelled" }))).toMatchObject({
            kind: "recovery",
            label: "Run cancelled",
            recovery: expect.stringContaining("preserved"),
        });
    });

    it("isolates activity explicitly targeted at another Chamber surface or block", () => {
        const context = { blockId: "chat-block", surfaceId: "kronterm:tab:chat-block" };

        expect(isActivityForChatHubSurface(makeActivity({ surfaceid: "another-surface" }), context)).toBe(false);
        expect(isActivityForChatHubSurface(makeActivity({ blockid: "another-block" }), context)).toBe(false);
        expect(isActivityForChatHubSurface(makeActivity({ surfaceid: context.surfaceId }), context)).toBe(true);
        expect(isActivityForChatHubSurface(makeActivity(), context)).toBe(false);
    });

    it("learns run and session identity only after direct activity targets this Chamber", () => {
        const identity = { runIds: new Set<string>(), sessionIds: new Set<string>() };
        const context = {
            blockId: "chat-a",
            runIds: identity.runIds,
            sessionIds: identity.sessionIds,
            surfaceId: "kronterm:tab-a:chat-a",
        };
        const targeted = makeActivity({
            runid: "run-a",
            sessionid: "session-a",
            surfaceid: context.surfaceId,
        });

        expect(isActivityForChatHubSurface(targeted, context)).toBe(true);
        rememberChatHubActivityIdentity(targeted, identity);
        expect(isActivityForChatHubSurface(makeActivity({ runid: "run-a", blockid: "terminal-a" }), context)).toBe(
            true
        );
        expect(
            isActivityForChatHubSurface(makeActivity({ sessionid: "session-a", blockid: "browser-a" }), context)
        ).toBe(true);
    });

    it("does not leak an untargeted or differently correlated run into a second Chamber", () => {
        const firstIdentity = { runIds: new Set(["run-a"]), sessionIds: new Set(["session-a"]) };
        const secondIdentity = { runIds: new Set(["run-b"]), sessionIds: new Set(["session-b"]) };
        const activity = makeActivity({ runid: "run-a", sessionid: "session-a", blockid: "terminal-a" });

        expect(
            isActivityForChatHubSurface(activity, {
                blockId: "chat-a",
                surfaceId: "kronterm:tab-a:chat-a",
                ...firstIdentity,
            })
        ).toBe(true);
        expect(
            isActivityForChatHubSurface(activity, {
                blockId: "chat-b",
                surfaceId: "kronterm:tab-b:chat-b",
                ...secondIdentity,
            })
        ).toBe(false);
        expect(
            isActivityForChatHubSurface(makeActivity({ surface: "terminal" }), {
                blockId: "chat-b",
                surfaceId: "kronterm:tab-b:chat-b",
                ...secondIdentity,
            })
        ).toBe(false);
    });
});
