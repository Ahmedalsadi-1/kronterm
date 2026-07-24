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
});
