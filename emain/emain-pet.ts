// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BrowserWindow, screen } from "electron";
import path from "path";
import type { AcpEvent } from "./acp";
import { getElectronAppBasePath, isDevVite, unamePlatform } from "./emain-platform";
import { focusedWaveWindow } from "./emain-window";

type DesktopPetContext = "idle" | "terminal" | "browser" | "desktop" | "file" | "thinking";

export type PetCursorAction = "idle" | "click" | "type" | "scroll" | "hover" | null;

export type DesktopPetState = {
    context: DesktopPetContext;
    detail: string;
    thought?: string;
    active: boolean;
    moving: boolean;
    cursorAction?: PetCursorAction;
    cursorPoint?: { x: number; y: number } | null;
    reasoningLog?: string[];
    previewImageUrl?: string;
};

export type DesktopPetNotification = {
    kind: "idle" | "thinking" | "tool";
    detail?: string;
    thought?: string;
    target?: Electron.Rectangle;
    cursorAction?: PetCursorAction;
    previewImageUrl?: string;
    petActivityUrl?: string;
    surfaceActivity?: Record<string, unknown>;
};

export type DesktopPetOptions = {
    roam: boolean;
    followUserCursor: boolean;
};

const PetWindowSize = { width: 322, height: 300 };
const IdleMoveIntervalMs = 14000;
const MovementStateMs = 900;
const ReasoningLogMax = 20;
const CursorFollowIntervalMs = 100;

let petWindow: BrowserWindow = null;
let idleTimer: NodeJS.Timeout = null;
let movementTimer: NodeJS.Timeout = null;
let thoughtTimer: NodeJS.Timeout = null;
let cursorTimer: NodeJS.Timeout = null;
let followCursorTimer: NodeJS.Timeout = null;
let options: DesktopPetOptions = {
    roam: false,
    followUserCursor: false,
};
let state: DesktopPetState = {
    context: "idle",
    detail: "KronosCode ready",
    active: false,
    moving: false,
    cursorAction: "idle",
    cursorPoint: null,
    reasoningLog: [],
};

function sendState() {
    if (petWindow == null || petWindow.isDestroyed() || petWindow.webContents.isLoading()) {
        return;
    }
    petWindow.webContents.send("desktop-pet-state", state);
}

function updateState(update: Partial<DesktopPetState>) {
    state = { ...state, ...update };
    sendState();
}

function limitPositionToDisplay(point: Electron.Point, display = screen.getDisplayNearestPoint(point)): Electron.Point {
    const area = display.workArea;
    const size = petWindow?.getBounds() ?? PetWindowSize;
    return {
        x: Math.min(Math.max(area.x, point.x), area.x + area.width - size.width),
        y: Math.min(Math.max(area.y, point.y), area.y + area.height - size.height),
    };
}

function movePet(point: Electron.Point) {
    if (petWindow == null || petWindow.isDestroyed()) {
        return;
    }
    const position = limitPositionToDisplay(point);
    petWindow.setPosition(position.x, position.y, false);
    updateState({ moving: true });
    if (movementTimer != null) {
        clearTimeout(movementTimer);
    }
    movementTimer = setTimeout(() => updateState({ moving: false }), MovementStateMs);
}

function roamWhileIdle() {
    if (state.active || !options.roam || options.followUserCursor) {
        return;
    }
    const displays = screen.getAllDisplays();
    const display = displays[Math.floor(Math.random() * displays.length)] ?? screen.getPrimaryDisplay();
    const area = display.workArea;
    const size = petWindow?.getBounds() ?? PetWindowSize;
    const maxX = Math.max(area.x, area.x + area.width - size.width);
    const maxY = Math.max(area.y, area.y + area.height - size.height);
    const point = {
        x: area.x + Math.round(Math.random() * (maxX - area.x)),
        y: area.y + Math.round(Math.random() * (maxY - area.y)),
    };
    movePet(point);
}

