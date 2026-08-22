// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AgentRunStrip } from "@/app/aipanel/agent-run-strip";
import { AIPanel } from "@/app/aipanel/aipanel";
import { FloatingIsland, loadFloatingIslandState, saveFloatingIslandState } from "@/app/aipanel/floating-island";
import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { CenteredDiv } from "@/app/element/quickelems";
import { ModalsRenderer } from "@/app/modals/modalsrenderer";
import { TabBar } from "@/app/tab/tabbar";
import { TabContent } from "@/app/tab/tabcontent";
import { VTabBar } from "@/app/tab/vtabbar";
import { buildCanvasContextPrompt } from "@/app/tab/workspace-canvas-agent";
import {
    publishWorkspaceCanvasComposerSubmit,
    workspaceCanvasComposerContextAtom,
} from "@/app/tab/workspace-canvas-context";
import { ComputerUseStreamManager } from "@/app/view/appstream/computer-use-stream-manager";
import { KronarchyShell } from "@/app/workspace/kronarchy-shell";
import { Widgets } from "@/app/workspace/widgets";
import { getWorkspaceTabPresentation, WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { atoms, createBlock, getApi, getSettingsKeyAtom } from "@/store/global";
import { isMacOS } from "@/util/platformutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
    ImperativePanelGroupHandle,
    ImperativePanelHandle,
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";

const KronosPetImageUrl = new URL(
    "../../../assets/pet/sprite-sheets/iterations/expressive-status/frames/frame-1.png",
    import.meta.url
).href;

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
                                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-accent/25 bg-black/35 shadow-[0_0_22px_rgba(237,180,73,0.1)]">
                                    <img
                                        src={KronosPetImageUrl}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-12 w-12 object-contain [image-rendering:pixelated]"
                                    />
                                </div>
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
    const quickComposerEnabled = useAtomValue(getSettingsKeyAtom("app:quickcomposer" as keyof SettingsType)) ?? false;
    const canvasComposerContext = useAtomValue(workspaceCanvasComposerContextAtom);
    const sidePanelMode = useAtomValue(workspaceLayoutModel.sidePanelModeAtom);
    const aiPanelVisible = useAtomValue(workspaceLayoutModel.panelVisibleAtom);
    const vtabVisible = useAtomValue(workspaceLayoutModel.vtabVisibleAtom);
    const widgetsPanelVisible = useAtomValue(workspaceLayoutModel.widgetsPanelVisibleAtom);
    const windowWidth = window.innerWidth;
    const { showLeftTabBar, showTopWorkspaceTabs } = getWorkspaceTabPresentation(sidePanelMode);
    const vtabInitialPct = workspaceLayoutModel.getVTabInitialPercentage(windowWidth, showLeftTabBar);
    const innerContentInitialPct = workspaceLayoutModel.getInnerContentInitialPercentage(windowWidth, showLeftTabBar);
    const innerAIPanelInitialPct = workspaceLayoutModel.getInnerAIPanelInitialPercentage(windowWidth, showLeftTabBar);
    const outerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const innerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const aiPanelRef = useRef<ImperativePanelHandle>(null);
    const vtabPanelRef = useRef<ImperativePanelHandle>(null);
    const panelContainerRef = useRef<HTMLDivElement>(null);
    const aiPanelWrapperRef = useRef<HTMLDivElement>(null);
    const [floatingIslandVisible, setFloatingIslandVisible] = useState(() => loadFloatingIslandState().enabled);
    const [hiddenCanvasComposerTabId, setHiddenCanvasComposerTabId] = useState<string | null>(null);

    useEffect(() => {
        setHiddenCanvasComposerTabId(null);
    }, [tabId]);

    useEffect(() => {
        if (!canvasComposerContext.active) {
            setHiddenCanvasComposerTabId(null);
        }
    }, [canvasComposerContext.active]);

    const openCanvasKronosChamber = useCallback(async () => {
        const sourceTabId = canvasComposerContext.tabid;
        if (!sourceTabId) {
            return;
        }
        await createBlock({ meta: { view: "chathubv2" } }, false);
        setHiddenCanvasComposerTabId(sourceTabId);
    }, [canvasComposerContext.tabid]);

    const handleOpenFloatingIsland = () => {
        workspaceLayoutModel.setAIPanelVisible(false);
        setFloatingIslandVisible(true);
        saveFloatingIslandState({ enabled: true, mode: "expanded" });
    };

    const handleCloseFloatingIsland = () => {
        setFloatingIslandVisible(false);
        saveFloatingIslandState({ enabled: false, mode: "collapsed" });
    };

    const handleReturnToPanel = () => {
        setFloatingIslandVisible(false);
        saveFloatingIslandState({ enabled: false, mode: "collapsed" });
        workspaceLayoutModel.setAIPanelVisible(true);
    };

    // showLeftTabBar is passed as a seed value only; subsequent changes are handled by setShowLeftTabBar below.
    // Do NOT add showLeftTabBar as a dep here — re-registering refs on config changes would redundantly re-run commitLayouts.
    useEffect(() => {
        const outerGroup = outerPanelGroupRef.current;
        if (
            aiPanelRef.current &&
            outerGroup &&
            innerPanelGroupRef.current &&
            panelContainerRef.current &&
            aiPanelWrapperRef.current
        ) {
            workspaceLayoutModel.registerRefs(
                aiPanelRef.current,
                outerPanelGroupRef.current,
                innerPanelGroupRef.current,
                panelContainerRef.current,
                aiPanelWrapperRef.current,
                vtabPanelRef.current ?? undefined,
                showLeftTabBar
            );
        }
        return () => {
            if (outerGroup) {
                workspaceLayoutModel.unregisterRefs(outerGroup);
            }
        };
    }, []);

    useEffect(() => {
        const isVisible = workspaceLayoutModel.getAIPanelVisible();
        getApi().setWaveAIOpen(isVisible);
    }, []);

    useEffect(() => {
        workspaceLayoutModel.setShowLeftTabBar(showLeftTabBar);
    }, [showLeftTabBar]);

    useEffect(() => {
        window.addEventListener("resize", workspaceLayoutModel.handleWindowResize);
        return () => window.removeEventListener("resize", workspaceLayoutModel.handleWindowResize);
    }, []);

    useEffect(() => {
        const handleFocus = () => workspaceLayoutModel.syncVTabWidthFromMeta();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, []);

    useEffect(() => {
        return getApi().onDesktopPetResume(() => workspaceLayoutModel.setAIPanelVisible(true));
    }, []);

    const innerHandleVisible = aiPanelVisible;
    const innerHandleClass = `workspace-panel-resize-handle ${innerHandleVisible ? "is-visible" : "pointer-events-none"}`;
    const outerHandleVisible = vtabVisible && sidePanelMode === "full";
    const outerHandleClass = `workspace-panel-resize-handle ${outerHandleVisible ? "is-visible" : "pointer-events-none"}`;

    return (
        <div className="flex flex-col w-full flex-grow overflow-hidden">
            <KronarchyShell workspace={ws} activeTabId={tabId} />
            {!isMacOS() && <TabBar key={ws.oid} workspace={ws} noTabs={!showTopWorkspaceTabs} />}
            <div ref={panelContainerRef} className="flex flex-row flex-grow overflow-hidden">
                <ComputerUseStreamManager />
                <ErrorBoundary key={tabId}>
                    <PanelGroup
                        direction="horizontal"
                        onLayout={workspaceLayoutModel.handleOuterPanelLayout}
                        ref={outerPanelGroupRef}
                    >
                        <Panel
                            ref={vtabPanelRef}
                            collapsible
                            defaultSize={vtabInitialPct}
                            order={0}
                            className="overflow-hidden"
                        >
                            {showLeftTabBar && <VTabBar workspace={ws} />}
                        </Panel>
                        <PanelResizeHandle className={outerHandleClass} />
                        <Panel order={1} defaultSize={100 - vtabInitialPct} className="overflow-hidden">
                            <PanelGroup
                                direction="horizontal"
                                onLayout={workspaceLayoutModel.handleInnerPanelLayout}
                                ref={innerPanelGroupRef}
                            >
                                <Panel order={0} defaultSize={innerContentInitialPct} className="overflow-hidden">
                                    {tabId === "" ? (
                                        <CenteredDiv>No Active Tab</CenteredDiv>
                                    ) : (
                                        <div className="relative flex flex-row h-full">
                                            <TabContent key={tabId} tabId={tabId} noTopPadding={isMacOS()} />
                                        </div>
                                    )}
                                </Panel>
                                <PanelResizeHandle className={innerHandleClass} />
                                <Panel
                                    ref={aiPanelRef}
                                    collapsible
                                    defaultSize={innerAIPanelInitialPct}
                                    order={1}
                                    className="overflow-hidden"
                                >
                                    <div
                                        ref={aiPanelWrapperRef}
                                        className={`w-full h-full pl-0.5 ${aiPanelVisible ? "" : "opacity-0"}`}
                                    >
                                        {tabId !== "" && (
                                            <AIPanel
                                                roundTopLeft={false}
                                                onFloatingIsland={handleOpenFloatingIsland}
                                                floatingIslandActive={floatingIslandVisible}
                                            />
                                        )}
                                    </div>
                                </Panel>
                            </PanelGroup>
                        </Panel>
                    </PanelGroup>
                    <ModalsRenderer />
                </ErrorBoundary>
                {sidePanelMode === "hidden" && (
                    <button
                        type="button"
                        className="fixed bottom-3 left-3 z-[105] grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-white/10 bg-[#10131ae6] text-white/60 shadow-lg shadow-black/30 backdrop-blur-xl transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                        onClick={() => workspaceLayoutModel.setSidePanelMode("compact")}
                        aria-label="Show workspace sidebar"
                        title="Show workspace sidebar"
                    >
                        <i className="fa-solid fa-sidebar" aria-hidden="true" />
                    </button>
                )}
                {widgetsPanelVisible && (
                    <div
                        className="absolute left-0 top-0 h-full z-50"
                        style={{
                            width: "280px",
                            backdropFilter: "blur(20px)",
                            background: "rgba(0, 0, 0, 0.35)",
                            borderRight: "1px solid rgb(from var(--border-color) r g b / 0.3)",
                        }}
                    >
                        <Widgets position="left" />
                    </div>
                )}
            </div>
            {floatingIslandVisible && !canvasComposerContext.active && (
                <FloatingIsland onClose={handleCloseFloatingIsland} onReturnToPanel={handleReturnToPanel} />
            )}
            {canvasComposerContext.active && hiddenCanvasComposerTabId !== canvasComposerContext.tabid ? (
                <KronosChamberCanvasComposer onOpenKronosChamber={openCanvasKronosChamber} />
            ) : quickComposerEnabled ? (
                !canvasComposerContext.active ? (
                    <BottomQuickComposer onOpenDock={() => workspaceLayoutModel.setAIPanelVisible(true)} />
                ) : null
            ) : null}
            {!canvasComposerContext.active && (
                <AgentRunStrip onInspect={() => workspaceLayoutModel.setAIPanelVisible(true)} />
            )}
        </div>
    );
});

WorkspaceElem.displayName = "WorkspaceElem";

export { WorkspaceElem as Workspace };
