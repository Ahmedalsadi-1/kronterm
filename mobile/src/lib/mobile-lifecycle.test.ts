import { describe, expect, it } from "vitest";
import { gatewayReconnectDelay, transitionMobileLifecycle } from "./mobile-lifecycle";

describe("transitionMobileLifecycle", () => {
    it("pauses once when multiple background signals arrive", () => {
        const appSignal = transitionMobileLifecycle(true, false);
        const visibilitySignal = transitionMobileLifecycle(appSignal.active, false);

        expect(appSignal).toEqual({ active: false, action: "pause" });
        expect(visibilitySignal).toEqual({ active: false, action: "none" });
    });

    it("resumes once when multiple foreground signals arrive", () => {
        const appSignal = transitionMobileLifecycle(false, true);
        const visibilitySignal = transitionMobileLifecycle(appSignal.active, true);

        expect(appSignal).toEqual({ active: true, action: "resume" });
        expect(visibilitySignal).toEqual({ active: true, action: "none" });
    });

    it("does not change an already active lifecycle", () => {
        expect(transitionMobileLifecycle(true, true)).toEqual({ active: true, action: "none" });
    });
});

describe("gatewayReconnectDelay", () => {
    it("backs off quickly and caps retries", () => {
        expect([0, 1, 2, 3, 4, 20].map(gatewayReconnectDelay)).toEqual([1_000, 2_000, 5_000, 10_000, 20_000, 20_000]);
    });
});
