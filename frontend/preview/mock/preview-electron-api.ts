// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const acpPreviewListeners = new Set<
    (event: { conversationId: string; type: string; msgId: string; data?: any; timestamp: number }) => void
>();

function emitAcpPreviewEvent(conversationId: string, type: string, data?: any) {
    const event = {
        conversationId,
        type,
        msgId: `${conversationId}-preview-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        data,
        timestamp: Date.now(),
    };
    acpPreviewListeners.forEach((listener) => listener(event));
}

const previewAcpAgents = [
    {
        backend: "kronoscode",
        name: "KronosCode",
        cliPath: "/Users/albsheralsadi/kronterm/kronoscoder/packages/kronoscode/bin/kronoscode",
        available: true,
        avatar: "K",
        description: "Local KronosCode ACP agent",
        authRequired: false,
        supportsStreaming: true,
        acpArgs: ["acp"],
        skillsDirs: [".kronoscode/skills"],
    },
    { backend: "opencode", name: "OpenCode", cliPath: "opencode", available: true, avatar: "O", acpArgs: ["acp"] },
    {
        backend: "codex",
        name: "Codex",
        cliPath: "npx @zed-industries/codex-acp@0.9.5",
        available: true,
        avatar: "C",
    },
    {
        backend: "gemini",
        name: "Gemini",
        cliPath: "gemini",
        available: true,
        avatar: "G",
        acpArgs: ["--experimental-acp"],
    },
    {
        backend: "claude",
        name: "Claude",
        cliPath: "claude",
        available: false,
        avatar: "A",
        acpArgs: ["--experimental-acp"],
    },
];

const previewAcpModels = [
    { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { id: "openai/gpt-5.2", label: "GPT-5.2" },
    { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
    { id: "google/gemini-3-flash", label: "Gemini 3 Flash" },
];

const previewRuntimes = new Map<
    string,
    { conversationId: string; backend: string; workspace?: string; status: string; sessionId: string }
>();

function getPreviewChatHubV2Data(url: string, ready: boolean) {
    return {
        url,
        port: 3107,
        serverPath: "",
        distPath: "",
        ready,
    };
}

async function isPreviewChatHubV2Reachable(url: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 700);
    try {
        const response = await fetch(`${url}/health`, { mode: "no-cors", signal: controller.signal });
        return response.ok || response.type === "opaque";
    } catch (_err) {
        return false;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function getPreviewChatHubV2Status() {
    const url = "http://127.0.0.1:3107";
    if (await isPreviewChatHubV2Reachable(url)) {
        return {
            success: true,
            data: getPreviewChatHubV2Data(url, true),
        };
    }
    return { success: true, data: null };
}

async function startPreviewChatHubV2() {
    const url = "http://127.0.0.1:3107";
    if (await isPreviewChatHubV2Reachable(url)) {
        return {
            success: true,
            data: getPreviewChatHubV2Data(url, true),
        };
    }
    return {
        success: false,
        error: "ChatHub V2 can only be started by the Electron app. Open the ChatHub V2 widget in KronTerm to launch KronosChamber.",
    };
}

const previewElectronApi: ElectronApi = {
    getAuthKey: () => "",
    getIsDev: () => false,
    getCursorPoint: () => ({ x: 0, y: 0 }) as Electron.Point,
    getPlatform: () => "darwin",
    getEnv: (_varName: string) => "",
    getUserName: () => "",
    getHostName: () => "",
    getDataDir: () => "",
    getConfigDir: () => "",
    getHomeDir: () => "",
    getWebviewPreload: () => "",
    getAboutModalDetails: () => ({}) as AboutModalDetails,
    getZoomFactor: () => 1.0,
    showWorkspaceAppMenu: (_workspaceId: string) => {},
    showBuilderAppMenu: (_builderId: string) => {},
    showContextMenu: (_workspaceId: string, _menu: ElectronContextMenuItem[]) => {},
    onContextMenuClick: (_callback: (id: string | null) => void) => {},
    onNavigate: (_callback: (url: string) => void) => {},
    onIframeNavigate: (_callback: (url: string) => void) => {},
    downloadFile: (_path: string) => {},
    openExternal: (_url: string) => {},
    onFullScreenChange: (_callback: (isFullScreen: boolean) => void) => {},
    onZoomFactorChange: (_callback: (zoomFactor: number) => void) => {},
    onUpdaterStatusChange: (_callback: (status: UpdaterStatus) => void) => {},
    getUpdaterStatus: () => "up-to-date",
    getUpdaterChannel: () => "",
    installAppUpdate: () => {},
    onMenuItemAbout: (_callback: () => void) => {},
    updateWindowControlsOverlay: (_rect: Dimensions) => {},
    onReinjectKey: (_callback: (waveEvent: WaveKeyboardEvent) => void) => {},
    setWebviewFocus: (_focusedId: number) => {},
    registerGlobalWebviewKeys: (_keys: string[]) => {},
    onControlShiftStateUpdate: (_callback: (state: boolean) => void) => {},
    createWorkspace: () => {},
    switchWorkspace: (_workspaceId: string) => {},
    deleteWorkspace: (_workspaceId: string) => {},
    setActiveTab: (_tabId: string) => {},
    createTab: () => {},
    closeTab: (_workspaceId: string, _tabId: string, _confirmClose: boolean) => Promise.resolve(false),
    setWindowInitStatus: (_status: "ready" | "wave-ready") => {},
    onWaveInit: (_callback: (initOpts: WaveInitOpts) => void) => {},
    onBuilderInit: (_callback: (initOpts: BuilderInitOpts) => void) => {},
    sendLog: (_log: string) => {},
    onQuicklook: (_filePath: string) => {},
    openNativePath: (_filePath: string) => {},
    captureScreenshot: (_rect: Electron.Rectangle) => Promise.resolve(""),
    setKeyboardChordMode: () => {},
    clearWebviewStorage: (_webContentsId: number) => Promise.resolve(),
    setWaveAIOpen: (_isOpen: boolean) => {},
    closeBuilderWindow: () => {},
    incrementTermCommands: (_opts?: { isRemote?: boolean; isWsl?: boolean; isDurable?: boolean }) => {},
    nativePaste: () => {},
    openBuilder: (_appId?: string) => {},
    setBuilderWindowAppId: (_appId: string) => {},
    doRefresh: () => {},
    saveTextFile: (_fileName: string, _content: string) => Promise.resolve(false),
    selectDirectory: () => Promise.resolve("/Users/albsheralsadi/kronterm"),
    selectFiles: () =>
        Promise.resolve([
            "/Users/albsheralsadi/kronterm/frontend/app/aipanel/acp-chat-panel.tsx",
            "/Users/albsheralsadi/kronterm/frontend/app/aipanel/use-acp-session.ts",
        ]),
    acpApplyGitIdentity: (_opts: { workspace: string; userName: string; userEmail: string }) =>
        Promise.resolve({ success: true }),
    setIsActive: async () => {},
    setDesktopPetActivity: (_notification) => {},
    onDesktopPetChat: (_callback) => () => {},
    onDesktopPetResume: (_callback) => () => {},
    onDesktopPetSurfaceActivity: (_callback) => () => {},
    acpDetectAgents: () => Promise.resolve(previewAcpAgents),
    acpInitialize: (opts: {
        conversationId: string;
        backend: string;
        workspace?: string;
        cliPath?: string;
        customArgs?: string[];
        customEnv?: Record<string, string>;
        resumeSessionId?: string;
        resumeSessionConversationId?: string;
        mcpServers?: Array<
            | {
                  type?: "stdio";
                  name: string;
                  command: string;
                  args: string[];
                  env: Array<{ name: string; value: string }>;
              }
            | {
                  type: "http" | "sse";
                  name: string;
                  url: string;
                  headers?: Array<{ name: string; value: string }>;
              }
        >;
    }) => {
        previewRuntimes.set(opts.conversationId, {
            conversationId: opts.conversationId,
            backend: opts.backend,
            workspace: opts.workspace,
            status: "connected",
            sessionId: opts.resumeSessionId ?? `${opts.conversationId}-session`,
        });
        window.setTimeout(() => {
            emitAcpPreviewEvent(opts.conversationId, "status", { status: "connected" });
            emitAcpPreviewEvent(opts.conversationId, "config_option", {
                currentMode: "default",
                modes: {
                    currentModeId: "default",
                    availableModes: [
                        { id: "default", name: "Auto" },
                        { id: "plan", name: "Plan" },
                        { id: "build", name: "Build" },
                    ],
                },
                configOptions: [],
            });
            emitAcpPreviewEvent(opts.conversationId, "agent_info", {
                modelInfo: {
                    currentModelId: "anthropic/claude-sonnet-4-5",
                    currentModelLabel: "Claude Sonnet 4.5",
                    canSwitch: true,
                    availableModels: previewAcpModels,
                },
            });
        }, 150);
        return Promise.resolve({ success: true });
    },
    acpSendMessage: (opts: { conversationId: string; content: string }) => {
        const runtime = previewRuntimes.get(opts.conversationId);
        if (runtime) {
            runtime.status = "running";
        }
        window.setTimeout(() => {
            emitAcpPreviewEvent(opts.conversationId, "status", { status: "running" });
            emitAcpPreviewEvent(opts.conversationId, "agent_message_chunk", {
                text: `Preview response from ACP for: ${opts.content}`,
            });
            emitAcpPreviewEvent(opts.conversationId, "tool_call", {
                title: "Preview tool call",
                status: "completed",
                rawInput: { command: "kronoscode acp", workspace: "preview" },
            });
            emitAcpPreviewEvent(opts.conversationId, "finish", {});
            if (runtime) {
                runtime.status = "finished";
            }
        }, 250);
        return Promise.resolve({ success: true });
    },
    acpConfirmTool: (_opts: { conversationId: string; msgId: string; callId: string; optionId: string }) =>
        Promise.resolve({ success: false, error: "ACP is not available in preview" }),
    acpStop: (_opts: { conversationId: string }) => {
        previewRuntimes.delete(_opts.conversationId);
        return Promise.resolve({ success: true });
    },
    acpGetStatus: (_opts: { conversationId: string }) => {
        const runtime = previewRuntimes.get(_opts.conversationId);
        return Promise.resolve(
            runtime
                ? {
                      found: true,
                      ...runtime,
                      modelInfo: {
                          currentModelId: "anthropic/claude-sonnet-4-5",
                          currentModelLabel: "Claude Sonnet 4.5",
                          canSwitch: true,
                          availableModels: previewAcpModels,
                      },
                      modes: {
                          currentModeId: "default",
                          availableModes: [
                              { id: "default", name: "Auto" },
                              { id: "plan", name: "Plan" },
                              { id: "build", name: "Build" },
                          ],
                      },
                      currentMode: "default",
                      configOptions: [],
                      capabilities: { loadSession: true, mcpCapabilities: { stdio: true } },
                  }
                : { found: false, status: "idle" }
        );
    },
    acpListRuntimes: () => Promise.resolve(Array.from(previewRuntimes.values())),
    acpGetMode: (_opts: { conversationId: string }) =>
        Promise.resolve({ success: true, data: { mode: "default", initialized: true } }),
    acpSetMode: (_opts: { conversationId: string; mode: string }) =>
        Promise.resolve({ success: true, data: { mode: _opts.mode, initialized: true } }),
    acpGetConfigOptions: (_opts: { conversationId: string }) =>
        Promise.resolve({ success: true, data: { configOptions: [] } }),
    acpSetConfigOption: (_opts: { conversationId: string; configId: string; value: string }) =>
        Promise.resolve({ success: true, data: { configOptions: [] } }),
    acpGetModelInfo: (_opts: { conversationId: string }) =>
        Promise.resolve({
            success: true,
            data: {
                modelInfo: {
                    currentModelId: "anthropic/claude-sonnet-4-5",
                    currentModelLabel: "Claude Sonnet 4.5",
                    canSwitch: true,
                    availableModels: previewAcpModels,
                },
            },
        }),
    acpSetModel: (_opts: { conversationId: string; modelId: string }) =>
        Promise.resolve({
            success: true,
            data: {
                modelInfo: {
                    currentModelId: _opts.modelId,
                    currentModelLabel: previewAcpModels.find((model) => model.id === _opts.modelId)?.label,
                    canSwitch: true,
                    availableModels: previewAcpModels,
                },
            },
        }),
    lspStart: (_language: string) => Promise.reject(new Error("LSP is not available in preview")),
    lspSend: (_sessionId: string, _content: string) => {},
    lspStop: (_sessionId: string) => {},
    onLspMessage: (_callback: (msg: { sessionId: string; content: string }) => void) => () => {},
    krondesignStatus: () => Promise.resolve({ running: false, url: "", pid: null }),
    krondesignStart: () => Promise.resolve({ success: false, error: "Krondesign is not available in preview" }),
    // ── ChatHub V2 / KronosChamber ──────────────────────────
    chathubv2Start: startPreviewChatHubV2,
    chathubv2Status: getPreviewChatHubV2Status,
    chathubv2Stop: () => Promise.resolve({ success: true }),
    hermesGetConnection: () => Promise.reject(new Error("Hermes is only available in the Electron app")),
    onHermesConnection: () => () => {},
    kronoscodeGetConnection: () =>
        Promise.resolve({
            mode: "managed" as const,
            baseUrl: "http://127.0.0.1:4096",
            backendVersion: "preview",
            protocolVersion: "1.0",
            serverInstanceId: "preview",
            capabilities: { gateway: true, replay: true, asyncPrompt: true },
            managed: true,
        }),
    kronoscodeRevalidateConnection: () => previewElectronApi.kronoscodeGetConnection(),
    kronoscodeTouchBackend: () => Promise.resolve(true),
    kronoscodeGetGatewayWsUrl: () => Promise.resolve("ws://127.0.0.1:4096/global/gateway?ticket=preview"),
    kronoscodeApi: () => Promise.resolve({ status: 200, headers: {}, body: {} }),
    kronoscodeApplyConnection: () => previewElectronApi.kronoscodeGetConnection(),
    kronoscodeGetBootProgress: () =>
        Promise.resolve({ phase: "ready" as const, message: "Preview KronosCode is ready.", progress: 100 }),
    onKronosCodeBootProgress: () => () => {},
    onKronosCodeExit: () => () => {},
    onKronosCodePowerResume: () => () => {},
    onKronosCodeConnectionApplied: () => () => {},
    audioStart: () => Promise.resolve(false),
    audioShutdown: () => {},
    audioStartListening: () => {},
    audioStopListening: () => {},
    audioSpeak: (_text: string) => {},
    audioSetWakeWord: (_enabled: boolean) => {},
    onAudioStatusChange: (_callback: (status: string) => void) => () => {},
    onAudioTranscript: (_callback: (text: string) => void) => () => {},
    onAudioError: (_callback: (message: string) => void) => () => {},

    onAcpEvent: (
        callback: (event: {
            conversationId: string;
            type: string;
            msgId: string;
            data?: any;
            timestamp: number;
        }) => void
    ) => {
        acpPreviewListeners.add(callback);
        return () => {
            acpPreviewListeners.delete(callback);
        };
    },
};

function installPreviewElectronApi() {
    (window as any).api = previewElectronApi;
}

export { installPreviewElectronApi, previewElectronApi };
