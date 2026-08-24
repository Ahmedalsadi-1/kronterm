// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { contextBridge, ipcRenderer, Rectangle, WebviewTag } from "electron";

// update type in custom.d.ts (ElectronApi type)
contextBridge.exposeInMainWorld("api", {
    getAuthKey: () => ipcRenderer.sendSync("get-auth-key"),
    getIsDev: () => ipcRenderer.sendSync("get-is-dev"),
    getPlatform: () => ipcRenderer.sendSync("get-platform"),
    getCursorPoint: () => ipcRenderer.sendSync("get-cursor-point"),
    getUserName: () => ipcRenderer.sendSync("get-user-name"),
    getHostName: () => ipcRenderer.sendSync("get-host-name"),
    getDataDir: () => ipcRenderer.sendSync("get-data-dir"),
    getConfigDir: () => ipcRenderer.sendSync("get-config-dir"),
    getHomeDir: () => ipcRenderer.sendSync("get-home-dir"),
    getAboutModalDetails: () => ipcRenderer.sendSync("get-about-modal-details"),
    getWebviewPreload: () => ipcRenderer.sendSync("get-webview-preload"),
    getZoomFactor: () => ipcRenderer.sendSync("get-zoom-factor"),
    openNewWindow: () => ipcRenderer.send("open-new-window"),
    showWorkspaceAppMenu: (workspaceId) => ipcRenderer.send("workspace-appmenu-show", workspaceId),
    showContextMenu: (workspaceId, menu) => ipcRenderer.send("contextmenu-show", workspaceId, menu),
    onContextMenuClick: (callback: (id: string | null) => void) =>
        ipcRenderer.on("contextmenu-click", (_event, id: string | null) => callback(id)),
    downloadFile: (filePath) => ipcRenderer.send("download", { filePath }),
    openExternal: (url) => {
        if (url && typeof url === "string") {
            ipcRenderer.send("open-external", url);
        } else {
            console.error("Invalid URL passed to openExternal:", url);
        }
    },
    getEnv: (varName) => ipcRenderer.sendSync("get-env", varName),
    onFullScreenChange: (callback) =>
        ipcRenderer.on("fullscreen-change", (_event, isFullScreen) => callback(isFullScreen)),
    onZoomFactorChange: (callback) =>
        ipcRenderer.on("zoom-factor-change", (_event, zoomFactor) => callback(zoomFactor)),
    onUpdaterStatusChange: (callback) => ipcRenderer.on("app-update-status", (_event, status) => callback(status)),
    getUpdaterStatus: () => ipcRenderer.sendSync("get-app-update-status"),
    getUpdaterChannel: () => ipcRenderer.sendSync("get-updater-channel"),
    installAppUpdate: () => ipcRenderer.send("install-app-update"),
    onMenuItemAbout: (callback) => ipcRenderer.on("menu-item-about", callback),
    updateWindowControlsOverlay: (rect) => ipcRenderer.send("update-window-controls-overlay", rect),
    onReinjectKey: (callback) => ipcRenderer.on("reinject-key", (_event, waveEvent) => callback(waveEvent)),
    setWebviewFocus: (focused: number) => ipcRenderer.send("webview-focus", focused),
    registerGlobalWebviewKeys: (keys) => ipcRenderer.send("register-global-webview-keys", keys),
    onControlShiftStateUpdate: (callback) =>
        ipcRenderer.on("control-shift-state-update", (_event, state) => callback(state)),
    createWorkspace: () => ipcRenderer.send("create-workspace"),
    switchWorkspace: (workspaceId) => ipcRenderer.send("switch-workspace", workspaceId),
    deleteWorkspace: (workspaceId) => ipcRenderer.send("delete-workspace", workspaceId),
    setActiveTab: (tabId) => ipcRenderer.send("set-active-tab", tabId),
    createTab: () => ipcRenderer.send("create-tab"),
    closeTab: (workspaceId, tabId, confirmClose) => ipcRenderer.invoke("close-tab", workspaceId, tabId, confirmClose),
    setWindowInitStatus: (status) => ipcRenderer.send("set-window-init-status", status),
    onWaveInit: (callback) => ipcRenderer.on("wave-init", (_event, initOpts) => callback(initOpts)),
    sendLog: (log) => ipcRenderer.send("fe-log", log),
    onQuicklook: (filePath: string) => ipcRenderer.send("quicklook", filePath),
    openNativePath: (filePath: string) => ipcRenderer.send("open-native-path", filePath),
    captureScreenshot: (rect: Rectangle) => ipcRenderer.invoke("capture-screenshot", rect),
    setKeyboardChordMode: () => ipcRenderer.send("set-keyboard-chord-mode"),
    clearWebviewStorage: (webContentsId: number) => ipcRenderer.invoke("clear-webview-storage", webContentsId),
    setWaveAIOpen: (isOpen: boolean) => ipcRenderer.send("set-waveai-open", isOpen),
    incrementTermCommands: (opts?: { isRemote?: boolean; isWsl?: boolean; isDurable?: boolean }) =>
        ipcRenderer.send("increment-term-commands", opts),
    nativePaste: () => ipcRenderer.send("native-paste"),
    doRefresh: () => ipcRenderer.send("do-refresh"),
    saveTextFile: (fileName: string, content: string) => ipcRenderer.invoke("save-text-file", fileName, content),
    selectDirectory: () => ipcRenderer.invoke("select-directory"),
    selectFiles: () => ipcRenderer.invoke("select-files"),
    searchSystemItems: (query: string) => ipcRenderer.invoke("search-system-items", query),
    acpApplyGitIdentity: (opts) => ipcRenderer.invoke("acp-apply-git-identity", opts),
    setIsActive: () => ipcRenderer.invoke("set-is-active"),
    setDesktopPetActivity: (notification) => ipcRenderer.send("desktop-pet-activity", notification),
    onDesktopPetChat: (callback: (text: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
        ipcRenderer.on("desktop-pet-chat", handler);
        return () => ipcRenderer.removeListener("desktop-pet-chat", handler);
    },
    onDesktopPetResume: (callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on("desktop-pet-resume", handler);
        return () => ipcRenderer.removeListener("desktop-pet-resume", handler);
    },
    onDesktopPetSurfaceActivity: (callback: (activity: Record<string, unknown>) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, activity: Record<string, unknown>) => callback(activity);
        ipcRenderer.on("desktop-pet-surface-activity", handler);
        return () => ipcRenderer.removeListener("desktop-pet-surface-activity", handler);
    },
    acpDetectAgents: () => ipcRenderer.invoke("acp-detect-agents"),
    acpInitialize: (opts) => ipcRenderer.invoke("acp-initialize", opts),
    acpSendMessage: (opts) => ipcRenderer.invoke("acp-send-message", opts),
    acpConfirmTool: (opts) => ipcRenderer.invoke("acp-confirm-tool", opts),
    acpStop: (opts) => ipcRenderer.invoke("acp-stop", opts),
    acpGetStatus: (opts) => ipcRenderer.invoke("acp-get-status", opts),
    acpListRuntimes: () => ipcRenderer.invoke("acp-list-runtimes"),
    acpGetMode: (opts) => ipcRenderer.invoke("acp-get-mode", opts),
    acpSetMode: (opts) => ipcRenderer.invoke("acp-set-mode", opts),
    acpGetConfigOptions: (opts) => ipcRenderer.invoke("acp-get-config-options", opts),
    acpSetConfigOption: (opts) => ipcRenderer.invoke("acp-set-config-option", opts),
    acpGetModelInfo: (opts) => ipcRenderer.invoke("acp-get-model-info", opts),
    acpSetModel: (opts) => ipcRenderer.invoke("acp-set-model", opts),
    onAcpEvent: (callback: (event: any) => void) => {
        const handler = (_event: any, event: any) => callback(event);
        ipcRenderer.on("acp-event", handler);
        return () => ipcRenderer.removeListener("acp-event", handler);
    },

    // ── LSP (Language Server Protocol) IPC ───────────────────────────
    lspStart: (language: string) =>
        ipcRenderer.invoke("lsp-start", language).then((r: any) => {
            if (!r.success) throw new Error(r.error ?? "Failed to start language server");
            return r.sessionId as string;
        }),
    lspSend: (sessionId: string, content: string) => ipcRenderer.send("lsp-send", sessionId, content),
    lspStop: (sessionId: string) => ipcRenderer.send("lsp-stop", sessionId),
    onLspMessage: (callback: (msg: { sessionId: string; content: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, msg: { sessionId: string; content: string }) =>
            callback(msg);
        ipcRenderer.on("lsp-message", handler);
        return () => ipcRenderer.removeListener("lsp-message", handler);
    },

    // ── Krondesign daemon IPC ────────────────────────────────────────
    krondesignStatus: () => ipcRenderer.invoke("krondesign-status"),
    krondesignStart: () => ipcRenderer.invoke("krondesign-start"),

    // ── ChatHub V2 / KronosChamber backend IPC ────────────────────────
    chathubv2Start: (context?: { tabId?: string; blockId?: string; surfaceId?: string }) =>
        ipcRenderer.invoke("chathubv2-start", context),
    chathubv2Status: () => ipcRenderer.invoke("chathubv2-status"),
    chathubv2Stop: () => ipcRenderer.invoke("chathubv2-stop"),
    hermesGetConnection: (context?: { tabId?: string; blockId?: string }) =>
        ipcRenderer.invoke("hermes-get-connection", context),
    onHermesConnection: (callback) => {
        const handler = (_event: Electron.IpcRendererEvent, payload: HermesConnectionDescriptor) => callback(payload);
        ipcRenderer.on("hermes-connection", handler);
        return () => ipcRenderer.removeListener("hermes-connection", handler);
    },
    kronoscodeGetConnection: () => ipcRenderer.invoke("kronoscode-get-connection"),
    kronoscodeRevalidateConnection: () => ipcRenderer.invoke("kronoscode-revalidate-connection"),
    kronoscodeTouchBackend: () => ipcRenderer.invoke("kronoscode-touch-backend"),
    kronoscodeGetGatewayWsUrl: (input?: { directory?: string; surfaceId?: string }) =>
        ipcRenderer.invoke("kronoscode-get-gateway-ws-url", input),
    kronoscodeApi: (input) => ipcRenderer.invoke("kronoscode-api", input),
    kronoscodeApplyConnection: (input) => ipcRenderer.invoke("kronoscode-apply-connection", input),
    kronoscodeGetBootProgress: () => ipcRenderer.invoke("kronoscode-get-boot-progress"),
    onKronosCodeBootProgress: (callback) => {
        const handler = (_event: Electron.IpcRendererEvent, payload: KronosCodeBootProgress) => callback(payload);
        ipcRenderer.on("kronoscode-boot-progress", handler);
        return () => ipcRenderer.removeListener("kronoscode-boot-progress", handler);
    },
    onKronosCodeExit: (callback) => {
        const handler = (_event: Electron.IpcRendererEvent, payload: { code: number | null; signal: string | null }) =>
            callback(payload);
        ipcRenderer.on("kronoscode-exit", handler);
        return () => ipcRenderer.removeListener("kronoscode-exit", handler);
    },
    onKronosCodePowerResume: (callback) => {
        const handler = () => callback();
        ipcRenderer.on("kronoscode-power-resume", handler);
        return () => ipcRenderer.removeListener("kronoscode-power-resume", handler);
    },
    onKronosCodeConnectionApplied: (callback) => {
        const handler = (_event: Electron.IpcRendererEvent, payload: KronosCodeConnectionDescriptor) =>
            callback(payload);
        ipcRenderer.on("kronoscode-connection-applied", handler);
        return () => ipcRenderer.removeListener("kronoscode-connection-applied", handler);
    },

    // ── Audio / Voice Engine IPC ─────────────────────────────────────
    audioStart: () => ipcRenderer.invoke("audio-start"),
    audioShutdown: () => ipcRenderer.send("audio-shutdown"),
    audioStartListening: () => ipcRenderer.send("audio-start-listening"),
    audioStopListening: () => ipcRenderer.send("audio-stop-listening"),
    audioSpeak: (text: string) => ipcRenderer.send("audio-speak", text),
    audioSetWakeWord: (enabled: boolean) => ipcRenderer.send("audio-set-wake-word", enabled),
    onAudioStatusChange: (callback: (status: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
        ipcRenderer.on("audio-status-change", handler);
        return () => ipcRenderer.removeListener("audio-status-change", handler);
    },
    onAudioTranscript: (callback: (text: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
        ipcRenderer.on("audio-transcript", handler);
        return () => ipcRenderer.removeListener("audio-transcript", handler);
    },
    onAudioError: (callback: (message: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
        ipcRenderer.on("audio-error", handler);
        return () => ipcRenderer.removeListener("audio-error", handler);
    },
});

// Custom event for "new-window"
ipcRenderer.on("webview-new-window", (e, webContentsId, details) => {
    const event = new CustomEvent("new-window", { detail: details });
    document.getElementById("webview").dispatchEvent(event);
});

ipcRenderer.on("webcontentsid-from-blockid", (e, blockId, responseCh) => {
    const webviewElem: WebviewTag = document.querySelector("div[data-blockid='" + blockId + "'] webview");
    const wcId = webviewElem?.dataset?.webcontentsid;
    ipcRenderer.send(responseCh, wcId);
});
