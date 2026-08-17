// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { blockViewToIcon, resolveBlockIcon } from "./blockutil";

describe("blockViewToIcon", () => {
    test.each([
        ["term", "terminal"],
        ["preview", "file"],
        ["web", "globe"],
        ["chathubv2", "sparkles"],
        ["sysinfo", "chart-line"],
        ["sandbox", "desktop"],
        ["appstream", "desktop"],
        ["launcher", "shapes"],
        ["aifilediff", "file-lines"],
        ["waveconfig", "gear"],
        ["vdom", "bolt"],
    ])("maps %s to a stable icon", (view, icon) => {
        expect(blockViewToIcon(view)).toBe(icon);
    });
});

describe("resolveBlockIcon", () => {
    test("prefers a frame icon saved on the block", () => {
        expect(resolveBlockIcon("term", { "frame:icon": "custom@kronos" })).toBe("custom@kronos");
    });

    test("uses a view fallback while block metadata is still loading", () => {
        expect(resolveBlockIcon("web")).toBe("globe");
    });
});
