// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { THEME_PRESETS } from "./kronsettings-theme-presets";

describe("Omarchy theme presets", () => {
    test("includes all 22 official palettes with unique identifiers", () => {
        expect(THEME_PRESETS).toHaveLength(22);
        expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(22);
    });

    test("maps every palette across shell and terminal colors", () => {
        for (const preset of THEME_PRESETS) {
            expect(preset.colors["--accent-color"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--surface-base-color"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-background"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-foreground"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-red"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-blue"]).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});
