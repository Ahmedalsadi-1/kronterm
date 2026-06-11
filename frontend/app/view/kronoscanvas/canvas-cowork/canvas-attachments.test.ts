// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { buildMessageWithAttachments, deduplicateAttachments, type CanvasAttachment } from "./canvas-attachments";

describe("canvas-attachments", () => {
    it("wraps selected canvas text and image attachments for prompts", () => {
        const result = buildMessageWithAttachments("Use these", [
            { shapeId: "shape:text", path: "notes.txt", type: "text", name: "notes", content: "hello" },
            {
                shapeId: "shape:image",
                path: "image.png",
                type: "image",
                name: "image",
                imageData: "abc",
                imageMimeType: "image/png",
            },
        ]);
        expect(result.text).toContain('<doc path="canvas/notes.txt">');
        expect(result.text).toContain('<image path="canvas/image.png">');
        expect(result.imageAttachments).toEqual([{ type: "image", data: "abc", mimeType: "image/png", name: "image" }]);
    });

    it("deduplicates attachments with mention priority", () => {
        const selection: CanvasAttachment[] = [{ shapeId: "a", path: "same.txt", type: "text", name: "selection" }];
        const mention: CanvasAttachment[] = [{ shapeId: "b", path: "same.txt", type: "text", name: "mention" }];
        expect(deduplicateAttachments(selection, mention)).toEqual(mention);
    });
});
