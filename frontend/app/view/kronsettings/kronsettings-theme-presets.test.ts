// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vitest";
import { THEME_PRESETS, applyCustomAccent } from "./kronsettings-theme-presets";

afterEach(() => {
    document.documentElement.removeAttribute("style");
});

describe("Omarchy theme presets", () => {
    test("includes all 22 official palettes with unique identifiers", () => {
        expect(THEME_PRESETS).toHaveLength(22);
        expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(22);
    });

    test("maps every palette across Hermes semantics, shell compatibility, and terminal colors", () => {
        for (const preset of THEME_PRESETS) {
            expect(preset.colors["--hermes-background"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--hermes-foreground"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--hermes-card"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--hermes-midground"]).toBe(preset.colors["--accent-color"]);
            expect(preset.colors["--hermes-ring"]).toBe(preset.colors["--focus-ring-color"]);
            expect(preset.colors["--hermes-sidebar-foreground"]).toBe(preset.colors["--hermes-foreground"]);
            expect(preset.colors["--hermes-destructive"]).toBe(preset.colors["--term-red"]);
            expect(preset.colors["--hermes-warning"]).toBe(preset.colors["--term-yellow"]);
            expect(preset.colors["--hermes-success"]).toBe(preset.colors["--term-green"]);
            expect(preset.colors["--hermes-interactive-selection"]).toBe(preset.colors["--surface-selected-color"]);
            expect(preset.colors["--accent-color"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--surface-base-color"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-background"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-foreground"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-red"]).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.colors["--term-blue"]).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    test("keeps custom accents synchronized across Hermes and compatibility tokens", () => {
        applyCustomAccent(12, 34, 56);

        const style = document.documentElement.style;
        expect(style.getPropertyValue("--hermes-primary")).toBe("rgb(12, 34, 56)");
        expect(style.getPropertyValue("--hermes-midground")).toBe("rgb(12, 34, 56)");
        expect(style.getPropertyValue("--hermes-ring")).toBe("rgba(12, 34, 56, 0.72)");
        expect(style.getPropertyValue("--accent-color")).toBe("rgb(12, 34, 56)");
        expect(style.getPropertyValue("--focus-ring-color")).toBe("rgba(12, 34, 56, 0.72)");
    });
});
