// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { getBrowserTabIdAfterClose, getNextBrowserTabIndex } from "./webview-tabs";

describe("browser tab keyboard interaction", () => {
    it.each([
        ["ArrowRight", 0, "horizontal", 1],
        ["ArrowRight", 2, "horizontal", 0],
        ["ArrowLeft", 0, "horizontal", 2],
        ["ArrowDown", 0, "vertical", 1],
        ["ArrowUp", 0, "vertical", 2],
        ["Home", 2, "horizontal", 0],
        ["End", 0, "vertical", 2],
    ] as const)("moves %s from tab %s in a %s strip to %s", (key, index, orientation, expected) => {
        expect(getNextBrowserTabIndex(key, index, 3, orientation)).toBe(expected);
    });

    it("leaves focus alone for keys outside the tab interaction pattern", () => {
        expect(getNextBrowserTabIndex("Enter", 1, 3, "horizontal")).toBeNull();
        expect(getNextBrowserTabIndex("ArrowDown", 1, 3, "horizontal")).toBeNull();
    });

    it("keeps focus aligned with selection after close", () => {
        const tabIds = ["docs", "terminal", "preview"];
        expect(getBrowserTabIdAfterClose(tabIds, "terminal", "terminal")).toBe("docs");
        expect(getBrowserTabIdAfterClose(tabIds, "preview", "preview")).toBe("terminal");
        expect(getBrowserTabIdAfterClose(tabIds, "docs", "preview")).toBe("docs");
        expect(getBrowserTabIdAfterClose(["docs"], "docs", "docs")).toBeNull();
    });
});
