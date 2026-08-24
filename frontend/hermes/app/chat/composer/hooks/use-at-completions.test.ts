// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { liveSurfaceEntries } from "./use-at-completions";

describe("KronTerm @ completions", () => {
    it("includes live widgets and each internal browser tab", () => {
        const entries = liveSurfaceEntries(
            [
                {
                    active: false,
                    browserTabs: [
                        { active: true, id: "docs", title: "Hermes docs", url: "https://example.com/docs" },
                        { active: false, id: "issues", title: "Issues", url: "https://example.com/issues" },
                    ],
                    focused: true,
                    id: "browser-1",
                    title: "Research browser",
                    view: "web",
                },
                {
                    active: true,
                    focused: false,
                    id: "term-1",
                    title: "Build terminal",
                    view: "term",
                },
            ],
            ""
        );

        expect(entries.map((entry) => entry.text)).toEqual([
            "@widget:browser-1",
            "@url:https://example.com/docs",
            "@url:https://example.com/issues",
            "@widget:term-1",
        ]);
        expect(entries[1].meta).toContain("active");
    });

    it("filters across titles, URLs, and widget kinds", () => {
        expect(
            liveSurfaceEntries(
                [{ active: false, focused: false, id: "term-1", title: "Build terminal", view: "term" }],
                "terminal"
            ).map((entry) => entry.text)
        ).toEqual(["@widget:term-1"]);
    });
});
