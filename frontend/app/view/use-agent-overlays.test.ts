import { describe, expect, it } from "vitest";
import type { LiveAgentSurfaceActivity } from "../../types/agent-activity";
import { matchesAgentOverlayTarget } from "./use-agent-overlays";

function activity(
    surface: LiveAgentSurfaceActivity["surface"],
    blockid?: string
): Pick<LiveAgentSurfaceActivity, "surface" | "blockid"> {
    return { surface, blockid };
}

describe("agent overlay targeting", () => {
    it("ignores activity from other surfaces", () => {
        expect(matchesAgentOverlayTarget(activity("browser", "block-1"), "sandbox", "block-1")).toBe(false);
    });

    it("ignores activity explicitly targeted at another block", () => {
        expect(matchesAgentOverlayTarget(activity("sandbox", "block-2"), "sandbox", "block-1")).toBe(false);
    });

    it("allows matching and surface-wide agent activity", () => {
        expect(matchesAgentOverlayTarget(activity("sandbox", "block-1"), "sandbox", "block-1")).toBe(true);
        expect(matchesAgentOverlayTarget(activity("sandbox"), "sandbox", "block-1")).toBe(true);
    });
});
