// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WorkspacePresentation } from "@/app/tab/workspace-presentation";

interface HermesPanelWidthBounds {
    defaultWidth: number;
    max: number;
    min: number;
}

function clampHermesPanelWidth(width: number, bounds: HermesPanelWidthBounds): number {
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, width)));
}

function getHermesPanelWidthBounds(presentation: WorkspacePresentation, viewportWidth: number): HermesPanelWidthBounds {
    const min = Math.min(360, Math.max(280, viewportWidth - 240));
    if (presentation !== "tabs") {
        const max = Math.max(min, Math.min(520, viewportWidth - 240));
        return { min, max, defaultWidth: clampHermesPanelWidth(390, { min, max, defaultWidth: 390 }) };
    }

    const max = Math.max(min, Math.min(Math.round(viewportWidth * 0.56), viewportWidth - 320));
    const bounds = { min, max, defaultWidth: 0 };
    return { ...bounds, defaultWidth: clampHermesPanelWidth(viewportWidth * 0.4, bounds) };
}

export { clampHermesPanelWidth, getHermesPanelWidthBounds };
export type { HermesPanelWidthBounds };
