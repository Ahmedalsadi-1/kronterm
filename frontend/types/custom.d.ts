// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WshClient } from "@/app/store/wshclient";
import type { WaveEnv } from "@/app/waveenv/waveenv";
import { type Placement } from "@floating-ui/react";
import type * as jotai from "jotai";
import type * as rxjs from "rxjs";

declare module "@/app/store/wshclientapi" {
    interface RpcApiType {
        ListAllAppsCommand(
            client: WshClient,
            opts?: RpcOpts
        ): Promise<
            Array<{
                appid: string;
                modtime?: number;
                manifest?: {
                    appmeta?: {
                        title?: string;
                        displayname?: string;
                        shortdesc?: string;
                        icon?: string;
                        iconcolor?: string;
                    };
                    configschema?: Record<string, unknown>;
                    dataschema?: Record<string, unknown>;
                    secrets?: Record<string, unknown>;
                };
            }>
        >;
        MakeDraftFromLocalCommand(
            client: WshClient,
            data: CommandMakeDraftFromLocalData,
            opts?: RpcOpts
        ): Promise<CommandMakeDraftFromLocalRtnData>;
    }
}

declare global {
    type GlobalAtomsType = {
        uiContext: jotai.Atom<UIContext>; // driven from windowId, tabId
        workspaceId: jotai.Atom<string>; // derived from window WOS object
        workspace: jotai.Atom<Workspace>; // driven from workspaceId via WOS
        fullConfigAtom: jotai.PrimitiveAtom<FullConfigType>; // driven from WOS, settings -- updated via WebSocket
        waveaiModeConfigAtom: jotai.PrimitiveAtom<Record<string, AIModeConfigType>>; // resolved AI mode configs -- updated via WebSocket
        settingsAtom: jotai.Atom<SettingsType>; // derrived from fullConfig
        hasCustomAIPresetsAtom: jotai.Atom<boolean>; // derived from fullConfig
        hasConfigErrors: jotai.Atom<boolean>; // derived from fullConfig
        staticTabId: jotai.Atom<string>;
        isFullScreen: jotai.PrimitiveAtom<boolean>;
        zoomFactorAtom: jotai.PrimitiveAtom<number>;
        controlShiftDelayAtom: jotai.PrimitiveAtom<boolean>;
        prefersReducedMotionAtom: jotai.Atom<boolean>;
        documentHasFocus: jotai.PrimitiveAtom<boolean>;
        updaterStatusAtom: jotai.PrimitiveAtom<UpdaterStatus>;
        modalOpen: jotai.PrimitiveAtom<boolean>;
        allConnStatus: jotai.Atom<ConnStatus[]>;
        reinitVersion: jotai.PrimitiveAtom<number>;
        waveAIRateLimitInfoAtom: jotai.PrimitiveAtom<RateLimitInfo>;
        builderId: jotai.PrimitiveAtom<string>;
        builderAppId: jotai.PrimitiveAtom<string>;
    };

    type ThrottledValueAtom<T> = jotai.WritableAtom<T, [update: jotai.SetStateAction<T>], void>;

    type AtomWithThrottle<T> = {
        currentValueAtom: jotai.Atom<T>;
        throttledValueAtom: ThrottledValueAtom<T>;
    };

    type DebouncedValueAtom<T> = jotai.WritableAtom<T, [update: jotai.SetStateAction<T>], void>;

    type AtomWithDebounce<T> = {
        currentValueAtom: jotai.Atom<T>;
        debouncedValueAtom: DebouncedValueAtom<T>;
    };

    type ChatHubV2RuntimeHealth = {
        runtime: "kronoscode-kronoschamber";
        status: "not-found" | "starting" | "ready" | "error" | "stopped";
        checkedAt: number;
        candidateRoots: string[];
        detectedRoot?: string;
        serverPath?: string;
        distPath?: string;
        kronosCodeBinary?: string;
        startupError?: string;
        logExcerpt: string[];
        supportedProviders: string[];
        supportedModels: string[];
        recoveryActions: Array<"retry" | "open-settings" | "inspect-logs">;
    };

    type ChatHubV2ServerData = {
        url: string;
        port: number;
        pid?: number;
        serverPath: string;
        distPath: string;
        ready: boolean;
        health?: ChatHubV2RuntimeHealth;
    };

    type SplitAtom<Item> = Atom<Atom<Item>[]>;
    type WritableSplitAtom<Item> = WritableAtom<PrimitiveAtom<Item>[], [SplitAtomAction<Item>], void>;

    type TabLayoutData = {
        blockId: string;
    };

    type GlobalInitOptions = {
        tabId?: string;
        platform: NodeJS.Platform;
        windowId: string;
        clientId: string;
        environment: "electron" | "renderer";
        primaryTabStartup?: boolean;
        builderId?: string;
        isPreview?: boolean;
    };

    type WaveInitOpts = GlobalInitOptions & {
        tabId: string;
        fullConfig: FullConfigType;
        clientId: string;
        activate?: boolean;
    };

    type BuilderInitOpts = GlobalInitOptions & {
        builderId: string;
        appId?: string;
    };

    type KronSettingsKey =
        | keyof SettingsType
        | "app:defaulteditor"
        | "desktop:control"
        | "desktop:screenshare"
        | "desktop:autominimize"
        | "git:username"
        | "git:useremail"
        | "github:token"
        | "github:owner"
        | "notify:desktop"
        | "notify:sound"
        | "notify:taskcomplete"
        | "notify:error"
        | "term:autodelete"
        | "term:autodeletedays";

    type CommandMakeDraftFromLocalData = {
        localappid: string;
    };

    type CommandMakeDraftFromLocalRtnData = {
        draftappid: string;
    };

    type ElectronApi = {
        getAuthKey(): string; // get-auth-key
        getIsDev(): boolean; // get-is-dev
        getCursorPoint: () => Electron.Point; // get-cursor-point
        getPlatform: () => NodeJS.Platform; // get-platform
        getEnv: (varName: string) => string; // get-env
        getUserName: () => string; // get-user-name
        getHostName: () => string; // get-host-name
        getDataDir: () => string; // get-data-dir
        getConfigDir: () => string; // get-config-dir
        getHomeDir: () => string; // get-home-dir
        getWebviewPreload: () => string; // get-webview-preload
        getAboutModalDetails: () => AboutModalDetails; // get-about-modal-details
        getZoomFactor: () => number; // get-zoom-factor
        showWorkspaceAppMenu: (workspaceId: string) => void; // workspace-appmenu-show
        showBuilderAppMenu: (builderId: string) => void; // builder-appmenu-show
        showContextMenu: (workspaceId: string, menu: ElectronContextMenuItem[]) => void; // contextmenu-show
        onContextMenuClick: (callback: (id: string | null) => void) => void; // contextmenu-click
        onNavigate: (callback: (url: string) => void) => void;
        onIframeNavigate: (callback: (url: string) => void) => void;
        downloadFile: (path: string) => void; // download
        openExternal: (url: string) => void; // open-external
        onFullScreenChange: (callback: (isFullScreen: boolean) => void) => void; // fullscreen-change
        onZoomFactorChange: (callback: (zoomFactor: number) => void) => void; // zoom-factor-change
        onUpdaterStatusChange: (callback: (status: UpdaterStatus) => void) => void; // app-update-status
        getUpdaterStatus: () => UpdaterStatus; // get-app-update-status
        getUpdaterChannel: () => string; // get-updater-channel
        installAppUpdate: () => void; // install-app-update
        onMenuItemAbout: (callback: () => void) => void; // menu-item-about
        updateWindowControlsOverlay: (rect: Dimensions) => void; // update-window-controls-overlay
        onReinjectKey: (callback: (waveEvent: WaveKeyboardEvent) => void) => void; // reinject-key
        setWebviewFocus: (focusedId: number) => void; // webview-focus, focusedId is the getWebContentsId of the webview
        registerGlobalWebviewKeys: (keys: string[]) => void; // register-global-webview-keys
        onControlShiftStateUpdate: (callback: (state: boolean) => void) => void; // control-shift-state-update
        createWorkspace: () => void; // create-workspace
        openBuilder: (appId?: string) => void; // open-builder
        closeBuilderWindow: (builderId?: string) => void; // close-builder-window
        setBuilderWindowAppId: (appId: string) => void; // set-builder-window-app-id
        switchWorkspace: (workspaceId: string) => void; // switch-workspace
        deleteWorkspace: (workspaceId: string) => void; // delete-workspace
        setActiveTab: (tabId: string) => void; // set-active-tab
        createTab: () => void; // create-tab
        closeTab: (workspaceId: string, tabId: string, confirmClose: boolean) => Promise<boolean>; // close-tab
        setWindowInitStatus: (status: "ready" | "wave-ready") => void; // set-window-init-status
        onWaveInit: (callback: (initOpts: WaveInitOpts) => void) => void; // wave-init
        onBuilderInit?: (callback: (initOpts: BuilderInitOpts) => void) => void; // builder-init
        sendLog: (log: string) => void; // fe-log
        onQuicklook: (filePath: string) => void; // quicklook
        openNativePath(filePath: string): void; // open-native-path
        captureScreenshot(rect: Electron.Rectangle): Promise<string>; // capture-screenshot
        setKeyboardChordMode: () => void; // set-keyboard-chord-mode
        clearWebviewStorage: (webContentsId: number) => Promise<void>; // clear-webview-storage
        setWaveAIOpen: (isOpen: boolean) => void; // set-waveai-open
        incrementTermCommands: (opts?: { isRemote?: boolean; isWsl?: boolean; isDurable?: boolean }) => void; // increment-term-commands
        nativePaste: () => void; // native-paste
        doRefresh: () => void; // do-refresh
        saveTextFile: (fileName: string, content: string) => Promise<boolean>; // save-text-file
        selectDirectory: () => Promise<string | null>; // select-directory
        selectFiles: () => Promise<string[]>; // select-files
        acpApplyGitIdentity: (opts: {
            workspace: string;
            userName: string;
            userEmail: string;
        }) => Promise<{ success: boolean; error?: string }>; // acp-apply-git-identity
        setIsActive: () => Promise<void>; // set-is-active
        setDesktopPetActivity: (notification: {
            kind: "idle" | "thinking" | "tool";
            detail?: string;
            thought?: string;
            target?: { x: number; y: number; width: number; height: number };
            cursorAction?: "idle" | "click" | "type" | "scroll" | "hover" | null;
            cursorPoint?: { x: number; y: number } | null;
            reasoningLog?: string[];
            previewImageUrl?: string;
            petActivityUrl?: string;
            surfaceActivity?: {
                sessionid?: string;
                source: "acp" | "kronoscode-tui" | "wave" | "mcp" | "plugin" | "surface-runtime";
                phase:
                    | "queued"
                    | "awaiting-approval"
                    | "running"
                    | "verifying"
                    | "succeeded"
                    | "degraded"
                    | "failed"
                    | "cancelled"
                    | "paused"
                    | "start"
                    | "update"
                    | "finish"
                    | "error";
                blockid?: string;
                surface: "browser" | "sandbox" | "desktop" | "terminal" | "file" | "panel";
                action: string;
                capabilityid?: string;
                connectorid?: string;
                detail?: string;
                thought?: string;
                reasoningSteps?: string[];
                point?: { x: number; y: number };
                target?: { x: number; y: number; width: number; height: number };
                previewimageurl?: string;
                petactivityurl?: string;
                appname?: string;
                presentationHints?: {
                    cursorAction?: "idle" | "click" | "type" | "scroll" | "hover" | null;
                    overlayAction?: string;
                };
            };
        }) => void; // desktop-pet-activity
        onDesktopPetChat: (callback: (text: string) => void) => () => void; // desktop-pet-chat
        onDesktopPetResume: (callback: () => void) => () => void; // desktop-pet-resume
        onDesktopPetSurfaceActivity: (callback: (activity: Record<string, unknown>) => void) => () => void; // desktop-pet-surface-activity
        acpDetectAgents: () => Promise<
            Array<{
                backend: string;
                name: string;
                cliPath: string;
                available: boolean;
                avatar?: string;
                description?: string;
                authRequired?: boolean;
                supportsStreaming?: boolean;
                acpArgs?: string[];
                skillsDirs?: string[];
            }>
        >;
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
            surfaceContext?: {
                tabId: string;
                blockId?: string;
            };
        }) => Promise<{
            success: boolean;
            error?: string;
            conversationId?: string;
            state?: {
                status: string;
                sessionId: string | null;
                backend: string;
                error: string | null;
                confirmations: any[];
                modes: any;
                currentMode: string;
                configOptions: any[];
                modelInfo: any;
                capabilities: any;
            };
        }>;
        acpSendMessage: (opts: {
            conversationId: string;
            content: string;
        }) => Promise<{ success: boolean; error?: string }>;
        acpConfirmTool: (opts: {
            conversationId: string;
            msgId: string;
            callId: string;
            optionId: string;
        }) => Promise<{ success: boolean; error?: string }>;
        acpStop: (opts: { conversationId: string }) => Promise<{ success: boolean; error?: string }>;
        acpGetStatus: (opts: { conversationId: string }) => Promise<{
            found: boolean;
            status?: string;
            sessionId?: string;
            backend?: string;
            error?: string;
            confirmations?: any[];
            modes?: any;
            currentMode?: string;
            configOptions?: any[];
            modelInfo?: any;
            capabilities?: any;
        }>;
        acpListRuntimes: () => Promise<
            Array<{
                conversationId: string;
                sessionId?: string | null;
                backend: string;
                workspace?: string;
                status: string;
                error?: string | null;
                confirmations?: any[];
                modes?: any;
                currentMode?: string | null;
                configOptions?: any[];
                modelInfo?: any;
                capabilities?: any;
            }>
        >;
        acpGetMode: (opts: { conversationId: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
        acpSetMode: (opts: {
            conversationId: string;
            mode: string;
        }) => Promise<{ success: boolean; data?: any; error?: string }>;
        acpGetConfigOptions: (opts: {
            conversationId: string;
        }) => Promise<{ success: boolean; data?: { configOptions?: any[] }; error?: string }>;
        acpSetConfigOption: (opts: {
            conversationId: string;
            configId: string;
            value: string;
        }) => Promise<{ success: boolean; data?: { configOptions?: any[] }; error?: string }>;
        acpGetModelInfo: (opts: {
            conversationId: string;
        }) => Promise<{ success: boolean; data?: { modelInfo?: any }; error?: string }>;
        acpSetModel: (opts: {
            conversationId: string;
            modelId: string;
        }) => Promise<{ success: boolean; data?: { modelInfo?: any }; error?: string }>;
        onAcpEvent: (
            callback: (event: {
                conversationId: string;
                type: string;
                msgId: string;
                data?: any;
                timestamp: number;
            }) => void
        ) => () => void;

        // ── LSP (Language Server Protocol) ────────────────────────────
        lspStart: (language: string) => Promise<string>;
        lspSend: (sessionId: string, content: string) => void;
        lspStop: (sessionId: string) => void;
        onLspMessage: (callback: (msg: { sessionId: string; content: string }) => void) => () => void;

        // ── Krondesign daemon ────────────────────────────────────────
        krondesignStatus: () => Promise<{ running: boolean; url: string; pid: number | null }>;
        krondesignStart: () => Promise<{ success: boolean; error?: string }>;

        // ── ChatHub V2 / KronosChamber backend ──────────────────────
        chathubv2Start: (context?: { tabId?: string; blockId?: string }) => Promise<{
            success: boolean;
            error?: string;
            data?: ChatHubV2ServerData;
            health?: ChatHubV2RuntimeHealth;
        }>;
        chathubv2Status: () => Promise<{
            success: boolean;
            data?: ChatHubV2ServerData | null;
            health?: ChatHubV2RuntimeHealth;
        }>;
        chathubv2Stop: () => Promise<{ success: boolean; error?: string }>;

        // ── Audio / Voice Engine IPC ──────────────────────────────
        audioStart: () => Promise<boolean>;
        audioShutdown: () => void;
        audioStartListening: () => void;
        audioStopListening: () => void;
        audioSpeak: (text: string) => void;
        audioSetWakeWord: (enabled: boolean) => void;
        onAudioStatusChange: (callback: (status: string) => void) => () => void;
        onAudioTranscript: (callback: (text: string) => void) => () => void;
        onAudioError: (callback: (message: string) => void) => () => void;
    };

    type ElectronContextMenuItem = {
        id: string; // unique id, used for communication
        label: string;
        role?: string; // electron role (optional)
        type?: "separator" | "normal" | "submenu" | "checkbox" | "radio" | "header";
        submenu?: ElectronContextMenuItem[];
        checked?: boolean;
        visible?: boolean;
        enabled?: boolean;
        sublabel?: string;
    };

    type ContextMenuItem = {
        label?: string;
        type?: "separator" | "normal" | "submenu" | "checkbox" | "radio" | "header";
        role?: string; // electron role (optional)
        click?: () => void; // not required if role is set
        submenu?: ContextMenuItem[];
        checked?: boolean;
        visible?: boolean;
        enabled?: boolean;
        sublabel?: string;
    };

    type KeyPressDecl = {
        mods: {
            Cmd?: boolean;
            Option?: boolean;
            Shift?: boolean;
            Ctrl?: boolean;
            Alt?: boolean;
            Meta?: boolean;
        };
        key: string;
        keyType: string;
    };

    type SubjectWithRef<T> = rxjs.Subject<T> & { refCount: number; release: () => void };

    type HeaderElem =
        | IconButtonDecl
        | ToggleIconButtonDecl
        | HeaderText
        | HeaderInput
        | HeaderDiv
        | HeaderTextButton
        | ConnectionButton
        | MenuButton;

    type IconButtonCommon = {
        icon: string | React.ReactNode;
        iconColor?: string;
        iconSpin?: boolean;
        className?: string;
        title?: string;
        disabled?: boolean;
        noAction?: boolean;
    };

    type IconButtonDecl = IconButtonCommon & {
        elemtype: "iconbutton";
        click?: (e: React.MouseEvent<any>) => void;
        longClick?: (e: React.MouseEvent<any>) => void;
    };

    type ToggleIconButtonDecl = IconButtonCommon & {
        elemtype: "toggleiconbutton";
        active: jotai.WritableAtom<boolean, [boolean], void>;
    };

    type HeaderTextButton = {
        elemtype: "textbutton";
        text: string;
        className?: string;
        title?: string;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type HeaderText = {
        elemtype: "text";
        text: string;
        ref?: React.RefObject<HTMLDivElement>;
        className?: string;
        noGrow?: boolean;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type HeaderInput = {
        elemtype: "input";
        value: string;
        className?: string;
        isDisabled?: boolean;
        ref?: React.RefObject<HTMLInputElement>;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
        onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
        onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    };

    type HeaderDiv = {
        elemtype: "div";
        className?: string;
        children: HeaderElem[];
        onMouseOver?: (e: React.MouseEvent<any>) => void;
        onMouseOut?: (e: React.MouseEvent<any>) => void;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type ConnectionButton = {
        elemtype: "connectionbutton";
        icon: string;
        text: string;
        iconColor: string;
        onClick?: (e: React.MouseEvent<any>) => void;
        connected: boolean;
    };

    type MenuItem = {
        label: string;
        icon?: string | React.ReactNode;
        subItems?: MenuItem[];
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type MenuButtonProps = {
        items: MenuItem[];
        className?: string;
        text: string;
        title?: string;
        menuPlacement?: Placement;
    };

    type MenuButton = {
        elemtype: "menubutton";
    } & MenuButtonProps;

    type SearchAtoms = {
        searchValue: PrimitiveAtom<string>;
        resultsIndex: PrimitiveAtom<number>;
        resultsCount: PrimitiveAtom<number>;
        isOpen: PrimitiveAtom<boolean>;
        focusInput: PrimitiveAtom<number>;
        regex?: PrimitiveAtom<boolean>;
        caseSensitive?: PrimitiveAtom<boolean>;
        wholeWord?: PrimitiveAtom<boolean>;
    };

    declare type ViewComponentProps<T extends ViewModel> = {
        blockId: string;
        blockRef: React.RefObject<HTMLDivElement>;
        contentRef: React.RefObject<HTMLDivElement>;
        model: T;
    };

    declare type ViewComponent = React.FC<ViewComponentProps>;

    type ViewModelInitType = {
        blockId: string;
        nodeModel: BlockNodeModel;
        tabModel: TabModel;
        waveEnv: WaveEnv;
    };

    type ViewModelClass = new (initOpts: ViewModelInitType) => ViewModel;

    interface ViewModel {
        // The type of view, used for identifying and rendering the appropriate component.
        viewType: string;

        useTermHeader?: jotai.Atom<boolean>;

        hideViewName?: jotai.Atom<boolean>;

        // Icon representing the view, can be a string or an IconButton declaration.
        viewIcon?: jotai.Atom<string | IconButtonDecl>;

        // Display name for the view, used in UI headers.
        viewName?: jotai.Atom<string>;

        // Optional header text or elements for the view.
        viewText?: jotai.Atom<string | HeaderElem[]>;

        termDurableStatus?: jotai.Atom<BlockJobStatusData | null>;
        termConfigedDurable?: jotai.Atom<null | boolean>;

        // Icon button displayed before the title in the header.
        preIconButton?: jotai.Atom<IconButtonDecl>;

        // Icon buttons displayed at the end of the block header.
        endIconButtons?: jotai.Atom<IconButtonDecl[]>;

        // Background styling metadata for the block.
        blockBg?: jotai.Atom<MetaType>;

        noHeader?: jotai.Atom<boolean>;

        // Whether the block manages its own connection (e.g., for remote access).
        manageConnection?: jotai.Atom<boolean>;

        // If true, filters out 'nowsh' connections (when managing connections)
        filterOutNowsh?: jotai.Atom<boolean>;

        // If true, removes padding inside the block content area.
        noPadding?: jotai.Atom<boolean>;

        // Atoms used for managing search functionality within the block.
        searchAtoms?: SearchAtoms;

        // The main view component associated with this ViewModel.
        viewComponent: ViewComponent<ViewModel>;

        // Function to determine if this is a basic terminal block.
        isBasicTerm?: (getFn: jotai.Getter) => boolean;

        // Returns menu items for the settings dropdown.
        getSettingsMenuItems?: () => ContextMenuItem[];

        // Attempts to give focus to the block, returning true if successful.
        giveFocus?: () => boolean;

        // Handles keydown events within the block.
        keyDownHandler?: (e: WaveKeyboardEvent) => boolean;

        // Cleans up resources when the block is disposed.
        dispose?: () => void;
    }

    type UpdaterStatus = "up-to-date" | "checking" | "downloading" | "ready" | "error" | "installing";

    // jotai doesn't export this type :/
    type Loadable<T> = { state: "loading" } | { state: "hasData"; data: T } | { state: "hasError"; error: unknown };

    interface Dimensions {
        width: number;
        height: number;
        left: number;
        top: number;
    }

    type TypeAheadModalType = { [key: string]: boolean };

    interface AboutModalDetails {
        version: string;
        buildTime: number;
    }

    type BlockComponentModel = {
        openSwitchConnection?: () => void;
        viewModel: ViewModel;
    };

    type ConnStatusType = "connected" | "connecting" | "disconnected" | "error" | "init";

    interface SuggestionBaseItem {
        label: string;
        value: string;
        icon?: string | React.ReactNode;
    }

    interface SuggestionConnectionItem extends SuggestionBaseItem {
        status: ConnStatusType;
        iconColor: string;
        onSelect?: (_: string) => void;
        current?: boolean;
    }

    interface SuggestionConnectionScope {
        headerText?: string;
        items: SuggestionConnectionItem[];
    }

    type SuggestionsType = SuggestionConnectionItem | SuggestionConnectionScope;

    type MarkdownResolveOpts = {
        connName: string;
        baseDir: string;
    };

    interface AbstractWshClient {
        recvRpcMessage(msg: RpcMessage): void;
    }

    type ClientRpcEntry = {
        reqId: string;
        startTs: number;
        command: string;
        msgFn: (msg: RpcMessage) => void;
    };

    type TimeSeriesMeta = {
        name?: string;
        color?: string;
        label?: string;
        maxy?: string | number;
        miny?: string | number;
        decimalPlaces?: number;
    };

    interface SuggestionRequestContext {
        widgetid: string;
        reqnum: number;
        dispose?: boolean;
    }

    type SuggestionsFnType = (query: string, reqContext: SuggestionRequestContext) => Promise<FetchSuggestionsResponse>;

    type DraggedFile = {
        uri: string;
        absParent: string;
        relName: string;
        isDir: boolean;
    };

    type ErrorButtonDef = {
        text: string;
        onClick: () => void;
    };

    type ErrorMsg = {
        status: string;
        text: string;
        level?: "error" | "warning";
        buttons?: Array<ErrorButtonDef>;
        closeAction?: () => void;
        showDismiss?: boolean;
    };

    type AIMessage = {
        messageid: string;
        parts: AIMessagePart[];
    };

    type AIMessagePart =
        | {
              type: "text";
              text: string;
          }
        | {
              type: "file";
              mimetype: string; // required
              filename?: string;
              data?: string; // base64 encoded data
              url?: string;
              size?: number;
              previewurl?: string;
          };

    type AIModeConfigWithMode = { mode: string } & AIModeConfigType;
}

export {};