function followUserCursorWhileIdle() {
    if (state.active || !options.followUserCursor || petWindow == null || petWindow.isDestroyed()) {
        return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    const point = {
        x: cursor.x + 20,
        y: cursor.y + 22 - bounds.height,
    };
    const position = limitPositionToDisplay(point);
    const current = petWindow.getPosition();
    if (Math.abs(current[0] - position.x) < 3 && Math.abs(current[1] - position.y) < 3) {
        return;
    }
    movePet(position);
}

function moveToAgentTarget(target: Electron.Rectangle | undefined) {
    if (target == null) {
        return;
    }
    const display = screen.getDisplayMatching(target);
    const size = petWindow?.getBounds() ?? PetWindowSize;
    const point = {
        x: target.x + target.width - Math.round(size.width * 0.4),
        y: target.y + target.height - size.height - 12,
    };
    movePet(limitPositionToDisplay(point, display));
}

export function createDesktopPetWindow() {
    if (unamePlatform !== "darwin" || petWindow != null) {
        return;
    }
    petWindow = new BrowserWindow({
        ...PetWindowSize,
        transparent: true,
        frame: false,
        resizable: true,
        movable: true,
        focusable: true,
        minWidth: 250,
        minHeight: 220,
        fullscreenable: false,
        hasShadow: false,
        show: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        type: "panel",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(getElectronAppBasePath(), "preload", "preload-pet.cjs"),
        },
    });
    petWindow.setAlwaysOnTop(true, "floating");
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    petWindow.once("ready-to-show", () => {
        roamWhileIdle();
        petWindow?.showInactive();
        sendState();
    });
    petWindow.on("closed", () => {
        petWindow = null;
        if (idleTimer != null) {
            clearInterval(idleTimer);
            idleTimer = null;
        }
        if (followCursorTimer != null) {
            clearInterval(followCursorTimer);
            followCursorTimer = null;
        }
    });
    if (isDevVite) {
        void petWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet.html`);
    } else {
        void petWindow.loadFile(path.join(getElectronAppBasePath(), "frontend", "pet.html"));
    }
    idleTimer = setInterval(roamWhileIdle, IdleMoveIntervalMs);
    followCursorTimer = setInterval(followUserCursorWhileIdle, CursorFollowIntervalMs);
}

export function updateDesktopPetOptions(nextOptions: Partial<DesktopPetOptions>) {
    if (typeof nextOptions.roam === "boolean") {
        options = { ...options, roam: nextOptions.roam };
    }
    if (typeof nextOptions.followUserCursor === "boolean") {
        options = { ...options, followUserCursor: nextOptions.followUserCursor };
        followUserCursorWhileIdle();
    }
}

export function submitDesktopPetChat(text: string) {
    const value = text.trim();
    const target = focusedWaveWindow?.activeTabView?.webContents;
    if (!value || target == null || target.isDestroyed()) {
        return;
    }
    target.send("desktop-pet-chat", value);
}

function textFromContent(content: unknown): string | null {
    if (typeof content === "string") {
        return content;
    }
    if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
    }
    return null;
}

function contextForTool(title: string): DesktopPetContext {
    const value = title.toLowerCase();
    if (/term|bash|shell|command/.test(value)) {
        return "terminal";
    }
    if (/browser|web|navigate|url/.test(value)) {
        return "browser";
    }
    if (/mouse|keyboard|desktop|widget|screen|click|scroll|hover|drag/.test(value)) {
        return "desktop";
    }
    if (/file|read|write|edit|patch|directory|grep|glob|search/.test(value)) {
        return "file";
    }
    return "thinking";
}

function cursorActionForTool(title: string): PetCursorAction {
    const value = title.toLowerCase();
    if (/type|paste|keyboard|input|write/.test(value)) {
        return "type";
    }
    if (/scroll/.test(value)) {
        return "scroll";
    }
    if (/click/.test(value)) {
        return "click";
    }
    if (/hover|move|drag/.test(value)) {
        return "hover";
    }
    if (/browser|navigate|goto|open|web|snapshot|screenshot/.test(value)) {
        return "idle";
    }
    return null;
}

function pointFromToolInput(rawInput: Record<string, unknown> | undefined): { x: number; y: number } | null {
    if (!rawInput) {
        return null;
    }
    const x = (rawInput.x ?? rawInput.originX ?? rawInput.endX) as number | undefined;
    const y = (rawInput.y ?? rawInput.originY ?? rawInput.endY) as number | undefined;
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
        return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
}

export function notifyDesktopPetActivity(event: AcpEvent) {
    if (event.type === "status") {
        const status = (event.data as { status?: string } | null)?.status;
        const active = status === "running" || status === "connecting";
        updateState({
            active,
            context: active ? state.context : "idle",
            detail: active ? "KronosCode working" : "KronosCode ready",
            ...(active
                ? {}
                : { thought: undefined, cursorAction: "idle", cursorPoint: null, previewImageUrl: undefined }),
        });
        return;
    }
    if (event.type === "finish") {
        updateState({
            active: false,
            context: "idle",
            detail: "Task complete",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        return;
    }
    if (event.type === "agent_thought_chunk") {
        const thought = textFromContent(event.data)?.replace(/\s+/g, " ").trim();
        if (!thought) {
            return;
        }
        const log = [...(state.reasoningLog ?? []), thought];
        if (log.length > ReasoningLogMax) {
            log.splice(0, log.length - ReasoningLogMax);
        }
        updateState({
            active: true,
            context: "thinking",
            detail: "Thinking",
            thought,
            reasoningLog: log,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        if (thoughtTimer != null) {
            clearTimeout(thoughtTimer);
        }
        thoughtTimer = setTimeout(
            () =>
                updateState({
                    thought: undefined,
                }),
            4500
        );
        return;
    }
    if (event.type === "tool_call") {
        const data = event.data as { title?: string; rawInput?: Record<string, unknown> } | null;
        const title = data?.title ?? "tool";
        const context = contextForTool(title);
        const cursorAction = cursorActionForTool(title);
        const cursorPoint = pointFromToolInput(data?.rawInput);
        updateState({
            active: true,
            context,
            detail: title.slice(0, 48),
            thought: undefined,
            cursorAction,
            cursorPoint,
            previewImageUrl: undefined,
        });
        if (cursorAction != null && cursorAction !== "idle") {
            if (cursorTimer != null) {
                clearTimeout(cursorTimer);
            }
            cursorTimer = setTimeout(() => updateState({ cursorAction: "idle", cursorPoint: null }), 2500);
        }
        return;
    }
}

export function notifyDesktopPetNotification(notification: DesktopPetNotification) {
    if (notification.kind === "idle") {
        updateState({
            active: false,
            context: "idle",
            detail: notification.detail ?? "KronosCode ready",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        roamWhileIdle();
        return;
    }
    if (notification.kind === "thinking") {
        const thought =
            typeof notification.thought === "string" ? notification.thought.replace(/\s+/g, " ").trim() : undefined;
        const log = thought ? [...(state.reasoningLog ?? []), thought] : state.reasoningLog;
        if (log.length > ReasoningLogMax) {
            log.splice(0, log.length - ReasoningLogMax);
        }
        updateState({
            active: true,
            context: "thinking",
            detail: notification.detail ?? "Thinking",
            thought,
            reasoningLog: log,
            cursorAction: "idle",
            cursorPoint: null,
        });
        moveToAgentTarget(notification.target);
        return;
    }
    const detail = typeof notification.detail === "string" ? notification.detail.slice(0, 48) : "Using tool";
    const cursorAction = notification.cursorAction ?? cursorActionForTool(detail);
    updateState({
        active: true,
        context: contextForTool(detail),
        detail,
        thought: undefined,
        cursorAction,
        cursorPoint: null,
        previewImageUrl: notification.previewImageUrl,
    });
    moveToAgentTarget(notification.target);
}
