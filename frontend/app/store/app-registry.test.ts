// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";

import {
    focusOrCreateDecision,
    getBuiltinViewDescriptors,
    makeInstalledAppDescriptor,
    makeViewAppDescriptor,
    mergeAppDescriptors,
    searchApps,
    type AppBlockRef,
} from "@/app/store/app-registry";

function makeBlock(view: string, blockId: string): AppBlockRef {
    return { blockId, view, title: blockId };
}

describe("app-registry", () => {
    test("view descriptor carries block view name, icon, and running blocks", () => {
        const descriptor = makeViewAppDescriptor("term", ["b1", "b2"]);
        expect(descriptor.id).toBe("view:term");
        expect(descriptor.kind).toBe("view");
        expect(descriptor.view).toBe("term");
        expect(descriptor.name.length).toBeGreaterThan(0);
        expect(descriptor.icon).toBeTruthy();
        expect(descriptor.runningBlockIds).toEqual(["b1", "b2"]);
        expect(descriptor.pinned).toBe(true);
        expect(descriptor.aliases).toContain("terminal");
    });

    test("installed app descriptor uses platform icon and stable id", () => {
        const descriptor = makeInstalledAppDescriptor({
            name: "Google Chrome",
            appid: "com.google.Chrome",
            path: "/Applications/Google Chrome.app",
            icon: "data:image/png;base64,AAAA",
            category: "Applications",
            source: "macos",
            bundleid: "com.google.Chrome",
        });
        expect(descriptor.id).toBe("app:com.google.Chrome");
        expect(descriptor.kind).toBe("installed");
        expect(descriptor.icon).toBe("data:image/png;base64,AAAA");
        expect(descriptor.aliases).toContain("google chrome");
    });

    test("merge attaches running blocks to view descriptors", () => {
        const builtins = getBuiltinViewDescriptors([makeBlock("term", "t1"), makeBlock("web", "w1"), makeBlock("web", "w2")]);
        const chrome = makeInstalledAppDescriptor({
            name: "Google Chrome",
            appid: "com.google.Chrome",
            path: "/Applications/Google Chrome.app",
            source: "macos",
        });
        const merged = mergeAppDescriptors(builtins, [chrome], [
            makeBlock("term", "t1"),
            makeBlock("web", "w1"),
            makeBlock("web", "w2"),
        ]);
        const term = merged.find((descriptor) => descriptor.id === "view:term");
        const web = merged.find((descriptor) => descriptor.id === "view:web");
        expect(term?.runningBlockIds).toEqual(["t1"]);
        expect(web?.runningBlockIds).toEqual(["w1", "w2"]);
        expect(merged.filter((descriptor) => descriptor.id === "app:com.google.Chrome")).toHaveLength(1);
    });

    test("search matches names and aliases case-insensitively", () => {
        const descriptors = getBuiltinViewDescriptors([]);
        expect(searchApps(descriptors, "SHEET")).toEqual([]);
        expect(searchApps(descriptors, "terminal").map((d) => d.id)).toContain("view:term");
        expect(searchApps(descriptors, "browser").map((d) => d.id)).toContain("view:web");
        expect(searchApps(descriptors, "kronoschamber").map((d) => d.id)).toContain("view:chathubv2");
        expect(searchApps(descriptors, "").length).toBe(descriptors.length);
    });

    test("launch decision focuses running, creates views, defers native", () => {
        const running = makeViewAppDescriptor("web", ["w1"]);
        expect(focusOrCreateDecision(running)).toEqual({ action: "focus", blockId: "w1" });

        const idle = makeViewAppDescriptor("term", []);
        expect(focusOrCreateDecision(idle)).toEqual({ action: "create", view: "term" });

        const native = makeInstalledAppDescriptor({
            name: "Figma",
            appid: "com.figma.Desktop",
            path: "/Applications/Figma.app",
            source: "macos",
        });
        const decision = focusOrCreateDecision(native);
        expect(decision.action).toBe("unsupported");
    });
});
