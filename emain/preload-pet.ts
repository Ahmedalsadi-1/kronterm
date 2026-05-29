// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { contextBridge, ipcRenderer } from "electron";
import type { DesktopPetOptions, DesktopPetState } from "./emain-pet";

contextBridge.exposeInMainWorld("petApi", {
    onState: (callback: (state: DesktopPetState) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, state: DesktopPetState) => callback(state);
        ipcRenderer.on("desktop-pet-state", listener);
        return () => ipcRenderer.removeListener("desktop-pet-state", listener);
    },
    updateOptions: (options: Partial<DesktopPetOptions>) => ipcRenderer.send("desktop-pet-options", options),
    sendChat: (text: string) => ipcRenderer.send("desktop-pet-chat", text),
});
