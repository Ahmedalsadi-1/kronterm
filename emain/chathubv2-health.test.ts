import { describe, expect, it } from "vitest";
import { isKronosChamberReady } from "./chathubv2-health";

describe("KronosChamber runtime health", () => {
    it("accepts the health payload emitted by the bundled server", () => {
        expect(
            isKronosChamberReady({
                status: "ok",
                openCodeRunning: true,
                isOpenCodeReady: true,
            })
        ).toBe(true);
    });

    it("waits until the managed KronosCode engine is ready", () => {
        expect(
            isKronosChamberReady({
                status: "ok",
                openCodeRunning: false,
                isOpenCodeReady: false,
            })
        ).toBe(false);
    });

    it("rejects an HTML fallback or malformed response", () => {
        expect(isKronosChamberReady("<!doctype html>")).toBe(false);
        expect(isKronosChamberReady(null)).toBe(false);
    });
});
