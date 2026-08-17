// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    canvasBoundsForRects,
    fitCanvasCameraToBounds,
    isCanvasShortcutInteractiveTarget,
    makeViewportCenteredCanvasRect,
    screenPointToCanvas,
    zoomCanvasCameraAtPoint,
} from "./workspace-canvas-utils";

describe("workspace canvas keyboard scope", () => {
    const target = (matchingSelector: string | null, isContentEditable = false) =>
        ({
            isContentEditable,
            closest: (selector: string) => (matchingSelector && selector.includes(matchingSelector) ? {} : null),
        }) as unknown as EventTarget;

    it.each(["button", "input", "textarea", "select", "summary"])("preserves shortcuts for a focused %s", (tag) => {
        expect(isCanvasShortcutInteractiveTarget(target(tag))).toBe(true);
    });

    it("preserves shortcuts for descendants and ARIA controls", () => {
        expect(isCanvasShortcutInteractiveTarget(target("button"))).toBe(true);
        expect(isCanvasShortcutInteractiveTarget(target("[role='switch']"))).toBe(true);
    });

    it("preserves shortcuts inside editable regions but handles the canvas surface", () => {
        expect(isCanvasShortcutInteractiveTarget(target(null, true))).toBe(true);
        expect(isCanvasShortcutInteractiveTarget(target(null))).toBe(false);
        expect(isCanvasShortcutInteractiveTarget(null)).toBe(false);
    });
});

describe("workspace canvas camera", () => {
    it("keeps the cursor anchored while zooming", () => {
        const point = { x: 420, y: 260 };
        const before = screenPointToCanvas({ x: 80, y: 40, zoom: 0.8 }, point);
        const camera = zoomCanvasCameraAtPoint({ x: 80, y: 40, zoom: 0.8 }, 1.35, point);
        expect(screenPointToCanvas(camera, point)).toEqual(before);
    });

    it("centers a new widget in the visible viewport", () => {
        expect(
            makeViewportCenteredCanvasRect(
                { x: -200, y: 100, zoom: 0.5 },
                { width: 1200, height: 800 },
                { width: 800, height: 520 }
            )
        ).toEqual({ x: 1200, y: 340, width: 800, height: 520 });
    });

    it("fits positive and negative canvas content into the viewport", () => {
        const bounds = canvasBoundsForRects([
            { x: -600, y: -200, width: 300, height: 200 },
            { x: 400, y: 300, width: 500, height: 400 },
        ]);
        expect(bounds).toEqual({ x: -600, y: -200, width: 1500, height: 900 });
        expect(fitCanvasCameraToBounds(bounds!, { width: 1200, height: 800 }, 100)).toEqual({
            x: 500,
            y: 233,
            zoom: 2 / 3,
        });
    });

    it("fits content wider than the interactive zoom range", () => {
        expect(
            fitCanvasCameraToBounds({ x: 0, y: 0, width: 20_000, height: 1_000 }, { width: 1_200, height: 800 }, 100)
        ).toEqual({
            x: 100,
            y: 375,
            zoom: 0.05,
        });
    });
});
