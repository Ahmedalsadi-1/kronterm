// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WorkspaceCanvasRect } from "./workspace-canvas-utils";
import type { WorkspacePresentation } from "./workspace-presentation";

type WorkspaceSurfaceControlAction =
    | "focus"
    | "move"
    | "resize"
    | "navigate"
    | "fit"
    | "arrange"
    | "add_note"
    | "update_object"
    | "delete_object"
    | "connect_objects";

type WorkspaceSurfaceControlInput = {
    action: WorkspaceSurfaceControlAction;
    blockid?: string;
    direction?: "up" | "right" | "down" | "left";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    objectid?: string;
    fromobjectid?: string;
    toobjectid?: string;
    text?: string;
    color?: string;
};

type WorkspaceSurfaceModeState = {
    presentation: WorkspacePresentation;
    selectedblockid?: string;
    selectedobjectid?: string;
    expandedblockid?: string;
    contextids?: string[];
    contextmode?: "follow" | "quote";
    camera?: { x: number; y: number; zoom: number };
    rects?: Record<string, WorkspaceCanvasRect>;
    objects?: unknown[];
};

type WorkspaceSurfaceModeProvider = {
    snapshot: () => WorkspaceSurfaceModeState;
    control: (input: WorkspaceSurfaceControlInput) => { success: boolean; message: string };
};

const providers = new Map<string, WorkspaceSurfaceModeProvider>();

function registerWorkspaceSurfaceModeProvider(tabId: string, provider: WorkspaceSurfaceModeProvider): () => void {
    providers.set(tabId, provider);
    return () => {
        if (providers.get(tabId) === provider) {
            providers.delete(tabId);
        }
    };
}

function getWorkspaceSurfaceModeProvider(tabId: string): WorkspaceSurfaceModeProvider | undefined {
    return providers.get(tabId);
}

export { getWorkspaceSurfaceModeProvider, registerWorkspaceSurfaceModeProvider };
export type { WorkspaceSurfaceControlInput, WorkspaceSurfaceModeProvider, WorkspaceSurfaceModeState };
