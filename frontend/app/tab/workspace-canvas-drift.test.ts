// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    centerWorkspaceCanvasCamera,
    decayWorkspaceCanvasVelocity,
    findDirectionalWorkspaceCanvasRect,
    findWorkspaceCanvasCluster,
    shouldContinueWorkspaceCanvasMomentum,
    snapWorkspaceCanvasRect,
    translateWorkspaceCanvasRect,
    workspaceCanvasEdgePanDelta,
    workspaceCanvasViewportRect,
} from "./workspace-canvas-drift";

describe("workspace canvas drift snapping", () => {
    it("snaps approaching window edges to the configured gap", () => {
        const result = snapWorkspaceCanvasRect({ x: 285, y: 10, width: 100, height: 100 }, [
            ["right", { x: 400, y: 0, width: 200, height: 160 }],
        ]);
        expect(result.rect.x).toBe(288);
        expect(result.snappedTo).toContain("right");
    });

    it("discovers a whole implicit snap cluster", () => {
        expect(
            findWorkspaceCanvasCluster("a", {
                a: { x: 0, y: 0, width: 100, height: 100 },
                b: { x: 112, y: 0, width: 100, height: 100 },
                c: { x: 224, y: 0, width: 100, height: 100 },
                detached: { x: 500, y: 0, width: 100, height: 100 },
            })
        ).toEqual(["a", "b", "c"]);
    });

    it("reports only the closest snap owners on each axis", () => {
        const result = snapWorkspaceCanvasRect(
            { x: 278, y: 282, width: 100, height: 100 },
            [
                ["stale-x", { x: 395, y: 260, width: 100, height: 100 }],
                ["closest-x", { x: 390, y: 260, width: 100, height: 100 }],
                ["closest-y", { x: 260, y: 394, width: 100, height: 100 }],
            ],
            12,
            24
        );

        expect(result.rect).toMatchObject({ x: 278, y: 282 });
        expect(result.snappedTo).toEqual(["closest-x", "closest-y"]);
    });

    it("translates a snapped rectangle without changing its size", () => {
        expect(translateWorkspaceCanvasRect({ x: 10, y: 20, width: 320, height: 180 }, { x: -4, y: 12 })).toEqual({
            x: 6,
            y: 32,
            width: 320,
            height: 180,
        });
    });
});

describe("workspace canvas drift navigation", () => {
    const rects = {
        center: { x: 0, y: 0, width: 100, height: 100 },
        right: { x: 180, y: 20, width: 100, height: 100 },
        farRight: { x: 400, y: 0, width: 100, height: 100 },
        down: { x: 10, y: 240, width: 100, height: 100 },
    };

    it("selects the nearest spatial target in a direction", () => {
        expect(findDirectionalWorkspaceCanvasRect("center", "right", rects)).toBe("right");
        expect(findDirectionalWorkspaceCanvasRect("center", "down", rects)).toBe("down");
        expect(findDirectionalWorkspaceCanvasRect("center", "left", rects)).toBeNull();
    });

    it("centers the camera and reports its visible world rectangle", () => {
        const camera = centerWorkspaceCanvasCamera(rects.right, { width: 1000, height: 700 }, 1);
        expect(camera).toEqual({ x: 270, y: 280, zoom: 1 });
        expect(workspaceCanvasViewportRect(camera, { width: 1000, height: 700 })).toEqual({
            x: -270,
            y: -280,
            width: 1000,
            height: 700,
        });
    });

    it("accelerates edge pan toward the canvas interior", () => {
        expect(workspaceCanvasEdgePanDelta({ x: 0, y: 350 }, { width: 1000, height: 700 })).toEqual({ x: 18, y: 0 });
        expect(workspaceCanvasEdgePanDelta({ x: 1000, y: 700 }, { width: 1000, height: 700 })).toEqual({
            x: -18,
            y: -18,
        });
    });

    it("decays momentum consistently and stops it for reduced motion", () => {
        expect(decayWorkspaceCanvasVelocity({ x: 1, y: -0.5 }, 16.67)).toEqual({ x: 0.9, y: -0.45 });
        expect(shouldContinueWorkspaceCanvasMomentum({ x: 0.4, y: 0 }, false)).toBe(true);
        expect(shouldContinueWorkspaceCanvasMomentum({ x: 0.4, y: 0 }, true)).toBe(false);
        expect(shouldContinueWorkspaceCanvasMomentum({ x: 0.001, y: 0.001 }, false)).toBe(false);
    });
});
