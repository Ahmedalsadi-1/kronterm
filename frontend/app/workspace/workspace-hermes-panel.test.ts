// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { clampHermesPanelWidth, getHermesPanelWidthBounds } from "./workspace-hermes-panel";

describe("Hermes workspace panel sizing", () => {
    test("uses the reference forty-percent split in tabs mode", () => {
        expect(getHermesPanelWidthBounds("tabs", 1600)).toEqual({ min: 360, max: 896, defaultWidth: 640 });
    });

    test("keeps the compact dock bounds in widgets and canvas modes", () => {
        expect(getHermesPanelWidthBounds("widgets", 1600)).toEqual({ min: 360, max: 520, defaultWidth: 390 });
        expect(getHermesPanelWidthBounds("canvas", 1600)).toEqual({ min: 360, max: 520, defaultWidth: 390 });
    });

    test("clamps persisted widths when the window narrows", () => {
        const bounds = getHermesPanelWidthBounds("tabs", 720);
        expect(clampHermesPanelWidth(900, bounds)).toBe(bounds.max);
    });
});
