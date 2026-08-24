// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { boundLspResult, resolveLspQueryPaths } from "./emain-lsp";

const tempDirectories: string[] = [];

function makeTempDirectory(prefix: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirectories.push(directory);
    return directory;
}

afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe("scoped LSP queries", () => {
    it("resolves workspace-relative regular files", () => {
        const workspace = makeTempDirectory("kronterm-lsp-workspace-");
        const source = path.join(workspace, "main.go");
        fs.writeFileSync(source, "package main\n");

        expect(resolveLspQueryPaths(workspace, "main.go")).toEqual({
            workspacePath: fs.realpathSync(workspace),
            filePath: fs.realpathSync(source),
        });
    });

    it("rejects files outside the workspace, including symlink escapes", () => {
        const workspace = makeTempDirectory("kronterm-lsp-workspace-");
        const outside = makeTempDirectory("kronterm-lsp-outside-");
        const outsideSource = path.join(outside, "secret.go");
        fs.writeFileSync(outsideSource, "package secret\n");
        fs.symlinkSync(outsideSource, path.join(workspace, "escape.go"));

        expect(() => resolveLspQueryPaths(workspace, outsideSource)).toThrow(/contained by the KronTerm workspace/);
        expect(() => resolveLspQueryPaths(workspace, "escape.go")).toThrow(/contained by the KronTerm workspace/);
    });

    it("bounds top-level results, nested depth, and long strings", () => {
        const result = boundLspResult(
            [
                { name: "a", detail: "x".repeat(20_000) },
                { name: "b", nested: { one: { two: { three: { four: { five: { six: { seven: "end" } } } } } } } },
                { name: "c" },
            ],
            2
        );

        expect(result.value).toHaveLength(2);
        expect(result.value[0].detail.length).toBeLessThan(20_000);
        expect(JSON.stringify(result.value)).toContain("maximum depth reached");
        expect(result.truncated).toBe(true);
    });
});
