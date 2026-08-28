// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { CenteredDiv } from "@/app/element/quickelems";
import { ModalsRenderer } from "@/app/modals/modalsrenderer";
import { globalStore } from "@/app/store/jotaiStore";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { TabBar } from "@/app/tab/tabbar";
import { TabContent } from "@/app/tab/tabcontent";
import { buildCanvasContextPrompt } from "@/app/tab/workspace-canvas-agent";
import {
    publishWorkspaceCanvasComposerSubmit,
    workspaceCanvasComposerContextAtom,
} from "@/app/tab/workspace-canvas-context";
import { isWorkspacePresentation, type WorkspacePresentation } from "@/app/tab/workspace-presentation";
import { ComputerUseStreamManager } from "@/app/view/appstream/computer-use-stream-manager";
import { HermesHudHost, HermesPanelHost } from "@/app/view/hermes/hermes-hud-host";
import { consumeHermesHudAutoOpen } from "@/app/view/hermes/hermes-startup";
import { hermesSurfaceController } from "@/app/view/hermes/hermes-surface-controller";
import { KronarchyShell } from "@/app/workspace/kronarchy-shell";
import { Widgets } from "@/app/workspace/widgets";
import { clampHermesPanelWidth, getHermesPanelWidthBounds } from "@/app/workspace/workspace-hermes-panel";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";

import { WorkspaceWallpaper } from "@/app/workspace/workspace-wallpaper";
import { atoms, createBlock, getApi, refocusNode } from "@/store/global";
import { isMacOS } from "@/util/platformutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const LayoutModeChangedEvent = "kronterm:layoutmode-changed";
const LayoutModeStorageKey = "kronterm:layoutmode";

function readWorkspacePresentation(): WorkspacePresentation {
    const live = (window as any).__krontermLayoutMode;
    if (isWorkspacePresentation(live)) {
        return live;
    }
    try {
        const stored = window.localStorage.getItem(LayoutModeStorageKey);
        return isWorkspacePresentation(stored) ? stored : "widgets";
    } catch {
        return "widgets";
    }
}

const BottomQuickComposer = memo(({ onOpenDock }: { onOpenDock: () => void }) => {
    const model = WaveAIModel.getInstance();
    const isStreaming = useAtomValue(model.isAIStreaming);
    const currentMode = useAtomValue(model.currentAIMode);
    const [value, setValue] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const disabled = submitting || isStreaming;

    const submit = async () => {
        const text = value.trim();
        if (!text || disabled) {
            return;
        }
        setSubmitting(true);
        try {
            onOpenDock();
            setValue("");
            await model.sendMessage(text);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="pointer-events-none fixed bottom-14 left-1/2 z-[110] w-[min(760px,calc(100vw-360px))] min-w-[420px] -translate-x-1/2">
            <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#0b0f16e8] p-2 shadow-2xl shadow-black/45 backdrop-blur-2xl">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onOpenDock}
                        className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/75 hover:bg-white/[0.08] hover:text-white cursor-pointer"
                    >
                        <i className="fa-solid fa-comments text-accent" />
                        KronosCode
                    </button>
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void submit();
                            }
                        }}
                        rows={1}
                        placeholder="Ask KronosCode to edit, inspect, run, or explain..."
                        className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-accent/50"
                    />
                    <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-white/45 md:flex">
                        <span>{currentMode || "default"}</span>
                    </div>
                    <button
                        type="button"
                        disabled={!value.trim() || disabled}
                        onClick={() => void submit()}
                        className={cn(
                            "flex h-9 w-10 items-center justify-center rounded-xl border cursor-pointer",
                            !value.trim() || disabled
                                ? "border-white/10 bg-white/[0.035] text-white/25 opacity-60"
                                : "border-accent/40 bg-accent/20 text-accent hover:bg-accent/30"
                        )}
                        title={isStreaming ? "KronosCode is running" : "Send"}
                    >
                        <i className={cn("fa-solid", submitting ? "fa-spinner fa-spin" : "fa-arrow-up")} />
                    </button>
                </div>
            </div>
        </div>
    );
});
BottomQuickComposer.displayName = "BottomQuickComposer";

