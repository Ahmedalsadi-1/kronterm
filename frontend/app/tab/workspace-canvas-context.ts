// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atom } from "jotai";
import type { CanvasComposerContextNode, CanvasContextMode } from "./workspace-canvas-agent";

export type WorkspaceCanvasComposerContext = {
    active: boolean;
    mode: CanvasContextMode;
    nodes: CanvasComposerContextNode[];
    tabid: string;
    viewport?: {
        left: number;
        width: number;
    };
};

export type WorkspaceCanvasComposerSubmit = {
    contextids: string[];
    mode: CanvasContextMode;
    prompt: string;
    tabid: string;
};

export const WorkspaceCanvasComposerSubmitEvent = "kronterm:workspace-canvas-composer-submit";
export const WorkspaceCanvasClearContextEvent = "kronterm:workspace-canvas-clear-context";

export const workspaceCanvasComposerContextAtom = atom<WorkspaceCanvasComposerContext>({
    active: false,
    mode: "follow",
    nodes: [],
    tabid: "",
});

export function publishWorkspaceCanvasComposerSubmit(detail: WorkspaceCanvasComposerSubmit) {
    window.dispatchEvent(
        new CustomEvent<WorkspaceCanvasComposerSubmit>(WorkspaceCanvasComposerSubmitEvent, { detail })
    );
}

export function clearWorkspaceCanvasContext(tabid: string) {
    window.dispatchEvent(new CustomEvent<string>(WorkspaceCanvasClearContextEvent, { detail: tabid }));
}
