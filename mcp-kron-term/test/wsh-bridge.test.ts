// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
    makeLspArgs,
    makeSandboxClickArgs,
    makeSandboxDragArgs,
    makeWidgetClickArgs,
    makeWidgetHoverArgs,
    makeWorkspaceSurfaceControlArgs,
    readSurfaceCapability,
} from "../src/wsh-bridge.ts";

describe("wsh bridge command builders", () => {
    it("reads a refreshed surface capability without exposing extra fields", () => {
        const filePath = join(tmpdir(), `kronterm-surface-${process.pid}-${Date.now()}.json`);
        writeFileSync(filePath, JSON.stringify({ token: "jwt-1", tabId: "tab-1", blockId: "block-1", ignored: true }));
        assert.deepEqual(readSurfaceCapability(filePath), {
            token: "jwt-1",
            tabId: "tab-1",
            blockId: "block-1",
        });
    });

    it("rejects malformed surface capability files", () => {
        const filePath = join(tmpdir(), `kronterm-surface-invalid-${process.pid}-${Date.now()}.json`);
        writeFileSync(filePath, JSON.stringify({ tabId: "tab-1" }));
        assert.throws(() => readSurfaceCapability(filePath), /missing token or tabId/);
    });

    it("builds presentation-aware canvas geometry args without dropping zero coordinates", () => {
        assert.deepEqual(
            makeWorkspaceSurfaceControlArgs({
                action: "resize",
                blockId: "block:block-1",
                x: 0,
                y: 0,
                width: 840,
                height: 540,
            }),
            [
                "workspace-surface",
                "control",
                "resize",
                "--block",
                "block-1",
                "--x",
                "0",
                "--y",
                "0",
                "--width",
                "840",
                "--height",
                "540",
            ]
        );
    });

    it("builds workspace whiteboard object args", () => {
        assert.deepEqual(
            makeWorkspaceSurfaceControlArgs({
                action: "add_note",
                text: "Investigate browser flow",
                color: "amber",
                x: 0,
                y: 320,
            }),
            [
                "workspace-surface",
                "control",
                "add_note",
                "--x",
                "0",
                "--y",
                "320",
                "--text",
                "Investigate browser flow",
                "--color",
                "amber",
            ]
        );
    });

    it("builds scoped LSP query args with bounded position options", () => {
        assert.deepEqual(makeLspArgs("/workspace", "src/main.go", "go", "definition", 4, 8, 25), [
            "lsp",
            "/workspace",
            "src/main.go",
            "go",
            "definition",
            "--line",
            "4",
            "--character",
            "8",
            "--max-results",
            "25",
        ]);
    });

    it("builds widget click args for element refs", () => {
        assert.deepEqual(makeWidgetClickArgs("abc123", "@e3", undefined, undefined, "right", "double"), [
            "-b",
            "block:abc123",
            "widget",
            "click",
            "--element-ref",
            "@e3",
            "--button",
            "right",
            "--click-type",
            "double",
        ]);
    });

    it("builds widget click args for coordinates", () => {
        assert.deepEqual(makeWidgetClickArgs("block:abc123", undefined, 40, 50, "left", "single"), [
            "-b",
            "block:abc123",
            "widget",
            "click",
            "--x",
            "40",
            "--y",
            "50",
            "--button",
            "left",
            "--click-type",
            "single",
        ]);
    });

    it("rejects widget clicks without a target", () => {
        assert.throws(
            () => makeWidgetClickArgs("abc123"),
            /widget click requires exactly one target: elementRef or both x and y/
        );
    });

    it("rejects widget clicks with ambiguous targets", () => {
        assert.throws(
            () => makeWidgetClickArgs("abc123", "@e3", 40, 50),
            /widget click requires exactly one target: elementRef or both x and y/
        );
    });

    it("rejects widget clicks with partial coordinates", () => {
        assert.throws(() => makeWidgetClickArgs("abc123", undefined, 40), /widget click requires both x and y/);
    });

    it("builds widget mouse move args through the hover route", () => {
        assert.deepEqual(makeWidgetHoverArgs("abc123", undefined, 60, 70), [
            "-b",
            "block:abc123",
            "widget",
            "hover",
            "--x",
            "60",
            "--y",
            "70",
        ]);
    });

    it("builds sandbox click args with coordinates and count", () => {
        assert.deepEqual(makeSandboxClickArgs("default", 120, 80, "left", 2), [
            "sandbox",
            "--session-id",
            "default",
            "click",
            "--at",
            "--x",
            "120",
            "--y",
            "80",
            "--button",
            "left",
            "--count",
            "2",
        ]);
    });

    it("builds sandbox drag args for the bytebot-backed CLI route", () => {
        assert.deepEqual(makeSandboxDragArgs("s1", 1, 2, 3, 4, "middle"), [
            "sandbox",
            "--session-id",
            "s1",
            "drag",
            "1",
            "2",
            "3",
            "4",
            "--button",
            "middle",
        ]);
    });
});
