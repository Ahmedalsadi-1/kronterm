// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

export function ensureNodePtySpawnHelperExecutable(root: string): string[] {
    if (process.platform !== "darwin") {
        return [];
    }

    const candidates = [
        path.join(root, "node_modules", "node-pty", "prebuilds", `darwin-${process.arch}`, "spawn-helper"),
        path.join(root, "node_modules", "node-pty", "build", "Release", "spawn-helper"),
    ];
    const repaired: string[] = [];

    for (const helper of candidates) {
        if (!fs.existsSync(helper)) {
            continue;
        }
        const mode = fs.statSync(helper).mode;
        if ((mode & 0o111) === 0o111) {
            continue;
        }
        fs.chmodSync(helper, mode | 0o111);
        repaired.push(helper);
    }

    return repaired;
}