export const KronosChamberCanvasComposer = memo(
    ({ onOpenKronosChamber }: { onOpenKronosChamber: () => Promise<void> }) => {
        const model = WaveAIModel.getInstance();
        const isStreaming = useAtomValue(model.isAIStreaming);
        const currentMode = useAtomValue(model.currentAIMode);
        const canvasContext = useAtomValue(workspaceCanvasComposerContextAtom);
        const [opening, setOpening] = useState(false);
        const [value, setValue] = useState("");
        const [submitting, setSubmitting] = useState(false);
        const currentNode = canvasContext.nodes[canvasContext.nodes.length - 1];
        const reasoningSteps = currentNode?.reasoningsteps ?? [];
        const outputNodes = canvasContext.nodes.filter(
            (node) => node.blockid || node.previewimageurl || node.verificationstatus
        );
        const composerStyle = canvasContext.viewport
            ? {
                  left: canvasContext.viewport.left + canvasContext.viewport.width / 2,
                  width: Math.max(280, Math.min(620, canvasContext.viewport.width - 360)),
              }
            : undefined;
        const transformSubmit = useCallback(
            (value: string) => buildCanvasContextPrompt(value, canvasContext.mode, canvasContext.nodes),
            [canvasContext.mode, canvasContext.nodes]
        );
        const onSubmit = useCallback(
            (prompt: string) => {
                publishWorkspaceCanvasComposerSubmit({
                    contextids: canvasContext.nodes.map((node) => node.id),
                    mode: canvasContext.mode,
                    prompt,
                    tabid: canvasContext.tabid,
                });
            },
            [canvasContext.mode, canvasContext.nodes, canvasContext.tabid]
        );
        const submitCanvasPrompt = useCallback(async () => {
            const rawPrompt = value.trim();
            if (!rawPrompt || submitting || isStreaming) {
                return;
            }
            const prompt = transformSubmit(rawPrompt);
            setSubmitting(true);
            setValue("");
            onSubmit(prompt);
            try {
                await model.sendMessage(prompt);
            } catch (e) {
                console.error("failed to send Kronos canvas prompt", e);
                setValue(rawPrompt);
            } finally {
                setSubmitting(false);
            }
        }, [isStreaming, model, onSubmit, submitting, transformSubmit, value]);
        const openKronosChamber = useCallback(async () => {
            if (opening) {
                return;
            }
            setOpening(true);
            try {
                await onOpenKronosChamber();
            } catch (e) {
                console.error("failed to open KronosChamber from the canvas composer", e);
            } finally {
                setOpening(false);
            }
        }, [onOpenKronosChamber, opening]);

        return (
            <section
                aria-label="KronosChamber canvas chat"
                className={cn(
                    "pointer-events-none fixed bottom-[82px] z-[110] -translate-x-1/2",
                    composerStyle == null && "left-1/2 w-[min(620px,calc(100vw-360px))]"
                )}
                style={composerStyle}
            >
                <div className="pointer-events-auto overflow-hidden rounded-xl border border-accent/30 bg-[#080a0df2] shadow-[0_24px_80px_rgba(0,0,0,0.62),0_0_0_1px_rgba(255,255,255,0.025)] backdrop-blur-2xl">
                    <header className="flex min-h-11 items-center gap-3 border-b border-white/10 px-3 py-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
                                <i className="fa-solid fa-comments" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <strong className="block truncate text-xs font-semibold text-white/90">
                                    Kronos canvas chat
                                </strong>
                                <small className="block truncate text-[10px] capitalize text-white/45">
                                    {canvasContext.nodes.length > 0
                                        ? `${canvasContext.mode} · ${canvasContext.nodes.length} selected`
                                        : "Ready for canvas context"}
                                </small>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => void openKronosChamber()}
                            disabled={opening}
                            className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 text-[11px] font-semibold text-white/75 transition-colors hover:border-accent/35 hover:bg-accent/10 hover:text-white disabled:opacity-60"
                            aria-label="Open the full KronosChamber chat widget"
                        >
                            <i
                                className={cn(
                                    "fa-solid",
                                    opening ? "fa-spinner fa-spin" : "fa-up-right-and-down-left-from-center"
                                )}
                                aria-hidden="true"
                            />
                            {opening ? "Opening" : "Open KronosChamber"}
                        </button>
                    </header>

                    {currentNode ? (
                        <div className="max-h-48 overflow-y-auto border-b border-white/10 px-3 py-3">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <strong className="text-xs font-semibold text-white/90">
                                            {currentNode.title}
                                        </strong>
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/45">
                                            {currentNode.phase.replace("-", " ")}
                                        </span>
                                        {currentNode.verificationstatus ? (
                                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300/80">
                                                {currentNode.verificationstatus.replace("-", " ")}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-1.5 text-xs leading-5 text-white/70">{currentNode.detail}</p>

                                    {reasoningSteps.length > 0 ? (
                                        <details className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-white/55">
                                            <summary className="cursor-pointer select-none font-semibold text-white/65">
                                                Reasoning summary · {reasoningSteps.length} step
                                                {reasoningSteps.length === 1 ? "" : "s"}
                                            </summary>
                                            <ol className="mt-2 list-decimal space-y-1 pl-4 leading-4">
                                                {reasoningSteps.map((step, index) => (
                                                    <li key={`${currentNode.id}-reasoning-${index}`}>{step}</li>
                                                ))}
                                            </ol>
                                        </details>
                                    ) : null}

                                    {outputNodes.length > 0 ? (
                                        <ul
                                            className="mt-2 flex flex-wrap gap-1.5"
                                            aria-label="Selected canvas outputs"
                                        >
                                            {outputNodes.map((node) => (
                                                <li
                                                    key={node.id}
                                                    className="flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/60"
                                                >
                                                    <i
                                                        className={cn(
                                                            "fa-solid shrink-0 text-accent/75",
                                                            node.previewimageurl
                                                                ? "fa-image"
                                                                : node.blockid
                                                                  ? "fa-window-maximize"
                                                                  : "fa-circle-check"
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="truncate">
                                                        {node.title}
                                                        {node.previewimageurl
                                                            ? " preview"
                                                            : node.blockid
                                                              ? " widget"
                                                              : ` ${node.verificationstatus?.replace("-", " ")}`}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <form
                        className="bg-[#080a0d] p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitCanvasPrompt();
                        }}
                    >
                        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5 shadow-inner shadow-black/20 focus-within:border-accent/35">
                            <textarea
                                value={value}
                                onChange={(event) => setValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void submitCanvasPrompt();
                                    }
                                }}
                                rows={2}
                                placeholder="Ask Kronos or continue this task…"
                                className="max-h-28 min-h-12 w-full resize-none bg-transparent text-xs leading-5 text-white/85 outline-none placeholder:text-white/30"
                                aria-label="Ask Kronos about the selected canvas context"
                            />
                            <div className="mt-1 flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
                                <button
                                    type="button"
                                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                                    title="Attach task context"
                                    aria-label="Attach task context"
                                >
                                    <i className="fa-solid fa-paperclip" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                                    title="Use browser context"
                                    aria-label="Use browser context"
                                >
                                    <i className="fa-solid fa-globe" aria-hidden="true" />
                                </button>
                                <span className="ml-auto max-w-40 truncate rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-white/45">
                                    {currentMode || "Kronos"}
                                </span>
                                <button
                                    type="submit"
                                    disabled={!value.trim() || submitting || isStreaming}
                                    className={cn(
                                        "grid h-8 w-8 cursor-pointer place-items-center rounded-lg border transition-colors",
                                        !value.trim() || submitting || isStreaming
                                            ? "border-white/10 bg-white/[0.035] text-white/25 opacity-60"
                                            : "border-accent/40 bg-accent/20 text-accent hover:bg-accent/30"
                                    )}
                                    title={isStreaming ? "Kronos is working" : "Send to Kronos"}
                                    aria-label={isStreaming ? "Kronos is working" : "Send to Kronos"}
                                >
                                    <i
                                        className={cn(
                                            "fa-solid",
                                            submitting || isStreaming ? "fa-spinner fa-spin" : "fa-arrow-up"
                                        )}
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </section>
        );
    }
);
KronosChamberCanvasComposer.displayName = "KronosChamberCanvasComposer";

const WorkspaceElem = memo(() => {
    const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
    const tabId = useAtomValue(atoms.staticTabId);
    const ws = useAtomValue(atoms.workspace);
    const canvasComposerContext = useAtomValue(workspaceCanvasComposerContextAtom);
    const widgetsPanelVisible = useAtomValue(workspaceLayoutModel.widgetsPanelVisibleAtom);
    const surface = useSyncExternalStore(
        hermesSurfaceController.subscribe,
        hermesSurfaceController.getSnapshot,
        hermesSurfaceController.getSnapshot
    );
    const [autoOpenHud] = useState(consumeHermesHudAutoOpen);
    const [presentation, setPresentation] = useState(readWorkspacePresentation);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const panelBounds = useMemo(
        () => getHermesPanelWidthBounds(presentation, viewportWidth),
        [presentation, viewportWidth]
    );
    const [panelWidth, setPanelWidth] = useState(() => {
        const initialPresentation = readWorkspacePresentation();
        const initialBounds = getHermesPanelWidthBounds(initialPresentation, window.innerWidth);
        const persisted = Number(ws?.meta?.["layout:hermespanelwidth"]);
        return clampHermesPanelWidth(
            Number.isFinite(persisted) ? persisted : initialBounds.defaultWidth,
            initialBounds
        );
    });
    const panelWidthRef = useRef(panelWidth);
    panelWidthRef.current = panelWidth;

    useEffect(() => {
        const handleLayoutModeChanged = (event: Event) => {
            const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
            if (isWorkspacePresentation(mode)) {
                setPresentation(mode);
            }
        };
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener(LayoutModeChangedEvent, handleLayoutModeChanged);
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener(LayoutModeChangedEvent, handleLayoutModeChanged);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        setPanelWidth((width) => clampHermesPanelWidth(width, panelBounds));
    }, [panelBounds]);

    const expandHermes = useCallback(async () => {
        if (!tabId) {
            throw new Error("A workspace tab is required to expand Kronos.");
        }
        const tab = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)));
        const existingBlockId = tab?.blockids?.find((blockId) => {
            const block = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)));
            return block?.meta?.view === "hermes";
        });
        if (existingBlockId) {
            refocusNode(existingBlockId);
            return;
        }
        await createBlock({ meta: { view: "hermes" } }, false);
    }, [tabId]);

    useEffect(() => {
        if (!widgetsPanelVisible) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                workspaceLayoutModel.setWidgetsPanelVisible(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [widgetsPanelVisible, workspaceLayoutModel]);

    useEffect(() => getApi().onDesktopPetResume(() => hermesSurfaceController.requestOpenPanel()), []);

    return (
        <div className="flex flex-col w-full flex-grow overflow-hidden">
            <KronarchyShell workspace={ws} activeTabId={tabId} />
            {!isMacOS() && <TabBar key={ws.oid} workspace={ws} noTabs />}
            <div
                className="workspace-surface-row workspace-reference-shell flex flex-row flex-grow overflow-hidden"
                data-workspace-presentation={presentation}
            >
                <WorkspaceWallpaper />
                <ComputerUseStreamManager />
                {surface.presentation === "panel" && (
                    <div className="workspace-hermes-dock" style={{ width: panelWidth }}>
                        <HermesPanelHost tabId={tabId} />
                        <div
                            className="workspace-hermes-dock-resizer"
                            role="separator"
                            aria-label="Resize Kronos side panel"
                            aria-orientation="vertical"
                            aria-valuemin={panelBounds.min}
                            aria-valuemax={panelBounds.max}
                            aria-valuenow={panelWidth}
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                                    return;
                                }
                                event.preventDefault();
                                setPanelWidth((width) =>
                                    clampHermesPanelWidth(width + (event.key === "ArrowRight" ? 12 : -12), panelBounds)
                                );
                            }}
                            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                            onPointerMove={(event) => {
                                if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                                    return;
                                }
                                const dock = event.currentTarget.parentElement?.getBoundingClientRect();
                                if (dock) {
                                    setPanelWidth(clampHermesPanelWidth(event.clientX - dock.left, panelBounds));
                                }
                            }}
                            onPointerUp={(event) => {
                                event.currentTarget.releasePointerCapture(event.pointerId);
                                void RpcApi.SetMetaCommand(TabRpcClient, {
                                    oref: WOS.makeORef("workspace", ws.oid),
                                    meta: {
                                        "layout:hermespanelwidth": panelWidthRef.current,
                                    } as unknown as MetaType,
                                });
                            }}
                        />
                    </div>
                )}
                <main className="workspace-reference-content">
                    <ErrorBoundary key={tabId}>
                        <div className="workspace-widget-surface">
                            <div className="workspace-widget-surface-content">
                                {tabId === "" ? (
                                    <CenteredDiv>No Active Tab</CenteredDiv>
                                ) : (
                                    <div className="relative flex h-full flex-row">
                                        <TabContent key={tabId} tabId={tabId} noTopPadding={isMacOS()} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <ModalsRenderer />
                    </ErrorBoundary>
                </main>
                {widgetsPanelVisible && (
                    <div className="workspace-reference-widget-catalog">
                        <Widgets
                            position="left"
                            catalog
                            onDismiss={() => workspaceLayoutModel.setWidgetsPanelVisible(false)}
                        />
                    </div>
                )}
            </div>
            <HermesHudHost
                autoOpen={autoOpenHud || canvasComposerContext.active}
                canvasContext={canvasComposerContext}
                onExpand={expandHermes}
                tabId={tabId}
            />
        </div>
    );
});

WorkspaceElem.displayName = "WorkspaceElem";

export { WorkspaceElem as Workspace };
