// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { SpatialRect, SpatialViewport } from "@/app/spatial/spatial-engine";

const OSLayoutVersion = 1;

export type OSScene =
    | { kind: "freeform" }
    | { kind: "focused"; blockId: string }
    | { kind: "grouped"; groupId: string }
    | { kind: "overview"; selectedBlockId?: string };

export type OSWindowPresentation =
    "freeform" | "focused" | "docked-left" | "docked-right" | "edge-left" | "edge-right" | "overview" | "collapsed";

export type OSWindowState = {
    blockId: string;
    bounds: SpatialRect;
    zOrder: number;
    collapsed?: boolean;
};

export type OSWindowGroup = {
    id: string;
    primaryBlockId: string;
    sideBlockId: string;
    side: "left" | "right";
    dividerRatio: number;
};

export type OSCanvasObjectKind = "note" | "rectangle" | "ellipse" | "diamond" | "connector";
export type OSCanvasColor = "amber" | "blue" | "green" | "rose" | "slate";

export type WidgetPresentation = "canvas" | "file";

export type OSCanvasObject = SpatialRect & {
    id: string;
    kind: OSCanvasObjectKind;
    text?: string;
    color?: OSCanvasColor;
    fromObjectId?: string;
    toObjectId?: string;
};

export type OSModeState = {
    version: number;
    camera: SpatialViewport;
    windows: Record<string, OSWindowState>;
    zOrder: string[];
    groups: Record<string, OSWindowGroup>;
    objects: OSCanvasObject[];
    scene: OSScene;
    previousScene?: Exclude<OSScene, { kind: "overview" }>;
    selectedEntityId?: string;
    widgetPresentation: WidgetPresentation;
};

export type OSWindowLayout = {
    bounds: SpatialRect;
    presentation: OSWindowPresentation;
    rotateY: number;
    scale: number;
    opacity: number;
    zIndex: number;
};

export type OSDockHitTarget = {
    targetBlockId: string;
    side: "left" | "right";
    bounds: SpatialRect;
};

export type OSSpatialAction =
    | { type: "spatial.focus"; blockId: string }
    | { type: "spatial.move"; blockId: string; x: number; y: number }
    | { type: "spatial.resize"; blockId: string; width: number; height: number }
    | { type: "spatial.dock"; blockId: string; targetBlockId: string; side: "left" | "right" }
    | { type: "spatial.detach"; blockId: string }
    | { type: "spatial.collapse"; blockId: string }
    | { type: "spatial.restore"; blockId: string }
    | { type: "spatial.showOverview"; selectedBlockId?: string }
    | { type: "spatial.restoreScene" }
    | { type: "spatial.freeform" }
    | { type: "spatial.setDivider"; groupId: string; dividerRatio: number }
    | { type: "spatial.setWidgetPresentation"; presentation: WidgetPresentation };

export function findOSDockHitTarget(
    draggedBlockId: string,
    pointer: { x: number; y: number },
    layouts: Record<string, Pick<OSWindowLayout, "bounds" | "opacity" | "presentation" | "zIndex">>
): OSDockHitTarget | undefined {
    const candidates = Object.entries(layouts)
        .filter(([blockId, layout]) => {
            if (blockId === draggedBlockId || layout.opacity <= 0 || layout.presentation === "collapsed") return false;
            const { x, y, width, height } = layout.bounds;
            return pointer.x >= x && pointer.x <= x + width && pointer.y >= y && pointer.y <= y + height;
        })
        .sort(([, a], [, b]) => b.zIndex - a.zIndex);
    const [targetBlockId, target] = candidates[0] ?? [];
    if (!targetBlockId || !target) return undefined;
    return {
        targetBlockId,
        side: pointer.x < target.bounds.x + target.bounds.width / 2 ? "left" : "right",
        bounds: target.bounds,
    };
}

function defaultWindowBounds(index: number): SpatialRect {
    const desktop = [
        { x: 360, y: 120, width: 520, height: 600 },
        { x: 920, y: 100, width: 900, height: 620 },
        { x: 120, y: 710, width: 720, height: 460 },
        { x: 980, y: 720, width: 760, height: 470 },
    ];
    if (index < desktop.length) return desktop[index];
    const column = index % 3;
    const row = Math.floor(index / 3);
    return { x: 180 + column * 520, y: 160 + row * 380, width: 680, height: 440 };
}

function overlapsExistingWindow(bounds: SpatialRect, occupied: SpatialRect[]): boolean {
    return occupied.some((other) => {
        const overlapWidth = Math.max(
            0,
            Math.min(bounds.x + bounds.width, other.x + other.width) - Math.max(bounds.x, other.x)
        );
        const overlapHeight = Math.max(
            0,
            Math.min(bounds.y + bounds.height, other.y + other.height) - Math.max(bounds.y, other.y)
        );
        const overlapArea = overlapWidth * overlapHeight;
        const smallerArea = Math.min(bounds.width * bounds.height, other.width * other.height);
        return smallerArea > 0 && overlapArea / smallerArea > 0.82;
    });
}

