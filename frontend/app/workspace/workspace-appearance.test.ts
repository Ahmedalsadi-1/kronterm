// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";
import { applyWorkspaceAppearance, readWorkspaceAppearance } from "./workspace-appearance";

describe("workspace appearance typography", () => {
    afterEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute("style");
        delete document.documentElement.dataset.krontermDensity;
        delete document.documentElement.dataset.krontermIcons;
    });

    it("uses the Hermes font pairing for a fresh workspace", () => {
        const appearance = readWorkspaceAppearance();

        expect(appearance).toEqual({ font: "hermes", density: "comfortable", icons: "soft" });

        applyWorkspaceAppearance(appearance);

        expect(document.documentElement.style.getPropertyValue("--hermes-font-sans")).toContain("Inter");
        expect(document.documentElement.style.getPropertyValue("--hermes-font-mono")).toContain("JetBrains Mono");
    });

    it("keeps a saved font and density preference", () => {
        window.localStorage.setItem(
            "kronterm:workspace-appearance",
            JSON.stringify({ font: "system", density: "compact", icons: "minimal" })
        );

        const appearance = readWorkspaceAppearance();
        applyWorkspaceAppearance(appearance);

        expect(appearance).toEqual({ font: "system", density: "compact", icons: "minimal" });
        expect(document.documentElement.style.getPropertyValue("--hermes-font-sans")).toContain("system-ui");
        expect(document.documentElement.style.getPropertyValue("--hermes-font-mono")).toContain("ui-monospace");
    });

    it("clears legacy direct font overrides so semantic aliases stay authoritative", () => {
        const root = document.documentElement;
        root.style.setProperty("--font-default", "legacy");
        root.style.setProperty("--font-mono-family", "legacy");
        root.style.setProperty("--markdown-font-family", "legacy");

        applyWorkspaceAppearance({ font: "hermes", density: "comfortable", icons: "soft" });

        expect(root.style.getPropertyValue("--font-default")).toBe("");
        expect(root.style.getPropertyValue("--font-mono-family")).toBe("");
        expect(root.style.getPropertyValue("--markdown-font-family")).toBe("");
    });
});
