// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WorkspaceCanvasComposerContext } from "@/app/tab/workspace-canvas-context";
import type { ComposerAttachment } from "@hermes/store/composer";

const MaxDetailLength = 2_000;

function bounded(value: string | undefined): string | undefined {
    return value?.replace(/```/g, "''' ").slice(0, MaxDetailLength);
}

export function makeCanvasAttachments(context: WorkspaceCanvasComposerContext): ComposerAttachment[] {
    if (!context.active) {
        return [];
    }
    return context.nodes.map((node) => {
        const payload = {
            tabId: context.tabid,
            canvasObjectId: node.id,
            linkedBlockId: node.blockid,
            mode: context.mode,
            title: bounded(node.title),
            status: node.phase,
            surface: node.surface,
            action: node.action,
            detail: bounded(node.detail),
            verificationStatus: node.verificationstatus,
            reasoningSteps: node.reasoningsteps?.slice(0, 20).map(bounded),
        };
        return {
            id: `canvas:${context.tabid}:${node.id}`,
            kind: "canvas",
            label: node.title,
            detail: `${context.mode} · ${node.phase.replaceAll("-", " ")}`,
            refText: `\n\`\`\`kronterm-canvas-context\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
            source: "kronterm-canvas",
            sourceId: node.id,
            sourceMode: context.mode,
            sourceTabId: context.tabid,
        };
    });
}

export function mergeCanvasAttachments(
    current: ComposerAttachment[],
    managed: ComposerAttachment[],
    dismissedIds: ReadonlySet<string>
): ComposerAttachment[] {
    return [
        ...current.filter((attachment) => attachment.source !== "kronterm-canvas"),
        ...managed.filter((attachment) => !dismissedIds.has(attachment.id)),
    ];
}
