import { describe, expect, it } from "vitest";
import {
    contextForAgentActivity,
    createAgentActivityTimeline,
    cursorActionForAgentActivity,
    inferAgentActivityAction,
    inferAgentActivitySurface,
    normalizeAgentActivity,
    pointFromAgentActivityInput,
} from "./agent-activity";

describe("agent activity normalization", () => {
    it("maps legacy phases into the canonical lifecycle", () => {
        expect(
            normalizeAgentActivity({
                source: "kronoscode-tui",
                phase: "update",
                surface: "browser",
                action: "click",
            }).phase
        ).toBe("running");
        expect(
            normalizeAgentActivity({
                source: "kronoscode-tui",
                phase: "finish",
                surface: "panel",
                action: "focus",
            }).phase
        ).toBe("succeeded");
        expect(
            normalizeAgentActivity({
                source: "kronoscode-tui",
                phase: "error",
                surface: "panel",
                action: "focus",
            }).phase
        ).toBe("failed");
    });

    it("preserves explicit lifecycle and presentation metadata", () => {
        const activity = normalizeAgentActivity({
            source: "acp",
            phase: "awaiting-approval",
            surface: "terminal",
            action: "wait",
            risk: "dangerous",
            presentationHints: { cursorAction: "idle" },
        });

        expect(activity.phase).toBe("awaiting-approval");
        expect(activity.risk).toBe("dangerous");
        expect(cursorActionForAgentActivity(activity)).toBe("idle");
        expect(contextForAgentActivity(activity)).toBe("terminal");
    });

    it("retains title inference as a legacy compatibility path", () => {
        expect(inferAgentActivityAction("desktop_mouse_click")).toBe("click");
        expect(inferAgentActivityAction("browser screenshot")).toBe("screenshot");
        expect(inferAgentActivitySurface("term_run_command")).toBe("terminal");
        expect(inferAgentActivitySurface("widget_click", "block-1")).toBe("browser");
        expect(pointFromAgentActivityInput({ coordinates: { x: 12, y: 24 } })).toEqual({ x: 12, y: 24 });
    });

    it("retains a bounded canonical timeline per run", () => {
        const timeline = createAgentActivityTimeline(2);
        timeline.record({ source: "acp", phase: "start", surface: "panel", action: "thinking" }, 1);
        timeline.record({ source: "acp", phase: "running", surface: "browser", action: "open", runid: "run-1" }, 2);
        timeline.record({ source: "acp", phase: "verifying", surface: "browser", action: "verify", runid: "run-1" }, 3);
        timeline.record({ source: "acp", phase: "finish", surface: "browser", action: "verify", runid: "run-1" }, 4);

        expect(timeline.get()).toHaveLength(1);
        expect(timeline.get("run-1").map(({ phase, timestamp }) => ({ phase, timestamp }))).toEqual([
            { phase: "verifying", timestamp: 3 },
            { phase: "succeeded", timestamp: 4 },
        ]);
    });
});
