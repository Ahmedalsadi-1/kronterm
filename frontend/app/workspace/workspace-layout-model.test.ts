import { describe, expect, test } from "vitest";
import {
    computeWorkspacePanelLayout,
    getWorkspaceTabPresentation,
    isEmptyPanelGroupLayoutError,
} from "./workspace-layout-model";

describe("getWorkspaceTabPresentation", () => {
    test("hides the left workspace tabs only in hidden mode", () => {
        expect(getWorkspaceTabPresentation("hidden")).toEqual({
            showLeftTabBar: false,
            showTopWorkspaceTabs: false,
        });
        expect(getWorkspaceTabPresentation("compact")).toEqual({
            showLeftTabBar: true,
            showTopWorkspaceTabs: false,
        });
        expect(getWorkspaceTabPresentation("full")).toEqual({
            showLeftTabBar: true,
            showTopWorkspaceTabs: false,
        });
    });
});

describe("computeWorkspacePanelLayout", () => {
    test("keeps the workspace tree left and the AI panel right of the content", () => {
        const layout = computeWorkspacePanelLayout({ windowWidth: 1200, vtabWidth: 220, aiPanelWidth: 400 });

        expect(layout.outer[0]).toBeCloseTo(18.333, 2);
        expect(layout.outer[1]).toBeCloseTo(81.667, 2);
        expect(layout.inner[0]).toBeCloseTo(59.184, 2);
        expect(layout.inner[1]).toBeCloseTo(40.816, 2);
    });

    test("lets content use the left edge when the workspace tree is collapsed", () => {
        const layout = computeWorkspacePanelLayout({ windowWidth: 1200, vtabWidth: 0, aiPanelWidth: 400 });

        expect(layout.outer).toEqual([0, 100]);
        expect(layout.inner[0]).toBeCloseTo(66.667, 2);
        expect(layout.inner[1]).toBeCloseTo(33.333, 2);
    });
});

describe("isEmptyPanelGroupLayoutError", () => {
    test("recognizes the transient react-resizable-panels remount error", () => {
        expect(isEmptyPanelGroupLayoutError(new Error("Invalid 0 panel layout: 0%, 100%"))).toBe(true);
    });

    test("does not hide real panel layout failures", () => {
        expect(isEmptyPanelGroupLayoutError(new Error("Invalid 2 panel layout: 100%"))).toBe(false);
        expect(isEmptyPanelGroupLayoutError("Invalid 0 panel layout: 0%, 100%")).toBe(false);
    });
});
