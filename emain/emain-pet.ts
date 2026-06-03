// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BrowserWindow, screen } from "electron";
import { createServer, type Server } from "http";
import path from "path";
import {
    contextForAgentActivity,
    cursorActionForAgentActivity,
    inferAgentActivityAction,
    inferAgentActivitySurface,
    isAgentActivityActive,
    normalizeAgentActivity,
    pointFromAgentActivityInput,
    type AgentActivityAction,
    type AgentActivityEvent,
    type AgentActivityPhase,
} from "../frontend/types/agent-activity";
import type { AcpEvent } from "./acp";
import type { OverlayAnimationCommand } from "./emain-overlay";
import { sendOverlayAnimation } from "./emain-overlay";
import { getElectronAppBasePath, isDevVite, unamePlatform } from "./emain-platform";
import { focusedWaveWindow } from "./emain-window";

type DesktopPetContext = "idle" | "terminal" | "browser" | "desktop" | "file" | "thinking";
type DesktopPetLifecycle = "idle" | AgentActivityPhase;

export type PetCursorAction = "idle" | "click" | "type" | "scroll" | "hover" | null;
export type DesktopPetMode = "off" | "status-only" | "docked" | "expressive";

export type DesktopPetState = {
    context: DesktopPetContext;
    lifecycle: DesktopPetLifecycle;
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
    cursorPoint?: { x: number; y: number } | null;
    reasoningLog?: string[];
    previewImageUrl?: string;
    petActivityUrl?: string;
    surfaceActivity?: AgentActivityEvent;
};

export type DesktopPetOptions = {
    mode: DesktopPetMode;
    roam: boolean;
    followUserCursor: boolean;
};

export type ClickThroughState = {
    enabled: boolean;
};

const PetWindowSize = { width: 322, height: 300 };
const MovementStateMs = 900;
const ReasoningLogMax = 20;
const CursorFollowIntervalMs = 100;
const AgentCursorFollowMs = 2600;
const SuccessStateMs = 1800;
const PreviewStateMs = 6200;
const PetActivityPort = 4097;

