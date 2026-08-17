import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureNodePtySpawnHelperExecutable } from "./chathubv2-pty";

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe("KronosChamber node-pty setup", () => {
    it("repairs a spawn helper whose executable mode was lost", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "kronterm-pty-"));
        temporaryDirectories.push(root);
        const helper = path.join(root, "node_modules", "node-pty", "prebuilds", `darwin-${process.arch}`, "spawn-helper");
        fs.mkdirSync(path.dirname(helper), { recursive: true });
        fs.writeFileSync(helper, "helper");
        fs.chmodSync(helper, 0o644);

        expect(ensureNodePtySpawnHelperExecutable(root)).toEqual([helper]);
        expect(fs.statSync(helper).mode & 0o111).toBe(0o111);
    });

    it("does nothing when no helper is bundled for the current platform", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "kronterm-pty-"));
        temporaryDirectories.push(root);

        expect(ensureNodePtySpawnHelperExecutable(root)).toEqual([]);
    });
});