function unoccupiedDefaultWindowBounds(index: number, occupied: SpatialRect[]): SpatialRect {
    const initial = defaultWindowBounds(index);
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = {
            ...initial,
            x: initial.x + attempt * 72,
            y: initial.y + attempt * 56,
        };
        if (!overlapsExistingWindow(candidate, occupied)) return candidate;
    }
    return { ...initial, x: initial.x + 144, y: initial.y + 112 };
}

function readStoredLayout(tabData: Tab): Partial<OSModeState> | undefined {
    const meta = (tabData as any)?.meta as Record<string, any> | undefined;
    return meta?.["layout:os"] as Partial<OSModeState> | undefined;
}

function readCanvasSeed(tabData: Tab): {
    camera?: SpatialViewport;
    rects?: Record<string, SpatialRect>;
    objects?: any[];
} {
    const meta = (tabData as any)?.meta as Record<string, any> | undefined;
    return (meta?.["layout:canvas"] ?? {}) as {
        camera?: SpatialViewport;
        rects?: Record<string, SpatialRect>;
        objects?: any[];
    };
}

function normalizeSeedObjects(objects: any[] | undefined): OSCanvasObject[] {
    return (objects ?? [])
        .filter((object) => ["note", "rectangle", "ellipse", "diamond", "connector"].includes(object?.kind))
        .map((object) => ({
            id: String(object.id),
            kind: object.kind,
            x: Number(object.x) || 0,
            y: Number(object.y) || 0,
            width: Math.max(24, Number(object.width) || 240),
            height: Math.max(24, Number(object.height) || 176),
            text: object.text,
            color: object.color,
            fromObjectId: object.fromObjectId,
            toObjectId: object.toObjectId,
        }));
}

export function makeInitialOSModeState(tabData: Tab, blockIds: string[]): OSModeState {
    const stored = readStoredLayout(tabData);
    const seed = readCanvasSeed(tabData);
    const storedWindows = stored?.windows ?? {};
    const windows = Object.fromEntries(
        blockIds.map((blockId, index) => [
            blockId,
            storedWindows[blockId] ?? {
                blockId,
                bounds: seed.rects?.[blockId] ?? defaultWindowBounds(index),
                zOrder: index,
            },
        ])
    );
    const zOrder = (stored?.zOrder ?? blockIds).filter((blockId) => blockIds.includes(blockId));
    for (const blockId of blockIds) {
        if (!zOrder.includes(blockId)) zOrder.push(blockId);
    }
    return reconcileOSModeState(
        {
            version: OSLayoutVersion,
            camera: stored?.camera ?? seed.camera ?? { x: 32, y: 20, zoom: 0.82 },
            windows,
            zOrder,
            groups: stored?.groups ?? {},
            objects: stored?.objects ?? normalizeSeedObjects(seed.objects),
            scene: stored?.scene ?? { kind: "freeform" },
            previousScene: stored?.previousScene,
            selectedEntityId: stored?.selectedEntityId,
            widgetPresentation: stored?.widgetPresentation === "file" ? "file" : "canvas",
        },
        blockIds
    );
}

export function reconcileOSModeState(state: OSModeState, blockIds: string[]): OSModeState {
    const occupied = blockIds.flatMap((blockId) => (state.windows[blockId] ? [state.windows[blockId].bounds] : []));
    const windows: Record<string, OSWindowState> = {};
    blockIds.forEach((blockId, index) => {
        const existing = state.windows[blockId];
        const bounds = existing?.bounds ?? unoccupiedDefaultWindowBounds(index, occupied);
        windows[blockId] = existing ?? { blockId, bounds, zOrder: index };
        if (!existing) occupied.push(bounds);
    });
    const zOrder = state.zOrder.filter((blockId) => blockIds.includes(blockId));
    for (const blockId of blockIds) if (!zOrder.includes(blockId)) zOrder.push(blockId);
    const groups = Object.fromEntries(
        Object.entries(state.groups).filter(
            ([, group]) =>
                blockIds.includes(group.primaryBlockId) &&
                blockIds.includes(group.sideBlockId) &&
                !windows[group.primaryBlockId]?.collapsed &&
                !windows[group.sideBlockId]?.collapsed
        )
    );
    let scene = state.scene;
    if (scene.kind === "focused" && !blockIds.includes(scene.blockId)) scene = { kind: "freeform" };
    if (scene.kind === "focused" && windows[scene.blockId]?.collapsed) scene = { kind: "freeform" };
    if (scene.kind === "grouped" && !groups[scene.groupId]) scene = { kind: "freeform" };
    if (scene.kind === "overview" && scene.selectedBlockId && !blockIds.includes(scene.selectedBlockId)) {
        scene = { kind: "overview", selectedBlockId: blockIds[0] };
    }
    return { ...state, version: OSLayoutVersion, windows, zOrder, groups, scene };
}

