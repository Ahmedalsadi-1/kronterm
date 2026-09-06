import { contextBridge, ipcRenderer } from "electron";

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

contextBridge.exposeInMainWorld("overlayApi", {
    onAnimation: (callback: (cmd: OverlayAnimationCommand) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, cmd: OverlayAnimationCommand) => callback(cmd);
        ipcRenderer.on("overlay-animation", listener);
        return () => ipcRenderer.removeListener("overlay-animation", listener);
    },
});
