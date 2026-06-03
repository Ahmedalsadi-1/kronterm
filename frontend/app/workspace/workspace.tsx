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
import { ComputerUseStreamManager } from "@/app/view/appstream/computer-use-stream-manager";
import { Widgets } from "@/app/workspace/widgets";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { atoms, getApi, getSettingsKeyAtom } from "@/store/global";
import { isMacOS } from "@/util/platformutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import {
    ImperativePanelGroupHandle,
    ImperativePanelHandle,
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";

const MacOSTabBarSpacer = memo(() => {
    return (
        <div
            className="w-full shrink-0"
            style={
                {
                    height: "calc(8px * var(--zoomfactor-inv))",
                    WebkitAppRegion: "drag",
                    backdropFilter: "blur(20px)",
                    background: "rgba(0, 0, 0, 0.35)",
                } as React.CSSProperties
            }
        />
    );
});
MacOSTabBarSpacer.displayName = "MacOSTabBarSpacer";

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
        <div className="pointer-events-none fixed bottom-14 left-1/2 z-[70] w-[min(760px,calc(100vw-360px))] min-w-[420px] -translate-x-1/2">
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
                                ? "border-white/10 bg-white/[0.035] text-white/25 cursor-not-allowed"
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

const WorkspaceElem = memo(() => {
    const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
    const tabId = useAtomValue(atoms.staticTabId);
    const ws = useAtomValue(atoms.workspace);
    const tabBarPosition = useAtomValue(getSettingsKeyAtom("app:tabbar")) ?? "top";
    const quickComposerEnabled = useAtomValue(getSettingsKeyAtom("app:quickcomposer" as keyof SettingsType)) ?? false;
    const showLeftTabBar = tabBarPosition === "left";
    const aiPanelVisible = useAtomValue(workspaceLayoutModel.panelVisibleAtom);
    const vtabVisible = useAtomValue(workspaceLayoutModel.vtabVisibleAtom);
    const windowWidth = window.innerWidth;
    const leftGroupInitialPct = workspaceLayoutModel.getLeftGroupInitialPercentage(windowWidth, showLeftTabBar);
    const innerVTabInitialPct = workspaceLayoutModel.getInnerVTabInitialPercentage(windowWidth, showLeftTabBar);
    const innerAIPanelInitialPct = workspaceLayoutModel.getInnerAIPanelInitialPercentage(windowWidth, showLeftTabBar);
    const outerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const innerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const aiPanelRef = useRef<ImperativePanelHandle>(null);
    const vtabPanelRef = useRef<ImperativePanelHandle>(null);
    const panelContainerRef = useRef<HTMLDivElement>(null);
    const aiPanelWrapperRef = useRef<HTMLDivElement>(null);
    const [floatingIslandVisible, setFloatingIslandVisible] = useState(() => loadFloatingIslandState().enabled);

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
        if (
            aiPanelRef.current &&
            outerPanelGroupRef.current &&
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

    const innerHandleVisible = vtabVisible && aiPanelVisible;
    const innerHandleClass = `workspace-panel-resize-handle ${innerHandleVisible ? "is-visible" : "pointer-events-none"}`;
    const outerHandleVisible = vtabVisible || aiPanelVisible;
    const outerHandleClass = `workspace-panel-resize-handle ${outerHandleVisible ? "is-visible" : "pointer-events-none"}`;

    return (
        <div className="flex flex-col w-full flex-grow overflow-hidden">
            {!(showLeftTabBar && isMacOS()) && <TabBar key={ws.oid} workspace={ws} noTabs={showLeftTabBar} />}
            {showLeftTabBar && isMacOS() && <MacOSTabBarSpacer />}
            <div ref={panelContainerRef} className="flex flex-row flex-grow overflow-hidden">
                <ComputerUseStreamManager />
                <ErrorBoundary key={tabId}>
                    <PanelGroup
                        direction="horizontal"
                        onLayout={workspaceLayoutModel.handleOuterPanelLayout}
                        ref={outerPanelGroupRef}
                    >
                        <Panel order={0} defaultSize={leftGroupInitialPct} className="overflow-hidden">
                            <PanelGroup
                                direction="horizontal"
                                onLayout={workspaceLayoutModel.handleInnerPanelLayout}
                                ref={innerPanelGroupRef}
                            >
                                <Panel
                                    ref={vtabPanelRef}
                                    collapsible
                                    defaultSize={innerVTabInitialPct}
                                    order={0}
                                    className="overflow-hidden"
                                >
                                    {showLeftTabBar && <VTabBar workspace={ws} />}
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
                                        className={`w-full h-full pr-0.5 ${aiPanelVisible ? "" : "opacity-0"}`}
                                    >
                                        {tabId !== "" && (
                                            <AIPanel
                                                roundTopLeft={showLeftTabBar}
                                                onFloatingIsland={handleOpenFloatingIsland}
                                                floatingIslandActive={floatingIslandVisible}
                                            />
                                        )}
                                    </div>
                                </Panel>
                            </PanelGroup>
                        </Panel>
                        <PanelResizeHandle className={outerHandleClass} />
                        <Panel order={1} defaultSize={100 - leftGroupInitialPct}>
                            {tabId === "" ? (
                                <CenteredDiv>No Active Tab</CenteredDiv>
                            ) : (
                                <div className="flex flex-row h-full">
                                    <TabContent key={tabId} tabId={tabId} noTopPadding={showLeftTabBar && isMacOS()} />
                                    <Widgets />
                                </div>
                            )}
                        </Panel>
                    </PanelGroup>
                    <ModalsRenderer />
                </ErrorBoundary>
            </div>
            {floatingIslandVisible && (
                <FloatingIsland onClose={handleCloseFloatingIsland} onReturnToPanel={handleReturnToPanel} />
            )}
            {quickComposerEnabled && (
                <BottomQuickComposer onOpenDock={() => workspaceLayoutModel.setAIPanelVisible(true)} />
            )}
            <AgentRunStrip onInspect={() => workspaceLayoutModel.setAIPanelVisible(true)} />
        </div>
    );
});

WorkspaceElem.displayName = "WorkspaceElem";

export { WorkspaceElem as Workspace };