let petWindow: BrowserWindow = null;
let movementTimer: NodeJS.Timeout = null;
let thoughtTimer: NodeJS.Timeout = null;
let cursorTimer: NodeJS.Timeout = null;
let idleStateTimer: NodeJS.Timeout = null;
let followCursorTimer: NodeJS.Timeout = null;
let petActivityServer: Server = null;
let agentCursorFollowUntil = 0;
let options: DesktopPetOptions = {
    mode: "docked",
    roam: false,
    followUserCursor: false,
};
let clickThroughEnabled = false;
let state: DesktopPetState = {
    context: "idle",
    lifecycle: "idle",
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

function scheduleIdleState(detail = "KronosCode ready", delayMs = SuccessStateMs) {
    if (idleStateTimer != null) {
        clearTimeout(idleStateTimer);
    }
    idleStateTimer = setTimeout(() => {
        updateState({
            active: false,
            context: "idle",
            lifecycle: "idle",
            detail,
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        dockNearKronterm();
        idleStateTimer = null;
    }, delayMs);
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

function dockNearKronterm(force = false) {
    const shouldDock = options.mode === "status-only" || options.mode === "docked";
    if (state.active || (!shouldDock && !options.roam && !force)) {
        return;
    }
    const waveBounds = focusedWaveWindow?.getBounds();
    const display = waveBounds ? screen.getDisplayMatching(waveBounds) : screen.getPrimaryDisplay();
    const area = display.workArea;
    const size = petWindow?.getBounds() ?? PetWindowSize;
    const point = {
        x: waveBounds ? waveBounds.x + waveBounds.width - size.width - 18 : area.x + area.width - size.width - 18,
        y: waveBounds ? waveBounds.y + waveBounds.height - size.height - 18 : area.y + area.height - size.height - 18,
    };
    movePet(limitPositionToDisplay(point, display));
}

function followUserCursorWhileIdle() {
    if (options.mode !== "expressive") {
        return;
    }
    const followAgentCursor = Date.now() < agentCursorFollowUntil;
    if (
        (!state.active && !followAgentCursor) ||
        (!options.followUserCursor && !followAgentCursor) ||
        petWindow == null ||
        petWindow.isDestroyed()
    ) {
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

function startAgentCursorFollow() {
    agentCursorFollowUntil = Date.now() + AgentCursorFollowMs;
    followUserCursorWhileIdle();
}

function startPetActivityServer() {
    if (petActivityServer != null) {
        return;
    }
    petActivityServer = createServer((request, response) => {
        if (request.method !== "POST" || request.url !== "/pet/activity") {
            response.writeHead(404).end();
            return;
        }
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            if (body.length < 64 * 1024) {
                body += chunk;
            }
        });
        request.on("end", () => {
            try {
                const payload = JSON.parse(body) as DesktopPetNotification | AgentActivityEvent;
                const activity = "kind" in payload ? null : normalizeAgentActivity(payload);
                const notification =
                    "kind" in payload
                        ? payload
                        : {
                              kind:
                                  activity?.phase === "succeeded" || activity?.phase === "failed"
                                      ? ("idle" as const)
                                      : ("tool" as const),
                              detail: payload.detail ?? payload.action,
                              thought: payload.thought,
                              cursorPoint: payload.point,
                              previewImageUrl: payload.previewimageurl,
                              surfaceActivity: payload,
                          };
                notifyDesktopPetNotification(notification);
                broadcastDesktopPetSurfaceActivity(notification);
                response.writeHead(204).end();
            } catch {
                response.writeHead(400).end();
            }
        });
    });
    petActivityServer.once("error", () => {
        petActivityServer = null;
    });
    petActivityServer.listen(PetActivityPort, "127.0.0.1");
}

function moveToAgentTarget(target: Electron.Rectangle | undefined) {
    if (options.mode !== "expressive" || target == null) {
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
        focusable: false,
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
    startPetActivityServer();
    petWindow.setAlwaysOnTop(true, "floating");
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    petWindow.once("ready-to-show", () => {
        dockNearKronterm(true);
        petWindow?.showInactive();
        sendState();
    });
    petWindow.on("closed", () => {
        petWindow = null;
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
    followCursorTimer = setInterval(followUserCursorWhileIdle, CursorFollowIntervalMs);
}

export function updateDesktopPetOptions(nextOptions: Partial<DesktopPetOptions>) {
    if (
        nextOptions.mode === "off" ||
        nextOptions.mode === "status-only" ||
        nextOptions.mode === "docked" ||
        nextOptions.mode === "expressive"
    ) {
        options = { ...options, mode: nextOptions.mode };
        if (options.mode !== "expressive") {
            sendOverlayAnimation({ type: "hide" });
            agentCursorFollowUntil = 0;
            updateState({ cursorAction: "idle", cursorPoint: null });
            dockNearKronterm(true);
        }
    }
    if (typeof nextOptions.roam === "boolean") {
        options = { ...options, roam: nextOptions.roam };
        dockNearKronterm();
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

export function resumeDesktopPetContext() {
    const window = focusedWaveWindow;
    const target = window?.activeTabView?.webContents;
    if (window == null || target == null || target.isDestroyed()) {
        return;
    }
    window.focus();
    target.send("desktop-pet-resume");
}

export function toggleDesktopPetClickThrough(): boolean {
    if (petWindow == null || petWindow.isDestroyed()) {
        return false;
    }
    clickThroughEnabled = !clickThroughEnabled;
    petWindow.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
    if (!petWindow.isDestroyed()) {
        petWindow.webContents.send("desktop-pet-clickthrough-changed", clickThroughEnabled);
    }
    return clickThroughEnabled;
}

export function getDesktopPetClickThroughStatus(): boolean {
    return clickThroughEnabled;
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

function legacyContextForTool(title: string): DesktopPetContext {
    const value = title.toLowerCase();
    if (/term|bash|shell|command/.test(value)) {
        return "terminal";
    }
    if (/browser|web|navigate|url/.test(value)) {
        return "browser";
    }
    if (/mouse|keyboard|desktop|widget|screen|click|scroll|hover|drag|trace|press|paste|wait|cursor/.test(value)) {
        return "desktop";
    }
    if (/file|read|write|edit|patch|directory|grep|glob|search/.test(value)) {
        return "file";
    }
    return "thinking";
}

function legacyCursorActionForTool(title: string): PetCursorAction {
    const value = title.toLowerCase();
    if (/type|paste|keyboard|input|write/.test(value)) {
        return "type";
    }
    if (/scroll/.test(value)) {
        return "scroll";
    }
    if (/click|press/.test(value)) {
        return "click";
    }
    if (/hover|move|drag|trace|cursor/.test(value)) {
        return "hover";
    }
    if (/browser|navigate|goto|open|web|snapshot|screenshot/.test(value)) {
        return "idle";
    }
    return null;
}

function pointFromToolInput(rawInput: Record<string, unknown> | undefined): { x: number; y: number } | null {
    const point = pointFromAgentActivityInput(rawInput);
    return point ? { x: Math.round(point.x), y: Math.round(point.y) } : null;
}

function broadcastDesktopPetSurfaceActivity(notification: DesktopPetNotification) {
    const activity = notification.surfaceActivity;
    const target = focusedWaveWindow?.activeTabView?.webContents;
    if (activity == null || target == null || target.isDestroyed()) {
        return;
    }
    target.send("desktop-pet-surface-activity", activity);
}

function pathFromToolInput(rawInput: Record<string, unknown> | undefined): Array<{ x: number; y: number }> | null {
    if (!rawInput) {
        return null;
    }
    const path = rawInput.path as Array<{ x: number; y: number }> | undefined;
    if (Array.isArray(path) && path.length > 0 && typeof path[0]?.x === "number") {
        return path.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    }
    return null;
}

function overlayCommandFromAction(
    action: AgentActivityAction,
    rawInput: Record<string, unknown> | undefined
): OverlayAnimationCommand | null {
    const point = pointFromToolInput(rawInput);
    const path = pathFromToolInput(rawInput);

    if (action === "click" || action === "doubleClick") {
        if (point) return { type: "click", x: point.x, y: point.y };
        return null;
    }
    if (action === "type" || action === "press") {
        if (point) return { type: "type", x: point.x, y: point.y };
        return null;
    }
    if (action === "scroll") {
        const direction = (rawInput?.direction as string) ?? "down";
        if (point)
            return { type: "scroll", x: point.x, y: point.y, direction: direction as "up" | "down" | "left" | "right" };
        return { type: "scroll", x: 0, y: 0, direction: "down" };
    }
    if (action === "drag") {
        if (path) return { type: "drag", path };
        if (point) return { type: "drag", path: [point, point] };
        return null;
    }
    if (action === "move") {
        if (path) return { type: "trace", path };
        if (point) return { type: "hover", x: point.x, y: point.y };
        return null;
    }
    if (action === "wait" || action === "verify") {
        if (point) return { type: "wait", x: point.x, y: point.y };
        return { type: "wait" };
    }
    if (action === "screenshot") {
        return {
            type: "screenshot",
            x: (rawInput?.x as number) ?? 0,
            y: (rawInput?.y as number) ?? 0,
            width: (rawInput?.width as number) ?? 0,
            height: (rawInput?.height as number) ?? 0,
        };
    }
    if (action === "open" || action === "focus" || action === "inspect") {
        if (point) return { type: "wait", x: point.x, y: point.y };
        return { type: "wait" };
    }
    return null;
}

function pointForNotification(notification: DesktopPetNotification): { x: number; y: number } | null {
    if (notification.cursorPoint != null) {
        return notification.cursorPoint;
    }
    const target = notification.target;
    if (target == null) {
        return null;
    }
    return {
        x: Math.round(target.x + target.width / 2),
        y: Math.round(target.y + target.height / 2),
    };
}

function overlayCommandFromNotification(notification: DesktopPetNotification): OverlayAnimationCommand | null {
    const activity = activityForNotification(notification);
    const point = pointForNotification(notification);
    const input = point ? { x: point.x, y: point.y } : undefined;
    return overlayCommandFromAction(activity.action, input);
}

function activityForNotification(notification: DesktopPetNotification): ReturnType<typeof normalizeAgentActivity> {
    if (notification.surfaceActivity != null) {
        return normalizeAgentActivity(notification.surfaceActivity);
    }
    const detail = notification.detail ?? "Using tool";
    const action = notification.kind === "thinking" ? "thinking" : inferAgentActivityAction(detail);
    return normalizeAgentActivity({
        source: "acp",
        phase: notification.kind === "idle" ? "succeeded" : "running",
        surface: inferAgentActivitySurface(detail),
        action,
        detail,
        point: notification.cursorPoint ?? undefined,
    });
}

export function notifyDesktopPetActivity(event: AcpEvent) {
    if (event.type === "status") {
        const status = (event.data as { status?: string } | null)?.status;
        const active = status === "running" || status === "connecting";
        updateState({
            active,
            context: active ? state.context : "idle",
            lifecycle: active ? "running" : "idle",
            detail: active ? "KronosCode working" : "KronosCode ready",
            ...(active
                ? {}
                : { thought: undefined, cursorAction: "idle", cursorPoint: null, previewImageUrl: undefined }),
        });
        return;
    }
    if (event.type === "finish") {
        const previewImageUrl = state.previewImageUrl;
        updateState({
            active: false,
            context: "idle",
            lifecycle: "succeeded",
            detail: "Task complete",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl,
        });
        sendOverlayAnimation({ type: "hide" });
        scheduleIdleState("KronosCode ready", previewImageUrl ? PreviewStateMs : SuccessStateMs);
        return;
    }
    if (event.type === "error") {
        updateState({
            active: false,
            context: "idle",
            lifecycle: "failed",
            detail: "Task failed",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        sendOverlayAnimation({ type: "hide" });
        return;
    }
    if (event.type === "tool_permission") {
        const data = event.data as { confirmation?: { title?: string }; toolCall?: { title?: string } } | null;
        updateState({
            active: true,
            context: state.context,
            lifecycle: "awaiting-approval",
            detail: data?.confirmation?.title ?? data?.toolCall?.title ?? "Review required",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
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
            lifecycle: "running",
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
        const activity = normalizeAgentActivity({
            source: "acp",
            phase: "running",
            surface: inferAgentActivitySurface(title),
            action: inferAgentActivityAction(title),
            detail: title,
            point: pointFromAgentActivityInput(data?.rawInput),
        });
        const context = contextForAgentActivity(activity);
        const cursorAction = cursorActionForAgentActivity(activity);
        const cursorPoint = pointFromToolInput(data?.rawInput);
        updateState({
            active: true,
            context,
            lifecycle: activity.phase,
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
        if (cursorPoint) {
            moveToAgentTarget({ x: cursorPoint.x, y: cursorPoint.y, width: 1, height: 1 });
        }
        if (cursorAction != null && cursorAction !== "idle") {
            startAgentCursorFollow();
        }
        const overlayCmd = overlayCommandFromAction(activity.action, data?.rawInput);
        if (options.mode === "expressive" && overlayCmd) {
            sendOverlayAnimation(overlayCmd);
        }
        return;
    }
}

export function notifyDesktopPetNotification(notification: DesktopPetNotification) {
    if (notification.kind === "idle") {
        const activity = activityForNotification(notification);
        updateState({
            active: false,
            context: "idle",
            lifecycle: activity.phase,
            detail: notification.detail ?? "KronosCode ready",
            thought: undefined,
            cursorAction: "idle",
            cursorPoint: null,
            previewImageUrl: undefined,
        });
        sendOverlayAnimation({ type: "hide" });
        if (activity.phase === "succeeded") {
            scheduleIdleState();
        } else {
            dockNearKronterm();
        }
        return;
    }
    if (notification.kind === "thinking") {
        const thought =
            typeof notification.thought === "string" ? notification.thought.replace(/\s+/g, " ").trim() : undefined;
        const log =
            notification.reasoningLog ??
            (thought ? [...(state.reasoningLog ?? []), thought] : (state.reasoningLog ?? []));
        if (log.length > ReasoningLogMax) {
            log.splice(0, log.length - ReasoningLogMax);
        }
        updateState({
            active: true,
            context: "thinking",
            lifecycle: "running",
            detail: notification.detail ?? "Thinking",
            thought,
            reasoningLog: log,
            cursorAction: "idle",
            cursorPoint: null,
        });
        moveToAgentTarget(notification.target);
        return;
    }
    const activity = activityForNotification(notification);
    const detail = typeof notification.detail === "string" ? notification.detail.slice(0, 48) : "Using tool";
    const cursorAction =
        notification.cursorAction ?? cursorActionForAgentActivity(activity) ?? legacyCursorActionForTool(detail);
    const cursorPoint = pointForNotification(notification);
    updateState({
        active: isAgentActivityActive(activity.phase),
        context: contextForAgentActivity(activity) ?? legacyContextForTool(detail),
        lifecycle: activity.phase,
        detail,
        thought: undefined,
        cursorAction,
        cursorPoint,
        previewImageUrl: notification.previewImageUrl,
    });
    if (cursorAction != null && cursorAction !== "idle") {
        if (cursorTimer != null) {
            clearTimeout(cursorTimer);
        }
        cursorTimer = setTimeout(() => updateState({ cursorAction: "idle", cursorPoint: null }), 2500);
    }
    moveToAgentTarget(notification.target);
    if (cursorPoint) {
        moveToAgentTarget({ x: cursorPoint.x, y: cursorPoint.y, width: 1, height: 1 });
    }
    if (cursorAction != null && cursorAction !== "idle") {
        startAgentCursorFollow();
    }
    const overlayCommand = overlayCommandFromNotification(notification);
    if (options.mode === "expressive" && overlayCommand != null) {
        sendOverlayAnimation(overlayCommand);
    }
}
