// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { waveAIHasSelection } from "@/app/aipanel/waveai-focus-utils";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { atoms, getApi, getSettingsKeyAtom } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { useTabModelMaybe } from "@/app/store/tab-model";
import { isBuilderWindow } from "@/app/store/windowtype";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { getWebServerEndpoint } from "@/util/endpoints";
import { checkKeyPressed, keydownWrapper } from "@/util/keyutil";
import { isMacOS, isWindows } from "@/util/platformutil";
import { cn } from "@/util/util";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import * as jotai from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { AcpChatPanel } from "./acp-chat-panel";
import { AIPanelHeader } from "./aipanelheader";
import { formatFileSizeError, isAcceptableFile, validateFileSize } from "./ai-utils";
import { AIRateLimitStrip } from "./airatelimitstrip";
import { WaveUIMessage } from "./aitypes";
import { BYOKAnnouncement } from "./byokannouncement";
import { WaveAIModel } from "./waveai-model";

const AIBlockMask = memo(() => {
    return (
        <div
            key="block-mask"
            className="absolute top-0 left-0 right-0 bottom-0 border-1 border-transparent pointer-events-auto select-none p-0.5"
            style={{
                borderRadius: "var(--block-border-radius)",
                zIndex: "var(--zindex-block-mask-inner)",
            }}
        >
            <div
                className="w-full mt-[44px] h-[calc(100%-44px)] flex items-center justify-center"
                style={{
                    backgroundColor: "rgb(from var(--block-bg-color) r g b / 50%)",
                }}
            >
                <div className="font-bold opacity-70 mt-[-25%] text-[60px]">0</div>
            </div>
        </div>
    );
});

AIBlockMask.displayName = "AIBlockMask";

const AIDragOverlay = memo(() => {
    return (
        <div
            key="drag-overlay"
            className="absolute inset-0 bg-accent/20 border-2 border-dashed border-accent rounded-lg flex items-center justify-center z-10 p-4"
        >
            <div className="text-accent text-center">
                <i className="fa fa-upload text-3xl mb-2"></i>
                <div className="text-lg font-semibold">Drop files here</div>
                <div className="text-sm">Images, PDFs, and text/code files supported</div>
            </div>
        </div>
    );
});

AIDragOverlay.displayName = "AIDragOverlay";

const KeyCap = memo(({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
        <kbd
            className={cn(
                "px-1.5 py-0.5 text-xs bg-black/30 border border-border rounded-sm shadow-sm font-mono",
                className
            )}
        >
            {children}
        </kbd>
    );
});

KeyCap.displayName = "KeyCap";

