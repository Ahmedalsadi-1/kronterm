// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { getAdjacentWidgetFocus } from "./widget-focus-utils";

const LeafOrder: LeafOrderEntry[] = [
    { nodeid: "first", blockid: "block-1" },
    { nodeid: "second", blockid: "block-2" },
    { nodeid: "third", blockid: "block-3" },
];

describe("getAdjacentWidgetFocus", () => {
    test("advances to the next widget tab", () => {
        expect(getAdjacentWidgetFocus(LeafOrder, "first", 1)).toEqual(LeafOrder[1]);
    });

    test("wraps in both directions", () => {
        expect(getAdjacentWidgetFocus(LeafOrder, "third", 1)).toEqual(LeafOrder[0]);
        expect(getAdjacentWidgetFocus(LeafOrder, "first", -1)).toEqual(LeafOrder[2]);
    });

    test("starts at the first widget when focus is stale", () => {
        expect(getAdjacentWidgetFocus(LeafOrder, "missing", 1)).toEqual(LeafOrder[0]);
    });
});
