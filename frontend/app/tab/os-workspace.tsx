// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block as BlockView } from "@/app/block/block";
import { blockViewToIcon, blockViewToName, resolveBlockIcon } from "@/app/block/blockutil";
import { AppIcon } from "@/app/components/app-icon";
import { ComputerUseControlEvent } from "@/app/components/computer-use-status-card";
import {
    fitSpatialViewportToBounds,
    spatialBoundsForRects,
    zoomSpatialViewportAtPoint,
} from "@/app/spatial/spatial-engine";
import {
    focusOrCreateDecision,
    getBuiltinViewDescriptors,
    mergeAppDescriptors,
    useInstalledAppDescriptors,
    type AppDescriptor,
} from "@/app/store/app-registry";
import { globalStore } from "@/app/store/jotaiStore";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { hermesSurfaceController } from "@/app/view/hermes/hermes-surface-controller";
import { WorkspaceWallpaper } from "@/app/workspace/workspace-wallpaper";
import type { NodeModel } from "@/layout/lib/types";
import { atoms, getApi, getSettingsKeyAtom } from "@/store/global";
import * as services from "@/store/services";
import * as WOS from "@/store/wos";
import { cn } from "@/util/util";
import { atom, useAtomValue } from "jotai";
import {
    Bot,
    ChevronDown,
    Circle,
    Diamond,
    Focus,
    GitFork,
    Grid2X2,
    Hand,
    Image,
    LayoutGrid,
    List,
    Maximize2,
    Minimize2,
    PanelLeft,
    PanelRight,
    Plus,
    Search,
    Square,
    StickyNote,
    Trash2,
    Unlink,
    X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";
import {
    isAgentActivityActive,
    subscribeAgentActivityStream,
    type LiveAgentSurfaceActivity,
} from "../../types/agent-activity";
import { OSAppDragMimeType, OSAppIconRail, OSAppStreamRail, readOSAppDragPayload, type OSAppDragPayload } from "./os-app-stream";
import { OSWidgetsFileView } from "./os-widgets-file";
import {
    computeOSWindowLayout,
    findOSDockHitTarget,
    makeInitialOSModeState,
    reconcileOSModeState,
    reduceOSModeState,
    type OSCanvasColor,
    type OSCanvasObject,
    type OSCanvasObjectKind,
    type OSModeState,
    type OSSpatialAction,
    type OSWindowGroup,
    type OSWindowLayout,
    type WidgetPresentation,
} from "./os-workspace-model";
import "./os-workspace.scss";
import type { WorkspacePresentation } from "./workspace-presentation";
import { registerWorkspaceSurfaceModeProvider } from "./workspace-surface-runtime";

const OSSaveDelayMs = 180;
const OSActivityHistoryLimit = 8;
const OSCanvasColors: OSCanvasColor[] = ["amber", "blue", "green", "rose", "slate"];

type OSCanvasTool = "select" | "hand" | "note" | "rectangle" | "ellipse" | "diamond" | "connector";

type BlockDescriptor = {
    blockId: string;
    view: string;
    title: string;
    icon?: string;
    appStreamAppId?: string;
};

type DragBounds = { x: number; y: number; width: number; height: number };
type DockPreview = {
    blockId: string;
    targetBlockId: string;
    targetTitle: string;
    targetBounds: DragBounds;
    side: "left" | "right";
};

function toScreenWindowLayout(state: OSModeState, layout: OSWindowLayout): OSWindowLayout {
    if (state.scene.kind !== "freeform") return layout;
    return {
        ...layout,
        bounds: {
            x: state.camera.x + layout.bounds.x * state.camera.zoom,
            y: state.camera.y + layout.bounds.y * state.camera.zoom,
            width: layout.bounds.width * state.camera.zoom,
            height: layout.bounds.height * state.camera.zoom,
        },
    };
}

const OSActivityIcons: Record<LiveAgentSurfaceActivity["surface"], string> = {
    browser: "globe",
    desktop: "display",
    file: "file-code",
    panel: "sparkles",
    sandbox: "box",
    terminal: "terminal",
};

const osAgentActivitiesAtom = atom<LiveAgentSurfaceActivity[]>([]);

const AgentSurfaceToView: Record<LiveAgentSurfaceActivity["surface"], string> = {
    browser: "web",
    desktop: "appstream",
    file: "preview",
    panel: "chathubv2",
    sandbox: "sandbox",
    terminal: "term",
};

function emitOSComputerUseControl(action: "focus" | "takeover" | "inspect", activity: LiveAgentSurfaceActivity) {
    window.dispatchEvent(new CustomEvent(ComputerUseControlEvent, { detail: { action, activity } }));
}

function OSAgentActivityPanel({ onFocusBlock }: { onFocusBlock: (blockId: string) => void }) {
    const [activities, setActivities] = useState<LiveAgentSurfaceActivity[]>([]);
    const startedAtRef = useRef<Record<string, number>>({});

    useEffect(
        () =>
            subscribeAgentActivityStream((activity) => {
                const runId = activity.runid ?? "default";
                if (startedAtRef.current[runId] == null || activity.phase === "queued") {
                    startedAtRef.current[runId] = activity.timestamp;
                }
                setActivities((current) => [...current, activity].slice(-OSActivityHistoryLimit));
            }),
        []
    );

    const latest = activities.at(-1);
    if (!latest) return null;
    const active = isAgentActivityActive(latest.phase);
    const runId = latest.runid ?? "default";
    const elapsedSeconds = Math.max(
        1,
        Math.round((latest.timestamp - (startedAtRef.current[runId] ?? latest.timestamp)) / 1000)
    );
    const visible = activities.slice(-5);

    return (
        <aside className={cn("os-agent-activity", active && "is-active")} aria-label="Worker activity">
            <header>
                <div>
                    <span className="os-agent-activity-eyebrow">Worker activity</span>
                    <strong>
                        {active
                            ? "Working in your apps"
                            : latest.phase === "succeeded"
                              ? "Workflow completed"
                              : latest.phase}
                    </strong>
                </div>
                <span className="os-agent-activity-state">
                    <i aria-hidden="true" />
                    {active ? "Live" : latest.phase}
                </span>
            </header>
            <ol>
                {visible.map((activity, index) => (
                    <li
                        key={`${activity.id ?? activity.timestamp}-${index}`}
                        className={cn(isAgentActivityActive(activity.phase) && "is-current")}
                    >
                        <i className={`fa-solid fa-${OSActivityIcons[activity.surface]}`} aria-hidden="true" />
                        <span>{activity.detail?.trim() || `${activity.action} ${activity.surface}`}</span>
                        <i className="fa-solid fa-circle-check os-agent-step-state" aria-hidden="true" />
                    </li>
                ))}
            </ol>
            {!active && (
                <div className="os-agent-completion">
                    <span>
                        <strong>Status</strong>
                        {latest.phase}
                    </span>
                    <span>
                        <strong>Elapsed</strong>
                        {elapsedSeconds}s
                    </span>
                    <p>{latest.detail?.trim() || `The ${latest.surface} workflow finished.`}</p>
                </div>
            )}
            <footer>
                {latest.blockid && (
                    <button
                        type="button"
                        onClick={() => {
                            onFocusBlock(latest.blockid!);
                            emitOSComputerUseControl("focus", latest);
                        }}
                    >
                        Inspect app
                    </button>
                )}
                <button type="button" onClick={() => emitOSComputerUseControl("takeover", latest)}>
                    Take control
                </button>
            </footer>
        </aside>
    );
}

function makeOSNodeModel(blockId: string, onFocus: () => void, onClose: () => void): NodeModel {
    return {
        additionalProps: atom({}),
        innerRect: atom({}),
        blockNum: atom(1),
        numLeafs: atom(1),
        nodeId: `os-${blockId}`,
        blockId,
        addEphemeralNodeToLayout: () => {},
        animationTimeS: atom(0),
        isResizing: atom(false),
        isFocused: atom(false),
        isMagnified: atom(false),
        isFolded: atom(false),
        anyMagnified: atom(false),
        isEphemeral: atom(false),
        ready: atom(true),
        disablePointerEvents: atom(false),
        toggleMagnify: () => {},
        toggleFold: () => {},
        focusNode: onFocus,
        onClose,
        dragHandleRef: undefined,
        displayContainerRef: undefined,
    } as unknown as NodeModel;
}

function readBlockDescriptor(blockId: string): BlockDescriptor {
    const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId));
    const block = globalStore.get(blockAtom);
    const view = String(block?.meta?.view ?? "term");
    return {
        blockId,
        view,
        title: String(block?.meta?.["frame:title"] ?? "").trim() || blockViewToName(view),
        icon: resolveBlockIcon(view, block?.meta),
        appStreamAppId: block?.meta?.["appstream:appid"] != null ? String(block.meta["appstream:appid"]) : undefined,
    };
}

