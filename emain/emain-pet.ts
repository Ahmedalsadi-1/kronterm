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
    type AgentActivitySurface,
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
    surface?: AgentActivitySurface;
    action?: AgentActivityAction;
    appName?: string;
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
const CursorFollowIntervalMs = 20; // 50fps smooth update loop
const AgentCursorFollowMs = 2600;
const SuccessStateMs = 1800;
const PreviewStateMs = 6200;
const PetActivityPort = 4097;

let petWindow: BrowserWindow = null;
let petTargetX = 0;
let petTargetY = 0;
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
    surface: "panel",
    action: "focus",
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
            surface: "panel",
            action: "focus",
            appName: undefined,
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
    petTargetX = position.x;
    petTargetY = position.y;
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

function updatePetWindowPosition() {
    if (petWindow == null || petWindow.isDestroyed()) {
        return;
    }

    const bounds = petWindow.getBounds();

    let tx = petTargetX;
    let ty = petTargetY;

    const followAgentCursor = Date.now() < agentCursorFollowUntil;
    const shouldFollowCursor = options.mode === "expressive" && (options.followUserCursor || followAgentCursor);

    if (shouldFollowCursor) {
        let cursor = screen.getCursorScreenPoint();

        if (state.active && state.cursorPoint) {
            cursor = state.cursorPoint;
        }

        tx = cursor.x - bounds.width / 2;
        ty = cursor.y - Math.round(bounds.height * 0.45);

        const nextCursorPoint = { x: cursor.x, y: cursor.y };
        if (
            !state.cursorPoint ||
            state.cursorPoint.x !== nextCursorPoint.x ||
            state.cursorPoint.y !== nextCursorPoint.y
        ) {
            updateState({
                cursorPoint: nextCursorPoint,
                cursorAction: state.cursorAction === "idle" || !state.cursorAction ? "hover" : state.cursorAction,
            });
        }
    } else {
        if (state.cursorPoint && (state.cursorAction === "hover" || state.cursorAction === "idle")) {
            updateState({
                cursorPoint: null,
                cursorAction: "idle",
            });
        }
    }

    const display = screen.getDisplayNearestPoint({ x: tx, y: ty });
    const position = limitPositionToDisplay({ x: tx, y: ty }, display);

    const current = petWindow.getPosition();
    const curX = current[0];
    const curY = current[1];

    const dx = position.x - curX;
    const dy = position.y - curY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.5) {
        const nextX = Math.round(curX + dx * 0.15);
        const nextY = Math.round(curY + dy * 0.15);

        if (nextX !== curX || nextY !== curY) {
            petWindow.setPosition(nextX, nextY, false);
            updateState({ moving: true });

            if (movementTimer != null) {
                clearTimeout(movementTimer);
            }
            movementTimer = setTimeout(() => {
                if (petWindow && !petWindow.isDestroyed()) {
                    const [latestX, latestY] = petWindow.getPosition();
                    const latestDist = Math.sqrt(Math.pow(latestX - position.x, 2) + Math.pow(latestY - position.y, 2));
                    if (latestDist < 2) {
                        updateState({ moving: false });
                    }
                }
            }, MovementStateMs);
        }
    } else {
        if (state.moving) {
            updateState({ moving: false });
        }
    }
}