export function reduceOSModeState(state: OSModeState, action: OSSpatialAction): OSModeState {
    if (action.type === "spatial.focus") {
        if (!state.windows[action.blockId]) return state;
        return {
            ...state,
            scene: { kind: "focused", blockId: action.blockId },
            selectedEntityId: action.blockId,
            zOrder: [...state.zOrder.filter((id) => id !== action.blockId), action.blockId],
            windows: { ...state.windows, [action.blockId]: { ...state.windows[action.blockId], collapsed: false } },
        };
    }
    if (action.type === "spatial.move" || action.type === "spatial.resize") {
        const current = state.windows[action.blockId];
        if (!current) return state;
        const bounds =
            action.type === "spatial.move"
                ? { ...current.bounds, x: action.x, y: action.y }
                : { ...current.bounds, width: Math.max(320, action.width), height: Math.max(220, action.height) };
        return { ...state, windows: { ...state.windows, [action.blockId]: { ...current, bounds } } };
    }
    if (action.type === "spatial.dock") {
        if (
            action.blockId === action.targetBlockId ||
            !state.windows[action.blockId] ||
            !state.windows[action.targetBlockId]
        ) {
            return state;
        }
        const groups = Object.fromEntries(
            Object.entries(state.groups).filter(
                ([, group]) => ![action.blockId, action.targetBlockId].includes(group.sideBlockId)
            )
        );
        const groupId = `group-${action.targetBlockId}-${action.blockId}`;
        groups[groupId] = {
            id: groupId,
            primaryBlockId: action.targetBlockId,
            sideBlockId: action.blockId,
            side: action.side,
            dividerRatio: 0.31,
        };
        return { ...state, groups, scene: { kind: "grouped", groupId }, selectedEntityId: action.targetBlockId };
    }
    if (action.type === "spatial.detach") {
        const current = Object.values(state.groups).find((group) => group.sideBlockId === action.blockId);
        const groups = Object.fromEntries(
            Object.entries(state.groups).filter(([, group]) => group.sideBlockId !== action.blockId)
        );
        return {
            ...state,
            groups,
            scene: current ? { kind: "focused", blockId: current.primaryBlockId } : state.scene,
        };
    }
    if (action.type === "spatial.collapse" || action.type === "spatial.restore") {
        const current = state.windows[action.blockId];
        if (!current) return state;
        const collapsed = action.type === "spatial.collapse";
        const containingGroup = Object.values(state.groups).find(
            (group) => group.primaryBlockId === action.blockId || group.sideBlockId === action.blockId
        );
        const groups = collapsed
            ? Object.fromEntries(
                  Object.entries(state.groups).filter(
                      ([, group]) => group.sideBlockId !== action.blockId && group.primaryBlockId !== action.blockId
                  )
              )
            : state.groups;
        let scene = state.scene;
        if (
            collapsed &&
            containingGroup &&
            state.scene.kind === "grouped" &&
            state.scene.groupId === containingGroup.id
        ) {
            const remainingBlockId =
                containingGroup.primaryBlockId === action.blockId
                    ? containingGroup.sideBlockId
                    : containingGroup.primaryBlockId;
            scene = { kind: "focused", blockId: remainingBlockId };
        } else if (collapsed && state.scene.kind === "focused" && state.scene.blockId === action.blockId) {
            scene = { kind: "freeform" };
        }
        return {
            ...state,
            groups,
            scene,
            windows: { ...state.windows, [action.blockId]: { ...current, collapsed } },
        };
    }
    if (action.type === "spatial.showOverview") {
        const selectedBlockId = action.selectedBlockId ?? state.selectedEntityId ?? state.zOrder.at(-1);
        return {
            ...state,
            previousScene: state.scene.kind === "overview" ? state.previousScene : state.scene,
            scene: { kind: "overview", selectedBlockId },
            selectedEntityId: selectedBlockId,
        };
    }
    if (action.type === "spatial.restoreScene") {
        return { ...state, scene: state.previousScene ?? { kind: "freeform" }, previousScene: undefined };
    }
    if (action.type === "spatial.freeform") {
        return { ...state, scene: { kind: "freeform" }, previousScene: undefined };
    }
    if (action.type === "spatial.setDivider") {
        const group = state.groups[action.groupId];
        if (!group) return state;
        return {
            ...state,
            groups: {
                ...state.groups,
                [action.groupId]: { ...group, dividerRatio: Math.min(0.42, Math.max(0.22, action.dividerRatio)) },
            },
        };
    }
    if (action.type === "spatial.setWidgetPresentation") {
        if (state.widgetPresentation === action.presentation) return state;
        return { ...state, widgetPresentation: action.presentation };
    }
    return state;
}