const OSDockWingSvg = memo(function OSDockWingSvg({ mirrored }: { mirrored?: boolean }) {
    return (
        <svg
            className={cn("os-dock-wing", mirrored && "is-mirrored")}
            width="28"
            height="28"
            viewBox="0 0 28 28"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M0 0 A28 28 0 0 1 28 28 L28 0 Z" fill="var(--os-shell-bg)" />
            <path d="M0 0 A28 28 0 0 1 28 28" fill="none" stroke="var(--os-shell-border)" strokeWidth="1" />
        </svg>
    );
});
OSDockWingSvg.displayName = "OSDockWingSvg";

const OSBlockWindow = memo(
    ({
        descriptor,
        layout,
        selected,
        docked,
        agentWorking,
        reducedMotion,
        onFocus,
        onTitlePointerDown,
        onResizePointerDown,
        onClose,
        onCollapse,
        onToggleFocus,
        onDock,
        onDetach,
    }: {
        descriptor: BlockDescriptor;
        layout: OSWindowLayout;
        selected: boolean;
        docked: boolean;
        agentWorking: boolean;
        reducedMotion: boolean;
        onFocus: (blockId: string) => void;
        onTitlePointerDown: (event: ReactPointerEvent, blockId: string, layout: OSWindowLayout) => void;
        onResizePointerDown: (event: ReactPointerEvent, blockId: string, layout: OSWindowLayout) => void;
        onClose: (blockId: string) => void;
        onCollapse: (blockId: string) => void;
        onToggleFocus: (blockId: string) => void;
        onDock: (blockId: string, side: "left" | "right") => void;
        onDetach: (blockId: string) => void;
    }) => {
        const blockAtom = useMemo(
            () => WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", descriptor.blockId)),
            [descriptor.blockId]
        );
        useAtomValue(blockAtom);
        const nodeModel = useMemo(
            () =>
                makeOSNodeModel(
                    descriptor.blockId,
                    () => onFocus(descriptor.blockId),
                    () => onClose(descriptor.blockId)
                ),
            [descriptor.blockId, onClose, onFocus]
        );

        useEffect(() => {
            globalStore.set(nodeModel.isFocused as any, selected);
        }, [nodeModel, selected]);

        const { bounds } = layout;
        return (
            <motion.section
                layout
                className={cn(
                    "os-window",
                    `is-${layout.presentation}`,
                    selected && "is-selected",
                    docked && "is-docked",
                    agentWorking && "is-agent-working"
                )}
                data-block-id={descriptor.blockId}
                data-presentation={layout.presentation}
                initial={false}
                animate={{
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                    rotateY: layout.rotateY,
                    scale: layout.scale,
                    opacity: layout.opacity,
                }}
                transition={
                    reducedMotion ? { duration: 0.08 } : { type: "spring", stiffness: 260, damping: 32, mass: 0.9 }
                }
                style={{
                    zIndex: layout.zIndex,
                    transformOrigin: layout.presentation === "edge-left" ? "left" : "right",
                }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onFocus(descriptor.blockId);
                }}
            >
                <header
                    className="os-window-titlebar"
                    onPointerDown={(event) => onTitlePointerDown(event, descriptor.blockId, layout)}
                    onDoubleClick={() => onToggleFocus(descriptor.blockId)}
                >
                    <div className="os-window-title">
                        <AppIcon icon={descriptor.icon} />
                        <span>{descriptor.title}</span>
                    </div>
                    {agentWorking && (
                        <span className="os-window-agent-badge">
                            <Bot />
                            Hermes
                        </span>
                    )}
                    <div className="os-window-controls">
                        {docked ? (
                            <button
                                type="button"
                                onClick={() => onDetach(descriptor.blockId)}
                                aria-label="Detach window"
                            >
                                <Unlink />
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onDock(descriptor.blockId, "left")}
                                    aria-label="Dock left"
                                >
                                    <PanelLeft />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDock(descriptor.blockId, "right")}
                                    aria-label="Dock right"
                                >
                                    <PanelRight />
                                </button>
                            </>
                        )}
                        <button type="button" onClick={() => onCollapse(descriptor.blockId)} aria-label="Minimize">
                            <Minimize2 />
                        </button>
                        <button
                            type="button"
                            onClick={() => onToggleFocus(descriptor.blockId)}
                            aria-label="Toggle focus"
                        >
                            <Maximize2 />
                        </button>
                        <button
                            type="button"
                            className="is-close"
                            onClick={() => onClose(descriptor.blockId)}
                            aria-label="Close"
                        >
                            <X />
                        </button>
                    </div>
                </header>
                <div
                    className="os-window-content"
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onFocus(descriptor.blockId);
                    }}
                >
                    <BlockView nodeModel={nodeModel} preview={false} />
                </div>
                {layout.presentation === "freeform" && (
                    <button
                        type="button"
                        className="os-window-resize"
                        aria-label={`Resize ${descriptor.title}`}
                        onPointerDown={(event) => onResizePointerDown(event, descriptor.blockId, layout)}
                    />
                )}
            </motion.section>
        );
    }
);
OSBlockWindow.displayName = "OSBlockWindow";

const OSCanvasEntity = memo(
    ({
        object,
        selected,
        zoom,
        onSelect,
        onMove,
        onResize,
        onDelete,
    }: {
        object: OSCanvasObject;
        selected: boolean;
        onSelect: (id: string) => void;
        zoom: number;
        onMove: (id: string, x: number, y: number) => void;
        onResize: (id: string, width: number, height: number) => void;
        onDelete: (id: string) => void;
    }) => {
        const startRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | undefined>(undefined);
        const resizeRef = useRef<{ clientX: number; clientY: number; width: number; height: number } | undefined>(
            undefined
        );
        if (object.kind === "connector") return null;
        return (
            <article
                className={cn(
                    "os-canvas-object",
                    `is-${object.kind}`,
                    `color-${object.color ?? "amber"}`,
                    selected && "is-selected"
                )}
                style={{ left: object.x, top: object.y, width: object.width, height: object.height }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(object.id);
                }}
            >
                <div
                    className="os-canvas-object-handle"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelect(object.id);
                        startRef.current = { clientX: event.clientX, clientY: event.clientY, x: object.x, y: object.y };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!startRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                        onMove(
                            object.id,
                            startRef.current.x + (event.clientX - startRef.current.clientX) / zoom,
                            startRef.current.y + (event.clientY - startRef.current.clientY) / zoom
                        );
                    }}
                    onPointerUp={(event) => {
                        startRef.current = undefined;
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                >
                    <span>{object.kind === "note" ? "Note" : object.kind}</span>
                    <button type="button" onClick={() => onDelete(object.id)} aria-label="Delete canvas object">
                        <X />
                    </button>
                </div>
                {object.kind === "note" && <p>{object.text || "New note"}</p>}
                <button
                    type="button"
                    className="os-canvas-object-resize"
                    aria-label="Resize canvas object"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        resizeRef.current = {
                            clientX: event.clientX,
                            clientY: event.clientY,
                            width: object.width,
                            height: object.height,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!resizeRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                        onResize(
                            object.id,
                            Math.max(96, resizeRef.current.width + (event.clientX - resizeRef.current.clientX) / zoom),
                            Math.max(72, resizeRef.current.height + (event.clientY - resizeRef.current.clientY) / zoom)
                        );
                    }}
                    onPointerUp={(event) => {
                        resizeRef.current = undefined;
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                />
            </article>
        );
    }
);
OSCanvasEntity.displayName = "OSCanvasEntity";

