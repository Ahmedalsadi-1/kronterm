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
    | "connect_objects"
    | "spatial.open"
    | "spatial.focus"
    | "spatial.move"
    | "spatial.resize"
    | "spatial.dock"
    | "spatial.detach"
    | "spatial.collapse"
    | "spatial.restore"
    | "spatial.showOverview"
    | "spatial.switchWorkspace"
    | "spatial.openApp"
    | "spatial.setWidgetPresentation"
    | "spatial.openFile"
    | "spatial.openCommandCenter";

type WorkspaceSurfaceControlInput = {
    action: WorkspaceSurfaceControlAction;
    blockid?: string;
    targetblockid?: string;
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
    side?: "left" | "right";
    view?: string;
    workspaceid?: string;
    appid?: string;
    appname?: string;
    presentation?: string;
    file?: string;
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
    scene?: unknown;
    groups?: unknown;
    presentations?: Record<string, string>;
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
