import assert from "node:assert/strict";
import test from "node:test";
import { classifyInteractionError, normalizeShortcut, runInteraction } from "../src/interaction-contract.js";

test("normalizes cross-runtime shortcuts", () => {
    assert.equal(normalizeShortcut(["cmd", "C"]), "Meta+c");
    assert.equal(normalizeShortcut("ctrl+return"), "Control+Enter");
});

test("retries observations but never repeats mutating actions", async () => {
    let observations = 0;
    const observed = await runInteraction(
        { surface: "kronterm", surfaceId: "block-1", action: "observe", maxAttempts: 3 },
        async () => {
            observations++;
            if (observations < 3) throw new Error("connection unavailable");
            return "ready";
        }
    );
    assert.equal(observed.result.ok, true);
    assert.equal(observed.result.attempts, 3);

    let clicks = 0;
    const clicked = await runInteraction(
        { surface: "desktop", surfaceId: "Safari", action: "click", maxAttempts: 3 },
        async () => {
            clicks++;
            throw new Error("timeout");
        }
    );
    assert.equal(clicked.result.ok, false);
    assert.equal(clicks, 1);
});

test("classifies actionable failures", () => {
    assert.equal(classifyInteractionError(new Error("Accessibility permission denied")), "permission");
    assert.equal(classifyInteractionError(new Error("element ref is stale")), "stale-target");
});
