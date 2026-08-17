// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const StylesheetPath = fileURLToPath(new URL("./tailwindsetup.css", import.meta.url));

describe("Tailwind source boundary", () => {
    it("does not scan sibling applications", () => {
        const stylesheet = fs.readFileSync(StylesheetPath, "utf8");

        expect(stylesheet).toContain('@import "tailwindcss" source(none);');
        expect(stylesheet).toContain('@source "./";');
        expect(stylesheet).not.toMatch(/@source\s+["']\.\.\/mobile/);
    });
});