const AIWelcomeMessage = memo(() => {
    const modKey = isMacOS() ? "⌘" : "Alt";
    const aiModeConfigs = jotai.useAtomValue(atoms.waveaiModeConfigAtom);
    const hasCustomModes = Object.keys(aiModeConfigs).some((key) => !key.startsWith("waveai@"));
    return (
        <div className="text-secondary py-6">
            <div className="text-center">
                <i className="fa fa-circle-nodes text-4xl mb-2 block" style={{ color: "#e8c47c" }}></i>
                <p className="text-lg font-bold text-primary">KronosCode</p>
            </div>
            <div className="mt-4 text-left max-w-md mx-auto">
                <div className="bg-black/20 border border-border rounded-md p-4">
                    <div className="text-sm font-semibold mb-3 text-accent">Start</div>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-4 text-center flex-shrink-0">
                                <i className="fa-solid fa-plug text-accent"></i>
                            </div>
                            <div>
                                <span className="font-bold">Widget Context</span>
                                <div>ON reads terminal and widgets. OFF stays sandboxed.</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-4 text-center flex-shrink-0">
                                <i className="fa-solid fa-file-import text-accent"></i>
                            </div>
                            <div>Drag & drop files or images for analysis</div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-4 text-center flex-shrink-0">
                                <i className="fa-solid fa-keyboard text-accent"></i>
                            </div>
                            <div className="space-y-1">
                                <div>
                                    <KeyCap>{modKey}</KeyCap>
                                    <KeyCap className="ml-1">K</KeyCap>
                                    <span className="ml-1.5">to start a new chat</span>
                                </div>
                                <div>
                                    <KeyCap>{modKey}</KeyCap>
                                    <KeyCap className="ml-1">Shift</KeyCap>
                                    <KeyCap className="ml-1">A</KeyCap>
                                    <span className="ml-1.5">to toggle panel</span>
                                </div>
                                <div>
                                    {isWindows() ? (
                                        <>
                                            <KeyCap>Alt</KeyCap>
                                            <KeyCap className="ml-1">0</KeyCap>
                                            <span className="ml-1.5">to focus</span>
                                        </>
                                    ) : (
                                        <>
                                            <KeyCap>Ctrl</KeyCap>
                                            <KeyCap className="ml-1">Shift</KeyCap>
                                            <KeyCap className="ml-1">0</KeyCap>
                                            <span className="ml-1.5">to focus</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-4 text-center flex-shrink-0">
                                <i className="fa-brands fa-discord text-accent"></i>
                            </div>
                            <div>
                                Questions or feedback?{" "}
                                <a
                                    target="_blank"
                                    href="https://discord.gg/XfvZ334gwU"
                                    rel="noopener"
                                    className="text-accent hover:underline cursor-pointer"
                                >
                                    Join our Discord
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                {!hasCustomModes && <BYOKAnnouncement />}
                <div className="mt-4 text-center text-[12px] text-muted">
                    BETA: Free to use. Daily limits keep our costs in check.
                </div>
            </div>
        </div>
    );
});

AIWelcomeMessage.displayName = "AIWelcomeMessage";

const AIBuilderWelcomeMessage = memo(() => {
    return (
        <div className="text-secondary py-8">
            <div className="text-center">
                <i className="fa fa-sparkles text-4xl text-accent mb-4 block"></i>
                <p className="text-lg font-bold text-primary">WaveApp Builder</p>
            </div>
            <div className="mt-4 text-left max-w-md mx-auto">
                <p className="text-sm mb-6">
                    The WaveApp builder helps create wave widgets that integrate seamlessly into Kronterm.
                </p>
            </div>
        </div>
    );
});

AIBuilderWelcomeMessage.displayName = "AIBuilderWelcomeMessage";

const AIErrorMessage = memo(() => {
    const model = WaveAIModel.getInstance();
    const errorMessage = jotai.useAtomValue(model.errorMessage);

    if (!errorMessage) {
        return null;
    }

    return (
        <div className="px-4 py-2 text-red-400 bg-red-900/20 border-l-4 border-red-500 mx-2 mb-2 relative">
            <button
                onClick={() => model.clearError()}
                className="absolute top-2 right-2 text-red-400 hover:text-red-300 cursor-pointer z-10"
                aria-label="Close error"
            >
                <i className="fa fa-times text-sm"></i>
            </button>
            <div className="text-sm pr-6 max-h-[100px] overflow-y-auto">
                {errorMessage}
                <button
                    onClick={() => model.clearChat()}
                    className="ml-2 text-xs text-red-300 hover:text-red-200 cursor-pointer underline"
                >
                    New Chat
                </button>
            </div>
        </div>
    );
});

AIErrorMessage.displayName = "AIErrorMessage";

function formatGatewayLabel(endpoint?: string): string | null {
    if (!endpoint) {
        return null;
    }
    try {
        const parsed = new URL(endpoint);
        return parsed.host || endpoint;
    } catch {
        return endpoint.replace(/^https?:\/\//, "");
    }
}

type KronosPanelModelSnapshot = {
    id: string;
    name?: string;
    toolCall?: boolean;
    reasoning?: boolean;
    attachment?: boolean;
    status?: string;
};

type KronosPanelProviderSnapshot = {
    id: string;
    name?: string;
    connected?: boolean;
    defaultModelId?: string;
    models?: KronosPanelModelSnapshot[];
};

type KronosPanelNativeConnectorSnapshot = {
    available?: boolean;
    connector?: string;
    status?: string;
    reason?: string;
};

type KronosPanelModeSnapshot = {
    connected?: boolean;
    selectedProviderId?: string;
    selectedModelId?: string;
    providers?: KronosPanelProviderSnapshot[];
    toolCapabilities?: unknown[];
    selectedTools?: unknown[];
    nativeWaveConnector?: KronosPanelNativeConnectorSnapshot;
    errors?: string[];
};

function parseKronosModelLabel(model?: string): { providerId: string; modelId: string } | null {
    if (!model) {
        return null;
    }
    const [providerId, ...modelParts] = model.split("/");
    const modelId = modelParts.join("/");
    if (!providerId || !modelId) {
        return null;
    }
    return { providerId, modelId };
}

const AIPrivacyStrip = memo(() => {
    const model = WaveAIModel.getInstance();
    const currentMode = jotai.useAtomValue(model.currentAIMode);
    const widgetContextEnabled = jotai.useAtomValue(model.widgetAccessAtom);
    const telemetryEnabled = jotai.useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const aiModeConfigs = jotai.useAtomValue(model.aiModeConfigs);
    const modeConfig = aiModeConfigs[currentMode];
    const modeName = modeConfig?.["display:name"] || currentMode;
    const endpoint = modeConfig?.["ai:endpoint"] ?? "";
    const provider = modeConfig?.["ai:provider"];
    const apiType = modeConfig?.["ai:apitype"];
    const toolsEnabled = modeConfig?.["ai:capabilities"]?.includes("tools") ?? false;
    const isKronosMode =
        provider === "kronos" || provider === "kronoscode" || apiType === "kronos-session" || apiType === "kronoscode";
    const gatewayLabel = formatGatewayLabel(endpoint);
    const [kronosSnapshot, setKronosSnapshot] = useState<KronosPanelModeSnapshot | null>(null);
    const [kronosSnapshotLoading, setKronosSnapshotLoading] = useState(false);
    const [kronosSnapshotError, setKronosSnapshotError] = useState("");
    const [kronosSnapshotRefreshNonce, setKronosSnapshotRefreshNonce] = useState(0);

    useEffect(() => {
        if (!isKronosMode) {
            setKronosSnapshot(null);
            setKronosSnapshotLoading(false);
            setKronosSnapshotError("");
            return;
        }

        const webEndpoint = getWebServerEndpoint();
        if (!webEndpoint) {
            setKronosSnapshot(null);
            setKronosSnapshotLoading(false);
            setKronosSnapshotError("Wave web endpoint unavailable");
            return;
        }

        let cancelled = false;

        const loadSnapshot = async () => {
            setKronosSnapshotLoading(true);
            setKronosSnapshotError("");
            try {
                const url = `${webEndpoint}/api/waveai/kronos/snapshot?mode=${encodeURIComponent(currentMode)}`;
                const response = await fetch(url, { method: "GET" });
                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    const errorText =
                        typeof payload?.error === "string" && payload.error.length > 0
                            ? payload.error
                            : response.statusText || "Failed to load Kronos snapshot";
                    throw new Error(errorText);
                }
                const snapshot = (payload?.data ?? payload) as KronosPanelModeSnapshot;
                if (!cancelled) {
                    setKronosSnapshot(snapshot);
                }
            } catch (err) {
                if (!cancelled) {
                    setKronosSnapshot(null);
                    setKronosSnapshotError(err instanceof Error ? err.message : "Failed to load Kronos snapshot");
                }
            } finally {
                if (!cancelled) {
                    setKronosSnapshotLoading(false);
                }
            }
        };

        void loadSnapshot();

        return () => {
            cancelled = true;
        };
    }, [
        currentMode,
        endpoint,
        isKronosMode,
        modeConfig?.["ai:model"],
        modeConfig?.["ai:apitokensecretname"],
        kronosSnapshotRefreshNonce,
    ]);

    let privacyLabel = "Custom provider";
    if (isKronosMode) {
        privacyLabel = "KronosCode host";
    } else if (currentMode.startsWith("waveai@") || modeConfig?.["waveai:cloud"]) {
        privacyLabel = telemetryEnabled ? "Wave cloud" : "Wave cloud locked";
    } else if (
        endpoint.includes("localhost") ||
        endpoint.includes("127.0.0.1") ||
        modeConfig?.["ai:apitoken"] === "ollama"
    ) {
        privacyLabel = "Local only";
    } else if (provider === "openai" || provider === "google" || provider === "openrouter" || provider === "azure") {
        privacyLabel = "Your cloud account";
    }

    const parsedModel = parseKronosModelLabel(modeConfig?.["ai:model"]);
    const kronosProviderId = kronosSnapshot?.selectedProviderId ?? parsedModel?.providerId ?? "";
    const kronosModelId = kronosSnapshot?.selectedModelId ?? parsedModel?.modelId ?? "";
    const kronosProvider = kronosSnapshot?.providers?.find((item) => item.id === kronosProviderId);
    const kronosModel =
        kronosProvider?.models?.find((item) => item.id === kronosModelId) ??
        kronosProvider?.models?.find((item) => item.id === kronosProvider.defaultModelId);
    const kronosProviderLabel = kronosProvider?.name || kronosProviderId;
    const kronosModelLabel = kronosModel?.name || kronosModelId;
    const kronosCapabilities = [
        kronosModel?.toolCall ? "Tools" : "",
        kronosModel?.reasoning ? "Reasoning" : "",
        kronosModel?.attachment ? "Attachments" : "",
    ].filter(Boolean);
    const kronosToolCount = kronosSnapshot?.selectedTools?.length ?? kronosSnapshot?.toolCapabilities?.length ?? 0;
    const nativeConnector = kronosSnapshot?.nativeWaveConnector;
    const nativeConnectorLabel =
        nativeConnector?.available && nativeConnector.connector
            ? `Native: ${nativeConnector.connector}`
            : "Bridge: XML";
    const kronosErrorText = kronosSnapshotError || kronosSnapshot?.errors?.[0] || "";

    return (
        <div className="px-3 py-2 border-b border-border bg-panel">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted">AI path</div>
                    <div className="flex items-center gap-2 mt-1 min-w-0">
                        <span className="text-xs rounded-full px-2 py-1 bg-black/25 text-primary shrink-0 border border-border">
                            {privacyLabel}
                        </span>
                        <span className="text-sm text-primary truncate">{modeName}</span>
                    </div>
                </div>
                <button
                    onClick={() => model.openWaveAIConfig()}
                    className="text-xs text-accent hover:text-accent/80 cursor-pointer shrink-0"
                >
                    Configure
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                <span>Widget context: {widgetContextEnabled ? "On" : "Off"}</span>
                <span>Tools: {toolsEnabled ? "Enabled" : "Unavailable"}</span>
                {isKronosMode && gatewayLabel && <span>Gateway: {gatewayLabel}</span>}
                {isKronosMode && modeConfig?.["ai:agent"] && <span>Agent: {modeConfig["ai:agent"]}</span>}
                {isKronosMode && modeConfig?.["ai:kronostoolrouting"] && (
                    <span>Routing: {modeConfig["ai:kronostoolrouting"]}</span>
                )}
            </div>
            {isKronosMode && (
                <div className="mt-2 rounded border border-border bg-black/20 px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span
                            className={cn(
                                "font-medium",
                                kronosSnapshot?.connected ? "text-emerald-300" : "text-amber-300"
                            )}
                        >
                            {kronosSnapshotLoading
                                ? "Checking Kronos..."
                                : kronosSnapshot?.connected
                                  ? "Kronos connected"
                                  : "Kronos offline"}
                        </span>
                        {kronosProviderLabel && <span className="text-secondary">Provider: {kronosProviderLabel}</span>}
                        {kronosModelLabel && <span className="text-secondary">Model: {kronosModelLabel}</span>}
                        {kronosCapabilities.length > 0 && (
                            <span className="text-muted">{kronosCapabilities.join(" / ")}</span>
                        )}
                        <span className="text-muted">{kronosToolCount} native tools</span>
                        <span className="text-muted">{nativeConnectorLabel}</span>
                        <button
                            onClick={() => setKronosSnapshotRefreshNonce((value) => value + 1)}
                            className="ml-auto text-muted hover:text-primary cursor-pointer"
                            title="Refresh Kronos snapshot"
                        >
                            <i className="fa fa-rotate-right text-xs"></i>
                        </button>
                    </div>
                    {kronosErrorText && <div className="mt-1 text-xs text-amber-300">{kronosErrorText}</div>}
                </div>
            )}
        </div>
    );
});

AIPrivacyStrip.displayName = "AIPrivacyStrip";

const ConfigChangeModeFixer = memo(() => {
    const model = WaveAIModel.getInstance();
    const telemetryEnabled = jotai.useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const aiModeConfigs = jotai.useAtomValue(model.aiModeConfigs);

    useEffect(() => {
        model.fixModeAfterConfigChange();
    }, [telemetryEnabled, aiModeConfigs, model]);

    return null;
});

ConfigChangeModeFixer.displayName = "ConfigChangeModeFixer";

type AIPanelComponentInnerProps = {
    roundTopLeft: boolean;
    onFloatingIsland?: () => void;
    floatingIslandActive?: boolean;
};

const AIPanelComponentInner = memo(({ roundTopLeft, onFloatingIsland, floatingIslandActive }: AIPanelComponentInnerProps) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isReactDndDragOver, setIsReactDndDragOver] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const model = WaveAIModel.getInstance();
    const containerRef = useRef<HTMLDivElement>(null);
    const isLayoutMode = jotai.useAtomValue(atoms.controlShiftDelayAtom);
    const showOverlayBlockNums = jotai.useAtomValue(getSettingsKeyAtom("app:showoverlayblocknums")) ?? true;
    const isFocused = jotai.useAtomValue(model.isWaveAIFocusedAtom);
    const focusFollowsCursorMode = jotai.useAtomValue(getSettingsKeyAtom("app:focusfollowscursor")) ?? "off";
    const telemetryEnabled = jotai.useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const isPanelVisible = jotai.useAtomValue(model.getPanelVisibleAtom());
    const tabModel = useTabModelMaybe();
    const defaultMode = jotai.useAtomValue(getSettingsKeyAtom("waveai:defaultmode")) ?? "waveai@kronos";
    const aiModeConfigs = jotai.useAtomValue(model.aiModeConfigs);

    useEffect(() => {
        return getApi().onDesktopPetChat((text) => {
            WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
            void model.sendMessage(text);
        });
    }, [model]);

    const hasCustomModes = Object.keys(aiModeConfigs).some((key) => !key.startsWith("waveai@"));
    const isUsingCustomMode = !defaultMode.startsWith("waveai@");
    const hasKronosMode = Object.values(aiModeConfigs).some(
        (config) =>
            config["ai:provider"] === "kronos" ||
            config["ai:provider"] === "kronoscode" ||
            config["ai:apitype"] === "kronos-session" ||
            config["ai:apitype"] === "kronoscode"
    );
    const allowAccess = telemetryEnabled || hasKronosMode || (hasCustomModes && isUsingCustomMode);

    const { messages, sendMessage, status, setMessages, error, stop } = useChat<WaveUIMessage>({
        transport: new DefaultChatTransport({
            api: model.getUseChatEndpointUrl(),
            prepareSendMessagesRequest: (_opts) => {
                const msg = model.getAndClearMessage();
                const selectedKronosAgent = globalStore.get(model.selectedKronosAgentAtom);
                const body: any = {
                    msg,
                    chatid: globalStore.get(model.chatId),
                    widgetaccess: globalStore.get(model.widgetAccessAtom),
                    aimode: globalStore.get(model.currentAIMode),
                    kronosAgent: selectedKronosAgent === "kronoscode" ? "build" : selectedKronosAgent,
                    kronosProvider: globalStore.get(model.selectedKronosProviderAtom),
                    kronosModel: globalStore.get(model.selectedKronosModelAtom),
                    kronosMode: globalStore.get(model.selectedKronosModeAtom),
                };
                if (isBuilderWindow()) {
                    body.builderid = globalStore.get(atoms.builderId);
                    body.builderappid = globalStore.get(atoms.builderAppId);
                } else {
                    body.tabid = tabModel.tabId;
                }
                return { body };
            },
        }),
        onError: (error) => {
            console.error("AI Chat error:", error);
            model.setError(error.message || "An error occurred");
        },
    });

    model.registerUseChatData(sendMessage, setMessages, status, stop);

    // console.log("AICHAT messages", messages);
    (window as any).aichatmessages = messages;
    (window as any).aichatstatus = status;

    const handleKeyDown = (waveEvent: WaveKeyboardEvent): boolean => {
        if (checkKeyPressed(waveEvent, "Cmd:k")) {
            model.clearChat();
            return true;
        }
        return false;
    };

    useEffect(() => {
        globalStore.set(model.isAIStreaming, status === "streaming" || status === "submitted");
    }, [status]);

    useEffect(() => {
        const keyHandler = keydownWrapper(handleKeyDown);
        document.addEventListener("keydown", keyHandler);
        return () => {
            document.removeEventListener("keydown", keyHandler);
        };
    }, []);

    useEffect(() => {
        const loadChat = async () => {
            await model.uiLoadInitialChat();
            setInitialLoadDone(true);
        };
        loadChat();
    }, [model]);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                globalStore.set(model.containerWidth, containerRef.current.offsetWidth);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [model]);

    useEffect(() => {
        model.ensureRateLimitSet();
    }, [model]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await model.handleSubmit();
        setTimeout(() => {
            model.focusInput();
        }, 100);
    };

    const hasFilesDragged = (dataTransfer: DataTransfer): boolean => {
        // Check if the drag operation contains files by looking at the types
        return dataTransfer.types.includes("Files");
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Only set drag over to false if we're actually leaving the drop zone
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        if (!allowAccess) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            return;
        }

        // Check if this is a FILE_ITEM drag from react-dnd
        // If so, let react-dnd handle it instead
        if (!e.dataTransfer.files.length) {
            return; // Let react-dnd handle FILE_ITEM drags
        }

        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const acceptableFiles = files.filter(isAcceptableFile);

        for (const file of acceptableFiles) {
            const sizeError = validateFileSize(file);
            if (sizeError) {
                model.setError(formatFileSizeError(sizeError));
                return;
            }
            await model.addFile(file);
        }

        if (acceptableFiles.length < files.length) {
            const rejectedCount = files.length - acceptableFiles.length;
            const rejectedFiles = files.filter((f) => !isAcceptableFile(f));
            const fileNames = rejectedFiles.map((f) => f.name).join(", ");
            model.setError(
                `${rejectedCount} file${rejectedCount > 1 ? "s" : ""} rejected (unsupported type): ${fileNames}. Supported: images, PDFs, and text/code files.`
            );
        }
    };

    const handleFileItemDrop = useCallback(
        (draggedFile: DraggedFile) => {
            if (!allowAccess) {
                return;
            }
            model.addFileFromRemoteUri(draggedFile);
        },
        [model, allowAccess]
    );

    const [{ isOver, canDrop }, drop] = useDrop(
        () => ({
            accept: "FILE_ITEM",
            drop: handleFileItemDrop,
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
            }),
        }),
        [handleFileItemDrop]
    );

    // Update drag over state for FILE_ITEM drags
    useEffect(() => {
        if (isOver && canDrop) {
            setIsReactDndDragOver(true);
        } else {
            setIsReactDndDragOver(false);
        }
    }, [isOver, canDrop]);

    // Attach the drop ref to the container
    useEffect(() => {
        if (containerRef.current) {
            drop(containerRef.current);
        }
    }, [drop]);

    const handleFocusCapture = useCallback(
        (_event: React.FocusEvent) => {
            // console.log("KronosCode focus capture", getElemAsStr(event.target));
            model.requestWaveAIFocus();
        },
        [model]
    );

    const handlePointerEnter = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (focusFollowsCursorMode !== "on") return;
            if (event.pointerType === "touch" || event.buttons > 0) return;
            if (isFocused) return;
            model.focusInput();
        },
        [focusFollowsCursorMode, isFocused, model]
    );

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button, a, input, textarea, select, [role="button"], [tabindex]');

        if (isInteractive) {
            return;
        }

        const hasSelection = waveAIHasSelection();
        if (hasSelection) {
            model.requestWaveAIFocus();
            return;
        }

        setTimeout(() => {
            if (!waveAIHasSelection()) {
                model.focusInput();
            }
        }, 0);
    };

    const showBlockMask = isLayoutMode && showOverlayBlockNums;

    return (
        <div
            ref={containerRef}
            data-waveai-panel="true"
            className={cn(
                "@container bg-panel flex flex-col relative",
                model.inBuilder ? "mt-0 h-full" : "mt-1 h-[calc(100%-4px)]",
                (isDragOver || isReactDndDragOver) && "bg-hoverbg border-accent",
                isFocused ? "border-2 border-accent" : "border-2 border-transparent"
            )}
            style={{
                borderTopLeftRadius: roundTopLeft ? 10 : 0,
                borderTopRightRadius: model.inBuilder ? 0 : 10,
                borderBottomRightRadius: model.inBuilder ? 0 : 10,
                borderBottomLeftRadius: 10,
            }}
            onFocusCapture={handleFocusCapture}
            onPointerEnter={handlePointerEnter}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            inert={!isPanelVisible && !floatingIslandActive ? true : undefined}
        >
            <ConfigChangeModeFixer />
            {(isDragOver || isReactDndDragOver) && allowAccess && <AIDragOverlay />}
            {showBlockMask && <AIBlockMask />}
            <AIRateLimitStrip />

            <AIPanelHeader onFloatingIsland={onFloatingIsland} />
            <div key="main-content" className="flex-1 flex flex-col min-h-0">
                <AcpChatPanel />
            </div>
        </div>
    );
});

AIPanelComponentInner.displayName = "AIPanelInner";

type AIPanelComponentProps = {
    roundTopLeft: boolean;
    onFloatingIsland?: () => void;
    floatingIslandActive?: boolean;
};

const AIPanelComponent = ({ roundTopLeft, onFloatingIsland, floatingIslandActive }: AIPanelComponentProps) => {
    return (
        <ErrorBoundary>
            <AIPanelComponentInner roundTopLeft={roundTopLeft} onFloatingIsland={onFloatingIsland} floatingIslandActive={floatingIslandActive} />
        </ErrorBoundary>
    );
};

AIPanelComponent.displayName = "AIPanel";

export { AIPanelComponent as AIPanel, AIPanelComponentInner };
