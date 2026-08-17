// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { FlexDirection, type LayoutNode } from "@/layout/lib/types";
import { describe, expect, test } from "vitest";
import { getWidgetFocusAfterClose, getWidgetTabCloseAccessibility, moveWidgetTab } from "./widget-tabs-layout-utils";

function node(id: string): LayoutNode {
    return { id, flexDirection: FlexDirection.Row, size: 10 };
}

describe("getWidgetFocusAfterClose", () => {
    const nodes = [node("first"), node("second"), node("third")];

    test("focuses the following tab when the active widget closes", () => {
        expect(getWidgetFocusAfterClose(nodes, "second", "second")).toBe("third");
    });

    test("falls back to the previous tab when the last widget closes", () => {
        expect(getWidgetFocusAfterClose(nodes, "third", "third")).toBe("second");
    });

    test("keeps the active tab when a background widget closes", () => {
        expect(getWidgetFocusAfterClose(nodes, "first", "second")).toBe("second");
    });
});

describe("getWidgetTabCloseAccessibility", () => {
    test("keeps the active close action visible to keyboard and assistive technology", () => {
        expect(getWidgetTabCloseAccessibility(true)).toEqual({ ariaHidden: false, tabIndex: 0 });
    });

    test("removes an inactive close action from keyboard and assistive technology", () => {
        expect(getWidgetTabCloseAccessibility(false)).toEqual({ ariaHidden: true, tabIndex: -1 });
    });
});

describe("moveWidgetTab", () => {
    test("reorders the layout without requesting another presentation mode", () => {
        const actions: unknown[] = [];
        const focused: string[] = [];
        let dropCount = 0;
        const layout = {
            treeReducer: (action: unknown) => actions.push(action),
            onDrop: () => {
                dropCount += 1;
            },
            focusNode: (nodeId: string) => focused.push(nodeId),
        };

        expect(moveWidgetTab(layout, "first", "second", 1)).toBe(true);
        expect(actions).toHaveLength(1);
        expect(dropCount).toBe(1);
        expect(focused).toEqual(["first"]);
    });
});
