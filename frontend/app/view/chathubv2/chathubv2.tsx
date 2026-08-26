// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { VoiceModel } from "@/app/aipanel/voice-model";
import { createBlock, getApi, refocusNode } from "@/app/store/global";
import { focusAgentWidget, listAgentWidgets, previewAgentWidget } from "@/app/view/agent-widget-bridge";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { useAtomValue } from "jotai";
import { RefreshCw, Settings, Terminal, TriangleAlert } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentSurfaceUiActivityEvent, type LiveAgentSurfaceActivity } from "../../../types/agent-activity";
import {
    isActivityForChatHubSurface,
    projectChatHubActivity,
    rememberChatHubActivityIdentity,
    type ChatHubV2ActivityStatus,
} from "./chathubv2-activity";
import { ChatHubV2ActivityStatusBar } from "./chathubv2-activity-status";
import {
    makeEmbeddedChatUrl,
    makeKronSettingsBlockDef,
    makeKronTermPowerResumeMessage,
    makeKronTermSurfaceActivityMessage,
    makeKronTermThemeMessage,
    readKronTermThemeSnapshot,
} from "./chathubv2-bridge";
import { installComposerGuard, type ComposerGuardOptions } from "./chathubv2-composer";
import type { ChatHubV2ViewModel } from "./chathubv2-model";
import {
    resolveBackendStateFromStartResult,
    resolveBackendStateFromStatus,
    type ChatHubV2State,
} from "./chathubv2-state";

const KronTermWidgetBlocks: Record<string, BlockDef> = {
    terminal: { meta: { view: "term", controller: "shell" } },
    files: { meta: { view: "preview", file: "~" } },
    git: { meta: { view: "preview", file: "." } },
    chat: { meta: { view: "chathubv2" } },
    web: { meta: { view: "web" } },
    browser: { meta: { view: "web" } },
    "browser-tabs": { meta: { view: "web" } },
    "browser-widget": { meta: { view: "web" } },
    sandbox: { meta: { view: "sandbox" } },
    apps: { meta: { view: "installedapps" } },
    diff: { meta: { view: "aifilediff" } },
};

async function getBackendState(): Promise<ChatHubV2State> {
    const status = await getApi().chathubv2Status();
    return resolveBackendStateFromStatus(status);
}

async function startBackend(context?: {
    tabId?: string;
    blockId?: string;
    surfaceId?: string;
}): Promise<ChatHubV2State> {
    const result = await getApi().chathubv2Start(context);
    return resolveBackendStateFromStartResult(result);
}

const RuntimeStatusCopy: Record<ChatHubV2RuntimeHealth["status"], string> = {
    "not-found": "KronosChamber bundle missing",
    starting: "KronosChamber starting",
    ready: "KronosChamber ready",
    error: "KronosChamber needs repair",
    stopped: "KronosChamber stopped",
};

export type ChatHubV2Presentation = "full" | "composer";

export type ChatHubV2ComposerBridge = Pick<ComposerGuardOptions, "onSubmit" | "transformSubmit">;

const RuntimeHealthRow = ({ label, value }: { label: string; value?: string }) => {
    if (!value) {
        return null;
    }
    return (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-[11px] leading-5">
            <div className="text-muted-foreground">{label}</div>
            <div className="min-w-0 truncate font-mono text-foreground/85" title={value}>
                {value}
            </div>
        </div>
    );
};

