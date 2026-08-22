// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { globalStore } from "@/app/store/jotaiStore";
import { isBuilderWindow } from "@/app/store/windowtype";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { atoms, getApi, getOrefMetaKeyAtom, recordTEvent, refocusNode } from "@/store/global";
import debug from "debug";
import * as jotai from "jotai";
import { debounce } from "lodash-es";
import { ImperativePanelGroupHandle, ImperativePanelHandle } from "react-resizable-panels";

const dlog = debug("wave:workspace");

const AIPanel_DefaultWidth = 300;
const AIPanel_DefaultWidthRatio = 0.33;
const AIPanel_MinWidth = 300;
const AIPanel_MaxWidthRatio = 0.66;

const VTabBar_DefaultWidth = 220;
const VTabBar_CompactWidth = 52;
const VTabBar_MinWidth = 110;
const VTabBar_MaxWidth = 280;

export type SidePanelMode = "hidden" | "compact" | "full";

export function getWorkspaceTabPresentation(sidePanelMode: SidePanelMode): {
    showLeftTabBar: boolean;
    showTopWorkspaceTabs: false;
} {
    return { showLeftTabBar: sidePanelMode !== "hidden", showTopWorkspaceTabs: false };
}

export function isEmptyPanelGroupLayoutError(error: unknown): boolean {
    return error instanceof Error && /^Invalid 0 panel layout:/.test(error.message);
}

export function computeWorkspacePanelLayout({
    windowWidth,
    vtabWidth,
    aiPanelWidth,
}: {
    windowWidth: number;
    vtabWidth: number;
    aiPanelWidth: number;
}): { outer: number[]; inner: number[] } {
    const remainingW = Math.max(0, windowWidth - vtabWidth);
    const resolvedAIWidth = Math.min(aiPanelWidth, remainingW);
    const contentW = Math.max(0, remainingW - resolvedAIWidth);
    const vtabPct = windowWidth > 0 ? (vtabWidth / windowWidth) * 100 : 0;
    const contentPct = remainingW > 0 ? (contentW / remainingW) * 100 : 100;

    return {
        outer: [vtabPct, Math.max(0, 100 - vtabPct)],
        inner: [contentPct, Math.max(0, 100 - contentPct)],
    };
}

function clampVTabWidth(w: number): number {
    return Math.max(VTabBar_MinWidth, Math.min(w, VTabBar_MaxWidth));
}

function clampAIPanelWidth(w: number, windowWidth: number): number {
    const maxWidth = Math.floor(windowWidth * AIPanel_MaxWidthRatio);
    if (AIPanel_MinWidth > maxWidth) return AIPanel_MinWidth;
    return Math.max(AIPanel_MinWidth, Math.min(w, maxWidth));
}

class WorkspaceLayoutModel {
    private static instance: WorkspaceLayoutModel | null = null;

    aiPanelRef: ImperativePanelHandle | null;
    vtabPanelRef: ImperativePanelHandle | null;
    outerPanelGroupRef: ImperativePanelGroupHandle | null;
    innerPanelGroupRef: ImperativePanelGroupHandle | null;
    panelContainerRef: HTMLDivElement | null;
    aiPanelWrapperRef: HTMLDivElement | null;
    panelVisibleAtom: jotai.PrimitiveAtom<boolean>;
    vtabVisibleAtom: jotai.PrimitiveAtom<boolean>;
    widgetsPanelVisibleAtom: jotai.PrimitiveAtom<boolean>;
    sidePanelModeAtom: jotai.PrimitiveAtom<SidePanelMode>;

    private inResize: boolean;
    private aiPanelVisible: boolean;
    private aiPanelWidth: number | null;
    private vtabWidth: number;
    private vtabVisible: boolean;
    private widgetsPanelVisible: boolean;
    private sidePanelMode: SidePanelMode;
    private initialized: boolean = false;
    private transitionTimeoutRef: NodeJS.Timeout | null = null;
    private focusTimeoutRef: NodeJS.Timeout | null = null;
    private debouncedPersistAIWidth: (width: number) => void;
    private debouncedPersistVTabWidth: (width: number) => void;
    private debouncedPersistSidePanelMode: (mode: SidePanelMode) => void;

