// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";
import { consumeHermesHudAutoOpen, resetHermesHudAutoOpenForTests } from "./hermes-startup";

afterEach(resetHermesHudAutoOpenForTests);

describe("Hermes HUD startup", () => {
    it("auto-opens only once for the renderer launch", () => {
        expect(consumeHermesHudAutoOpen()).toBe(true);
        expect(consumeHermesHudAutoOpen()).toBe(false);
        expect(consumeHermesHudAutoOpen()).toBe(false);
    });
});