const RuntimeRepairPanel = ({
    error,
    health,
    onRetry,
}: {
    error: string;
    health?: ChatHubV2RuntimeHealth;
    onRetry: () => void;
}) => {
    const statusLabel = health ? RuntimeStatusCopy[health.status] : "KronosChamber needs repair";
    const checkedAt = health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : null;
    const primaryCandidate = health?.candidateRoots?.[0];

    return (
        <div className="flex h-full w-full items-center justify-center bg-background p-6 text-foreground">
            <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-destructive/30 bg-card shadow-[var(--shadow-panel)]">
                <div className="border-b border-border/60 bg-destructive/5 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                            <TriangleAlert className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">{statusLabel}</div>
                            <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                KronosCode/KronosChamber is the only enabled runtime for this beta. Repair it before
                                continuing.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Runtime Health
                        </div>
                        <RuntimeHealthRow label="Status" value={health?.status ?? "error"} />
                        <RuntimeHealthRow label="Checked" value={checkedAt ?? undefined} />
                        <RuntimeHealthRow label="Bundle" value={health?.detectedRoot ?? primaryCandidate} />
                        <RuntimeHealthRow label="Server" value={health?.serverPath} />
                        <RuntimeHealthRow
                            label="KronosCode"
                            value={health?.kronosCodeBinary ?? "Using runtime defaults"}
                        />
                    </div>

                    <div className="rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <Terminal className="h-3.5 w-3.5" />
                            Failure Evidence
                        </div>
                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                            {error}
                            {health?.logExcerpt?.length ? `\n\n${health.logExcerpt.join("\n")}` : ""}
                        </pre>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onRetry}
                            className="flex h-9 cursor-pointer items-center gap-2 rounded bg-accent/80 px-3 text-sm text-primary transition-colors hover:bg-accent"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Retry runtime
                        </button>
                        <button
                            type="button"
                            onClick={() => void createBlock({ meta: { view: "kronoschamber" } }, false)}
                            className="flex h-9 cursor-pointer items-center gap-2 rounded border border-border/80 bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent/40"
                        >
                            <Settings className="h-4 w-4" />
                            Open runtime settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ComposerRuntimeStatus = ({
    error,
    onRetry,
    status,
}: {
    error?: string;
    onRetry?: () => void;
    status: "error" | "starting";
}) => {
    return (
        <div className="flex h-full w-full items-center justify-center bg-transparent px-4 text-foreground">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div
                    className={
                        status === "error"
                            ? "grid h-8 w-8 place-items-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive"
                            : "grid h-8 w-8 place-items-center rounded-md border border-accent/25 bg-accent/10 text-accent"
                    }
                >
                    {status === "error" ? (
                        <TriangleAlert className="h-4 w-4" />
                    ) : (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="font-semibold text-foreground">
                        {status === "error" ? "KronosChamber is unavailable" : "Connecting to KronosChamber"}
                    </div>
                    {error && <div className="mt-0.5 max-w-80 truncate text-[10px]">{error}</div>}
                </div>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="h-8 cursor-pointer rounded border border-border/80 bg-background px-3 font-semibold text-foreground transition-colors hover:bg-accent/20"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};

type ChatHubV2LoadedFrameProps = {
    blockId: string;
    composerBridge?: ChatHubV2ComposerBridge;
    presentation: ChatHubV2Presentation;
    url: string;
    surfaceId: string;
};

const ChatHubV2LoadedFrame = memo(
    ({ blockId, composerBridge, presentation, surfaceId, url }: ChatHubV2LoadedFrameProps) => {
        const iframeRef = useRef<HTMLIFrameElement>(null);
        const frameUrl = useMemo(() => makeEmbeddedChatUrl(url, surfaceId), [surfaceId, url]);
        const frameOrigin = useMemo(() => new URL(frameUrl).origin, [frameUrl]);
        const [iframeReady, setIframeReady] = useState(false);
        const [activityStatus, setActivityStatus] = useState<ChatHubV2ActivityStatus>();
        const activityIdentityRef = useRef({ runIds: new Set<string>(), sessionIds: new Set<string>() });
        const voiceModel = VoiceModel.getInstance();
        const voiceStatus = useAtomValue(voiceModel.statusAtom);
        const voiceListening = useAtomValue(voiceModel.listeningAtom);
        const voiceTranscript = useAtomValue(voiceModel.transcriptAtom);
        const voiceError = useAtomValue(voiceModel.errorAtom);
        const syncTheme = useCallback(() => {
            if (iframeRef.current?.contentWindow == null) {
                return;
            }
            const themeTarget = document.body ?? document.documentElement;
            const theme = readKronTermThemeSnapshot(window.getComputedStyle(themeTarget));
            iframeRef.current.contentWindow.postMessage(makeKronTermThemeMessage(theme), frameOrigin);
        }, [frameOrigin]);
        const guardComposer = useCallback(() => {
            try {
                const iframe = iframeRef.current;
                const doc = iframe?.contentDocument;
                if (!doc) {
                    return;
                }
                installComposerGuard(doc, {
                    onSubmit: composerBridge?.onSubmit,
                    presentation: presentation === "composer" ? "mini" : "full",
                    transformSubmit: composerBridge?.transformSubmit,
                });
            } catch {
                return;
            }
        }, [composerBridge?.onSubmit, composerBridge?.transformSubmit, presentation]);

        useEffect(() => {
            if (iframeReady) {
                guardComposer();
            }
        }, [guardComposer, iframeReady]);

        useEffect(() => {
            const handleVoiceTranscript = (event: Event) => {
                const customEvent = event as CustomEvent<{ text?: string; mode?: "append" | "submit" }>;
                const text = customEvent.detail?.text?.trim();
                if (!text || !iframeReady || iframeRef.current?.contentWindow == null) {
                    return;
                }
                try {
                    iframeRef.current.contentWindow.postMessage(
                        {
                            type: "kronterm:voice-transcript",
                            text,
                            mode: customEvent.detail?.mode ?? "submit",
                        },
                        frameOrigin
                    );
                } catch {
                    return;
                }
            };

            window.addEventListener("kronterm:voice-transcript", handleVoiceTranscript);
            return () => window.removeEventListener("kronterm:voice-transcript", handleVoiceTranscript);
        }, [frameOrigin, iframeReady]);

        useEffect(() => {
            const handleSurfaceActivity = (event: Event) => {
                const activity = (event as CustomEvent<LiveAgentSurfaceActivity>).detail;
                if (!activity) {
                    return;
                }
                const identity = activityIdentityRef.current;
                if (
                    isActivityForChatHubSurface(activity, {
                        blockId,
                        runIds: identity.runIds,
                        sessionIds: identity.sessionIds,
                        surfaceId,
                    })
                ) {
                    rememberChatHubActivityIdentity(activity, identity);
                    setActivityStatus(projectChatHubActivity(activity));
                    if (iframeReady && iframeRef.current?.contentWindow != null) {
                        iframeRef.current.contentWindow.postMessage(
                            makeKronTermSurfaceActivityMessage(activity),
                            frameOrigin
                        );
                    }
                }
            };

            window.addEventListener(AgentSurfaceUiActivityEvent, handleSurfaceActivity);
            return () => window.removeEventListener(AgentSurfaceUiActivityEvent, handleSurfaceActivity);
        }, [blockId, frameOrigin, iframeReady, surfaceId]);

        useEffect(() => {
            if (!activityStatus?.dismissAfterMs) {
                return;
            }
            const activityTimestamp = activityStatus.activity.timestamp;
            const timeout = window.setTimeout(() => {
                setActivityStatus((current) =>
                    current?.activity.timestamp === activityTimestamp ? undefined : current
                );
            }, activityStatus.dismissAfterMs);
            return () => window.clearTimeout(timeout);
        }, [activityStatus]);

        useEffect(() => {
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== iframeRef.current?.contentWindow || event.origin !== frameOrigin) {
                    return;
                }
                const data = event.data;
                if (data?.type === "kronterm:bridge-ready") {
                    syncTheme();
                    return;
                }
                if (data?.type === "kronterm:list-widgets") {
                    iframeRef.current?.contentWindow?.postMessage(
                        {
                            type: "kronterm:widgets",
                            requestId: typeof data.requestId === "string" ? data.requestId : "",
                            widgets: listAgentWidgets(blockId),
                        },
                        frameOrigin
                    );
                    return;
                }
                if (data?.type === "kronterm:preview-widget") {
                    const requestId = typeof data.requestId === "string" ? data.requestId : "";
                    const targetBlockId = typeof data.blockId === "string" ? data.blockId.trim() : "";
                    void previewAgentWidget(targetBlockId).then(
                        (previewImageUrl) =>
                            iframeRef.current?.contentWindow?.postMessage(
                                { type: "kronterm:widget-preview", requestId, blockId: targetBlockId, previewImageUrl },
                                frameOrigin
                            ),
                        (failure) =>
                            iframeRef.current?.contentWindow?.postMessage(
                                {
                                    type: "kronterm:widget-preview",
                                    requestId,
                                    blockId: targetBlockId,
                                    error: failure instanceof Error ? failure.message : "preview-unavailable",
                                },
                                frameOrigin
                            )
                    );
                    return;
                }
                if (data?.type === "kronterm:focus-widget") {
                    const targetBlockId = typeof data.blockId === "string" ? data.blockId.trim() : "";
                    focusAgentWidget(targetBlockId);
                    return;
                }
                if (data?.type === "kronterm:open-widget") {
                    const widget = String(data.widget ?? "");
                    const existingBlockId =
                        typeof data.blockId === "string" && data.blockId.trim() ? data.blockId.trim() : "";
                    if (existingBlockId) {
                        refocusNode(existingBlockId);
                        return;
                    }
                    if (widget === "settings") {
                        void createBlock(
                            makeKronSettingsBlockDef(data.settingsSection),
                            false,
                            data.ephemeral === true
                        );
                        return;
                    }
                    if (widget === "appstream") {
                        const appId = typeof data.appId === "string" && data.appId.trim() ? data.appId.trim() : "";
                        const appName =
                            typeof data.appName === "string" && data.appName.trim() ? data.appName.trim() : appId;
                        if (appId) {
                            void createBlock(
                                {
                                    meta: {
                                        view: "appstream",
                                        "appstream:appid": appId,
                                        "appstream:appname": appName,
                                    } as unknown as MetaType,
                                },
                                false,
                                data.ephemeral === true
                            );
                        }
                        return;
                    }
                    const blockDef = KronTermWidgetBlocks[widget];
                    if (blockDef != null) {
                        const url = typeof data.url === "string" && data.url.trim() ? data.url.trim() : "";
                        const nextBlockDef =
                            url && blockDef.meta?.view === "web"
                                ? ({ ...blockDef, meta: { ...blockDef.meta, url } } as BlockDef)
                                : blockDef;
                        void createBlock(nextBlockDef, false, data.ephemeral === true);
                    }
                    return;
                }
                if (!data || data.type !== "kronterm:voice-command") {
                    return;
                }
                if (data.action === "start") {
                    void voiceModel.startListening();
                    return;
                }
                if (data.action === "stop") {
                    if (voiceListening) {
                        void voiceModel.toggleListening();
                    }
                    return;
                }
                if (data.action === "toggle") {
                    void voiceModel.toggleListening();
                }
            };

            window.addEventListener("message", handleMessage);
            return () => window.removeEventListener("message", handleMessage);
        }, [blockId, frameOrigin, syncTheme, voiceListening, voiceModel]);

        useEffect(() => {
            if (!iframeReady) {
                return;
            }
            syncTheme();
            const observer = new MutationObserver(syncTheme);
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["class", "style"],
            });
            if (document.body) {
                observer.observe(document.body, {
                    attributes: true,
                    attributeFilter: ["class", "style"],
                });
            }
            return () => observer.disconnect();
        }, [iframeReady, syncTheme]);

        useEffect(() => {
            if (!iframeReady || iframeRef.current?.contentWindow == null) {
                return;
            }
            try {
                iframeRef.current.contentWindow.postMessage(
                    {
                        type: "kronterm:voice-state",
                        status: voiceStatus,
                        listening: voiceListening,
                        transcript: voiceTranscript,
                        error: voiceError,
                    },
                    frameOrigin
                );
            } catch {
                return;
            }
        }, [frameOrigin, iframeReady, voiceError, voiceListening, voiceStatus, voiceTranscript]);

        useEffect(() => {
            return getApi().onKronosCodePowerResume(() => {
                iframeRef.current?.contentWindow?.postMessage(makeKronTermPowerResumeMessage(), frameOrigin);
            });
        }, [frameOrigin]);

        return (
            <div
                className={`relative flex h-full w-full flex-col overflow-hidden ${
                    presentation === "composer" ? "bg-transparent" : "bg-background"
                }`}
                data-chathubv2-block={blockId}
                data-chathubv2-presentation={presentation}
            >
                {presentation === "full" && activityStatus && (
                    <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-3">
                        <ChatHubV2ActivityStatusBar status={activityStatus} onOpenEvidence={refocusNode} />
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    title="ChatHub V2"
                    name="chathubv2"
                    src={frameUrl}
                    onLoad={() => {
                        setIframeReady(true);
                        guardComposer();
                        let attempts = 0;
                        const interval = window.setInterval(() => {
                            attempts += 1;
                            guardComposer();
                            if (attempts >= 24) {
                                window.clearInterval(interval);
                            }
                        }, 250);
                    }}
                    className={`min-h-0 flex-1 border-0 ${
                        presentation === "composer" ? "bg-transparent" : "bg-background"
                    }`}
                    allow="clipboard-read; clipboard-write; fullscreen; microphone"
                />
            </div>
        );
    }
);

ChatHubV2LoadedFrame.displayName = "ChatHubV2LoadedFrame";

type ChatHubV2FrameProps = {
    blockId?: string;
    composerBridge?: ChatHubV2ComposerBridge;
    presentation?: ChatHubV2Presentation;
    surfaceBlockId?: string;
    tabId?: string;
};

export const ChatHubV2Frame = memo(
    ({ blockId = "panel", composerBridge, presentation = "full", surfaceBlockId, tabId }: ChatHubV2FrameProps) => {
        const [state, setState] = useState<ChatHubV2State>({ status: "idle" });
        const surfaceId = useMemo(
            () => `kronterm:${tabId ?? "global"}:${surfaceBlockId ?? blockId}`,
            [blockId, surfaceBlockId, tabId]
        );

        const load = useCallback(
            (ignoreResult?: () => boolean) => {
                setState((current) => ({ status: "starting", url: current.url }));
                void startBackend({ tabId, blockId: surfaceBlockId, surfaceId }).then(
                    (nextState) => {
                        if (!ignoreResult?.()) {
                            setState(nextState);
                        }
                    },
                    (err) => {
                        if (!ignoreResult?.()) {
                            setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
                        }
                    }
                );
            },
            [surfaceBlockId, surfaceId, tabId]
        );

        useEffect(() => {
            let cancelled = false;
            load(() => cancelled);
            return () => {
                cancelled = true;
            };
        }, [load]);

        useEffect(() => {
            return getApi().onKronosCodeConnectionApplied(() => load());
        }, [load]);

        useEffect(() => {
            return getApi().onKronosCodePowerResume(() => {
                void getApi()
                    .kronoscodeRevalidateConnection()
                    .then(() => getBackendState())
                    .then((nextState) => {
                        if (nextState.status !== "ready") {
                            load();
                        }
                    })
                    .catch(() => load());
            });
        }, [load]);

        useEffect(() => {
            if (state.status !== "starting") {
                return;
            }
            const interval = window.setInterval(() => {
                void getBackendState().then((nextState) => {
                    if (nextState.status === "ready") {
                        setState(nextState);
                    }
                });
            }, 1_000);
            return () => window.clearInterval(interval);
        }, [state.status]);

        useEffect(() => {
            if (state.status !== "ready") {
                return;
            }
            const interval = window.setInterval(() => {
                void getBackendState().then((nextState) => {
                    if (nextState.status !== "ready") {
                        load();
                    }
                });
            }, 5_000);
            return () => window.clearInterval(interval);
        }, [load, state.status]);

        if (state.status === "error") {
            if (presentation === "composer") {
                return <ComposerRuntimeStatus error={state.error} status="error" onRetry={() => load()} />;
            }
            return <RuntimeRepairPanel error={state.error} health={state.health} onRetry={() => load()} />;
        }

        if (state.status === "ready") {
            return (
                <ChatHubV2LoadedFrame
                    blockId={blockId}
                    composerBridge={composerBridge}
                    presentation={presentation}
                    surfaceId={surfaceId}
                    url={state.url}
                />
            );
        }

        if (state.status === "starting" && state.url) {
            return (
                <div
                    className={`relative h-full w-full overflow-hidden ${
                        presentation === "composer" ? "bg-transparent" : "bg-background"
                    }`}
                    data-chathubv2-block={blockId}
                >
                    <ChatHubV2LoadedFrame
                        blockId={blockId}
                        composerBridge={composerBridge}
                        presentation={presentation}
                        surfaceId={surfaceId}
                        url={state.url}
                    />
                    {presentation === "full" && (
                        <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-border/70 bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur">
                            Connecting KronosCode…
                        </div>
                    )}
                    {presentation === "composer" && (
                        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#080a0d]/88 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground backdrop-blur-sm">
                            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin text-accent" />
                            Connecting KronosChamber
                        </div>
                    )}
                </div>
            );
        }

        if (presentation === "composer") {
            return <ComposerRuntimeStatus status="starting" />;
        }

        return (
            <div className="relative h-full w-full overflow-hidden bg-background" data-chathubv2-block={blockId}>
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-sm text-muted-foreground">
                    Starting KronosChamber...
                </div>
            </div>
        );
    }
);

ChatHubV2Frame.displayName = "ChatHubV2Frame";

export const ChatHubV2View = memo(({ model }: ViewComponentProps<ChatHubV2ViewModel>) => {
    useEffect(() => {
        const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
        if (workspaceLayoutModel.getAIPanelVisible()) {
            workspaceLayoutModel.setAIPanelVisible(false, { nofocus: true });
        }
    }, []);

    return <ChatHubV2Frame blockId={model.blockId} tabId={model.tabModel.tabId} surfaceBlockId={model.blockId} />;
});

ChatHubV2View.displayName = "ChatHubV2View";
