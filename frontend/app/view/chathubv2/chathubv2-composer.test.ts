import { describe, expect, it } from "vitest";
import { makeComposerGuardStyleText } from "./chathubv2-composer";

describe("KronosChamber composer guard", () => {
    it("centers the complete command form instead of a nested input wrapper", () => {
        const css = makeComposerGuardStyleText();

        expect(css).toContain('form[data-kronterm-composer="true"]');
        expect(css).toContain("left: 50% !important");
        expect(css).toContain("transform: translateX(-50%) !important");
        expect(css).toContain("width: min(680px, calc(100% - 32px)) !important");
    });

    it("isolates the real composer form for the compact canvas presentation", () => {
        const css = makeComposerGuardStyleText("mini");

        expect(css).toContain('html[data-kronterm-mini-composer="true"]');
        expect(css).toContain('[data-kronterm-composer-hidden="true"]');
        expect(css).toContain('[data-kronterm-composer-path="true"]');
        expect(css).toContain("position: relative !important");
        expect(css).toContain("max-width: none !important");
    });
});
