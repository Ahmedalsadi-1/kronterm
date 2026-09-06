// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { filterCommandPaletteActions, normalizeCommandSearch } from "./command-palette-utils";

const Commands = [
    { label: "Ask Kronos", detail: "Focus the agent composer", keywords: ["agent", "chat", "ai"] },
    { label: "New terminal", detail: "Open a local shell widget", keywords: ["shell", "command", "cli"] },
    { label: "Open browser", detail: "Research or navigate the web", keywords: ["web", "comet", "url"] },
];

describe("command palette search", () => {
    it("normalizes whitespace and casing", () => {
        expect(normalizeCommandSearch("  NEW   Terminal ")).toEqual(["new", "terminal"]);
    });

    it("matches every token across labels and metadata", () => {
        expect(filterCommandPaletteActions(Commands, "local shell").map((command) => command.label)).toEqual([
            "New terminal",
        ]);
    });

    it("ranks direct label matches ahead of metadata matches", () => {
        expect(filterCommandPaletteActions(Commands, "agent").map((command) => command.label)).toEqual(["Ask Kronos"]);
        expect(filterCommandPaletteActions(Commands, "open").map((command) => command.label)).toEqual([
            "Open browser",
            "New terminal",
        ]);
    });

    it("keeps source order for empty queries so applications lead the grouped list", () => {
        const applications = [{ label: "Terminal", detail: "Application", keywords: ["shell"] }];
        expect(
            filterCommandPaletteActions([...applications, ...Commands], "").map((command) => command.label)
        ).toEqual(["Terminal", "Ask Kronos", "New terminal", "Open browser"]);
    });
});
