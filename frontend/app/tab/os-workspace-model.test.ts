// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    computeOSWindowLayout,
    findOSDockHitTarget,
    makeInitialOSModeState,
    reconcileOSModeState,
    reduceOSModeState,
} from "./os-workspace-model";

function tab(meta: Record<string, unknown> = {}): Tab {
    return { oid: "tab-1", blockids: ["browser", "hermes", "term"], meta } as Tab;
}

describe("OS workspace state", () => {
    it("seeds geometry and canvas notes without mutating Canvas state", () => {
        const canvas = {
            camera: { x: 12, y: 16, zoom: 0.75 },
            rects: { browser: { x: 40, y: 80, width: 900, height: 600 } },
            objects: [{ id: "note-1", kind: "note", x: 4, y: 8, width: 240, height: 176, text: "Keep me" }],
        };
        const tabData = tab({ "layout:canvas": canvas });
        const state = makeInitialOSModeState(tabData, tabData.blockids);
        expect(state.windows.browser.bounds).toEqual(canvas.rects.browser);
        expect(state.objects[0]).toMatchObject({ id: "note-1", text: "Keep me" });
        expect((tabData.meta as any)["layout:os"]).toBeUndefined();
    });

    it("defaults widget presentation to canvas, restores stored value, and toggles idempotently", () => {
        const defaultState = makeInitialOSModeState(tab(), ["browser"]);
        expect(defaultState.widgetPresentation).toBe("canvas");

        const stored = tab({ "layout:os": { widgetPresentation: "file" } });
        const fileState = makeInitialOSModeState(stored, ["browser"]);
        expect(fileState.widgetPresentation).toBe("file");

        const toggled = reduceOSModeState(fileState, { type: "spatial.setWidgetPresentation", presentation: "canvas" });
        expect(toggled.widgetPresentation).toBe("canvas");
        expect(reduceOSModeState(toggled, { type: "spatial.setWidgetPresentation", presentation: "canvas" })).toBe(
            toggled
        );
    });

    it("preserves block identity through focus, docking, overview, and detach", () => {
        let state = makeInitialOSModeState(tab(), ["browser", "hermes", "term"]);
        state = reduceOSModeState(state, { type: "spatial.focus", blockId: "browser" });
        state = reduceOSModeState(state, {
            type: "spatial.dock",
            blockId: "hermes",
            targetBlockId: "browser",
            side: "left",
        });
        expect(state.scene.kind).toBe("grouped");
        expect(Object.values(state.groups)[0]).toMatchObject({ primaryBlockId: "browser", sideBlockId: "hermes" });
        state = reduceOSModeState(state, { type: "spatial.showOverview" });
        expect(state.scene.kind).toBe("overview");
        state = reduceOSModeState(state, { type: "spatial.restoreScene" });
        expect(state.scene.kind).toBe("grouped");
        state = reduceOSModeState(state, { type: "spatial.detach", blockId: "hermes" });
        expect(state.scene).toEqual({ kind: "focused", blockId: "browser" });
        expect(Object.keys(state.windows)).toEqual(["browser", "hermes", "term"]);
    });

    it("removes stale group references when a live block closes", () => {
        let state = makeInitialOSModeState(tab(), ["browser", "hermes", "term"]);
        state = reduceOSModeState(state, {
            type: "spatial.dock",
            blockId: "hermes",
            targetBlockId: "browser",
            side: "right",
        });
        state = reconcileOSModeState(state, ["browser", "term"]);
        expect(state.groups).toEqual({});
        expect(state.scene).toEqual({ kind: "freeform" });
    });

    it("keeps a live group member focused when either docked window collapses", () => {
        let state = makeInitialOSModeState(tab(), ["browser", "hermes", "term"]);
        state = reduceOSModeState(state, {
            type: "spatial.dock",
            blockId: "hermes",
            targetBlockId: "browser",
            side: "left",
        });
        state = reduceOSModeState(state, { type: "spatial.collapse", blockId: "browser" });

        expect(state.groups).toEqual({});
        expect(state.scene).toEqual({ kind: "focused", blockId: "hermes" });

        state = reduceOSModeState(state, { type: "spatial.restore", blockId: "browser" });
        state = reduceOSModeState(state, {
            type: "spatial.dock",
            blockId: "hermes",
            targetBlockId: "browser",
            side: "right",
        });
        state = reduceOSModeState(state, { type: "spatial.collapse", blockId: "hermes" });

        expect(state.groups).toEqual({});
        expect(state.scene).toEqual({ kind: "focused", blockId: "browser" });
    });

    it("places newly opened windows away from an occupied default slot", () => {
        let state = makeInitialOSModeState(tab(), ["browser", "hermes", "term"]);
        state = {
            ...state,
            windows: {
                ...state.windows,
                term: { ...state.windows.term, bounds: { x: 980, y: 720, width: 760, height: 470 } },
            },
        };

        state = reconcileOSModeState(state, ["browser", "hermes", "term", "files"]);

        expect(state.windows.files.bounds).not.toEqual(state.windows.term.bounds);
    });

    it("derives perspective rails and Cover Flow from scene state", () => {
        let state = makeInitialOSModeState(tab(), ["browser", "hermes", "term"]);
        state = reduceOSModeState(state, { type: "spatial.focus", blockId: "browser" });
        expect(computeOSWindowLayout(state, "term", "term", { width: 1440, height: 900 }).presentation).toMatch(
            /^edge-/
        );
        state = reduceOSModeState(state, { type: "spatial.showOverview", selectedBlockId: "hermes" });
        const selected = computeOSWindowLayout(state, "hermes", "chathubv2", { width: 1440, height: 900 });
        const neighbor = computeOSWindowLayout(state, "browser", "web", { width: 1440, height: 900 });
        expect(selected.presentation).toBe("overview");
        expect(selected.rotateY).toBe(0);
        expect(neighbor.scale).toBeLessThan(selected.scale);
    });

    it("finds the topmost live window beneath a dragged floating window", () => {
        const hit = findOSDockHitTarget(
            "hermes",
            { x: 740, y: 320 },
            {
                browser: {
                    bounds: { x: 300, y: 120, width: 900, height: 620 },
                    opacity: 1,
                    presentation: "freeform",
                    zIndex: 4,
                },
                sheets: {
                    bounds: { x: 520, y: 160, width: 780, height: 580 },
                    opacity: 1,
                    presentation: "freeform",
                    zIndex: 8,
                },
                hermes: {
                    bounds: { x: 610, y: 220, width: 360, height: 480 },
                    opacity: 1,
                    presentation: "freeform",
                    zIndex: 12,
                },
            }
        );
        expect(hit).toMatchObject({ targetBlockId: "sheets", side: "left" });
    });
});
