// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export const CanvasMinZoom = 0.2;
export const CanvasMaxZoom = 2.4;
const CanvasMinFitZoom = 0.04;
const CanvasInteractiveTargetSelector = [
    "button",
    "a[href]",
    "input",
    "textarea",
    "select",
    "option",
    "label",
    "summary",
    "[contenteditable]:not([contenteditable='false'])",
    "[role='application']",
    "[role='button']",
    "[role='checkbox']",
    "[role='combobox']",
    "[role='link']",
    "[role='menuitem']",
    "[role='option']",
    "[role='radio']",
    "[role='searchbox']",
    "[role='slider']",
    "[role='spinbutton']",
    "[role='switch']",
    "[role='tab']",
    "[role='textbox']",
    "[role='treeitem']",
    "[data-canvas-shortcuts='ignore']",
].join(",");

export type WorkspaceCanvasPoint = {
    x: number;
    y: number;
};

export type WorkspaceCanvasSize = {
    width: number;
    height: number;
};

export type WorkspaceCanvasRect = WorkspaceCanvasPoint & WorkspaceCanvasSize;

export type WorkspaceCanvasCamera = WorkspaceCanvasPoint & {
    zoom: number;
};

export function isCanvasShortcutInteractiveTarget(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== "function") {
        return false;
    }
    const element = target as HTMLElement;
    return element.isContentEditable || element.closest(CanvasInteractiveTargetSelector) != null;
}

export function clampCanvasZoom(zoom: number): number {
    return Math.min(CanvasMaxZoom, Math.max(CanvasMinZoom, zoom));
}

export function screenPointToCanvas(camera: WorkspaceCanvasCamera, point: WorkspaceCanvasPoint): WorkspaceCanvasPoint {
    return {
        x: (point.x - camera.x) / camera.zoom,
        y: (point.y - camera.y) / camera.zoom,
    };
}

export function zoomCanvasCameraAtPoint(
    camera: WorkspaceCanvasCamera,
    nextZoom: number,
    point: WorkspaceCanvasPoint
): WorkspaceCanvasCamera {
    const zoom = clampCanvasZoom(nextZoom);
    const worldPoint = screenPointToCanvas(camera, point);
    return {
        zoom,
        x: point.x - worldPoint.x * zoom,
        y: point.y - worldPoint.y * zoom,
    };
}

export function makeViewportCenteredCanvasRect(
    camera: WorkspaceCanvasCamera,
    viewport: WorkspaceCanvasSize,
    size: WorkspaceCanvasSize,
    offset: WorkspaceCanvasPoint = { x: 0, y: 0 }
): WorkspaceCanvasRect {
    const center = screenPointToCanvas(camera, {
        x: viewport.width / 2,
        y: viewport.height / 2,
    });
    return {
        x: Math.round(center.x - size.width / 2 + offset.x),
        y: Math.round(center.y - size.height / 2 + offset.y),
        width: size.width,
        height: size.height,
    };
}

export function canvasBoundsForRects(rects: WorkspaceCanvasRect[]): WorkspaceCanvasRect | null {
    if (rects.length === 0) {
        return null;
    }
    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
    };
}

export function fitCanvasCameraToBounds(
    bounds: WorkspaceCanvasRect,
    viewport: WorkspaceCanvasSize,
    padding = 96,
    maxZoom = 1.15
): WorkspaceCanvasCamera {
    const availableWidth = Math.max(1, viewport.width - padding * 2);
    const availableHeight = Math.max(1, viewport.height - padding * 2);
    const zoom = Math.max(
        CanvasMinFitZoom,
        Math.min(CanvasMaxZoom, maxZoom, availableWidth / bounds.width, availableHeight / bounds.height)
    );
    return {
        zoom,
        x: Math.round(viewport.width / 2 - (bounds.x + bounds.width / 2) * zoom),
        y: Math.round(viewport.height / 2 - (bounds.y + bounds.height / 2) * zoom),
    };
}
