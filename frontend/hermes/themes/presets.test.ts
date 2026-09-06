// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").

import { describe, expect, it } from "vitest";
import { BUILTIN_THEME_LIST, DEFAULT_THEME_MODE, DEFAULT_TYPOGRAPHY, nousTheme } from "./presets";

describe("built-in Hermes themes", () => {
    it("does not inject remote font stylesheets into the KronTerm renderer", () => {
        expect(BUILTIN_THEME_LIST.map((theme) => theme.typography?.fontUrl).filter(Boolean)).toEqual([]);
    });

    it("starts fresh Hermes sessions in the neutral dark Nous palette", () => {
        expect(DEFAULT_THEME_MODE).toBe("dark");
        expect(nousTheme.darkColors).toMatchObject({
            background: "#09090B",
            foreground: "#F4F4F5",
            card: "#111113",
            primary: "#F4F4F5",
            midground: "#0053FD",
        });
    });

    it("uses bundled UI and code fonts as the universal Hermes pairing", () => {
        expect(DEFAULT_TYPOGRAPHY.fontSans).toContain("Inter");
        expect(DEFAULT_TYPOGRAPHY.fontMono).toContain("JetBrains Mono");
    });
});