function OSModeShell({
    workspaces,
    currentWorkspaceId,
    blocks,
    collapsedIds,
    sceneKind,
    activeBlockId,
    widgetPresentation,
    onSetWidgetPresentation,
    onFocusApp,
    onCreateAppStream,
    onWorkspace,
    onCreateWorkspace,
    onCreateBlock,
    onRestore,
    onOverview,
    onFreeform,
    onPresentation,
}: {
    workspaces: Array<{ id: string; name: string }>;
    currentWorkspaceId: string;
    blocks: BlockDescriptor[];
    collapsedIds: string[];
    sceneKind: OSModeState["scene"]["kind"];
    activeBlockId: string | undefined;
    widgetPresentation: WidgetPresentation;
    onSetWidgetPresentation: (presentation: WidgetPresentation) => void;
    onFocusApp: (blockId: string) => void;
    onCreateAppStream: (appid: string, appname: string) => void;
    onWorkspace: (id: string) => void;
    onCreateWorkspace: () => void;
    onCreateBlock: (view: string) => void;
    onRestore: (blockId: string) => void;
    onOverview: () => void;
    onFreeform: () => void;
    onPresentation: (presentation: WorkspacePresentation) => void;
}) {
    const [launcherOpen, setLauncherOpen] = useState(false);
    const [systemMenuOpen, setSystemMenuOpen] = useState(false);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [query, setQuery] = useState("");
    const installedApps = useInstalledAppDescriptors();
    const [clock, setClock] = useState(() => new Date());
    const wallpaper = useAtomValue(getSettingsKeyAtom("window:wallpaper" as never));
    const surfaceOpacity = useAtomValue(getSettingsKeyAtom("window:surfaceopacity" as never));
    const [wallpaperDraft, setWallpaperDraft] = useState(() => String(wallpaper ?? ""));
    useEffect(() => {
        const timer = window.setInterval(() => setClock(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        if (systemMenuOpen) setWallpaperDraft(String(wallpaper ?? ""));
    }, [systemMenuOpen, wallpaper]);
    const saveWallpaper = useCallback((value: string) => {
        void RpcApi.SetConfigCommand(TabRpcClient, { "window:wallpaper": value.trim() || undefined });
    }, []);
    const chooseWallpaper = useCallback(async () => {
        const selected = await getApi().selectWallpaper();
        if (!selected) return;
        setWallpaperDraft(selected);
        saveWallpaper(selected);
    }, [saveWallpaper]);
    const appDescriptors = useMemo(() => {
        const builtins = getBuiltinViewDescriptors(blocks);
        const merged = mergeAppDescriptors(builtins, installedApps, blocks);
        const pinned = merged.filter((descriptor) => descriptor.pinned);
        const runningExtras = merged.filter(
            (descriptor) => !descriptor.pinned && descriptor.kind === "view" && descriptor.runningBlockIds.length > 0
        );
        return [...pinned, ...runningExtras].slice(0, 8);
    }, [blocks, installedApps]);

    const launchApp = useCallback(
        (descriptor: AppDescriptor) => {
            const decision = focusOrCreateDecision(descriptor);
            if (decision.action === "focus") {
                onFocusApp(decision.blockId);
            } else if (decision.action === "create") {
                onCreateBlock(decision.view);
            } else if (decision.action === "create-appstream") {
                onCreateAppStream(decision.appid, decision.appname);
            }
        },
        [onFocusApp, onCreateBlock, onCreateAppStream]
    );

    const launcherViews = ["term", "web", "chathubv2", "preview", "sandbox", "sysinfo", "kronsettings", "help"].filter(
        (view) => `${view} ${blockViewToName(view)}`.toLowerCase().includes(query.toLowerCase())
    );
    return (
        <div className="os-shell">
            <div className="os-shell-left">
                <button
                    type="button"
                    className="os-brand"
                    onClick={() => onPresentation("widgets")}
                    aria-label="KronTerm home"
                >
                    <span>K</span>
                    <strong>KronTerm</strong>
                </button>
                <nav className="os-workspaces" aria-label="Workspaces">
                    {workspaces.slice(0, 4).map((workspace, index) => (
                        <button
                            type="button"
                            key={workspace.id}
                            className={cn(workspace.id === currentWorkspaceId && "is-active")}
                            onClick={() => onWorkspace(workspace.id)}
                            aria-label={workspace.name}
                            aria-current={workspace.id === currentWorkspaceId ? "page" : undefined}
                        >
                            {index + 1}
                        </button>
                    ))}
                    <button type="button" onClick={onCreateWorkspace} aria-label="Create workspace">
                        <Plus />
                    </button>
                </nav>
            </div>
            <div className="os-dock-bay">
                <OSDockWingSvg />
                <div className="os-app-dock" role="toolbar" aria-label="Applications">
                    {appDescriptors.map((descriptor) => {
                        const running = descriptor.runningBlockIds.length > 0;
                        const active = running && descriptor.runningBlockIds.includes(activeBlockId ?? "");
                        return (
                            <button
                                type="button"
                                key={descriptor.id}
                                className={cn(
                                    "os-dock-app",
                                    descriptor.view != null && `view-${descriptor.view}`,
                                    running && "is-running",
                                    active && "is-active"
                                )}
                                onClick={() => launchApp(descriptor)}
                                aria-label={`Open ${descriptor.name}`}
                                title={descriptor.name}
                            >
                                <AppIcon icon={descriptor.icon} />
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className="os-dock-app is-add"
                        onClick={() => setLauncherOpen(true)}
                        aria-label="More applications"
                    >
                        <Plus />
                    </button>
                </div>
                <OSDockWingSvg mirrored />
            </div>
            <div className="os-shell-right">
                <button
                    type="button"
                    className="os-hermes-button"
                    onClick={() => hermesSurfaceController.requestOpenPanel()}
                    aria-label="Open Hermes panel"
                >
                    <Bot />
                    <span>Hermes</span>
                </button>
                <div className="os-view-selector">
                    <button
                        type="button"
                        onClick={() => setViewMenuOpen((open) => !open)}
                        aria-expanded={viewMenuOpen}
                        aria-haspopup="menu"
                        aria-label={`Widget presentation: ${widgetPresentation}`}
                    >
                        {widgetPresentation === "file" ? <List /> : <Grid2X2 />}
                        <span className="os-view-selector-label">{widgetPresentation === "file" ? "File" : "Canvas"}</span>
                        <ChevronDown />
                    </button>
                    {viewMenuOpen && (
                        <div className="os-view-menu" role="menu">
                            <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={widgetPresentation === "canvas"}
                                onClick={() => {
                                    onSetWidgetPresentation("canvas");
                                    setViewMenuOpen(false);
                                }}
                            >
                                <Grid2X2 />
                                <span>Canvas</span>
                            </button>
                            <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={widgetPresentation === "file"}
                                onClick={() => {
                                    onSetWidgetPresentation("file");
                                    setViewMenuOpen(false);
                                }}
                            >
                                <List />
                                <span>File</span>
                            </button>
                        </div>
                    )}
                </div>
                <time>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                <button
                    type="button"
                    onClick={sceneKind === "freeform" ? onOverview : onFreeform}
                    aria-label={sceneKind === "freeform" ? "Show all apps" : "Return to desktop"}
                >
                    {sceneKind === "freeform" ? <Grid2X2 /> : <Focus />}
                </button>
                <button
                    type="button"
                    className="os-layout-menu"
                    onClick={() => setSystemMenuOpen((open) => !open)}
                    aria-label="Wallpaper and layout controls"
                    aria-expanded={systemMenuOpen}
                >
                    <LayoutGrid />
                </button>
            </div>
            {systemMenuOpen && (
                <section className="os-system-menu" role="dialog" aria-label="Wallpaper and layout controls">
                    <header>
                        <span>
                            <Image aria-hidden="true" />
                        </span>
                        <div>
                            <strong>Wallpaper engine</strong>
                            <small>Still images and looping video</small>
                        </div>
                    </header>
                    <label className="os-wallpaper-source">
                        <span>File path or URL</span>
                        <input
                            value={wallpaperDraft}
                            onChange={(event) => setWallpaperDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") saveWallpaper(wallpaperDraft);
                                if (event.key === "Escape") setSystemMenuOpen(false);
                            }}
                            placeholder="Choose an image/video or paste a URL"
                        />
                    </label>
                    <div className="os-wallpaper-actions">
                        <button type="button" onClick={() => void chooseWallpaper()}>
                            Choose file
                        </button>
                        <button type="button" onClick={() => saveWallpaper(wallpaperDraft)}>
                            Apply
                        </button>
                        <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                                setWallpaperDraft("");
                                saveWallpaper("");
                            }}
                            aria-label="Clear wallpaper"
                        >
                            <Trash2 aria-hidden="true" />
                        </button>
                    </div>
                    <label className="os-surface-opacity">
                        <span>Widget glass</span>
                        <input
                            type="range"
                            min="35"
                            max="100"
                            value={Math.min(100, Math.max(35, Number(surfaceOpacity ?? 78)))}
                            onChange={(event) =>
                                void RpcApi.SetConfigCommand(TabRpcClient, {
                                    "window:surfaceopacity": Number(event.target.value),
                                })
                            }
                        />
                    </label>
                    <div className="os-layout-actions">
                        <button
                            type="button"
                            onClick={() => {
                                onPresentation("widgets");
                                setSystemMenuOpen(false);
                            }}
                        >
                            <LayoutGrid aria-hidden="true" />
                            <span>
                                <strong>Tile all widgets</strong>
                                <small>Collapse this spatial desktop into widget tiles</small>
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onPresentation("canvas");
                                setSystemMenuOpen(false);
                            }}
                        >
                            <Grid2X2 aria-hidden="true" />
                            <span>
                                <strong>Canvas mode</strong>
                                <small>Move the same live apps to the infinite canvas</small>
                            </span>
                        </button>
                    </div>
                </section>
            )}
            {collapsedIds.length > 0 && (
                <div className="os-collapsed-dock" aria-label="Minimized applications">
                    {collapsedIds.map((blockId) => {
                        const block = blocks.find((item) => item.blockId === blockId);
                        return (
                            <button
                                type="button"
                                className="os-collapsed-tile"
                                key={blockId}
                                onClick={() => onRestore(blockId)}
                                aria-label={`Restore ${block?.title ?? "application"}`}
                            >
                                <AppIcon icon={block?.icon} />
                                <span>{block?.title ?? "App"}</span>
                            </button>
                        );
                    })}
                </div>
            )}
            {launcherOpen && (
                <div className="os-launcher-backdrop" onPointerDown={() => setLauncherOpen(false)}>
                    <section
                        className="os-launcher"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Application launcher"
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <label>
                            <Search />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search applications"
                            />
                        </label>
                        <div>
                            {launcherViews.map((view) => (
                                <button
                                    type="button"
                                    key={view}
                                    onClick={() => {
                                        onCreateBlock(view);
                                        setLauncherOpen(false);
                                    }}
                                >
                                    <AppIcon icon={blockViewToIcon(view)} />
                                    <span>{blockViewToName(view)}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function OSCanvasToolbar({
    tool,
    onTool,
    onFit,
}: {
    tool: OSCanvasTool;
    onTool: (tool: OSCanvasTool) => void;
    onFit: () => void;
}) {
    const tools: Array<{ id: OSCanvasTool; label: string; icon: React.ReactNode }> = [
        { id: "select", label: "Select", icon: <Circle /> },
        { id: "hand", label: "Pan", icon: <Hand /> },
        { id: "note", label: "Note", icon: <StickyNote /> },
        { id: "rectangle", label: "Rectangle", icon: <Square /> },
        { id: "ellipse", label: "Ellipse", icon: <Circle /> },
        { id: "diamond", label: "Diamond", icon: <Diamond /> },
        { id: "connector", label: "Connector", icon: <GitFork /> },
    ];
    return (
        <div className="os-canvas-toolbar" role="toolbar" aria-label="Spatial canvas tools">
            {tools.map((entry) => (
                <button
                    type="button"
                    key={entry.id}
                    className={cn(tool === entry.id && "is-active")}
                    onClick={() => onTool(entry.id)}
                    aria-label={entry.label}
                >
                    {entry.icon}
                </button>
            ))}
            <span />
            <button type="button" onClick={onFit} aria-label="Fit spatial content">
                <Maximize2 />
            </button>
        </div>
    );
}

function OSGroupDivider({
    group,
    viewport,
    onRatio,
}: {
    group: OSWindowGroup;
    viewport: { width: number; height: number };
    onRatio: (ratio: number) => void;
}) {
    const outerWidth = Math.min(1540, viewport.width * 0.92);
    const outerHeight = Math.min(860, viewport.height * 0.78);
    const outerX = (viewport.width - outerWidth) / 2;
    const outerY = 96 + (viewport.height - 96 - outerHeight) / 2;
    const dividerX =
        group.side === "left"
            ? outerX + outerWidth * group.dividerRatio
            : outerX + outerWidth * (1 - group.dividerRatio);
    return (
        <div
            className="os-group-frame"
            style={{ left: outerX - 8, top: outerY - 8, width: outerWidth + 16, height: outerHeight + 16 }}
        >
            <div
                className="os-group-divider"
                role="separator"
                aria-orientation="vertical"
                aria-valuemin={22}
                aria-valuemax={42}
                aria-valuenow={Math.round(group.dividerRatio * 100)}
                tabIndex={0}
                style={{ left: dividerX - outerX + 4 }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const raw =
                        group.side === "left"
                            ? (event.clientX - outerX) / outerWidth
                            : (outerX + outerWidth - event.clientX) / outerWidth;
                    onRatio(raw);
                }}
                onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowRight" ? 0.02 : -0.02;
                    onRatio(group.side === "left" ? group.dividerRatio + direction : group.dividerRatio - direction);
                }}
            />
        </div>
    );
}

function OSModeView({ tabId, tabData }: { tabId: string; tabData: Tab }) {
    const blockIds = tabData.blockids ?? [];
    const blockIdsKey = blockIds.join(":");
    const [state, setState] = useState<OSModeState>(() => makeInitialOSModeState(tabData, blockIds));
    const stateRef = useRef(state);
    const rootRef = useRef<HTMLDivElement>(null);
    const persistTimerRef = useRef<number | undefined>(undefined);
    const [viewport, setViewport] = useState({ width: 1440, height: 900 });
    const [tool, setTool] = useState<OSCanvasTool>("select");
    const [connectorStartId, setConnectorStartId] = useState<string | undefined>(undefined);
    const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
    const [dragBounds, setDragBounds] = useState<Record<string, DragBounds>>({});
    const [dockPreview, setDockPreview] = useState<DockPreview | undefined>(undefined);
    const panRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | undefined>(
        undefined
    );
    const interactionRef = useRef<
        | {
              kind: "move" | "resize";
              blockId: string;
              pointerId: number;
              clientX: number;
              clientY: number;
              bounds: DragBounds;
              scale: number;
          }
        | undefined
    >(undefined);
    const reducedMotion = useReducedMotion() ?? false;
    const currentWorkspace = useAtomValue(atoms.workspace);
    stateRef.current = state;

    const descriptors = useMemo(() => blockIds.map(readBlockDescriptor), [blockIdsKey]);

    const installedAppDescriptors = useInstalledAppDescriptors();
    const installedDescriptorsWithRunning = useMemo(
        () =>
            installedAppDescriptors.map((descriptor) => ({
                ...descriptor,
                runningBlockIds: descriptors
                    .filter((block) => block.appStreamAppId != null && block.appStreamAppId === descriptor.installedAppId)
                    .map((block) => block.blockId),
            })),
        [installedAppDescriptors, descriptors]
    );

    useEffect(() => {
        setState((current) => reconcileOSModeState(current, blockIds));
    }, [blockIdsKey]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const observer = new ResizeObserver(([entry]) => {
            setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    useEffect(
        () =>
            subscribeAgentActivityStream((activity) => {
                globalStore.set(osAgentActivitiesAtom, (current) => [...current, activity].slice(-OSActivityHistoryLimit));
            }),
        []
    );

    useEffect(() => {
        let cancelled = false;
        void RpcApi.WorkspaceListCommand(TabRpcClient, {}).then((items) => {
                if (cancelled) return;
                setWorkspaces(
                    (items ?? []).map((item, index) => ({
                        id: item.workspacedata.oid,
                        name: item.workspacedata.name || `Workspace ${index + 1}`,
                    }))
                );
            })
            .catch(() => {
                if (!cancelled) setWorkspaces([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const persist = useCallback(
        (nextState: OSModeState) => {
            if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
            persistTimerRef.current = window.setTimeout(() => {
                persistTimerRef.current = undefined;
                void RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("tab", tabId),
                    meta: { "layout:mode": "os", "layout:os": nextState } as unknown as MetaType,
                });
            }, OSSaveDelayMs);
        },
        [tabId]
    );

    useEffect(
        () => () => {
            if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
        },
        []
    );

    const setAndPersist = useCallback(
        (updater: (current: OSModeState) => OSModeState) => {
            setState((current) => {
                const next = updater(current);
                stateRef.current = next;
                persist(next);
                return next;
            });
        },
        [persist]
    );

    const dispatch = useCallback(
        (action: OSSpatialAction) => {
            setAndPersist((current) => reduceOSModeState(current, action));
        },
        [setAndPersist]
    );

    const addObject = useCallback(
        (kind: OSCanvasObjectKind, text?: string) => {
            const camera = stateRef.current.camera;
            const width = kind === "note" ? 260 : 220;
            const height = kind === "note" ? 180 : 160;
            const object: OSCanvasObject = {
                id: `${kind}-${crypto.randomUUID()}`,
                kind,
                x: (viewport.width / 2 - camera.x) / camera.zoom - width / 2,
                y: (viewport.height / 2 - camera.y) / camera.zoom - height / 2,
                width,
                height,
                text: text ?? (kind === "note" ? "New note" : undefined),
                color: OSCanvasColors[stateRef.current.objects.length % OSCanvasColors.length],
            };
            setAndPersist((current) => ({
                ...current,
                objects: [...current.objects, object],
                selectedEntityId: object.id,
            }));
            setTool("select");
        },
        [setAndPersist, viewport]
    );

    const updateObject = useCallback(
        (objectId: string, patch: Partial<OSCanvasObject>) => {
            const definedPatch = Object.fromEntries(
                Object.entries(patch).filter(([, value]) => value != null)
            ) as Partial<OSCanvasObject>;
            setAndPersist((current) => ({
                ...current,
                objects: current.objects.map((object) =>
                    object.id === objectId ? { ...object, ...definedPatch } : object
                ),
                selectedEntityId: objectId,
            }));
        },
        [setAndPersist]
    );

    const deleteObject = useCallback(
        (objectId: string) => {
            setAndPersist((current) => ({
                ...current,
                objects: current.objects.filter(
                    (object) =>
                        object.id !== objectId && object.fromObjectId !== objectId && object.toObjectId !== objectId
                ),
                selectedEntityId: current.selectedEntityId === objectId ? undefined : current.selectedEntityId,
            }));
        },
        [setAndPersist]
    );

    const fitAll = useCallback(() => {
        const rects = [
            ...Object.values(stateRef.current.windows)
                .filter((window) => !window.collapsed)
                .map((window) => window.bounds),
            ...stateRef.current.objects.filter((object) => object.kind !== "connector"),
        ];
        const bounds = spatialBoundsForRects(rects);
        if (!bounds) return;
        setAndPersist((current) => ({ ...current, camera: fitSpatialViewportToBounds(bounds, viewport, 120, 1) }));
    }, [setAndPersist, viewport]);

    const focusBlock = useCallback(
        (blockId: string) => {
            setAndPersist((current) => ({
                ...current,
                selectedEntityId: blockId,
                zOrder: [...current.zOrder.filter((id) => id !== blockId), blockId],
            }));
        },
        [setAndPersist]
    );

    const primaryBlockId =
        state.scene.kind === "focused"
            ? state.scene.blockId
            : state.scene.kind === "grouped"
              ? state.groups[state.scene.groupId]?.primaryBlockId
              : undefined;

    const dockBlock = useCallback(
        (blockId: string, side: "left" | "right") => {
            const targetBlockId = primaryBlockId ?? stateRef.current.zOrder.filter((id) => id !== blockId).at(-1);
            if (!targetBlockId) return;
            dispatch({ type: "spatial.dock", blockId, targetBlockId, side });
        },
        [dispatch, primaryBlockId]
    );

    const handleClose = useCallback((blockId: string) => {
        void services.ObjectService.DeleteBlock(blockId);
    }, []);

    const handleCreateBlock = useCallback(
        (view: string) => {
            const existing = descriptors.find((block) => block.view === view);
            if (existing) {
                dispatch({ type: "spatial.focus", blockId: existing.blockId });
                return;
            }
            void RpcApi.CreateBlockCommand(TabRpcClient, { tabid: tabId, blockdef: { meta: { view } } });
        },
        [descriptors, dispatch, tabId]
    );

    const handlePresentation = useCallback((presentation: WorkspacePresentation) => {
        window.localStorage.setItem("kronterm:layoutmode", presentation);
        window.dispatchEvent(new CustomEvent("kronterm:layoutmode-changed", { detail: { mode: presentation } }));
        void RpcApi.SetConfigCommand(TabRpcClient, { "app:layoutmode": presentation });
    }, []);

    const handleCreateAppStream = useCallback(
        (appid: string, appname: string) => {
            void RpcApi.CreateBlockCommand(TabRpcClient, {
                tabid: tabId,
                blockdef: {
                    meta: {
                        view: "appstream",
                        "appstream:appid": appid,
                        "appstream:appname": appname,
                    } as unknown as MetaType,
                },
            });
        },
        [tabId]
    );

    const launchAppDescriptor = useCallback(
        (descriptor: AppDescriptor) => {
            const decision = focusOrCreateDecision(descriptor);
            if (decision.action === "focus") {
                dispatch({ type: "spatial.focus", blockId: decision.blockId });
            } else if (decision.action === "create") {
                handleCreateBlock(decision.view);
            } else if (decision.action === "create-appstream") {
                handleCreateAppStream(decision.appid, decision.appname);
            }
        },
        [dispatch, handleCreateBlock, handleCreateAppStream]
    );

    const handleDropApp = useCallback(
        (payload: OSAppDragPayload, worldX: number, worldY: number) => {
            if (payload.blockId != null) {
                dispatch({ type: "spatial.focus", blockId: payload.blockId });
                dispatch({ type: "spatial.move", blockId: payload.blockId, x: worldX, y: worldY });
                return;
            }
            const meta: Record<string, string> =
                payload.appid != null
                    ? {
                          view: "appstream",
                          "appstream:appid": payload.appid,
                          "appstream:appname": payload.appname ?? payload.appid,
                      }
                    : { view: payload.view ?? "term" };
            void RpcApi.CreateBlockCommand(TabRpcClient, {
                tabid: tabId,
                blockdef: { meta: meta as unknown as MetaType },
            }).then((oref) => {
                const blockId = WOS.splitORef(oref)[1];
                dispatch({ type: "spatial.focus", blockId });
                dispatch({ type: "spatial.move", blockId, x: worldX, y: worldY });
            });
        },
        [dispatch, tabId]
    );

    const windowLayouts = useMemo(
        () =>
            Object.fromEntries(
                descriptors.map((block) => {
                    const computed = computeOSWindowLayout(state, block.blockId, block.view, viewport);
                    const dragged = dragBounds[block.blockId];
                    return [
                        block.blockId,
                        dragged
                            ? { ...computed, bounds: dragged, rotateY: 0, scale: 1, opacity: 1, zIndex: 900 }
                            : computed,
                    ];
                })
            ),
        [descriptors, dragBounds, state, viewport]
    );

    const beginWindowInteraction = useCallback(
        (event: ReactPointerEvent, blockId: string, layout: OSWindowLayout, kind: "move" | "resize") => {
            if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
            event.preventDefault();
            event.stopPropagation();
            const scale = stateRef.current.scene.kind === "freeform" ? stateRef.current.camera.zoom : 1;
            interactionRef.current = {
                kind,
                blockId,
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                bounds: layout.bounds,
                scale,
            };
            setDragBounds((current) => ({ ...current, [blockId]: layout.bounds }));
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        },
        []
    );

    const handleRootPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const interaction = interactionRef.current;
            if (interaction?.pointerId === event.pointerId) {
                const dx = (event.clientX - interaction.clientX) / interaction.scale;
                const dy = (event.clientY - interaction.clientY) / interaction.scale;
                const bounds =
                    interaction.kind === "move"
                        ? { ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy }
                        : {
                              ...interaction.bounds,
                              width: Math.max(320, interaction.bounds.width + dx),
                              height: Math.max(220, interaction.bounds.height + dy),
                          };
                setDragBounds((current) => ({ ...current, [interaction.blockId]: bounds }));
                if (interaction.kind === "move") {
                    const rootBounds = rootRef.current?.getBoundingClientRect();
                    const pointer = {
                        x: event.clientX - (rootBounds?.left ?? 0),
                        y: event.clientY - (rootBounds?.top ?? 0),
                    };
                    const current = stateRef.current;
                    const hit = findOSDockHitTarget(
                        interaction.blockId,
                        pointer,
                        Object.fromEntries(
                            descriptors.map((descriptor) => {
                                const layout = computeOSWindowLayout(
                                    current,
                                    descriptor.blockId,
                                    descriptor.view,
                                    viewport
                                );
                                return [descriptor.blockId, toScreenWindowLayout(current, layout)];
                            })
                        )
                    );
                    const target = hit && descriptors.find((descriptor) => descriptor.blockId === hit.targetBlockId);
                    setDockPreview(
                        hit && target
                            ? {
                                  blockId: interaction.blockId,
                                  targetBlockId: hit.targetBlockId,
                                  targetTitle: target.title,
                                  targetBounds: hit.bounds,
                                  side: hit.side,
                              }
                            : undefined
                    );
                }
                return;
            }
            const pan = panRef.current;
            if (pan?.pointerId === event.pointerId) {
                setState((current) => ({
                    ...current,
                    camera: {
                        ...current.camera,
                        x: pan.x + event.clientX - pan.clientX,
                        y: pan.y + event.clientY - pan.clientY,
                    },
                }));
            }
        },
        [descriptors, viewport]
    );

    const handleRootPointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const interaction = interactionRef.current;
            if (interaction?.pointerId === event.pointerId) {
                const finalBounds = dragBounds[interaction.blockId] ?? interaction.bounds;
                if (dockPreview?.blockId === interaction.blockId) {
                    dispatch({
                        type: "spatial.dock",
                        blockId: interaction.blockId,
                        targetBlockId: dockPreview.targetBlockId,
                        side: dockPreview.side,
                    });
                } else if (interaction.kind === "move") {
                    setAndPersist((current) =>
                        reduceOSModeState(
                            current.scene.kind === "freeform" ? current : { ...current, scene: { kind: "freeform" } },
                            { type: "spatial.move", blockId: interaction.blockId, x: finalBounds.x, y: finalBounds.y }
                        )
                    );
                } else {
                    dispatch({
                        type: "spatial.resize",
                        blockId: interaction.blockId,
                        width: finalBounds.width,
                        height: finalBounds.height,
                    });
                }
                interactionRef.current = undefined;
                setDockPreview(undefined);
                setDragBounds((current) => {
                    const next = { ...current };
                    delete next[interaction.blockId];
                    return next;
                });
            }
            if (panRef.current?.pointerId === event.pointerId) {
                panRef.current = undefined;
                persist(stateRef.current);
            }
        },
        [dispatch, dockPreview, dragBounds, persist, setAndPersist]
    );

    const handleWheel = useCallback(
        (event: ReactWheelEvent<HTMLDivElement>) => {
            if (stateRef.current.scene.kind === "overview") {
                event.preventDefault();
                const visible = stateRef.current.zOrder.filter((id) => !stateRef.current.windows[id]?.collapsed);
                if (!visible.length) return;
                const current = visible.indexOf(stateRef.current.scene.selectedBlockId ?? visible[0]);
                const next = visible[(current + (event.deltaY > 0 ? 1 : -1) + visible.length) % visible.length];
                dispatch({ type: "spatial.showOverview", selectedBlockId: next });
                return;
            }
            if (stateRef.current.scene.kind !== "freeform") return;
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
                const rect = rootRef.current?.getBoundingClientRect();
                const point = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
                setAndPersist((current) => ({
                    ...current,
                    camera: zoomSpatialViewportAtPoint(
                        current.camera,
                        current.camera.zoom * Math.exp(-event.deltaY * 0.002),
                        point
                    ),
                }));
            } else {
                setAndPersist((current) => ({
                    ...current,
                    camera: {
                        ...current.camera,
                        x: current.camera.x - event.deltaX,
                        y: current.camera.y - event.deltaY,
                    },
                }));
            }
        },
        [dispatch, setAndPersist]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, [contenteditable='true'], [role='application']")) return;
            const current = stateRef.current;
            if (event.key === "Escape") {
                if (current.scene.kind === "overview") dispatch({ type: "spatial.restoreScene" });
                else if (current.scene.kind !== "freeform") dispatch({ type: "spatial.freeform" });
                return;
            }
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") {
                event.preventDefault();
                dispatch({ type: "spatial.showOverview" });
                return;
            }
            if (current.scene.kind !== "overview") return;
            const visible = current.zOrder.filter((id) => !current.windows[id]?.collapsed);
            if (!visible.length) return;
            const selected = current.scene.selectedBlockId ?? visible[0];
            if (event.key === "Enter") {
                event.preventDefault();
                dispatch({ type: "spatial.focus", blockId: selected });
            } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                event.preventDefault();
                const index = visible.indexOf(selected);
                const delta = event.key === "ArrowRight" ? 1 : -1;
                dispatch({
                    type: "spatial.showOverview",
                    selectedBlockId: visible[(index + delta + visible.length) % visible.length],
                });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatch]);

    useEffect(
        () =>
            registerWorkspaceSurfaceModeProvider(tabId, {
                snapshot: () => ({
                    presentation: "os",
                    selectedblockid: stateRef.current.windows[stateRef.current.selectedEntityId ?? ""]
                        ? stateRef.current.selectedEntityId
                        : undefined,
                    selectedobjectid: stateRef.current.objects.some(
                        (object) => object.id === stateRef.current.selectedEntityId
                    )
                        ? stateRef.current.selectedEntityId
                        : undefined,
                    camera: stateRef.current.camera,
                    rects: Object.fromEntries(
                        descriptors.map((block) => [
                            block.blockId,
                            computeOSWindowLayout(stateRef.current, block.blockId, block.view, viewport).bounds,
                        ])
                    ),
                    objects: stateRef.current.objects,
                    scene: stateRef.current.scene,
                    groups: stateRef.current.groups,
                    presentations: Object.fromEntries(
                        descriptors.map((block) => [
                            block.blockId,
                            computeOSWindowLayout(stateRef.current, block.blockId, block.view, viewport).presentation,
                        ])
                    ),
                }),
                control: (input) => {
                    if (input.action === "spatial.open") {
                        if (!input.view) return { success: false, message: "View is required." };
                        handleCreateBlock(input.view);
                        return { success: true, message: `Opening ${input.view}.` };
                    }
                    if (input.action === "spatial.switchWorkspace") {
                        if (!input.workspaceid) return { success: false, message: "Workspace is required." };
                        getApi().switchWorkspace(input.workspaceid);
                        return { success: true, message: "Switching workspace." };
                    }
                    if (input.action === "spatial.openApp") {
                        if (!input.appid) return { success: false, message: "App id is required." };
                        handleCreateAppStream(input.appid, input.appname ?? input.appid);
                        return { success: true, message: `Opening ${input.appname ?? input.appid}.` };
                    }
                    if (input.action === "spatial.setWidgetPresentation") {
                        if (input.presentation !== "canvas" && input.presentation !== "file") {
                            return { success: false, message: "Presentation must be canvas or file." };
                        }
                        dispatch({ type: "spatial.setWidgetPresentation", presentation: input.presentation });
                        return { success: true, message: `Widgets shown as ${input.presentation}.` };
                    }
                    if (input.action === "spatial.openFile") {
                        if (!input.file) return { success: false, message: "File path is required." };
                        void RpcApi.CreateBlockCommand(TabRpcClient, {
                            tabid: tabId,
                            blockdef: { meta: { view: "preview", file: input.file } },
                        });
                        return { success: true, message: `Opening ${input.file}.` };
                    }
                    if (input.action === "spatial.openCommandCenter") {
                        modalsModel.pushModal("CommandPaletteModal");
                        return { success: true, message: "Opened command center." };
                    }
                    if (input.action === "focus" || input.action === "spatial.focus") {
                        if (!input.blockid || !stateRef.current.windows[input.blockid])
                            return { success: false, message: "OS window not found." };
                        dispatch({ type: "spatial.focus", blockId: input.blockid });
                        return { success: true, message: "Focused OS window." };
                    }
                    if (input.action === "move" || input.action === "spatial.move") {
                        if (!input.blockid || input.x == null || input.y == null)
                            return { success: false, message: "Block and coordinates are required." };
                        dispatch({ type: "spatial.move", blockId: input.blockid, x: input.x, y: input.y });
                        return { success: true, message: "Moved OS window." };
                    }
                    if (input.action === "resize" || input.action === "spatial.resize") {
                        if (!input.blockid || input.width == null || input.height == null)
                            return { success: false, message: "Block and size are required." };
                        dispatch({
                            type: "spatial.resize",
                            blockId: input.blockid,
                            width: input.width,
                            height: input.height,
                        });
                        return { success: true, message: "Resized OS window." };
                    }
                    if (input.action === "spatial.dock") {
                        if (!input.blockid || !input.targetblockid)
                            return { success: false, message: "Source and target blocks are required." };
                        dispatch({
                            type: "spatial.dock",
                            blockId: input.blockid,
                            targetBlockId: input.targetblockid,
                            side: input.side === "right" ? "right" : "left",
                        });
                        return { success: true, message: "Docked OS window." };
                    }
                    if (input.action === "spatial.detach") {
                        if (!input.blockid) return { success: false, message: "Block is required." };
                        dispatch({ type: "spatial.detach", blockId: input.blockid });
                        return { success: true, message: "Detached OS window." };
                    }
                    if (input.action === "spatial.collapse" || input.action === "spatial.restore") {
                        if (!input.blockid) return { success: false, message: "Block is required." };
                        dispatch({ type: input.action, blockId: input.blockid });
                        return {
                            success: true,
                            message:
                                input.action === "spatial.collapse" ? "Collapsed OS window." : "Restored OS window.",
                        };
                    }
                    if (input.action === "spatial.showOverview") {
                        dispatch({ type: "spatial.showOverview", selectedBlockId: input.blockid });
                        return { success: true, message: "Showing all OS windows." };
                    }
                    if (input.action === "fit") {
                        fitAll();
                        return { success: true, message: "OS content fitted." };
                    }
                    if (input.action === "add_note") {
                        addObject("note", input.text);
                        return { success: true, message: "Created OS note." };
                    }
                    if (input.action === "delete_object" && input.objectid) {
                        deleteObject(input.objectid);
                        return { success: true, message: "Deleted OS object." };
                    }
                    if (input.action === "update_object" && input.objectid) {
                        updateObject(input.objectid, {
                            x: input.x,
                            y: input.y,
                            width: input.width,
                            height: input.height,
                            text: input.text,
                            color: input.color as OSCanvasColor,
                        });
                        return { success: true, message: "Updated OS object." };
                    }
                    return { success: false, message: `Unsupported OS action: ${input.action}` };
                },
            }),
        [addObject, deleteObject, descriptors, dispatch, fitAll, handleCreateAppStream, handleCreateBlock, tabId, updateObject, viewport]
    );

    const activeGroup = state.scene.kind === "grouped" ? state.groups[state.scene.groupId] : undefined;
    const liveAgentActivities = useAtomValue(osAgentActivitiesAtom);
    const agentWorkingViews = useMemo(() => {
        const views = new Set<string>();
        for (const activity of liveAgentActivities) {
            if (isAgentActivityActive(activity.phase)) {
                const view = AgentSurfaceToView[activity.surface];
                if (view != null) views.add(view);
            }
        }
        return views;
    }, [liveAgentActivities]);
    const worldTransform =
        state.scene.kind === "freeform"
            ? `translate3d(${state.camera.x}px, ${state.camera.y}px, 0) scale(${state.camera.zoom})`
            : "translate3d(0, 0, 0) scale(1)";
    const connectorObjects = state.objects.filter((object) => object.kind === "connector");

    return (
        <div
            ref={rootRef}
            className={cn("os-mode-root", `scene-${state.scene.kind}`, reducedMotion && "reduced-motion")}
            tabIndex={-1}
            onPointerMove={handleRootPointerMove}
            onPointerUp={handleRootPointerUp}
            onPointerCancel={handleRootPointerUp}
            onWheel={handleWheel}
        >
            <WorkspaceWallpaper />
            <div className="os-wallpaper-fallback" aria-hidden="true" />
            <OSModeShell
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspace?.oid ?? ""}
                blocks={descriptors}
                collapsedIds={blockIds.filter((id) => state.windows[id]?.collapsed)}
                sceneKind={state.scene.kind}
                onWorkspace={(workspaceId) => getApi().switchWorkspace(workspaceId)}
                onCreateWorkspace={() => getApi().createWorkspace()}
                onCreateBlock={handleCreateBlock}
                onRestore={(blockId) => dispatch({ type: "spatial.restore", blockId })}
                onOverview={() => dispatch({ type: "spatial.showOverview" })}
                onFreeform={() => dispatch({ type: "spatial.freeform" })}
                onPresentation={handlePresentation}
                activeBlockId={state.scene.kind === "focused" ? state.scene.blockId : state.selectedEntityId}
                widgetPresentation={state.widgetPresentation}
                onSetWidgetPresentation={(presentation) =>
                    dispatch({ type: "spatial.setWidgetPresentation", presentation })
                }
                onFocusApp={(blockId) => dispatch({ type: "spatial.focus", blockId })}
                onCreateAppStream={handleCreateAppStream}
            />
            <OSAppStreamRail
                blocks={descriptors.filter((descriptor) => !state.windows[descriptor.blockId]?.collapsed)}
                activeBlockId={state.scene.kind === "focused" ? state.scene.blockId : state.selectedEntityId}
                onFocusBlock={(blockId) => dispatch({ type: "spatial.focus", blockId })}
            />
            <OSAppIconRail installedApps={installedDescriptorsWithRunning} onLaunchApp={launchAppDescriptor} />
            {state.widgetPresentation === "file" && (
                <OSWidgetsFileView
                    blocks={descriptors.map((descriptor) => ({
                        ...descriptor,
                        collapsed: state.windows[descriptor.blockId]?.collapsed,
                    }))}
                    onFocusBlock={(blockId) => dispatch({ type: "spatial.focus", blockId })}
                    onCollapseBlock={(blockId) => dispatch({ type: "spatial.collapse", blockId })}
                />
            )}
            <div
                className="os-mode-viewport"
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(OSAppDragMimeType)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                    }
                }}
                onDrop={(event) => {
                    const payload = readOSAppDragPayload(event.dataTransfer);
                    if (payload == null) return;
                    event.preventDefault();
                    const camera = stateRef.current.camera;
                    const worldX = Math.max(16, (event.clientX - camera.x) / camera.zoom - 260);
                    const worldY = Math.max(96, (event.clientY - camera.y) / camera.zoom - 30);
                    handleDropApp(payload, worldX, worldY);
                }}
                onPointerDown={(event) => {
                    if (
                        state.scene.kind !== "freeform" ||
                        event.target !== event.currentTarget ||
                        (tool !== "hand" && event.button !== 1)
                    )
                        return;
                    panRef.current = {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                        x: state.camera.x,
                        y: state.camera.y,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
            >
                <div className="os-mode-world" style={{ transform: worldTransform }}>
                    {state.scene.kind === "freeform" && (
                        <>
                            <svg className="os-connectors" aria-hidden="true">
                                {connectorObjects.map((connector) => {
                                    const from = state.objects.find((object) => object.id === connector.fromObjectId);
                                    const to = state.objects.find((object) => object.id === connector.toObjectId);
                                    if (!from || !to) return null;
                                    return (
                                        <line
                                            key={connector.id}
                                            x1={from.x + from.width / 2}
                                            y1={from.y + from.height / 2}
                                            x2={to.x + to.width / 2}
                                            y2={to.y + to.height / 2}
                                        />
                                    );
                                })}
                            </svg>
                            {state.objects.map((object) => (
                                <OSCanvasEntity
                                    key={object.id}
                                    object={object}
                                    selected={state.selectedEntityId === object.id}
                                    zoom={state.camera.zoom}
                                    onSelect={(id) => {
                                        if (tool === "connector") {
                                            if (!connectorStartId) {
                                                setConnectorStartId(id);
                                                setAndPersist((current) => ({ ...current, selectedEntityId: id }));
                                                return;
                                            }
                                            if (connectorStartId !== id) {
                                                setAndPersist((current) => ({
                                                    ...current,
                                                    objects: [
                                                        ...current.objects,
                                                        {
                                                            id: `connector-${crypto.randomUUID()}`,
                                                            kind: "connector",
                                                            x: 0,
                                                            y: 0,
                                                            width: 1,
                                                            height: 1,
                                                            fromObjectId: connectorStartId,
                                                            toObjectId: id,
                                                        },
                                                    ],
                                                    selectedEntityId: id,
                                                }));
                                            }
                                            setConnectorStartId(undefined);
                                            setTool("select");
                                            return;
                                        }
                                        setAndPersist((current) => ({ ...current, selectedEntityId: id }));
                                    }}
                                    onMove={(id, x, y) => updateObject(id, { x, y })}
                                    onResize={(id, width, height) => updateObject(id, { width, height })}
                                    onDelete={deleteObject}
                                />
                            ))}
                        </>
                    )}
                    {descriptors.map((descriptor) => {
                        const layout = windowLayouts[descriptor.blockId];
                        const docked = Object.values(state.groups).some(
                            (group) => group.sideBlockId === descriptor.blockId
                        );
                        return (
                            <OSBlockWindow
                                key={descriptor.blockId}
                                descriptor={descriptor}
                                layout={layout}
                                selected={
                                    state.selectedEntityId === descriptor.blockId ||
                                    (state.scene.kind === "overview" &&
                                        state.scene.selectedBlockId === descriptor.blockId)
                                }
                                docked={docked}
                                agentWorking={agentWorkingViews.has(descriptor.view)}
                                reducedMotion={reducedMotion}
                                onFocus={focusBlock}
                                onTitlePointerDown={(event, blockId, nextLayout) =>
                                    beginWindowInteraction(event, blockId, nextLayout, "move")
                                }
                                onResizePointerDown={(event, blockId, nextLayout) =>
                                    beginWindowInteraction(event, blockId, nextLayout, "resize")
                                }
                                onClose={handleClose}
                                onCollapse={(blockId) => dispatch({ type: "spatial.collapse", blockId })}
                                onToggleFocus={(blockId) =>
                                    state.scene.kind === "focused" && state.scene.blockId === blockId
                                        ? dispatch({ type: "spatial.freeform" })
                                        : dispatch({ type: "spatial.focus", blockId })
                                }
                                onDock={dockBlock}
                                onDetach={(blockId) => dispatch({ type: "spatial.detach", blockId })}
                            />
                        );
                    })}
                </div>
                {dockPreview && (
                    <div
                        className={cn("os-dock-preview", `is-${dockPreview.side}`)}
                        style={{
                            top: dockPreview.targetBounds.y,
                            left:
                                dockPreview.side === "left"
                                    ? dockPreview.targetBounds.x
                                    : dockPreview.targetBounds.x + dockPreview.targetBounds.width / 2,
                            width: dockPreview.targetBounds.width / 2,
                            height: dockPreview.targetBounds.height,
                        }}
                    >
                        <span>
                            Dock {dockPreview.side} of {dockPreview.targetTitle}
                        </span>
                    </div>
                )}
                {activeGroup && (
                    <OSGroupDivider
                        group={activeGroup}
                        viewport={viewport}
                        onRatio={(dividerRatio) =>
                            dispatch({ type: "spatial.setDivider", groupId: activeGroup.id, dividerRatio })
                        }
                    />
                )}
            </div>
            {state.scene.kind === "freeform" && (
                <OSCanvasToolbar
                    tool={tool}
                    onTool={(nextTool) => {
                        setTool(nextTool);
                        if (nextTool !== "connector") setConnectorStartId(undefined);
                        if (["note", "rectangle", "ellipse", "diamond"].includes(nextTool))
                            addObject(nextTool as OSCanvasObjectKind);
                    }}
                    onFit={fitAll}
                />
            )}
            <OSAgentActivityPanel onFocusBlock={(blockId) => dispatch({ type: "spatial.focus", blockId })} />
            <button type="button" className="os-worker-pill" onClick={() => handleCreateBlock("chathubv2")}>
                <span className="os-worker-avatar">
                    <Bot />
                </span>
                <span>New Worker</span>
                <ChevronDown />
            </button>
        </div>
    );
}

export { OSModeView };
