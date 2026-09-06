// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    extractCanvasEdgesFromArrowBindings,
    extractCanvasEdgesFromNodeParents,
    mergeCanvasEdges,
    summarizeCanvas,
} from "./kronoscanvas-utils";

describe("kronoscanvas-utils", () => {
    it("extracts tldraw arrow bindings into semantic canvas edges", () => {
        const shapeToNode = new Map([
            ["shape:text", "node:text"],
            ["shape:widget", "node:widget"],
        ]);
        const edges = extractCanvasEdgesFromArrowBindings(
            [
                { fromId: "shape:arrow", toId: "shape:text", props: { terminal: "start" } },
                { fromId: "shape:arrow", toId: "shape:widget", props: { terminal: "end" } },
            ],
            shapeToNode
        );
        expect(edges).toEqual([
            {
                id: "shape:arrow",
                shapeid: "shape:arrow",
                fromnode: "node:text",
                tonode: "node:widget",
            },
        ]);
    });

    it("summarizes nodes and connections", () => {
        const summary = summarizeCanvas(
            [
                { id: "a", shapeid: "shape:a", type: "text", title: "Prompt" },
                { id: "b", shapeid: "shape:b", type: "widget", title: "Terminal" },
            ] as CanvasNode[],
            [{ id: "edge", fromnode: "a", tonode: "b" }] as CanvasEdge[]
        );
        expect(summary).toContain("[text] Prompt");
        expect(summary).toContain("Prompt -> Terminal");
        expect(summary).not.toContain("\\n");
    });

    it("extracts Flowith-style parent links from node metadata", () => {
        const parentEdges = extractCanvasEdgesFromNodeParents([
            { id: "parent", shapeid: "shape:parent", type: "text", title: "Parent" },
            {
                id: "child",
                shapeid: "shape:child",
                type: "text",
                title: "Child",
                meta: { kronosParentNodeId: "parent" },
            },
        ] as CanvasNode[]);
        expect(parentEdges).toEqual([
            {
                id: "follow:parent:child",
                shapeid: "shape:child",
                fromnode: "parent",
                tonode: "child",
                label: "follow",
            },
        ]);
        expect(
            mergeCanvasEdges([{ id: "arrow", fromnode: "parent", tonode: "child" }] as CanvasEdge[], parentEdges)
        ).toHaveLength(2);
    });
});