function preferredFocusBounds(view: string, viewport: { width: number; height: number }): SpatialRect {
    const shellHeight = 116;
    const width = view === "term" ? Math.min(920, viewport.width * 0.64) : Math.min(1280, viewport.width * 0.82);
    const height = view === "term" ? Math.min(760, viewport.height * 0.76) : Math.min(820, viewport.height * 0.78);
    return {
        x: Math.round((viewport.width - width) / 2),
        y: Math.round(shellHeight + (viewport.height - shellHeight - height) / 2),
        width: Math.round(width),
        height: Math.round(height),
    };
}

export function computeOSWindowLayout(
    state: OSModeState,
    blockId: string,
    view: string,
    viewport: { width: number; height: number }
): OSWindowLayout {
    const window = state.windows[blockId];
    const base: OSWindowLayout = {
        bounds: window.bounds,
        presentation: window.collapsed ? "collapsed" : "freeform",
        rotateY: 0,
        scale: 1,
        opacity: window.collapsed ? 0 : 1,
        zIndex: Math.max(1, state.zOrder.indexOf(blockId) + 1),
    };
    if (window.collapsed || state.scene.kind === "freeform") return base;
    if (state.scene.kind === "overview") {
        const visible = state.zOrder.filter((id) => !state.windows[id]?.collapsed);
        const index = Math.max(0, visible.indexOf(blockId));
        const count = Math.max(1, visible.length);
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const gapX = 36;
        const gapY = 32;
        const topInset = 116;
        const cellWidth = Math.min(560, (viewport.width - 160 - gapX * (cols - 1)) / cols);
        const cellHeight = Math.min(420, (viewport.height - topInset - 60 - gapY * (rows - 1)) / rows);
        const gridWidth = cols * cellWidth + (cols - 1) * gapX;
        const gridHeight = rows * cellHeight + (rows - 1) * gapY;
        const startX = (viewport.width - gridWidth) / 2;
        const startY = topInset + (viewport.height - topInset - 60 - gridHeight) / 2;
        return {
            bounds: {
                x: Math.round(startX + (index % cols) * (cellWidth + gapX)),
                y: Math.round(startY + Math.floor(index / cols) * (cellHeight + gapY)),
                width: Math.round(cellWidth),
                height: Math.round(cellHeight),
            },
            presentation: "overview",
            rotateY: 0,
            scale: 1,
            opacity: 1,
            zIndex: 500 + index,
        };
    }
    let primaryBlockId: string;
    let group: OSWindowGroup | undefined;
    if (state.scene.kind === "grouped") {
        group = state.groups[state.scene.groupId];
        primaryBlockId = group?.primaryBlockId;
    } else {
        primaryBlockId = state.scene.blockId;
    }
    if (group && (blockId === group.primaryBlockId || blockId === group.sideBlockId)) {
        const outerWidth = Math.min(1540, viewport.width * 0.92);
        const outerHeight = Math.min(860, viewport.height * 0.78);
        const outerX = (viewport.width - outerWidth) / 2;
        const outerY = 96 + (viewport.height - 96 - outerHeight) / 2;
        const sideWidth = Math.max(280, outerWidth * group.dividerRatio);
        const gap = 8;
        const isSide = blockId === group.sideBlockId;
        const sideX = group.side === "left" ? outerX : outerX + outerWidth - sideWidth;
        const primaryX = group.side === "left" ? outerX + sideWidth + gap : outerX;
        return {
            bounds: {
                x: Math.round(isSide ? sideX : primaryX),
                y: Math.round(outerY),
                width: Math.round(isSide ? sideWidth : outerWidth - sideWidth - gap),
                height: Math.round(outerHeight),
            },
            presentation: isSide ? (group.side === "left" ? "docked-left" : "docked-right") : "focused",
            rotateY: 0,
            scale: 1,
            opacity: 1,
            zIndex: isSide ? 602 : 601,
        };
    }
    if (blockId === primaryBlockId) {
        return { ...base, bounds: preferredFocusBounds(view, viewport), presentation: "focused", zIndex: 600 };
    }
    // calm focused desktop: peripheral windows step aside entirely (dock, app stream, and overview reach them)
    return { ...base, opacity: 0, presentation: "collapsed" };
}

export { OSLayoutVersion };