    private constructor() {
        this.aiPanelRef = null;
        this.vtabPanelRef = null;
        this.outerPanelGroupRef = null;
        this.innerPanelGroupRef = null;
        this.panelContainerRef = null;
        this.aiPanelWrapperRef = null;
        this.inResize = false;
        this.aiPanelVisible = false;
        this.aiPanelWidth = null;
        this.vtabWidth = VTabBar_DefaultWidth;
        this.vtabVisible = false;
        this.widgetsPanelVisible = false;
        this.sidePanelMode = "full";
        this.panelVisibleAtom = jotai.atom(false);
        this.vtabVisibleAtom = jotai.atom(false);
        this.widgetsPanelVisibleAtom = jotai.atom(false);
        this.sidePanelModeAtom = jotai.atom<SidePanelMode>("full");

        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.handleOuterPanelLayout = this.handleOuterPanelLayout.bind(this);
        this.handleInnerPanelLayout = this.handleInnerPanelLayout.bind(this);

        this.debouncedPersistAIWidth = debounce((width: number) => {
            try {
                RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("tab", this.getTabId()),
                    meta: { "waveai:panelwidth": width },
                });
            } catch (e) {
                console.warn("Failed to persist AI panel width:", e);
            }
        }, 300);

        this.debouncedPersistVTabWidth = debounce((width: number) => {
            try {
                RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("workspace", this.getWorkspaceId()),
                    meta: { "layout:vtabbarwidth": width },
                });
            } catch (e) {
                console.warn("Failed to persist vtabbar width:", e);
            }
        }, 300);

        this.debouncedPersistSidePanelMode = debounce((mode: SidePanelMode) => {
            try {
                RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("workspace", this.getWorkspaceId()),
                    meta: { "layout:sidepanelmode": mode },
                });
            } catch (e) {
                console.warn("Failed to persist side panel mode:", e);
            }
        }, 300);
    }

    static getInstance(): WorkspaceLayoutModel {
        if (!WorkspaceLayoutModel.instance) {
            WorkspaceLayoutModel.instance = new WorkspaceLayoutModel();
        }
        return WorkspaceLayoutModel.instance;
    }

    // ---- Meta / persistence helpers ----

    private getTabId(): string {
        return globalStore.get(atoms.staticTabId);
    }

    private getWorkspaceId(): string {
        return globalStore.get(atoms.workspace)?.oid ?? "";
    }

    private getPanelOpenAtom(): jotai.Atom<boolean> {
        return getOrefMetaKeyAtom(WOS.makeORef("tab", this.getTabId()), "waveai:panelopen");
    }

    private getPanelWidthAtom(): jotai.Atom<number> {
        return getOrefMetaKeyAtom(WOS.makeORef("tab", this.getTabId()), "waveai:panelwidth");
    }

    private getVTabBarWidthAtom(): jotai.Atom<number> {
        return getOrefMetaKeyAtom(WOS.makeORef("workspace", this.getWorkspaceId()), "layout:vtabbarwidth");
    }

    private getSidePanelModeAtom(): jotai.Atom<SidePanelMode> {
        return getOrefMetaKeyAtom(
            WOS.makeORef("workspace", this.getWorkspaceId()),
            "layout:sidepanelmode"
        ) as jotai.Atom<SidePanelMode>;
    }

    private initializeFromMeta(): void {
        if (this.initialized) return;
        this.initialized = true;
        try {
            const savedVisible = globalStore.get(this.getPanelOpenAtom());
            const savedAIWidth = globalStore.get(this.getPanelWidthAtom());
            const savedVTabWidth = globalStore.get(this.getVTabBarWidthAtom());
            const savedSidePanelMode = globalStore.get(this.getSidePanelModeAtom());
            if (savedVisible != null) {
                this.aiPanelVisible = savedVisible;
                globalStore.set(this.panelVisibleAtom, savedVisible);
            }
            if (savedAIWidth != null) {
                this.aiPanelWidth = savedAIWidth;
            }
            if (savedVTabWidth != null && savedVTabWidth > 0) {
                this.vtabWidth = savedVTabWidth;
            }
            if (savedSidePanelMode != null && ["hidden", "compact", "full"].includes(savedSidePanelMode)) {
                this.sidePanelMode = savedSidePanelMode;
                globalStore.set(this.sidePanelModeAtom, savedSidePanelMode);
            }
        } catch (e) {
            console.warn("Failed to initialize from tab meta:", e);
        }
    }

    // ---- Resolved width getters (always clamped) ----

    private getResolvedAIWidth(windowWidth: number): number {
        this.initializeFromMeta();
        let w = this.aiPanelWidth;
        if (w == null) {
            w = Math.max(AIPanel_DefaultWidth, windowWidth * AIPanel_DefaultWidthRatio);
            this.aiPanelWidth = w;
        }
        return clampAIPanelWidth(w, windowWidth);
    }

    private getResolvedVTabWidth(): number {
        this.initializeFromMeta();
        if (this.sidePanelMode === "compact") {
            return VTabBar_CompactWidth;
        }
        return clampVTabWidth(this.vtabWidth);
    }

    private computeLayout(windowWidth: number): { outer: number[]; inner: number[] } {
        const vtabW = this.vtabVisible ? this.getResolvedVTabWidth() : 0;
        const remainingW = Math.max(0, windowWidth - vtabW);
        const aiW = this.aiPanelVisible ? Math.min(this.getResolvedAIWidth(windowWidth), remainingW) : 0;
        return computeWorkspacePanelLayout({ windowWidth, vtabWidth: vtabW, aiPanelWidth: aiW });
    }

    private commitLayouts(windowWidth: number): void {
        if (!this.outerPanelGroupRef || !this.innerPanelGroupRef) return;
        const { outer, inner } = this.computeLayout(windowWidth);
        this.inResize = true;
        try {
            this.outerPanelGroupRef.setLayout(outer);
            this.innerPanelGroupRef.setLayout(inner);
        } catch (error) {
            if (!isEmptyPanelGroupLayoutError(error)) {
                throw error;
            }
            dlog("skipping layout commit for an unmounted panel group");
        } finally {
            this.inResize = false;
        }
        this.updateWrapperWidth();
    }

    handleOuterPanelLayout(sizes: number[]): void {
        if (this.inResize) return;
        if (!this.vtabVisible) return;
        if (this.sidePanelMode !== "full") return;
        const windowWidth = window.innerWidth;
        const newVTabW = (sizes[0] / 100) * windowWidth;
        const clamped = clampVTabWidth(newVTabW);
        this.vtabWidth = clamped;
        this.debouncedPersistVTabWidth(clamped);

        this.commitLayouts(windowWidth);
    }

    handleInnerPanelLayout(sizes: number[]): void {
        if (this.inResize) return;
        if (!this.aiPanelVisible) return;

        const windowWidth = window.innerWidth;
        const vtabW = this.vtabVisible ? this.getResolvedVTabWidth() : 0;
        const remainingW = Math.max(0, windowWidth - vtabW);
        const newAIW = clampAIPanelWidth((sizes[1] / 100) * remainingW, windowWidth);
        this.aiPanelWidth = newAIW;
        this.debouncedPersistAIWidth(newAIW);

        this.commitLayouts(windowWidth);
    }

    handleWindowResize(): void {
        this.commitLayouts(window.innerWidth);
    }

    // ---- Registration & sync ----

    syncVTabWidthFromMeta(): void {
        const savedVTabWidth = globalStore.get(this.getVTabBarWidthAtom());
        if (savedVTabWidth != null && savedVTabWidth > 0 && savedVTabWidth !== this.vtabWidth) {
            this.vtabWidth = savedVTabWidth;
            this.commitLayouts(window.innerWidth);
        }
    }

    registerRefs(
        aiPanelRef: ImperativePanelHandle,
        outerPanelGroupRef: ImperativePanelGroupHandle,
        innerPanelGroupRef: ImperativePanelGroupHandle,
        panelContainerRef: HTMLDivElement,
        aiPanelWrapperRef: HTMLDivElement,
        vtabPanelRef?: ImperativePanelHandle,
        showLeftTabBar?: boolean
    ): void {
        this.aiPanelRef = aiPanelRef;
        this.vtabPanelRef = vtabPanelRef ?? null;
        this.outerPanelGroupRef = outerPanelGroupRef;
        this.innerPanelGroupRef = innerPanelGroupRef;
        this.panelContainerRef = panelContainerRef;
        this.aiPanelWrapperRef = aiPanelWrapperRef;
        this.vtabVisible = showLeftTabBar ?? false;
        globalStore.set(this.vtabVisibleAtom, this.vtabVisible);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);
    }

    unregisterRefs(outerPanelGroupRef: ImperativePanelGroupHandle): void {
        if (this.outerPanelGroupRef !== outerPanelGroupRef) {
            return;
        }
        this.aiPanelRef = null;
        this.vtabPanelRef = null;
        this.outerPanelGroupRef = null;
        this.innerPanelGroupRef = null;
        this.panelContainerRef = null;
        this.aiPanelWrapperRef = null;
        this.inResize = false;
    }

    private syncPanelCollapse(): void {
        if (this.aiPanelRef) {
            if (this.aiPanelVisible) {
                this.aiPanelRef.expand();
            } else {
                this.aiPanelRef.collapse();
            }
        }
        if (this.vtabPanelRef) {
            if (this.vtabVisible) {
                this.vtabPanelRef.expand();
            } else {
                this.vtabPanelRef.collapse();
            }
        }
    }

    // ---- Transitions ----

    enableTransitions(duration: number): void {
        if (!this.panelContainerRef) return;
        const panels = this.panelContainerRef.querySelectorAll("[data-panel]");
        panels.forEach((panel: HTMLElement) => {
            panel.style.transition = "flex 0.2s ease-in-out";
        });
        if (this.transitionTimeoutRef) {
            clearTimeout(this.transitionTimeoutRef);
        }
        this.transitionTimeoutRef = setTimeout(() => {
            if (!this.panelContainerRef) return;
            const panels = this.panelContainerRef.querySelectorAll("[data-panel]");
            panels.forEach((panel: HTMLElement) => {
                panel.style.transition = "none";
            });
        }, duration);
    }

    // ---- Wrapper width (AI panel inner content width) ----

    updateWrapperWidth(): void {
        if (!this.aiPanelWrapperRef) return;
        const width = this.getResolvedAIWidth(window.innerWidth);
        this.aiPanelWrapperRef.style.width = `${width}px`;
    }

    // ---- Public getters ----

    getAIPanelVisible(): boolean {
        this.initializeFromMeta();
        return this.aiPanelVisible;
    }

    getAIPanelWidth(): number {
        return this.getResolvedAIWidth(window.innerWidth);
    }

    // ---- Initial percentage helpers (used by workspace.tsx for defaultSize) ----

    getVTabInitialPercentage(windowWidth: number, showLeftTabBar: boolean): number {
        this.initializeFromMeta();
        if (windowWidth <= 0) return 0;
        const vtabW = showLeftTabBar && !isBuilderWindow() ? this.getResolvedVTabWidth() : 0;
        return (vtabW / windowWidth) * 100;
    }

    getInnerContentInitialPercentage(windowWidth: number, showLeftTabBar: boolean): number {
        this.initializeFromMeta();
        const vtabW = showLeftTabBar && !isBuilderWindow() ? this.getResolvedVTabWidth() : 0;
        const remainingW = Math.max(0, windowWidth - vtabW);
        const aiW = this.aiPanelVisible ? Math.min(this.getResolvedAIWidth(windowWidth), remainingW) : 0;
        if (remainingW === 0) return 100;
        return ((remainingW - aiW) / remainingW) * 100;
    }

    getInnerAIPanelInitialPercentage(windowWidth: number, showLeftTabBar: boolean): number {
        this.initializeFromMeta();
        const vtabW = showLeftTabBar && !isBuilderWindow() ? this.getResolvedVTabWidth() : 0;
        const remainingW = Math.max(0, windowWidth - vtabW);
        const aiW = this.aiPanelVisible ? Math.min(this.getResolvedAIWidth(windowWidth), remainingW) : 0;
        if (remainingW === 0) return 0;
        return (aiW / remainingW) * 100;
    }

    // ---- Toggle visibility ----

    setAIPanelVisible(visible: boolean, opts?: { nofocus?: boolean }): void {
        if (this.focusTimeoutRef != null) {
            clearTimeout(this.focusTimeoutRef);
            this.focusTimeoutRef = null;
        }
        const wasVisible = this.aiPanelVisible;
        this.aiPanelVisible = visible;
        if (visible && !wasVisible) {
            recordTEvent("action:openwaveai");
        }
        globalStore.set(this.panelVisibleAtom, visible);
        getApi().setWaveAIOpen(visible);
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("tab", this.getTabId()),
            meta: { "waveai:panelopen": visible },
        });
        this.enableTransitions(250);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);

        if (visible) {
            if (!opts?.nofocus) {
                this.focusTimeoutRef = setTimeout(() => {
                    WaveAIModel.getInstance().focusInput();
                    this.focusTimeoutRef = null;
                }, 350);
            }
        } else {
            const layoutModel = getLayoutModelForStaticTab();
            const focusedNode = globalStore.get(layoutModel.focusedNode);
            if (focusedNode == null) {
                layoutModel.focusFirstNode();
                return;
            }
            const blockId = focusedNode?.data?.blockId;
            if (blockId != null) {
                refocusNode(blockId);
            }
        }
    }

    setShowLeftTabBar(showLeftTabBar: boolean): void {
        if (this.vtabVisible === showLeftTabBar) return;
        this.vtabVisible = showLeftTabBar;
        globalStore.set(this.vtabVisibleAtom, showLeftTabBar);
        this.enableTransitions(250);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);
    }

    // ---- Side Panel Mode ----

    getSidePanelMode(): SidePanelMode {
        this.initializeFromMeta();
        return this.sidePanelMode;
    }

    setSidePanelMode(mode: SidePanelMode): void {
        if (this.sidePanelMode === mode) return;
        this.sidePanelMode = mode;
        globalStore.set(this.sidePanelModeAtom, mode);
        this.debouncedPersistSidePanelMode(mode);

        if (mode === "hidden") {
            this.setShowLeftTabBar(false);
        } else if (mode === "compact") {
            this.setShowLeftTabBar(true);
        } else if (mode === "full") {
            this.setShowLeftTabBar(true);
            // Don't auto-open AI panel, just allow it
        }

        this.enableTransitions(250);
    }

    cycleSidePanelMode(): void {
        const modes: SidePanelMode[] = ["full", "compact", "hidden"];
        const currentIndex = modes.indexOf(this.sidePanelMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setSidePanelMode(modes[nextIndex]);
    }

    // ---- Widgets Panel ----

    getWidgetsPanelVisible(): boolean {
        return this.widgetsPanelVisible;
    }

    setWidgetsPanelVisible(visible: boolean): void {
        if (this.widgetsPanelVisible === visible) return;
        this.widgetsPanelVisible = visible;
        globalStore.set(this.widgetsPanelVisibleAtom, visible);
        this.enableTransitions(250);
    }

    toggleWidgetsPanel(): void {
        this.setWidgetsPanelVisible(!this.widgetsPanelVisible);
    }
}

export { WorkspaceLayoutModel };
