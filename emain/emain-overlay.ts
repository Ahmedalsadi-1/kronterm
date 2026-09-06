import { BrowserWindow, screen } from "electron";
import path from "path";
import { getElectronAppBasePath, isDevVite, unamePlatform } from "./emain-platform";

let overlayWindow: BrowserWindow = null;
let overlayBounds: Electron.Rectangle = null;
let overlayReady = false;
let overlayHideTimer: NodeJS.Timeout = null;
const pendingCommands: OverlayAnimationCommand[] = [];
const OverlayVisibleMs = 2600;

export type OverlayAnimationCommand =
    | { type: "click"; x: number; y: number }
    | { type: "type"; x: number; y: number }
    | { type: "scroll"; x: number; y: number; direction?: "up" | "down" | "left" | "right" }
    | { type: "drag"; path: Array<{ x: number; y: number }> }
    | { type: "hover"; x: number; y: number }
    | { type: "trace"; path: Array<{ x: number; y: number }> }
    | { type: "wait"; x?: number; y?: number }
    | { type: "cursor_position"; x: number; y: number }
    | { type: "screenshot"; x?: number; y?: number; width?: number; height?: number }
    | { type: "hide" };

function getAllDisplayBounds(): Electron.Rectangle {
    const displays = screen.getAllDisplays();
    const left = Math.min(...displays.map((display) => display.bounds.x));
    const top = Math.min(...displays.map((display) => display.bounds.y));
    const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
    const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function createOverlayWindow() {
    if (unamePlatform !== "darwin" || overlayWindow != null) {
        return;
    }
    const bounds = getAllDisplayBounds();
    overlayBounds = bounds;

    overlayWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transparent: true,
        frame: false,
        resizable: false,
        movable: false,
        focusable: false,
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
            preload: path.join(getElectronAppBasePath(), "preload", "preload-overlay.cjs"),
        },
    });

    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.webContents.once("did-finish-load", () => {
        overlayReady = true;
        for (const command of pendingCommands.splice(0)) {
            sendOverlayAnimation(command);
        }
    });

    overlayWindow.on("closed", () => {
        overlayWindow = null;
        overlayBounds = null;
        overlayReady = false;
    });

    if (isDevVite) {
        void overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
    } else {
        void overlayWindow.loadFile(path.join(getElectronAppBasePath(), "frontend", "overlay.html"));
    }
}

export function sendOverlayAnimation(cmd: OverlayAnimationCommand) {
    if (cmd.type === "screenshot") {
        return;
    }
    if (cmd.type === "hide" && (overlayWindow == null || overlayWindow.isDestroyed())) {
        return;
    }
    if (overlayWindow == null || overlayWindow.isDestroyed()) {
        createOverlayWindow();
    }
    if (overlayWindow == null || overlayWindow.isDestroyed() || overlayBounds == null) {
        return;
    }
    if (cmd.type === "hide") {
        overlayWindow.hide();
        if (overlayHideTimer != null) {
            clearTimeout(overlayHideTimer);
            overlayHideTimer = null;
        }
    } else {
        overlayWindow.showInactive();
        if (overlayHideTimer != null) {
            clearTimeout(overlayHideTimer);
        }
        overlayHideTimer = setTimeout(() => {
            destroyOverlayWindow();
            overlayHideTimer = null;
        }, OverlayVisibleMs);
    }
    if (!overlayReady) {
        pendingCommands.push(cmd);
        return;
    }
    const offsetPoint = (point: { x: number; y: number }) => ({
        x: point.x - overlayBounds.x,
        y: point.y - overlayBounds.y,
    });
    if ("path" in cmd) {
        overlayWindow.webContents.send("overlay-animation", { ...cmd, path: cmd.path.map(offsetPoint) });
        return;
    }
    if ("x" in cmd && typeof cmd.x === "number" && "y" in cmd && typeof cmd.y === "number") {
        overlayWindow.webContents.send("overlay-animation", { ...cmd, ...offsetPoint({ x: cmd.x, y: cmd.y }) });
        return;
    }
    overlayWindow.webContents.send("overlay-animation", cmd);
}

export function destroyOverlayWindow() {
    if (overlayHideTimer != null) {
        clearTimeout(overlayHideTimer);
        overlayHideTimer = null;
    }
    if (overlayWindow != null && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
    }
    overlayWindow = null;
    overlayBounds = null;
}
