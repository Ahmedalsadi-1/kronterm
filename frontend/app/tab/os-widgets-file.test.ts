// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";

import { groupWidgetsByCategory } from "./os-widgets-file";

describe("widgets file view", () => {
    it("groups blocks by widget category and catches stragglers", () => {
        const blocks = [
            { blockId: "s1", view: "sysinfo", title: "System" },
            { blockId: "n1", view: "preview", title: "Notes" },
            { blockId: "a1", view: "chathubv2", title: "Chamber" },
            { blockId: "x1", view: "appstream", title: "Figma" },
            { blockId: "z1", view: "term", title: "Shell" },
        ];
        const groups = groupWidgetsByCategory(blocks);
        expect(groups.map((group) => group.id)).toEqual(["system", "productivity", "agents", "applications"]);
        expect(groups[0].blocks.map((block) => block.blockId)).toEqual(["s1", "z1"]);
    });

    it("omits empty categories and files uncategorized views under Other", () => {
        expect(groupWidgetsByCategory([{ blockId: "t", view: "help", title: "Help" }])).toEqual([
            { id: "other", label: "Other", blocks: [{ blockId: "t", view: "help", title: "Help" }] },
        ]);
    });
});
