// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WorkspaceCanvasComposerContext } from "@/app/tab/workspace-canvas-context";
import type { ComposerAttachment } from "@hermes/store/composer";
import { describe, expect, it } from "vitest";
import { makeCanvasAttachments, mergeCanvasAttachments } from "./hermes-canvas-context";

const context: WorkspaceCanvasComposerContext = {
    active: true,
    mode: "quote",
    tabid: "tab-1",
    nodes: [
        {
            action: "inspect",
            blockid: "browser-1",
            detail: "Account settings are visible.",
            id: "agent-1",
            phase: "succeeded",
            surface: "browser",
            title: "Settings evidence",
        },
    ],
};

describe("Hermes canvas attachments", () => {
    it("creates bounded structured context with Follow or Quote semantics", () => {
        const [attachment] = makeCanvasAttachments(context);
        expect(attachment).toMatchObject({
            id: "canvas:tab-1:agent-1",
            kind: "canvas",
            source: "kronterm-canvas",
            sourceId: "agent-1",
        });
        expect(attachment.refText).toContain('"mode": "quote"');
        expect(attachment.refText).toContain('"linkedBlockId": "browser-1"');
    });

    it("preserves user attachments and honors a manually dismissed automatic chip", () => {
        const userFile: ComposerAttachment = { id: "file-1", kind: "file", label: "notes.md" };
        const managed = makeCanvasAttachments(context);
        expect(mergeCanvasAttachments([userFile], managed, new Set([managed[0].id]))).toEqual([userFile]);
    });
});
