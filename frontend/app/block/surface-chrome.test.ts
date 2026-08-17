// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { getSurfaceChromeLabel, getSurfaceChromeName } from "./surface-chrome";

describe("surface chrome", () => {
    it.each([
        ["web", "Browser"],
        ["webview", "Browser"],
        ["term", "Terminal"],
        ["preview", "Files"],
        ["codeeditor", "Editor"],
    ])("gives %s a stable product-facing label", (view, label) => {
        expect(getSurfaceChromeLabel(view)).toBe(label);
    });

    it("preserves a view label for surfaces without a canonical label", () => {
        expect(getSurfaceChromeLabel("custom", "Notebook")).toBe("Notebook");
        expect(getSurfaceChromeLabel("custom")).toBe("Widget");
    });

    it("normalizes legacy webview chrome names", () => {
        expect(getSurfaceChromeName("webview")).toBe("web");
        expect(getSurfaceChromeName("term")).toBe("term");
    });
});