function followUserCursorWhileIdle() {
    updatePetWindowPosition();
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
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "content-type");
        if (request.method === "OPTIONS" && request.url === "/pet/activity") {
            response.writeHead(204).end();
            return;
        }
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
                if ("kind" in payload) {
                    notifyDesktopPetNotification(payload);
                    broadcastDesktopPetSurfaceActivity(payload);
                } else {
                    notifyDesktopPetSurfaceActivity(payload);
                }
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
    const targetCenterX = target.x + target.width / 2;
    const targetCenterY = target.y + target.height / 2;
    const point = {
        x: targetCenterX - Math.round(size.width / 2),
        y: targetCenterY - Math.round(size.height * 0.45),
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
    function snapPetToTarget() {
        if (petWindow == null || petWindow.isDestroyed()) {
            return;
        }
        petWindow.setPosition(petTargetX, petTargetY, false);
    }

    petWindow.once("ready-to-show", () => {
        dockNearKronterm(true);
        snapPetToTarget();
        petWindow?.showInactive();
        sendState();
    });
    // Fallback: if ready-to-show never fires (e.g., renderer error), force-show after 5s
    const petShowFallback = setTimeout(() => {
        if (petWindow && !petWindow.isVisible()) {
            petWindow.showInactive();
            sendState();
        }
    }, 5000);
    petWindow.on("closed", () => {
        clearTimeout(petShowFallback);
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

function broadcastAgentSurfaceActivity(activity: AgentActivityEvent) {
    const target = focusedWaveWindow?.activeTabView?.webContents;
    if (target == null || target.isDestroyed()) {
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

function targetFromToolInput(rawInput: Record<string, unknown> | undefined): Electron.Rectangle | undefined {
    if (
        typeof rawInput?.x === "number" &&
        typeof rawInput.y === "number" &&
        typeof rawInput.width === "number" &&
        typeof rawInput.height === "number"
    ) {
        return {
            x: Math.round(rawInput.x),
            y: Math.round(rawInput.y),
            width: Math.round(rawInput.width),
            height: Math.round(rawInput.height),
        };
    }
    return undefined;
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
    if (activity.point == null) {
        const point = pointForNotification(notification);
        if (point != null) {
            return overlayCommandFromAction(activity.action, { x: point.x, y: point.y });
        }
    }
    return overlayCommandFromActivity(activity);
}

function overlayCommandFromActivity(
    activity: ReturnType<typeof normalizeAgentActivity>
): OverlayAnimationCommand | null {
    const point = activity.point ? { x: Math.round(activity.point.x), y: Math.round(activity.point.y) } : null;
    if (activity.action === "screenshot" && activity.target != null) {
        return {
            type: "screenshot",
            x: activity.target.x,
            y: activity.target.y,
            width: activity.target.width,
            height: activity.target.height,
        };
    }
    if (activity.path != null && activity.path.length > 0) {
        return overlayCommandFromAction(activity.action, {
            path: activity.path.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        });
    }
    return overlayCommandFromAction(activity.action, point ? { x: point.x, y: point.y } : undefined);
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

function notificationKindForActivity(phase: AgentActivityPhase): DesktopPetNotification["kind"] {
    return isAgentActivityActive(phase) ? "tool" : "idle";
}

function notificationForActivity(
    activity: ReturnType<typeof normalizeAgentActivity>,
    target?: Electron.Rectangle
): DesktopPetNotification {
    return {
        kind:
            activity.action === "thinking" && isAgentActivityActive(activity.phase)
                ? "thinking"
                : notificationKindForActivity(activity.phase),
        detail: activity.detail ?? activity.action,
        thought: activity.thought,
        target: target ?? activity.target,
        cursorAction: cursorActionForAgentActivity(activity),
        cursorPoint: activity.point ?? null,
        reasoningLog: activity.reasoningSteps ?? (activity.thought ? [activity.thought] : undefined),
        previewImageUrl: activity.previewimageurl,
        petActivityUrl: activity.petactivityurl,
        surfaceActivity: activity,
    };
}

export function notifyDesktopPetSurfaceActivity(activity: AgentActivityEvent, target?: Electron.Rectangle) {
    const normalized = normalizeAgentActivity(activity);
    const notification = notificationForActivity(normalized, target);
    notifyDesktopPetNotification(notification);
    broadcastAgentSurfaceActivity(normalized);
}

type AcpCanvasTaskState = {
    active: boolean;
    activeApprovalDetail?: string;
    activeApprovalId?: string;
    currentDecisionId?: string;
    currentDecisionDetail?: string;
    decisionIndex: number;
    lastNodeId?: string;
    needsDecision: boolean;
    replyId?: string;
    replyText: string;
    runid: string;
    tools: Map<string, { blockid?: string; surface: AgentActivitySurface; title: string }>;
    turn: number;
};

const AcpCanvasTasks = new Map<string, AcpCanvasTaskState>();

function makeAcpCanvasTaskState(conversationId: string): AcpCanvasTaskState {
    return {
        active: false,
        decisionIndex: 0,
        needsDecision: true,
        replyText: "",
        runid: `${conversationId}:task:0`,
        tools: new Map(),
        turn: 0,
    };
}

function acpCanvasTask(event: AcpEvent, begin = false): AcpCanvasTaskState {
    const current = AcpCanvasTasks.get(event.conversationId) ?? makeAcpCanvasTaskState(event.conversationId);
    if (begin && !current.active) {
        current.active = true;
        current.activeApprovalDetail = undefined;
        current.activeApprovalId = undefined;
        current.turn += 1;
        current.runid = `${event.conversationId}:task:${current.turn}`;
        current.decisionIndex = 0;
        current.currentDecisionId = undefined;
        current.currentDecisionDetail = undefined;
        current.lastNodeId = undefined;
        current.needsDecision = true;
        current.replyId = undefined;
        current.replyText = "";
        current.tools.clear();
    }
    if (!current.active) {
        current.active = true;
    }
    AcpCanvasTasks.set(event.conversationId, current);
    return current;
}

function acpActivityBase(
    event: AcpEvent,
    task: AcpCanvasTaskState,
    id: string,
    parentid?: string
): Pick<AgentActivityEvent, "id" | "parentid" | "runid" | "sessionid" | "source"> {
    return {
        id,
        parentid,
        runid: task.runid,
        sessionid: event.conversationId,
        source: "acp",
    };
}

function blockIdFromAcpInput(input: Record<string, unknown> | undefined): string | undefined {
    const value =
        input?.blockId ??
        input?.blockid ??
        input?.block_id ??
        input?.sessionId ??
        input?.sessionid ??
        input?.session_id;
    return typeof value === "string" ? value : undefined;
}

function previewImageFromAcpUpdate(data: unknown): string | undefined {
    const items = (
        data as { content?: Array<{ content?: { type?: string; data?: string; mimeType?: string; text?: string } }> }
    )?.content;
    for (const item of items ?? []) {
        const content = item?.content;
        if (content?.type === "image" && typeof content.data === "string") {
            return `data:${content.mimeType ?? "image/png"};base64,${content.data.replace(/\s+/g, "")}`;
        }
        if (typeof content?.text === "string") {
            const match = content.text.match(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+/i)?.[0];
            if (match) {
                return match.replace(/\s+/g, "");
            }
        }
    }
    return undefined;
}

function completeAcpDecision(event: AcpEvent, task: AcpCanvasTaskState, phase: "succeeded" | "failed" = "succeeded") {
    if (!task.currentDecisionId) {
        return;
    }
    notifyDesktopPetSurfaceActivity({
        ...acpActivityBase(event, task, task.currentDecisionId),
        phase,
        surface: "panel",
        action: "thinking",
        detail: task.currentDecisionDetail || "Decision ready",
        verificationstatus: phase === "failed" ? "failed" : "verified",
    });
    task.lastNodeId = task.currentDecisionId;
    task.currentDecisionId = undefined;
    task.currentDecisionDetail = undefined;
}

function completeAcpApproval(event: AcpEvent, task: AcpCanvasTaskState, phase: "succeeded" | "failed" = "succeeded") {
    if (!task.activeApprovalId) {
        return;
    }
    notifyDesktopPetSurfaceActivity({
        ...acpActivityBase(event, task, task.activeApprovalId),
        phase,
        surface: "panel",
        action: "wait",
        detail: task.activeApprovalDetail || "Approved",
        verificationstatus: phase === "failed" ? "failed" : "verified",
    });
    task.lastNodeId = task.activeApprovalId;
    task.activeApprovalId = undefined;
    task.activeApprovalDetail = undefined;
}

export function notifyDesktopPetActivity(event: AcpEvent) {
    if (event.type === "status") {
        const status = (event.data as { status?: string } | null)?.status;
        if (status !== "running") {
            notifyDesktopPetNotification({
                kind: status === "connecting" ? "thinking" : "idle",
                detail: status === "connecting" ? "KronosCode connecting" : "KronosCode ready",
            });
            return;
        }
        const task = acpCanvasTask(event, true);
        task.decisionIndex = 1;
        task.currentDecisionId = `decision:${task.runid}:${task.decisionIndex}`;
        task.currentDecisionDetail = "Understanding the task";
        task.lastNodeId = task.currentDecisionId;
        task.needsDecision = false;
        updateState({ reasoningLog: [] });
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, task.currentDecisionId),
            phase: "running",
            surface: "panel",
            action: "thinking",
            detail: "Understanding the task",
        });
        return;
    }
    if (event.type === "finish") {
        const task = acpCanvasTask(event);
        completeAcpApproval(event, task);
        completeAcpDecision(event, task);
        const previewImageUrl = state.previewImageUrl;
        const outputId = task.replyId ?? `output:${task.runid}`;
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, outputId),
            phase: "succeeded",
            surface: "panel",
            action: "focus",
            detail: task.replyText.trim() || "Task complete",
            previewimageurl: previewImageUrl,
            verificationstatus: "verified",
        });
        task.lastNodeId = outputId;
        task.active = false;
        return;
    }
    if (event.type === "harness_lease") {
        const task = acpCanvasTask(event);
        const data = event.data as {
            lease?: { backend?: string; id?: string; reason?: string; taskClass?: string };
        } | null;
        const lease = data?.lease;
        const leaseId = lease?.id ?? event.msgId;
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, `lease:${leaseId}`, task.lastNodeId),
            phase: "running",
            surface: "panel",
            action: "focus",
            capabilityid: lease?.taskClass,
            connectorid: lease?.backend,
            detail: lease?.reason ?? "Scoped specialist capability lease issued",
            risk: "read",
        });
        task.lastNodeId = `lease:${leaseId}`;
        return;
    }
    if (event.type === "error") {
        const task = acpCanvasTask(event);
        completeAcpApproval(event, task, "failed");
        completeAcpDecision(event, task, "failed");
        const error = (event.data as { error?: string } | null)?.error;
        const outputId = `output:${task.runid}`;
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, outputId),
            phase: "failed",
            surface: "panel",
            action: "focus",
            detail: error || "Task failed",
            verificationstatus: "failed",
        });
        task.lastNodeId = outputId;
        task.active = false;
        return;
    }
    if (event.type === "tool_permission") {
        const task = acpCanvasTask(event);
        const data = event.data as {
            confirmation?: { title?: string };
            toolCall?: { title?: string; toolCallId?: string };
        } | null;
        const toolCallId = data?.toolCall?.toolCallId;
        const approvalId = `approval:${toolCallId || event.msgId}`;
        const approvalDetail = data?.confirmation?.title ?? data?.toolCall?.title ?? "Review required";
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, approvalId, toolCallId || task.lastNodeId),
            phase: "awaiting-approval",
            surface: "panel",
            action: "wait",
            detail: approvalDetail,
        });
        task.activeApprovalId = approvalId;
        task.activeApprovalDetail = approvalDetail;
        task.lastNodeId = approvalId;
        return;
    }
    if (event.type === "agent_thought_chunk") {
        const task = acpCanvasTask(event);
        const thought = textFromContent(event.data)?.replace(/\s+/g, " ").trim();
        if (!thought) {
            return;
        }
        if (task.needsDecision || !task.currentDecisionId) {
            task.decisionIndex += 1;
            task.currentDecisionId = `decision:${task.runid}:${task.decisionIndex}`;
            task.needsDecision = false;
        }
        task.currentDecisionDetail = thought;
        const log = [...(state.reasoningLog ?? []), thought];
        if (log.length > ReasoningLogMax) {
            log.splice(0, log.length - ReasoningLogMax);
        }
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(
                event,
                task,
                task.currentDecisionId,
                task.lastNodeId === task.currentDecisionId ? undefined : task.lastNodeId
            ),
            phase: "running",
            surface: "panel",
            action: "thinking",
            detail: thought,
            thought,
            reasoningSteps: log,
        });
        task.lastNodeId = task.currentDecisionId;
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
        const task = acpCanvasTask(event);
        completeAcpDecision(event, task);
        const data = event.data as {
            title?: string;
            toolCallId?: string;
            rawInput?: Record<string, unknown>;
            status?: "pending" | "in_progress" | "completed" | "failed";
        } | null;
        const title = data?.title ?? "tool";
        const toolId = data?.toolCallId || event.msgId;
        const blockid = blockIdFromAcpInput(data?.rawInput);
        const surface = inferAgentActivitySurface(title, blockid);
        task.tools.set(toolId, { blockid, surface, title });
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, toolId, task.currentDecisionId || task.lastNodeId),
            phase:
                data?.status === "pending"
                    ? "queued"
                    : data?.status === "completed"
                      ? "succeeded"
                      : data?.status === "failed"
                        ? "failed"
                        : "running",
            blockid,
            surface,
            action: inferAgentActivityAction(title),
            detail: title,
            point: pointFromAgentActivityInput(data?.rawInput),
            path: pathFromToolInput(data?.rawInput) ?? undefined,
            target: targetFromToolInput(data?.rawInput),
        });
        task.lastNodeId = toolId;
        task.needsDecision = true;
        return;
    }
    if (event.type === "tool_call_update") {
        const task = acpCanvasTask(event);
        completeAcpApproval(event, task);
        const data = event.data as {
            toolCallId?: string;
            title?: string;
            rawInput?: Record<string, unknown>;
            status?: "completed" | "failed";
        } | null;
        const toolId = data?.toolCallId || event.msgId;
        const priorTool = task.tools.get(toolId);
        const title = data?.title ?? priorTool?.title ?? "Tool result";
        const blockid = blockIdFromAcpInput(data?.rawInput) ?? priorTool?.blockid;
        const previewimageurl = previewImageFromAcpUpdate(event.data);
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, toolId),
            phase: data?.status === "failed" ? "failed" : "succeeded",
            blockid,
            surface: priorTool?.surface ?? inferAgentActivitySurface(title, blockid),
            action: previewimageurl ? "screenshot" : "verify",
            detail: previewimageurl ? "Captured tool evidence" : title,
            previewimageurl,
            verificationstatus: data?.status === "failed" ? "failed" : "verified",
        });
        task.lastNodeId = toolId;
        task.needsDecision = true;
        return;
    }
    if (event.type === "plan") {
        const task = acpCanvasTask(event);
        completeAcpDecision(event, task);
        const entries =
            (event.data as { entries?: Array<{ content?: string; status?: string }> } | null)?.entries ?? [];
        const steps = entries.map((entry) => entry.content?.trim()).filter((entry): entry is string => Boolean(entry));
        const planId = `plan:${task.runid}`;
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, planId, task.lastNodeId === planId ? undefined : task.lastNodeId),
            phase: "running",
            surface: "panel",
            action: "thinking",
            detail: steps[0] || "Prepared task plan",
            reasoningSteps: steps,
        });
        task.currentDecisionId = planId;
        task.currentDecisionDetail = steps[0] || "Prepared task plan";
        task.lastNodeId = planId;
        task.needsDecision = false;
        return;
    }
    if (event.type === "agent_message_chunk") {
        const task = acpCanvasTask(event);
        const chunk = textFromContent(event.data);
        if (!chunk) {
            return;
        }
        completeAcpDecision(event, task);
        task.replyText += chunk;
        task.replyId ??= `output:${task.runid}`;
        notifyDesktopPetSurfaceActivity({
            ...acpActivityBase(event, task, task.replyId),
            phase: "running",
            surface: "panel",
            action: "focus",
            detail: task.replyText.trim(),
        });
        task.lastNodeId = task.replyId;
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
            previewImageUrl: notification.previewImageUrl,
            surface: activity.surface,
            action: activity.action,
            appName: activity.appname,
        });
        sendOverlayAnimation({ type: "hide" });
        if (activity.phase === "succeeded") {
            scheduleIdleState("KronosCode ready", notification.previewImageUrl ? PreviewStateMs : SuccessStateMs);
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
            surface: "panel",
            action: "thinking",
            appName: undefined,
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
        surface: activity.surface,
        action: activity.action,
        appName: activity.appname,
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
