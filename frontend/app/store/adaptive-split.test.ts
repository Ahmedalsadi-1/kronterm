// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { getAdaptiveSplitDirection } from "./adaptive-split";

describe("getAdaptiveSplitDirection", () => {
    test("splits a wide pane side by side", () => {
        expect(getAdaptiveSplitDirection(1200, 600)).toBe("horizontal");
    });

    test("stacks a tall pane", () => {
        expect(getAdaptiveSplitDirection(480, 900)).toBe("vertical");
    });

    test("uses the longer edge for nearly square panes", () => {
        expect(getAdaptiveSplitDirection(620, 600)).toBe("horizontal");
        expect(getAdaptiveSplitDirection(600, 620)).toBe("vertical");
    });
});
