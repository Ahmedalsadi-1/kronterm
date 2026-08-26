// @vitest-environment jsdom

// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").

import { describe, expect, it } from "vitest";
import { shouldIncludeDragPreviewNode } from "./drag-preview";

describe("drag preview capture", () => {
    it("omits remote favicons that would make image capture reject", () => {
        const favicon = document.createElement("img");
        favicon.src = "https://example.com/favicon.ico";
        expect(shouldIncludeDragPreviewNode(favicon)).toBe(false);
    });

    it("keeps local and embedded images", () => {
        const local = document.createElement("img");
        local.src = "/asset.png";
        const embedded = document.createElement("img");
        embedded.src = "data:image/png;base64,AAAA";
        expect(shouldIncludeDragPreviewNode(local)).toBe(true);
        expect(shouldIncludeDragPreviewNode(embedded)).toBe(true);
    });
});
