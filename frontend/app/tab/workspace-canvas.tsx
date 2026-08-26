// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block as BlockView } from "@/app/block/block";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { atoms, createBlock } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { NodeModel } from "@/layout/lib/types";
import * as services from "@/store/services";
import * as WOS from "@/store/wos";
import { makeIconClass } from "@/util/util";
import { atom, useAtom, useAtomValue } from "jotai";
import {
    ArrowUpRight,
    Bookmark,
    Bot,
    Circle,
    Diamond,
    GitFork,
    GripHorizontal,
    Hand,
    LayoutGrid,
    MousePointer2,
    Network,
    Pencil,
    RotateCcw,
    Scan,
    Search,
    Square,
    StickyNote,
    Target,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";
import { isAgentActivityActive, subscribeAgentActivityStream } from "../../types/agent-activity";
import {
    agentActivityCardId,
    agentCardSizeForActivity,
    makeCanvasRequestCard,
    resolveAgentActivityContextIds,
    shouldRecordAgentActivity,
    toComposerContextNode,
    toggleCanvasContextSelection,
    updateCanvasRequestPhase,
    upsertAgentActivityCard,
    WorkspaceAgentCardSize,
    type CanvasComposerContextNode,
    type WorkspaceCanvasAgentCard,
} from "./workspace-canvas-agent";
import {
    WorkspaceCanvasClearContextEvent,
    workspaceCanvasComposerContextAtom,
    WorkspaceCanvasComposerSubmitEvent,
    type WorkspaceCanvasComposerSubmit,
} from "./workspace-canvas-context";
import {
    centerWorkspaceCanvasCamera,
    decayWorkspaceCanvasVelocity,
    findDirectionalWorkspaceCanvasRect,
    findWorkspaceCanvasCluster,
    shouldContinueWorkspaceCanvasMomentum,
    snapWorkspaceCanvasRect,
    workspaceCanvasEdgePanDelta,
    workspaceCanvasViewportRect,
} from "./workspace-canvas-drift";
import { aggregateWorkspaceCanvasRuns, type WorkspaceCanvasRunAggregate } from "./workspace-canvas-task-graph";
import {
    canvasBoundsForRects,
    clampCanvasZoom,
    findNonOverlappingCanvasRect,
    fitCanvasCameraToBounds,
    isCanvasShortcutInteractiveTarget,
    makeViewportCenteredCanvasRect,
    screenPointToCanvas,
    zoomCanvasCameraAtPoint,
    type WorkspaceCanvasCamera,
    type WorkspaceCanvasPoint,
    type WorkspaceCanvasRect,
    type WorkspaceCanvasSize,
} from "./workspace-canvas-utils";
import "./workspace-canvas.scss";
import { registerWorkspaceSurfaceModeProvider } from "./workspace-surface-runtime";

const DefaultCamera: WorkspaceCanvasCamera = { x: 80, y: 70, zoom: 0.9 };
const DefaultWidgetSize: WorkspaceCanvasSize = { width: 840, height: 540 };
const DefaultNoteSize: WorkspaceCanvasSize = { width: 240, height: 176 };
const CanvasSaveDelayMs = 180;
const CanvasChromeEnabled = false;

type WorkspaceCanvasTool = "select" | "hand" | "note" | "rectangle" | "ellipse" | "diamond" | "connector" | "draw";

const WidgetMenuGroups = ["Work", "Web", "System", "Custom"] as const;
type WidgetMenuGroup = (typeof WidgetMenuGroups)[number];
const CanvasPrimaryDockViews = ["chathubv2", "term", "preview", "web"];

type WorkspaceCanvasObjectKind = "note" | "rectangle" | "ellipse" | "diamond" | "connector" | "draw";
type WorkspaceCanvasColor = "amber" | "blue" | "green" | "rose" | "slate";

type WorkspaceCanvasPrimitiveObject = WorkspaceCanvasRect & {
    id: string;
    kind: WorkspaceCanvasObjectKind;
    text?: string;
    color?: WorkspaceCanvasColor;
    points?: WorkspaceCanvasPoint[];
};

type WorkspaceCanvasObject = WorkspaceCanvasPrimitiveObject | WorkspaceCanvasAgentCard;

type WorkspaceCanvasState = {
    version?: number;
    camera?: WorkspaceCanvasCamera;
    rects?: Record<string, WorkspaceCanvasRect>;
    objects?: WorkspaceCanvasObject[];
    bookmarks?: Record<string, WorkspaceCanvasCamera>;
};

function widgetMenuGroup(key: string, widget: WidgetConfigType): WidgetMenuGroup {
    const view = widget.blockdef?.meta?.view ?? "";
    if (view === "web") {
        return "Web";
    }
    if (["installedapps", "sandbox", "sysinfo", "kronsettings", "waveconfig", "help", "tips"].includes(view)) {
        return "System";
    }
    if (
        key.startsWith("defwidget@") ||
        ["term", "preview", "chathubv2", "waveai", "kronoschat", "vdom"].includes(view)
    ) {
        return "Work";
    }
    return "Custom";
}

function canvasSurfaceForView(view: string): CanvasComposerContextNode["surface"] {
    if (view === "web") {
        return "browser";
    }
    if (view === "sandbox" || view === "installedapps") {
        return "sandbox";
    }
    if (view === "term") {
        return "terminal";
    }
    if (view === "preview" || view === "aifilediff") {
        return "file";
    }
    return "panel";
}

type CanvasInteraction =
    | {
          kind: "pan";
          pointerId: number;
          startClient: WorkspaceCanvasPoint;
          startCamera: WorkspaceCanvasCamera;
          lastClient: WorkspaceCanvasPoint;
          lastTime: number;
          velocity: WorkspaceCanvasPoint;
      }
    | {
          kind: "create";
          pointerId: number;
          objectId: string;
          tool: Exclude<WorkspaceCanvasTool, "select" | "hand" | "note">;
          startPoint: WorkspaceCanvasPoint;
      }
    | {
          kind: "move-object";
          pointerId: number;
          objectId: string;
          startClient: WorkspaceCanvasPoint;
          startObject: WorkspaceCanvasObject;
      }
    | {
          kind: "resize-object";
          pointerId: number;
          objectId: string;
          startClient: WorkspaceCanvasPoint;
          startObject: WorkspaceCanvasObject;
      };

type CanvasNodeProps = {
    blockId: string;
    contextSelected: boolean;
    index: number;
    rect: WorkspaceCanvasRect;
    selected: boolean;
    clustered: boolean;
    expanded: boolean;
    zoom: number;
    camera: WorkspaceCanvasCamera;
    viewportSize: WorkspaceCanvasSize;
    onSelect: (blockId: string) => void;
    onShowContextMenu: (
        event: ReactMouseEvent<HTMLDivElement>,
        blockId: string,
        title: string,
        viewType: string
    ) => void;
    onRectChange: (
        blockId: string,
        rect: WorkspaceCanvasRect,
        affectCluster?: boolean,
        interaction?: "move" | "resize"
    ) => void;
    onToggleExpand: (blockId: string) => void;
    onEdgePan: (clientX: number, clientY: number) => WorkspaceCanvasPoint;
};

function readCanvasState(tabData: Tab): WorkspaceCanvasState {
    const meta = (tabData as any)?.meta as Record<string, any> | undefined;
    return (meta?.["layout:canvas"] ?? {}) as WorkspaceCanvasState;
}

function makeObjectId(kind: WorkspaceCanvasObjectKind): string {
    return `${kind}-${crypto.randomUUID()}`;
}

function normalizeObjectRect(object: WorkspaceCanvasObject): WorkspaceCanvasObject {
    if (object.kind === "connector" || object.kind === "draw") {
        return object;
    }
    return {
        ...object,
        x: object.width < 0 ? object.x + object.width : object.x,
        y: object.height < 0 ? object.y + object.height : object.y,
        width: Math.max(24, Math.abs(object.width)),
        height: Math.max(24, Math.abs(object.height)),
    };
}

function objectBounds(object: WorkspaceCanvasObject): WorkspaceCanvasRect {
    if (object.kind === "draw" && object.points?.length) {
        const minX = Math.min(...object.points.map((point) => point.x));
        const minY = Math.min(...object.points.map((point) => point.y));
        const maxX = Math.max(...object.points.map((point) => point.x));
        const maxY = Math.max(...object.points.map((point) => point.y));
        return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
    }
    if (object.kind === "connector") {
        return {
            x: Math.min(object.x, object.x + object.width),
            y: Math.min(object.y, object.y + object.height),
            width: Math.max(1, Math.abs(object.width)),
            height: Math.max(1, Math.abs(object.height)),
        };
    }
    return normalizeObjectRect(object);
}

function translateCanvasObject(object: WorkspaceCanvasObject, delta: WorkspaceCanvasPoint): WorkspaceCanvasObject {
    return {
        ...object,
        x: object.x + delta.x,
        y: object.y + delta.y,
        ...("points" in object && object.points
            ? {
                  points: object.points.map((point) => ({
                      x: point.x + delta.x,
                      y: point.y + delta.y,
                  })),
              }
            : {}),
    };
}

function canvasObjectLabel(object: WorkspaceCanvasObject): string {
    if (object.kind === "agent") {
        return `${object.agent.title}, ${object.agent.phase.replace("-", " ")}`;
    }
    if (object.kind === "note") {
        return object.text?.trim() ? `Note: ${object.text.trim().slice(0, 72)}` : "Empty note";
    }
    if (object.kind === "draw") {
        return "Freehand drawing";
    }
    if (object.kind === "connector") {
        return "Connector";
    }
    return `${object.kind} ${object.text?.trim() || "shape"}`;
}

function sameComposerContextNodes(left: CanvasComposerContextNode[], right: CanvasComposerContextNode[]): boolean {
    return (
        left.length === right.length &&
        left.every((node, index) => {
            const candidate = right[index];
            return (
                candidate != null &&
                node.id === candidate.id &&
                node.action === candidate.action &&
                node.blockid === candidate.blockid &&
                node.detail === candidate.detail &&
                node.phase === candidate.phase &&
                node.previewimageurl === candidate.previewimageurl &&
                node.surface === candidate.surface &&
                node.title === candidate.title &&
                node.verificationstatus === candidate.verificationstatus &&
                (node.reasoningsteps ?? []).join("\n") === (candidate.reasoningsteps ?? []).join("\n")
            );
        })
    );
}

const WorkspaceCanvasNode = memo(
    ({
        blockId,
        contextSelected,
        index,
        rect,
        selected,
        clustered,
        expanded,
        zoom,
        camera,
        viewportSize,
        onSelect,
        onShowContextMenu,
        onRectChange,
        onToggleExpand,
        onEdgePan,
    }: CanvasNodeProps) => {
        const dragStartRef = useRef<{
            x: number;
            y: number;
            rect: WorkspaceCanvasRect;
            moveCluster: boolean;
            edgeOffset: WorkspaceCanvasPoint;
        } | null>(null);
        const resizeStartRef = useRef<{
            x: number;
            y: number;
            rect: WorkspaceCanvasRect;
            resizeCluster: boolean;
        } | null>(null);
        const onSelectRef = useRef(onSelect);
        const onToggleExpandRef = useRef(onToggleExpand);
        onSelectRef.current = onSelect;
        onToggleExpandRef.current = onToggleExpand;
        const blockAtom = useMemo(() => WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)), [blockId]);
        const blockData = useAtomValue(blockAtom);
        const viewType = (blockData?.meta?.view as string | undefined) || "widget";
        const title = viewType === "term" ? "Terminal" : `${viewType.charAt(0).toUpperCase()}${viewType.slice(1)}`;
        const expandedSize = {
            width: Math.max(400, viewportSize.width - 24),
            height: Math.max(300, viewportSize.height - 24),
        };
        const [modelAtoms] = useState(() => ({
            innerRect: atom({ width: `${rect.width}px`, height: `${rect.height}px` }),
            blockNum: atom(index + 1),
            isFocused: atom(selected),
            isMagnified: atom(expanded),
            anyMagnified: atom(expanded),
        }));
        const nodeModel = useMemo<NodeModel>(() => {
            return {
                additionalProps: atom({}),
                innerRect: modelAtoms.innerRect,
                blockNum: modelAtoms.blockNum,
                numLeafs: atom(1),
                nodeId: `canvas-${blockId}`,
                blockId,
                addEphemeralNodeToLayout: () => {},
                animationTimeS: atom(0),
                isResizing: atom(false),
                isFocused: modelAtoms.isFocused,
                isMagnified: modelAtoms.isMagnified,
                isFolded: atom(false),
                anyMagnified: modelAtoms.anyMagnified,
                isEphemeral: atom(false),
                ready: atom(true),
                disablePointerEvents: atom(false),
                toggleMagnify: () => onToggleExpandRef.current(blockId),
                toggleFold: () => {},
                focusNode: () => onSelectRef.current(blockId),
                onClose: () => services.ObjectService.DeleteBlock(blockId),
                dragHandleRef: { current: null },
                displayContainerRef: { current: null },
            } as unknown as NodeModel;
        }, [blockId, modelAtoms]);

        useEffect(() => {
            const size = expanded ? expandedSize : rect;
            globalStore.set(modelAtoms.innerRect, {
                width: `${size.width}px`,
                height: `${size.height}px`,
            });
            globalStore.set(modelAtoms.blockNum, index + 1);
            globalStore.set(modelAtoms.isFocused, selected);
            globalStore.set(modelAtoms.isMagnified, expanded);
            globalStore.set(modelAtoms.anyMagnified, expanded);
        }, [expanded, expandedSize.height, expandedSize.width, index, modelAtoms, rect.height, rect.width, selected]);

        const onPointerMove = useCallback(
            (event: PointerEvent) => {
                if (dragStartRef.current) {
                    const start = dragStartRef.current;
                    const edgeOffset = onEdgePan(event.clientX, event.clientY);
                    start.edgeOffset = {
                        x: start.edgeOffset.x + edgeOffset.x,
                        y: start.edgeOffset.y + edgeOffset.y,
                    };
                    onRectChange(
                        blockId,
                        {
                            ...start.rect,
                            x: start.rect.x + (event.clientX - start.x) / zoom + start.edgeOffset.x,
                            y: start.rect.y + (event.clientY - start.y) / zoom + start.edgeOffset.y,
                        },
                        start.moveCluster,
                        "move"
                    );
                    return;
                }
                if (resizeStartRef.current) {
                    const start = resizeStartRef.current;
                    onRectChange(
                        blockId,
                        {
                            ...start.rect,
                            width: Math.max(400, start.rect.width + (event.clientX - start.x) / zoom),
                            height: Math.max(300, start.rect.height + (event.clientY - start.y) / zoom),
                        },
                        start.resizeCluster,
                        "resize"
                    );
                }
            },
            [blockId, onEdgePan, onRectChange, zoom]
        );

        const onPointerUp = useCallback(() => {
            dragStartRef.current = null;
            resizeStartRef.current = null;
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        }, [onPointerMove]);

        const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
            if (expanded) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onSelect(blockId);
            dragStartRef.current = {
                x: event.clientX,
                y: event.clientY,
                rect,
                moveCluster: event.shiftKey,
                edgeOffset: { x: 0, y: 0 },
            };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
            if (expanded) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onSelect(blockId);
            resizeStartRef.current = {
                x: event.clientX,
                y: event.clientY,
                rect,
                resizeCluster: event.shiftKey,
            };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        return (
            <div
                className={`workspace-canvas-node ${selected ? "is-selected" : ""} ${clustered ? "is-clustered" : ""} ${
                    contextSelected ? "is-context-selected" : ""
                } ${expanded ? "is-expanded" : ""}`}
                style={
                    expanded
                        ? {
                              left: (12 - camera.x) / zoom,
                              top: (12 - camera.y) / zoom,
                              width: expandedSize.width,
                              height: expandedSize.height,
                              transform: `scale(${1 / zoom})`,
                              transformOrigin: "top left",
                          }
                        : {
                              left: rect.x,
                              top: rect.y,
                              width: rect.width,
                              height: rect.height,
                          }
                }
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(blockId);
                }}
                onContextMenu={(event) => onShowContextMenu(event, blockId, title, viewType)}
                onWheel={(event) => event.stopPropagation()}
            >
                <div
                    className="workspace-canvas-node-handle"
                    onPointerDown={startDrag}
                    title={`Move ${title} widget`}
                    aria-hidden="true"
                >
                    <GripHorizontal aria-hidden="true" />
                </div>
                <div className="workspace-canvas-node-content">
                    <BlockView key={blockId} nodeModel={nodeModel} preview={false} />
                </div>
                {!expanded ? (
                    <div
                        className="workspace-canvas-node-resize"
                        onPointerDown={startResize}
                        title="Resize widget"
                        aria-label="Resize widget"
                    />
                ) : null}
            </div>
        );
    }
);
WorkspaceCanvasNode.displayName = "WorkspaceCanvasNode";

type CanvasObjectViewProps = {
    contextSelected: boolean;
    object: WorkspaceCanvasObject;
    selected: boolean;
    tool: WorkspaceCanvasTool;
    onSelect: (id: string, additive?: boolean) => void;
    onStartMove: (event: ReactPointerEvent<HTMLElement>, object: WorkspaceCanvasObject) => void;
    onStartResize: (event: ReactPointerEvent<HTMLElement>, object: WorkspaceCanvasObject) => void;
    onChange: (object: WorkspaceCanvasObject) => void;
    onShowContextMenu: (event: ReactMouseEvent<HTMLElement>, object: WorkspaceCanvasAgentCard) => void;
};

const CanvasObjectView = memo(
    ({
        contextSelected,
        object,
        selected,
        tool,
        onSelect,
        onStartMove,
        onStartResize,
        onChange,
        onShowContextMenu,
    }: CanvasObjectViewProps) => {
        if (object.kind === "connector") {
            const bounds = objectBounds(object);
            const startX = object.x - bounds.x;
            const startY = object.y - bounds.y;
            const endX = startX + object.width;
            const endY = startY + object.height;
            return (
                <svg
                    className={`workspace-canvas-connector ${selected ? "is-selected" : ""}`}
                    style={{
                        left: bounds.x - 12,
                        top: bounds.y - 12,
                        width: bounds.width + 24,
                        height: bounds.height + 24,
                    }}
                    viewBox={`-12 -12 ${bounds.width + 24} ${bounds.height + 24}`}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onSelect(object.id);
                        if (tool === "select") {
                            onStartMove(event as unknown as ReactPointerEvent<HTMLElement>, object);
                        }
                    }}
                >
                    <defs>
                        <marker
                            id={`arrow-${object.id}`}
                            markerWidth="8"
                            markerHeight="8"
                            refX="6"
                            refY="3"
                            orient="auto"
                        >
                            <path d="M0,0 L0,6 L7,3 z" />
                        </marker>
                    </defs>
                    <line x1={startX} y1={startY} x2={endX} y2={endY} markerEnd={`url(#arrow-${object.id})`} />
                </svg>
            );
        }

        if (object.kind === "draw") {
            const bounds = objectBounds(object);
            const points = object.points ?? [];
            const path = points
                .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x - bounds.x} ${point.y - bounds.y}`)
                .join(" ");
            return (
                <svg
                    className={`workspace-canvas-drawing ${selected ? "is-selected" : ""}`}
                    style={{
                        left: bounds.x - 10,
                        top: bounds.y - 10,
                        width: bounds.width + 20,
                        height: bounds.height + 20,
                    }}
                    viewBox={`-10 -10 ${bounds.width + 20} ${bounds.height + 20}`}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onSelect(object.id);
                        if (tool === "select") {
                            onStartMove(event as unknown as ReactPointerEvent<HTMLElement>, object);
                        }
                    }}
                >
                    <path d={path} />
                </svg>
            );
        }

        if (object.kind === "agent") {
            const active = isAgentActivityActive(object.agent.phase);
            const reasoningSteps = object.agent.reasoningsteps?.slice(-2) ?? [];
            if (object.agent.nodekind === "evidence" && object.agent.previewimageurl) {
                return (
                    <figure
                        className={`workspace-canvas-agent-evidence ${selected ? "is-selected" : ""} ${
                            contextSelected ? "is-context-selected" : ""
                        }`}
                        style={{ left: object.x, top: object.y, width: object.width, height: object.height }}
                        tabIndex={0}
                        aria-label={`${object.agent.title}, ${object.agent.phase}. ${object.agent.detail}`}
                        onPointerDown={(event) => {
                            event.stopPropagation();
                            onSelect(object.id, event.shiftKey || event.metaKey);
                            if (tool === "select") {
                                onStartMove(event, object);
                            }
                        }}
                        onContextMenu={(event) => onShowContextMenu(event, object)}
                        onWheel={(event) => event.stopPropagation()}
                    >
                        <img
                            src={object.agent.previewimageurl}
                            alt={`${object.agent.title}: ${object.agent.detail}`}
                            draggable={false}
                        />
                        {selected ? (
                            <button
                                type="button"
                                className="workspace-canvas-object-resize"
                                onPointerDown={(event) => onStartResize(event, object)}
                                aria-label="Resize task evidence image"
                            />
                        ) : null}
                    </figure>
                );
            }
            return (
                <article
                    className={`workspace-canvas-agent-card is-${object.agent.phase} ${
                        selected ? "is-selected" : ""
                    } ${contextSelected ? "is-context-selected" : ""} is-node-${object.agent.nodekind}`}
                    style={{ left: object.x, top: object.y, width: object.width, height: object.height }}
                    tabIndex={0}
                    aria-label={`${object.agent.title}, ${object.agent.phase}. ${object.agent.detail}`}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onSelect(object.id, event.shiftKey || event.metaKey);
                    }}
                    onContextMenu={(event) => onShowContextMenu(event, object)}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        onSelect(object.id, event.shiftKey || event.metaKey);
                    }}
                    onWheel={(event) => event.stopPropagation()}
                >
                    <div
                        className="workspace-canvas-agent-card-header"
                        onPointerDown={(event) => {
                            event.stopPropagation();
                            onSelect(object.id, event.shiftKey || event.metaKey);
                            if (tool === "select") {
                                onStartMove(event, object);
                            }
                        }}
                    >
                        <span className="workspace-canvas-agent-card-icon">
                            <Bot />
                        </span>
                        <span className="workspace-canvas-agent-card-heading">
                            <strong>{object.agent.title}</strong>
                            <small>
                                {object.agent.surface} · {object.agent.action}
                            </small>
                        </span>
                        <span className={`workspace-canvas-agent-phase ${active ? "is-active" : ""}`}>
                            <i />
                            {object.agent.phase.replace("-", " ")}
                        </span>
                    </div>
                    <div className="workspace-canvas-agent-card-body">
                        <p>{object.agent.detail}</p>
                        {reasoningSteps.length > 0 ? (
                            <ol>
                                {reasoningSteps.map((step, index) => (
                                    <li key={`${object.id}-reasoning-${index}`}>{step}</li>
                                ))}
                            </ol>
                        ) : null}
                        {object.agent.previewimageurl ? (
                            <img src={object.agent.previewimageurl} alt={`${object.agent.title} preview`} />
                        ) : null}
                    </div>
                    <div className="workspace-canvas-agent-card-footer">
                        <span>{contextSelected ? "In canvas context" : "Select to follow"}</span>
                        <span>
                            {object.agent.verificationstatus
                                ? object.agent.verificationstatus.replace("-", " ")
                                : new Date(object.agent.updatedts).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                  })}
                        </span>
                    </div>
                    {selected ? (
                        <button
                            type="button"
                            className="workspace-canvas-object-resize"
                            onPointerDown={(event) => onStartResize(event, object)}
                            aria-label="Resize agent card"
                        />
                    ) : null}
                </article>
            );
        }

        const rect = normalizeObjectRect(object);
        if (object.kind === "note") {
            return (
                <article
                    className={`workspace-canvas-note is-${object.color ?? "amber"} ${selected ? "is-selected" : ""}`}
                    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onSelect(object.id);
                    }}
                    onWheel={(event) => event.stopPropagation()}
                >
                    <div
                        className="workspace-canvas-note-grip"
                        onPointerDown={(event) => {
                            if (tool === "select") {
                                onStartMove(event, object);
                            }
                        }}
                    >
                        <StickyNote />
                        <span>Sticky note</span>
                    </div>
                    <textarea
                        value={object.text ?? ""}
                        onChange={(event) => onChange({ ...object, text: event.target.value })}
                        onPointerDown={(event) => event.stopPropagation()}
                        placeholder="Write an idea, task, decision, or reminder…"
                        aria-label="Sticky note text"
                    />
                    <div className="workspace-canvas-note-footer">
                        {(["amber", "blue", "green", "rose", "slate"] as WorkspaceCanvasColor[]).map((color) => (
                            <button
                                type="button"
                                key={color}
                                className={`workspace-canvas-color is-${color} ${object.color === color ? "is-active" : ""}`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => onChange({ ...object, color })}
                                aria-label={`Use ${color} note color`}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        className="workspace-canvas-object-resize"
                        onPointerDown={(event) => onStartResize(event, object)}
                        aria-label="Resize sticky note"
                    />
                </article>
            );
        }

        return (
            <div
                className={`workspace-canvas-shape is-${object.kind} is-${object.color ?? "blue"} ${
                    selected ? "is-selected" : ""
                }`}
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(object.id);
                    if (tool === "select") {
                        onStartMove(event, object);
                    }
                }}
            >
                <span
                    contentEditable
                    suppressContentEditableWarning
                    onPointerDown={(event) => event.stopPropagation()}
                    onBlur={(event) => onChange({ ...object, text: event.currentTarget.textContent ?? "" })}
                    aria-label={`${object.kind} label`}
                >
                    {object.text || (object.kind === "diamond" ? "Decision" : "Process")}
                </span>
                {selected ? (
                    <button
                        type="button"
                        className="workspace-canvas-object-resize"
                        onPointerDown={(event) => onStartResize(event, object)}
                        aria-label={`Resize ${object.kind}`}
                    />
                ) : null}
            </div>
        );
    }
);
CanvasObjectView.displayName = "CanvasObjectView";

const AgentLineageEdges = memo(({ objects }: { objects: WorkspaceCanvasObject[] }) => {
    const agentCards = objects.filter((object): object is WorkspaceCanvasAgentCard => object.kind === "agent");
    const cardsById = new Map(agentCards.map((card) => [card.id, card]));
    return (
        <>
            {agentCards.flatMap((card) =>
                (card.agent.contextids ?? []).map((contextId) => {
                    const parent = cardsById.get(contextId);
                    if (!parent) {
                        return null;
                    }
                    const start = { x: parent.x + parent.width, y: parent.y + parent.height / 2 };
                    const end = { x: card.x, y: card.y + card.height / 2 };
                    const left = Math.min(start.x, end.x) - 12;
                    const top = Math.min(start.y, end.y) - 12;
                    const width = Math.max(24, Math.abs(end.x - start.x) + 24);
                    const height = Math.max(24, Math.abs(end.y - start.y) + 24);
                    const relativeStart = { x: start.x - left, y: start.y - top };
                    const relativeEnd = { x: end.x - left, y: end.y - top };
                    const bend = Math.max(48, Math.abs(relativeEnd.x - relativeStart.x) * 0.45);
                    const path = `M ${relativeStart.x} ${relativeStart.y} C ${relativeStart.x + bend} ${
                        relativeStart.y
                    }, ${relativeEnd.x - bend} ${relativeEnd.y}, ${relativeEnd.x} ${relativeEnd.y}`;
                    return (
                        <svg
                            key={`${contextId}-${card.id}`}
                            className={`workspace-canvas-agent-edge ${
                                isAgentActivityActive(card.agent.phase) ? "is-active" : ""
                            }`}
                            style={{ left, top, width, height }}
                            viewBox={`0 0 ${width} ${height}`}
                            aria-hidden
                        >
                            <path d={path} />
                            <circle cx={relativeEnd.x} cy={relativeEnd.y} r="3.5" />
                        </svg>
                    );
                })
            )}
        </>
    );
});
AgentLineageEdges.displayName = "AgentLineageEdges";

const WidgetTaskEdges = memo(
    ({ objects, rects }: { objects: WorkspaceCanvasObject[]; rects: Record<string, WorkspaceCanvasRect> }) => {
        const cards = objects.filter(
            (object): object is WorkspaceCanvasAgentCard => object.kind === "agent" && Boolean(object.agent.blockid)
        );
        return (
            <>
                {cards.map((card) => {
                    const widgetRect = card.agent.blockid ? rects[card.agent.blockid] : undefined;
                    if (!widgetRect) {
                        return null;
                    }
                    const start = { x: widgetRect.x + widgetRect.width, y: widgetRect.y + widgetRect.height / 2 };
                    const end = { x: card.x, y: card.y + card.height / 2 };
                    const left = Math.min(start.x, end.x) - 12;
                    const top = Math.min(start.y, end.y) - 12;
                    const width = Math.max(24, Math.abs(end.x - start.x) + 24);
                    const height = Math.max(24, Math.abs(end.y - start.y) + 24);
                    const startX = start.x - left;
                    const startY = start.y - top;
                    const endX = end.x - left;
                    const endY = end.y - top;
                    const bend = Math.max(48, Math.abs(endX - startX) * 0.45);
                    return (
                        <svg
                            key={`widget-edge:${card.agent.blockid}:${card.id}`}
                            className="workspace-canvas-agent-edge is-widget-edge"
                            style={{ left, top, width, height }}
                            viewBox={`0 0 ${width} ${height}`}
                            aria-hidden="true"
                        >
                            <path
                                d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`}
                            />
                            <circle cx={endX} cy={endY} r="3.5" />
                        </svg>
                    );
                })}
            </>
        );
    }
);
WidgetTaskEdges.displayName = "WidgetTaskEdges";

const WorkspaceCanvasBatchPanel = memo(
    ({
        run,
        onFocusCurrent,
        onOpenOutputs,
    }: {
        run: WorkspaceCanvasRunAggregate;
        onFocusCurrent: () => void;
        onOpenOutputs: () => void;
    }) => {
        const [collapsed, setCollapsed] = useState(false);
        const title =
            run.cards.find((card) => card.agent.nodekind === "request")?.agent.detail ||
            run.current?.agent.detail ||
            run.cards[0]?.agent.detail ||
            "Kronos task";
        return (
            <aside
                className={`workspace-canvas-batch-panel ${collapsed ? "is-collapsed" : ""}`}
                data-canvas-overlay
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
                aria-label="KronosChamber batch job"
            >
                <header>
                    <span>
                        <i className={makeIconClass("sparkles", true)} aria-hidden="true" />
                        <strong>KronosChamber · Batch job</strong>
                    </span>
                    <button
                        type="button"
                        onClick={() => setCollapsed((value) => !value)}
                        aria-expanded={!collapsed}
                        title={collapsed ? "Expand batch job" : "Collapse batch job"}
                    >
                        <i className={makeIconClass(collapsed ? "chevron-up" : "chevron-down", true)} />
                    </button>
                </header>
                {!collapsed ? (
                    <>
                        <div className="workspace-canvas-batch-body">
                            <h3>{title}</h3>
                            <ol>
                                {run.cards.map((card) => (
                                    <li key={card.id} className={`is-${card.agent.phase}`}>
                                        <i
                                            className={makeIconClass(
                                                card.agent.phase === "succeeded"
                                                    ? "circle-check"
                                                    : isAgentActivityActive(card.agent.phase)
                                                      ? "circle-notch+spin"
                                                      : "clock",
                                                true
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span>{card.agent.title}</span>
                                        <small>{card.agent.phase.replace("-", " ")}</small>
                                    </li>
                                ))}
                            </ol>
                            <div className="workspace-canvas-batch-progress">
                                <span>
                                    {run.completed} of {run.total} jobs · {run.progress}%
                                </span>
                                <i style={{ width: `${run.progress}%` }} />
                            </div>
                        </div>
                        <footer>
                            <button type="button" onClick={onFocusCurrent} disabled={!run.current}>
                                Focus current
                            </button>
                            <button type="button" onClick={onOpenOutputs}>
                                <i className={makeIconClass("folder-open", true)} aria-hidden="true" />
                                Open outputs
                            </button>
                        </footer>
                    </>
                ) : null}
            </aside>
        );
    }
);
WorkspaceCanvasBatchPanel.displayName = "WorkspaceCanvasBatchPanel";

const ToolDefinitions: Array<{
    id: WorkspaceCanvasTool;
    label: string;
    shortcut: string;
    icon: typeof MousePointer2;
}> = [
    { id: "select", label: "Select and move", shortcut: "V", icon: MousePointer2 },
    { id: "hand", label: "Pan canvas", shortcut: "H", icon: Hand },
    { id: "note", label: "Sticky note", shortcut: "N", icon: StickyNote },
    { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
    { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
    { id: "diamond", label: "Decision", shortcut: "D", icon: Diamond },
    { id: "connector", label: "Connector", shortcut: "C", icon: ArrowUpRight },
    { id: "draw", label: "Freehand draw", shortcut: "P", icon: Pencil },
];

export const WorkspaceCanvas = memo(({ tabId, tabData }: { tabId: string; tabData: Tab }) => {
    const canvasState = readCanvasState(tabData);
    const storedObjects = canvasState.objects ?? [];
    const initialObjects = storedObjects.filter(
        (object) => object.kind !== "agent" || !object.agent.runid.startsWith("example-research:")
    );
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const [composerContext, setComposerContext] = useAtom(workspaceCanvasComposerContextAtom);
    const viewportRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<CanvasInteraction | null>(null);
    const persistTimerRef = useRef<number | null>(null);
    const momentumFrameRef = useRef<number | null>(null);
    const pendingRequestRef = useRef<string | null>(null);
    const activityRunAliasesRef = useRef(new Map<string, string>());
    const removedLegacyDemoRef = useRef(initialObjects.length !== storedObjects.length);
    const spacePressedRef = useRef(false);
    const [viewportSize, setViewportSize] = useState<WorkspaceCanvasSize>({ width: 0, height: 0 });
    const viewportSizeRef = useRef(viewportSize);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(tabData.blockids?.[0] ?? null);
    const selectedBlockIdRef = useRef(selectedBlockId);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const selectedObjectIdRef = useRef(selectedObjectId);
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    const [tool, setTool] = useState<WorkspaceCanvasTool>("select");
    const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
    const [widgetQuery, setWidgetQuery] = useState("");
    const [launchingWidget, setLaunchingWidget] = useState<string | null>(null);
    const [camera, setCamera] = useState<WorkspaceCanvasCamera>(() => canvasState.camera ?? DefaultCamera);
    const [rects, setRects] = useState<Record<string, WorkspaceCanvasRect>>(() => canvasState.rects ?? {});
    const [objects, setObjects] = useState<WorkspaceCanvasObject[]>(() => initialObjects);
    const [bookmarks, setBookmarks] = useState<Record<string, WorkspaceCanvasCamera>>(
        () => canvasState.bookmarks ?? {}
    );
    const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
    const [manualContextNodes, setManualContextNodes] = useState<CanvasComposerContextNode[]>([]);
    const [reducedMotion, setReducedMotion] = useState(false);
    const cameraRef = useRef(camera);
    const rectsRef = useRef(rects);
    const objectsRef = useRef(objects);
    const bookmarksRef = useRef(bookmarks);
    const selectedContextIdsRef = useRef(selectedContextIds);
    const contextModeRef = useRef<"follow" | "quote">("follow");
    const reducedMotionRef = useRef(reducedMotion);
    const homeReturnCameraRef = useRef<WorkspaceCanvasCamera | null>(null);
    const fittedRectRef = useRef<{ blockId: string; rect: WorkspaceCanvasRect } | null>(null);
    const mruBlockIdsRef = useRef<string[]>(tabData.blockids ?? []);
    const blockIds = tabData.blockids ?? [];
    const blockIdsKey = blockIds.join("|");
    selectedBlockIdRef.current = selectedBlockId;
    selectedObjectIdRef.current = selectedObjectId;
    selectedContextIdsRef.current = selectedContextIds;
    reducedMotionRef.current = reducedMotion;
    bookmarksRef.current = bookmarks;
    const contextMode = composerContext.tabid === tabId ? composerContext.mode : "follow";
    contextModeRef.current = contextMode;
    const totalContextCount = selectedContextIds.length + manualContextNodes.length;

    const latestBatchRun = useMemo(() => {
        const cards = objects.filter((object): object is WorkspaceCanvasAgentCard => object.kind === "agent");
        return aggregateWorkspaceCanvasRuns(cards).find((run) => run.total > 1);
    }, [objects]);

    const selectedClusterIds = useMemo(
        () => (selectedBlockId ? findWorkspaceCanvasCluster(selectedBlockId, rects) : []),
        [rects, selectedBlockId]
    );

    const visibleWidgets = useMemo(() => {
        return (Object.entries(fullConfig?.widgets ?? {}) as Array<[string, WidgetConfigType]>)
            .filter(([, widget]) => widget && widget["display:hidden"] !== true)
            .sort(([, a], [, b]) => (a["display:order"] ?? 0) - (b["display:order"] ?? 0));
    }, [fullConfig]);

    const widgets = useMemo(() => {
        const query = widgetQuery.trim().toLowerCase();
        return visibleWidgets.filter(
            ([key, widget]) =>
                !query || `${key} ${widget.label ?? ""} ${widget.description ?? ""}`.toLowerCase().includes(query)
        );
    }, [visibleWidgets, widgetQuery]);

    const groupedWidgets = useMemo(() => {
        const groups: Record<WidgetMenuGroup, Array<[string, WidgetConfigType]>> = {
            Work: [],
            Web: [],
            System: [],
            Custom: [],
        };
        for (const entry of widgets) {
            groups[widgetMenuGroup(...entry)].push(entry);
        }
        return groups;
    }, [widgets]);

    const appsWidgetEntry = useMemo(
        () => visibleWidgets.find(([, widget]) => widget.blockdef?.meta?.view === "installedapps"),
        [visibleWidgets]
    );
    const settingsWidgetEntry = useMemo(
        () => visibleWidgets.find(([, widget]) => widget.blockdef?.meta?.view === "kronsettings"),
        [visibleWidgets]
    );
    const dockWidgets = useMemo(
        () =>
            CanvasPrimaryDockViews.map((view) =>
                visibleWidgets.find(([, widget]) => widget.blockdef?.meta?.view === view)
            ).filter(Boolean) as Array<[string, WidgetConfigType]>,
        [visibleWidgets]
    );

    const persistCanvasState = useCallback(() => {
        void RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("tab", tabId),
            meta: {
                "layout:mode": "canvas",
                "layout:canvas": {
                    version: 4,
                    camera: cameraRef.current,
                    rects: rectsRef.current,
                    objects: objectsRef.current,
                    bookmarks: bookmarksRef.current,
                },
            } as unknown as MetaType,
        });
    }, [tabId]);

    const schedulePersist = useCallback(() => {
        if (persistTimerRef.current != null) {
            window.clearTimeout(persistTimerRef.current);
        }
        persistTimerRef.current = window.setTimeout(() => {
            persistTimerRef.current = null;
            persistCanvasState();
        }, CanvasSaveDelayMs);
    }, [persistCanvasState]);

    const toggleExpand = useCallback((blockId: string) => {
        setExpandedBlockId((current) => (current === blockId ? null : blockId));
        setSelectedBlockId(blockId);
    }, []);

    useEffect(() => {
        if (!removedLegacyDemoRef.current) {
            return;
        }
        removedLegacyDemoRef.current = false;
        persistCanvasState();
    }, [persistCanvasState]);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncPreference = () => setReducedMotion(query.matches);
        syncPreference();
        query.addEventListener("change", syncPreference);
        return () => query.removeEventListener("change", syncPreference);
    }, []);

    const updateCamera = useCallback(
        (nextCamera: WorkspaceCanvasCamera, persist = true) => {
            const bounded = { ...nextCamera, zoom: clampCanvasZoom(nextCamera.zoom) };
            cameraRef.current = bounded;
            setCamera(bounded);
            if (persist) {
                schedulePersist();
            }
        },
        [schedulePersist]
    );

    const cancelCameraMomentum = useCallback(() => {
        if (momentumFrameRef.current == null) {
            return;
        }
        window.cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
    }, []);

    const startCameraMomentum = useCallback(
        (velocity: WorkspaceCanvasPoint) => {
            cancelCameraMomentum();
            if (!shouldContinueWorkspaceCanvasMomentum(velocity, reducedMotionRef.current)) {
                schedulePersist();
                return;
            }
            let current = velocity;
            let previousTime = performance.now();
            const tick = (time: number) => {
                const elapsed = Math.min(32, time - previousTime);
                previousTime = time;
                current = decayWorkspaceCanvasVelocity(current, elapsed);
                if (!shouldContinueWorkspaceCanvasMomentum(current, reducedMotionRef.current)) {
                    momentumFrameRef.current = null;
                    schedulePersist();
                    return;
                }
                updateCamera(
                    {
                        ...cameraRef.current,
                        x: cameraRef.current.x + current.x * elapsed,
                        y: cameraRef.current.y + current.y * elapsed,
                    },
                    false
                );
                momentumFrameRef.current = window.requestAnimationFrame(tick);
            };
            momentumFrameRef.current = window.requestAnimationFrame(tick);
        },
        [cancelCameraMomentum, schedulePersist, updateCamera]
    );

    useEffect(() => cancelCameraMomentum, [cancelCameraMomentum]);

    const updateRects = useCallback(
        (updater: (current: Record<string, WorkspaceCanvasRect>) => Record<string, WorkspaceCanvasRect>) => {
            const next = updater(rectsRef.current);
            if (next === rectsRef.current) {
                return;
            }
            rectsRef.current = next;
            setRects(next);
            schedulePersist();
        },
        [schedulePersist]
    );

    const updateObjects = useCallback(
        (updater: (current: WorkspaceCanvasObject[]) => WorkspaceCanvasObject[]) => {
            const next = updater(objectsRef.current);
            if (next === objectsRef.current) {
                return;
            }
            objectsRef.current = next;
            setObjects(next);
            schedulePersist();
        },
        [schedulePersist]
    );

    useEffect(() => {
        const viewportBounds = viewportRef.current?.getBoundingClientRect();
        const selectedCards = selectedContextIds
            .map((id) =>
                objects.find(
                    (object): object is WorkspaceCanvasAgentCard => object.kind === "agent" && object.id === id
                )
            )
            .filter(Boolean)
            .map(toComposerContextNode);
        const nodes = [...manualContextNodes, ...selectedCards].filter(
            (node, index, all) => all.findIndex((candidate) => candidate.id === node.id) === index
        );
        const viewport = viewportBounds
            ? {
                  left: viewportBounds.left,
                  width: viewportBounds.width,
              }
            : undefined;
        setComposerContext((current) => {
            const mode = current.tabid === tabId ? current.mode : "follow";
            if (
                current.active &&
                current.mode === mode &&
                current.tabid === tabId &&
                current.viewport?.left === viewport?.left &&
                current.viewport?.width === viewport?.width &&
                sameComposerContextNodes(current.nodes, nodes)
            ) {
                return current;
            }
            return { active: true, mode, nodes, tabid: tabId, viewport };
        });
    }, [manualContextNodes, objects, selectedContextIds, setComposerContext, tabId, viewportSize.width]);

    useEffect(() => {
        return () => {
            setComposerContext((current) =>
                current.tabid === tabId ? { active: false, mode: "follow", nodes: [], tabid: "" } : current
            );
        };
    }, [setComposerContext, tabId]);

    useEffect(() => {
        if (contextMode !== "follow" || selectedContextIds.length <= 1) {
            return;
        }
        setSelectedContextIds((current) => current.slice(-1));
    }, [contextMode, selectedContextIds.length]);

    useEffect(() => {
        const clearContext = (event: Event) => {
            if ((event as CustomEvent<string>).detail === tabId) {
                setSelectedContextIds([]);
                setManualContextNodes([]);
            }
        };
        window.addEventListener(WorkspaceCanvasClearContextEvent, clearContext);
        return () => window.removeEventListener(WorkspaceCanvasClearContextEvent, clearContext);
    }, [tabId]);

    useEffect(() => {
        return subscribeAgentActivityStream((activity) => {
            if (!shouldRecordAgentActivity(activity)) {
                return;
            }
            updateObjects((current) => {
                const primitiveObjects = current.filter((object) => object.kind !== "agent");
                const agentCards = current.filter(
                    (object): object is WorkspaceCanvasAgentCard => object.kind === "agent"
                );
                const nativeRunId = activity.runid || "default";
                const pendingRequest = pendingRequestRef.current
                    ? agentCards.find((card) => card.id === pendingRequestRef.current)
                    : undefined;
                if (pendingRequest && !activityRunAliasesRef.current.has(nativeRunId)) {
                    activityRunAliasesRef.current.set(nativeRunId, pendingRequest.agent.runid);
                }
                const canvasRunId = activityRunAliasesRef.current.get(nativeRunId) ?? nativeRunId;
                const canvasActivity = canvasRunId === activity.runid ? activity : { ...activity, runid: canvasRunId };
                const existingId = agentActivityCardId(canvasActivity);
                const existing = agentCards.find((card) => card.id === existingId);
                const contextIds = resolveAgentActivityContextIds(
                    agentCards,
                    canvasActivity,
                    existing ? undefined : pendingRequest?.id
                );
                const parent = contextIds
                    .map((id) => agentCards.find((card) => card.id === id))
                    .filter((card): card is WorkspaceCanvasAgentCard => Boolean(card))
                    .sort((a, b) => b.agent.updatedts - a.agent.updatedts)[0];
                const linkedBlock = canvasActivity.blockid ? rectsRef.current[canvasActivity.blockid] : undefined;
                const viewportCenter = screenPointToCanvas(cameraRef.current, {
                    x: viewportSizeRef.current.width / 2,
                    y: viewportSizeRef.current.height / 2,
                });
                const siblingIndex = parent
                    ? agentCards.filter((card) => card.agent.contextids?.includes(parent.id)).length
                    : 0;
                const rootIndex = agentCards.filter((card) => (card.agent.contextids?.length ?? 0) === 0).length;
                const cardSize = agentCardSizeForActivity(canvasActivity);
                const preferredPlacement: WorkspaceCanvasRect = {
                    x: parent
                        ? parent.x + siblingIndex * (cardSize.width + 64)
                        : linkedBlock
                          ? linkedBlock.x
                          : viewportCenter.x - cardSize.width / 2 + (rootIndex % 3) * 42,
                    y: parent
                        ? parent.y + parent.height + 88
                        : linkedBlock
                          ? linkedBlock.y + linkedBlock.height + 88
                          : viewportCenter.y - cardSize.height / 2 + Math.floor(rootIndex / 3) * (cardSize.height + 64),
                    ...cardSize,
                };
                const occupied = [
                    ...Object.values(rectsRef.current),
                    ...primitiveObjects.map(objectBounds),
                    ...agentCards.filter((card) => card.id !== existingId),
                ];
                const placement = existing ?? findNonOverlappingCanvasRect(preferredPlacement, occupied, 48);
                const result = upsertAgentActivityCard(agentCards, canvasActivity, placement, contextIds);
                const requestPhase =
                    result.card.agent.nodekind === "output" && !isAgentActivityActive(result.card.agent.phase)
                        ? result.card.agent.phase
                        : "running";
                const nextCards = result.cards.map((card) =>
                    card.agent.runid === canvasRunId && card.agent.nodekind === "request"
                        ? updateCanvasRequestPhase(card, requestPhase)
                        : card
                );
                if (pendingRequestRef.current && result.card.id !== pendingRequestRef.current) {
                    pendingRequestRef.current = null;
                }
                return [...primitiveObjects, ...nextCards];
            });
        });
    }, [updateObjects]);

    useEffect(() => {
        const onComposerSubmit = (event: Event) => {
            const detail = (event as CustomEvent<WorkspaceCanvasComposerSubmit>).detail;
            if (detail.tabid !== tabId) {
                return;
            }
            const parent = [...objectsRef.current]
                .reverse()
                .find(
                    (object): object is WorkspaceCanvasAgentCard =>
                        object.kind === "agent" && detail.contextids.includes(object.id)
                );
            const viewportCenter = screenPointToCanvas(cameraRef.current, {
                x: viewportSizeRef.current.width / 2,
                y: viewportSizeRef.current.height / 2,
            });
            const siblingIndex = parent
                ? objectsRef.current.filter(
                      (object) => object.kind === "agent" && object.agent.contextids?.includes(parent.id)
                  ).length
                : 0;
            const preferred = {
                x: parent
                    ? parent.x + siblingIndex * (WorkspaceAgentCardSize.width + 64)
                    : viewportCenter.x - WorkspaceAgentCardSize.width / 2,
                y: parent ? parent.y + parent.height + 88 : viewportCenter.y - WorkspaceAgentCardSize.height / 2,
                ...WorkspaceAgentCardSize,
            };
            const placement = findNonOverlappingCanvasRect(
                preferred,
                [...Object.values(rectsRef.current), ...objectsRef.current.map(objectBounds)],
                48
            );
            const request = makeCanvasRequestCard(detail.prompt, detail.contextids, placement);
            pendingRequestRef.current = request.id;
            updateObjects((current) => [...current, request]);
            setSelectedContextIds([request.id]);
            setSelectedObjectId(request.id);
            setSelectedBlockId(null);
        };
        window.addEventListener(WorkspaceCanvasComposerSubmitEvent, onComposerSubmit);
        return () => window.removeEventListener(WorkspaceCanvasComposerSubmitEvent, onComposerSubmit);
    }, [tabId, updateObjects]);

    useEffect(() => {
        return () => {
            if (persistTimerRef.current != null) {
                window.clearTimeout(persistTimerRef.current);
                persistCanvasState();
            }
        };
    }, [persistCanvasState]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }
        const resizeObserver = new ResizeObserver(([entry]) => {
            const next = {
                width: Math.round(entry.contentRect.width),
                height: Math.round(entry.contentRect.height),
            };
            viewportSizeRef.current = next;
            setViewportSize(next);
        });
        resizeObserver.observe(viewport);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (viewportSize.width === 0 || viewportSize.height === 0) {
            return;
        }
        const activeIds = new Set(blockIds);
        updateRects((current) => {
            const next = Object.fromEntries(Object.entries(current).filter(([blockId]) => activeIds.has(blockId)));
            let changed = Object.keys(next).length !== Object.keys(current).length;
            const occupied = [...Object.values(next), ...objectsRef.current.map(objectBounds)];
            for (const blockId of blockIds) {
                if (next[blockId]) {
                    continue;
                }
                const preferred = makeViewportCenteredCanvasRect(cameraRef.current, viewportSize, DefaultWidgetSize);
                next[blockId] = findNonOverlappingCanvasRect(preferred, occupied, 72);
                occupied.push(next[blockId]);
                changed = true;
            }
            return changed ? next : current;
        });
    }, [blockIdsKey, viewportSize.height, viewportSize.width]);

    useEffect(() => {
        if (expandedBlockId && !blockIds.includes(expandedBlockId)) {
            setExpandedBlockId(null);
        }
        if (selectedBlockId && !blockIds.includes(selectedBlockId)) {
            setSelectedBlockId(blockIds[0] ?? null);
        }
    }, [blockIdsKey, expandedBlockId, selectedBlockId]);

    const updateRect = useCallback(
        (blockId: string, rect: WorkspaceCanvasRect, affectCluster = false, interaction?: "move" | "resize") => {
            updateRects((current) => {
                const previous = current[blockId];
                const adjusted =
                    interaction === "move"
                        ? snapWorkspaceCanvasRect(rect, [
                              ...Object.entries(current)
                                  .filter(([candidateId]) => candidateId !== blockId)
                                  .map(
                                      ([candidateId, candidate]) =>
                                          [`block:${candidateId}`, candidate] as [string, WorkspaceCanvasRect]
                                  ),
                              ...objectsRef.current
                                  .filter((object) => object.kind !== "connector" && object.kind !== "draw")
                                  .map(
                                      (object) =>
                                          [`object:${object.id}`, objectBounds(object)] as [string, WorkspaceCanvasRect]
                                  ),
                          ]).rect
                        : rect;
                const next = { ...current, [blockId]: adjusted };
                if (!affectCluster || !previous) {
                    return next;
                }
                const dx = adjusted.x - previous.x;
                const dy = adjusted.y - previous.y;
                const scaleX = adjusted.width / previous.width;
                const scaleY = adjusted.height / previous.height;
                for (const clusterId of findWorkspaceCanvasCluster(blockId, current)) {
                    if (clusterId === blockId) {
                        continue;
                    }
                    const clustered = current[clusterId];
                    next[clusterId] =
                        interaction === "resize"
                            ? {
                                  x: previous.x + (clustered.x - previous.x) * scaleX,
                                  y: previous.y + (clustered.y - previous.y) * scaleY,
                                  width: Math.max(240, clustered.width * scaleX),
                                  height: Math.max(180, clustered.height * scaleY),
                              }
                            : { ...clustered, x: clustered.x + dx, y: clustered.y + dy };
                }
                return next;
            });
        },
        [updateRects]
    );

    const updateObject = useCallback(
        (nextObject: WorkspaceCanvasObject) => {
            updateObjects((current) => current.map((object) => (object.id === nextObject.id ? nextObject : object)));
        },
        [updateObjects]
    );

    const viewportPoint = useCallback((clientX: number, clientY: number): WorkspaceCanvasPoint => {
        const bounds = viewportRef.current?.getBoundingClientRect();
        return {
            x: clientX - (bounds?.left ?? 0),
            y: clientY - (bounds?.top ?? 0),
        };
    }, []);

    const edgePanAtPoint = useCallback(
        (clientX: number, clientY: number): WorkspaceCanvasPoint => {
            const delta = workspaceCanvasEdgePanDelta(viewportPoint(clientX, clientY), viewportSizeRef.current);
            if (delta.x === 0 && delta.y === 0) {
                return delta;
            }
            updateCamera({
                ...cameraRef.current,
                x: cameraRef.current.x + delta.x,
                y: cameraRef.current.y + delta.y,
            });
            return {
                x: -delta.x / cameraRef.current.zoom,
                y: -delta.y / cameraRef.current.zoom,
            };
        },
        [updateCamera, viewportPoint]
    );

    const canvasPoint = useCallback(
        (clientX: number, clientY: number): WorkspaceCanvasPoint => {
            return screenPointToCanvas(cameraRef.current, viewportPoint(clientX, clientY));
        },
        [viewportPoint]
    );

    const capturePointer = (pointerId: number) => {
        try {
            viewportRef.current?.setPointerCapture(pointerId);
        } catch {
            return;
        }
    };

    const startPan = useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
            cancelCameraMomentum();
            const point = { x: event.clientX, y: event.clientY };
            interactionRef.current = {
                kind: "pan",
                pointerId: event.pointerId,
                startClient: point,
                startCamera: cameraRef.current,
                lastClient: point,
                lastTime: performance.now(),
                velocity: { x: 0, y: 0 },
            };
            capturePointer(event.pointerId);
        },
        [cancelCameraMomentum]
    );

    const startObjectMove = useCallback((event: ReactPointerEvent<HTMLElement>, object: WorkspaceCanvasObject) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedBlockId(null);
        setSelectedObjectId(object.id);
        interactionRef.current = {
            kind: "move-object",
            pointerId: event.pointerId,
            objectId: object.id,
            startClient: { x: event.clientX, y: event.clientY },
            startObject: object,
        };
        capturePointer(event.pointerId);
    }, []);

    const startObjectResize = useCallback((event: ReactPointerEvent<HTMLElement>, object: WorkspaceCanvasObject) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedObjectId(object.id);
        interactionRef.current = {
            kind: "resize-object",
            pointerId: event.pointerId,
            objectId: object.id,
            startClient: { x: event.clientX, y: event.clientY },
            startObject: object,
        };
        capturePointer(event.pointerId);
    }, []);

    const addNoteAtPoint = useCallback(
        (point: WorkspaceCanvasPoint, text = "") => {
            const preferred = {
                x: Math.round(point.x - DefaultNoteSize.width / 2),
                y: Math.round(point.y - DefaultNoteSize.height / 2),
                ...DefaultNoteSize,
            };
            const placement = findNonOverlappingCanvasRect(
                preferred,
                [...Object.values(rectsRef.current), ...objectsRef.current.map(objectBounds)],
                32
            );
            const object: WorkspaceCanvasObject = {
                id: makeObjectId("note"),
                kind: "note",
                ...placement,
                text,
                color: "amber",
            };
            updateObjects((current) => [...current, object]);
            setSelectedObjectId(object.id);
            setSelectedBlockId(null);
            setTool("select");
        },
        [updateObjects]
    );

    const addNote = useCallback(() => {
        const rect = makeViewportCenteredCanvasRect(cameraRef.current, viewportSizeRef.current, DefaultNoteSize);
        addNoteAtPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    }, [addNoteAtPoint]);

    const onCanvasPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
        viewportRef.current?.focus({ preventScroll: true });
        if (expandedBlockId) {
            return;
        }
        if (event.target instanceof Element && event.target.closest("[data-canvas-overlay]")) {
            return;
        }
        const shouldPan = event.button === 1 || (event.button === 0 && (tool === "hand" || spacePressedRef.current));
        if (shouldPan) {
            event.preventDefault();
            event.stopPropagation();
            startPan(event);
        }
    };

    const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        setSelectedBlockId(null);
        setSelectedObjectId(null);
        setSelectedContextIds([]);
        setManualContextNodes([]);
        const point = canvasPoint(event.clientX, event.clientY);
        if (tool === "note") {
            addNoteAtPoint(point);
            return;
        }
        if (tool === "select" || tool === "hand") {
            return;
        }
        const kind = tool;
        const object: WorkspaceCanvasObject = {
            id: makeObjectId(kind),
            kind,
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            color: kind === "diamond" ? "amber" : "blue",
            text: kind === "diamond" ? "Decision" : kind === "connector" || kind === "draw" ? "" : "Process",
            points: kind === "draw" ? [point] : undefined,
        };
        objectsRef.current = [...objectsRef.current, object];
        setObjects(objectsRef.current);
        setSelectedObjectId(object.id);
        interactionRef.current = {
            kind: "create",
            pointerId: event.pointerId,
            objectId: object.id,
            tool,
            startPoint: point,
        };
        capturePointer(event.pointerId);
    };

    const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const interaction = interactionRef.current;
        if (!interaction || interaction.pointerId !== event.pointerId) {
            return;
        }
        if (interaction.kind === "pan") {
            const now = performance.now();
            const elapsed = Math.max(1, now - interaction.lastTime);
            const instantVelocity = {
                x: (event.clientX - interaction.lastClient.x) / elapsed,
                y: (event.clientY - interaction.lastClient.y) / elapsed,
            };
            interaction.velocity = {
                x: interaction.velocity.x * 0.65 + instantVelocity.x * 0.35,
                y: interaction.velocity.y * 0.65 + instantVelocity.y * 0.35,
            };
            interaction.lastClient = { x: event.clientX, y: event.clientY };
            interaction.lastTime = now;
            updateCamera(
                {
                    ...interaction.startCamera,
                    x: interaction.startCamera.x + event.clientX - interaction.startClient.x,
                    y: interaction.startCamera.y + event.clientY - interaction.startClient.y,
                },
                false
            );
            return;
        }
        if (interaction.kind === "move-object") {
            const dx = (event.clientX - interaction.startClient.x) / cameraRef.current.zoom;
            const dy = (event.clientY - interaction.startClient.y) / cameraRef.current.zoom;
            const moved = translateCanvasObject(interaction.startObject, { x: dx, y: dy });
            const bounds = objectBounds(moved);
            const snapped =
                moved.kind === "connector" || moved.kind === "draw"
                    ? bounds
                    : snapWorkspaceCanvasRect(bounds, [
                          ...Object.entries(rectsRef.current).map(
                              ([blockId, rect]) => [`block:${blockId}`, rect] as [string, WorkspaceCanvasRect]
                          ),
                          ...objectsRef.current
                              .filter(
                                  (object) =>
                                      object.id !== interaction.objectId &&
                                      object.kind !== "connector" &&
                                      object.kind !== "draw"
                              )
                              .map(
                                  (object) =>
                                      [`object:${object.id}`, objectBounds(object)] as [string, WorkspaceCanvasRect]
                              ),
                      ]).rect;
            const snappedObject = translateCanvasObject(moved, {
                x: snapped.x - bounds.x,
                y: snapped.y - bounds.y,
            });
            objectsRef.current = objectsRef.current.map((object) =>
                object.id === interaction.objectId ? snappedObject : object
            );
            setObjects(objectsRef.current);
            return;
        }
        if (interaction.kind === "resize-object") {
            const dx = (event.clientX - interaction.startClient.x) / cameraRef.current.zoom;
            const dy = (event.clientY - interaction.startClient.y) / cameraRef.current.zoom;
            const resized = {
                ...interaction.startObject,
                width: Math.max(120, interaction.startObject.width + dx),
                height: Math.max(88, interaction.startObject.height + dy),
            };
            objectsRef.current = objectsRef.current.map((object) =>
                object.id === interaction.objectId ? resized : object
            );
            setObjects(objectsRef.current);
            return;
        }
        const point = canvasPoint(event.clientX, event.clientY);
        objectsRef.current = objectsRef.current.map((object) => {
            if (object.id !== interaction.objectId) {
                return object;
            }
            if (interaction.tool === "draw") {
                if (object.kind !== "draw") {
                    return object;
                }
                const previousPoint = object.points?.at(-1);
                if (previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 2) {
                    return object;
                }
                return { ...object, points: [...(object.points ?? []), point] };
            }
            return {
                ...object,
                width: point.x - interaction.startPoint.x,
                height: point.y - interaction.startPoint.y,
            };
        });
        setObjects(objectsRef.current);
    };

    const onCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const interaction = interactionRef.current;
        if (!interaction || interaction.pointerId !== event.pointerId) {
            return;
        }
        interactionRef.current = null;
        if (interaction.kind === "pan" && performance.now() - interaction.lastTime < 80) {
            startCameraMomentum(interaction.velocity);
        }
        if (interaction.kind === "create") {
            objectsRef.current = objectsRef.current
                .map((object) => (object.id === interaction.objectId ? normalizeObjectRect(object) : object))
                .filter((object) => {
                    if (object.id !== interaction.objectId) {
                        return true;
                    }
                    if (object.kind === "draw") {
                        return (object.points?.length ?? 0) > 1;
                    }
                    return Math.abs(object.width) >= 8 || Math.abs(object.height) >= 8;
                });
            setObjects(objectsRef.current);
            setTool("select");
        }
        if (interaction.kind !== "pan") {
            persistCanvasState();
        }
    };

    const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
        if (expandedBlockId) {
            return;
        }
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
            const point = viewportPoint(event.clientX, event.clientY);
            const factor = Math.exp(-event.deltaY * 0.002);
            updateCamera(zoomCanvasCameraAtPoint(cameraRef.current, cameraRef.current.zoom * factor, point));
            return;
        }
        updateCamera({
            ...cameraRef.current,
            x: cameraRef.current.x - (event.shiftKey ? event.deltaY : event.deltaX),
            y: cameraRef.current.y - (event.shiftKey ? 0 : event.deltaY),
        });
    };

    const zoomBy = useCallback(
        (factor: number) => {
            updateCamera(
                zoomCanvasCameraAtPoint(cameraRef.current, cameraRef.current.zoom * factor, {
                    x: viewportSizeRef.current.width / 2,
                    y: viewportSizeRef.current.height / 2,
                })
            );
        },
        [updateCamera]
    );

    const allBounds = useMemo(() => {
        return canvasBoundsForRects([
            ...blockIds.map((blockId) => rects[blockId]).filter(Boolean),
            ...objects.map(objectBounds),
        ]);
    }, [blockIdsKey, objects, rects]);

    const fitAll = useCallback(() => {
        if (!allBounds || viewportSizeRef.current.width === 0) {
            updateCamera(DefaultCamera);
            return;
        }
        updateCamera(fitCanvasCameraToBounds(allBounds, viewportSizeRef.current));
    }, [allBounds, updateCamera]);

    const resetView = useCallback(() => {
        const screenCenter = {
            x: viewportSizeRef.current.width / 2,
            y: viewportSizeRef.current.height / 2,
        };
        const canvasCenter = screenPointToCanvas(cameraRef.current, screenCenter);
        updateCamera({
            x: screenCenter.x - canvasCenter.x,
            y: screenCenter.y - canvasCenter.y,
            zoom: 1,
        });
    }, [updateCamera]);

    const arrangeWidgets = useCallback(() => {
        if (blockIds.length === 0) {
            return;
        }
        const center = screenPointToCanvas(cameraRef.current, {
            x: viewportSizeRef.current.width / 2,
            y: viewportSizeRef.current.height / 2,
        });
        const columns = Math.max(1, Math.ceil(Math.sqrt(blockIds.length)));
        const rows = Math.ceil(blockIds.length / columns);
        const gap = 84;
        const totalWidth = columns * DefaultWidgetSize.width + (columns - 1) * gap;
        const totalHeight = rows * DefaultWidgetSize.height + (rows - 1) * gap;
        const arrangedRects = { ...rectsRef.current };
        blockIds.forEach((blockId, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            arrangedRects[blockId] = {
                x: center.x - totalWidth / 2 + column * (DefaultWidgetSize.width + gap),
                y: center.y - totalHeight / 2 + row * (DefaultWidgetSize.height + gap),
                ...DefaultWidgetSize,
            };
        });
        updateRects(() => arrangedRects);
        const arrangedBounds = canvasBoundsForRects(blockIds.map((blockId) => arrangedRects[blockId]));
        if (arrangedBounds) {
            updateCamera(fitCanvasCameraToBounds(arrangedBounds, viewportSizeRef.current));
        }
    }, [blockIdsKey, updateCamera, updateRects]);

    const focusCanvasBlock = useCallback(
        (blockId: string, center = true) => {
            const rect = rectsRef.current[blockId];
            if (!rect) {
                return;
            }
            selectedBlockIdRef.current = blockId;
            setSelectedBlockId(blockId);
            setSelectedObjectId(null);
            setExpandedBlockId((current) => (current && current !== blockId ? null : current));
            mruBlockIdsRef.current = [blockId, ...mruBlockIdsRef.current.filter((id) => id !== blockId)];
            if (center) {
                updateCamera(centerWorkspaceCanvasCamera(rect, viewportSizeRef.current, cameraRef.current.zoom));
            }
        },
        [updateCamera]
    );

    const focusCanvasTarget = useCallback(
        (targetId: string) => {
            if (targetId.startsWith("block:")) {
                focusCanvasBlock(targetId.slice("block:".length));
                return;
            }
            if (!targetId.startsWith("object:")) {
                return;
            }
            const objectId = targetId.slice("object:".length);
            const object = objectsRef.current.find((candidate) => candidate.id === objectId);
            if (!object) {
                return;
            }
            setSelectedBlockId(null);
            setSelectedObjectId(objectId);
            setExpandedBlockId(null);
            updateCamera(
                centerWorkspaceCanvasCamera(objectBounds(object), viewportSizeRef.current, cameraRef.current.zoom)
            );
        },
        [focusCanvasBlock, updateCamera]
    );

    const navigateCanvas = useCallback(
        (direction: "left" | "right" | "up" | "down") => {
            const navigationRects = Object.fromEntries([
                ...Object.entries(rectsRef.current).map(([blockId, rect]) => [`block:${blockId}`, rect] as const),
                ...objectsRef.current
                    .filter((object) => object.kind !== "connector" && object.kind !== "draw")
                    .map((object) => [`object:${object.id}`, objectBounds(object)] as const),
            ]);
            const sourceId = selectedObjectIdRef.current
                ? `object:${selectedObjectIdRef.current}`
                : selectedBlockIdRef.current
                  ? `block:${selectedBlockIdRef.current}`
                  : Object.keys(navigationRects)[0];
            if (!sourceId) {
                return;
            }
            const targetId = findDirectionalWorkspaceCanvasRect(sourceId, direction, navigationRects);
            if (targetId) {
                focusCanvasTarget(targetId);
            }
        },
        [focusCanvasTarget]
    );

    const nudgeSelectedCluster = useCallback(
        (direction: "left" | "right" | "up" | "down") => {
            const objectId = selectedObjectIdRef.current;
            const delta = {
                x: direction === "left" ? -20 : direction === "right" ? 20 : 0,
                y: direction === "up" ? -20 : direction === "down" ? 20 : 0,
            };
            if (objectId) {
                updateObjects((current) =>
                    current.map((object) => (object.id === objectId ? translateCanvasObject(object, delta) : object))
                );
                return;
            }
            const selectedId = selectedBlockIdRef.current;
            if (!selectedId || !rectsRef.current[selectedId]) {
                return;
            }
            const clusterIds = findWorkspaceCanvasCluster(selectedId, rectsRef.current);
            updateRects((current) => {
                const next = { ...current };
                for (const id of clusterIds) {
                    next[id] = { ...current[id], x: current[id].x + delta.x, y: current[id].y + delta.y };
                }
                return next;
            });
        },
        [updateObjects, updateRects]
    );

    const toggleHome = useCallback(() => {
        if (homeReturnCameraRef.current) {
            updateCamera(homeReturnCameraRef.current);
            homeReturnCameraRef.current = null;
            return;
        }
        homeReturnCameraRef.current = cameraRef.current;
        updateCamera({
            x: viewportSizeRef.current.width / 2,
            y: viewportSizeRef.current.height / 2,
            zoom: 1,
        });
    }, [updateCamera]);

    const saveBookmark = useCallback(
        (slot: string) => {
            const next = { ...bookmarksRef.current, [slot]: cameraRef.current };
            bookmarksRef.current = next;
            setBookmarks(next);
            schedulePersist();
        },
        [schedulePersist]
    );

    const goToBookmark = useCallback(
        (slot: string) => {
            const bookmarkedCamera = bookmarksRef.current[slot];
            if (bookmarkedCamera) {
                updateCamera(bookmarkedCamera);
            }
        },
        [updateCamera]
    );

    const toggleFitFocused = useCallback(() => {
        const selectedId = selectedBlockIdRef.current;
        if (!selectedId) {
            return;
        }
        const restore = fittedRectRef.current;
        if (restore?.blockId === selectedId) {
            updateRects((current) => ({ ...current, [selectedId]: restore.rect }));
            fittedRectRef.current = null;
            updateCamera(centerWorkspaceCanvasCamera(restore.rect, viewportSizeRef.current, 1));
            return;
        }
        const current = rectsRef.current[selectedId];
        if (!current) {
            return;
        }
        fittedRectRef.current = { blockId: selectedId, rect: current };
        const visible = workspaceCanvasViewportRect(cameraRef.current, viewportSizeRef.current);
        const center = {
            x: visible.x + visible.width / 2,
            y: visible.y + visible.height / 2,
        };
        const fitted = {
            x: center.x - Math.max(400, viewportSizeRef.current.width - 36) / 2,
            y: center.y - Math.max(300, viewportSizeRef.current.height - 36) / 2,
            width: Math.max(400, viewportSizeRef.current.width - 36),
            height: Math.max(300, viewportSizeRef.current.height - 36),
        };
        updateRects((rects) => ({ ...rects, [selectedId]: fitted }));
        updateCamera(centerWorkspaceCanvasCamera(fitted, viewportSizeRef.current, 1));
    }, [updateCamera, updateRects]);

    const cycleMru = useCallback(
        (reverse: boolean) => {
            const available = mruBlockIdsRef.current.filter((id) => blockIds.includes(id));
            const missing = blockIds.filter((id) => !available.includes(id));
            const ordered = [...available, ...missing];
            if (ordered.length < 2) {
                return;
            }
            const currentIndex = Math.max(0, ordered.indexOf(selectedBlockIdRef.current ?? ordered[0]));
            const offset = reverse ? ordered.length - 1 : 1;
            focusCanvasBlock(ordered[(currentIndex + offset) % ordered.length]);
        },
        [blockIdsKey, focusCanvasBlock]
    );

    const addFlowTemplate = useCallback(() => {
        const center = screenPointToCanvas(cameraRef.current, {
            x: viewportSizeRef.current.width / 2,
            y: viewportSizeRef.current.height / 2,
        });
        const y = center.y - 70;
        const nodes: WorkspaceCanvasObject[] = ["Input", "Process", "Result"].map((text, index) => ({
            id: makeObjectId("rectangle"),
            kind: "rectangle",
            x: center.x - 430 + index * 300,
            y,
            width: 220,
            height: 116,
            text,
            color: index === 1 ? "green" : "blue",
        }));
        const connectors: WorkspaceCanvasObject[] = [0, 1].map((index) => ({
            id: makeObjectId("connector"),
            kind: "connector",
            x: nodes[index].x + nodes[index].width,
            y: nodes[index].y + nodes[index].height / 2,
            width: nodes[index + 1].x - (nodes[index].x + nodes[index].width),
            height: 0,
            color: "slate",
        }));
        updateObjects((current) => [...current, ...connectors, ...nodes]);
        setSelectedObjectId(nodes[1].id);
    }, [updateObjects]);

    const addMindMapTemplate = useCallback(() => {
        const center = screenPointToCanvas(cameraRef.current, {
            x: viewportSizeRef.current.width / 2,
            y: viewportSizeRef.current.height / 2,
        });
        const root: WorkspaceCanvasObject = {
            id: makeObjectId("ellipse"),
            kind: "ellipse",
            x: center.x - 115,
            y: center.y - 60,
            width: 230,
            height: 120,
            text: "Core idea",
            color: "amber",
        };
        const offsets = [
            { x: -390, y: -230 },
            { x: 170, y: -230 },
            { x: -390, y: 150 },
            { x: 170, y: 150 },
        ];
        const branches = offsets.map((offset, index): WorkspaceCanvasObject => ({
            id: makeObjectId("rectangle"),
            kind: "rectangle",
            x: center.x + offset.x,
            y: center.y + offset.y,
            width: 220,
            height: 100,
            text: `Branch ${index + 1}`,
            color: index % 2 === 0 ? "blue" : "green",
        }));
        const connectors = branches.map((branch): WorkspaceCanvasObject => ({
            id: makeObjectId("connector"),
            kind: "connector",
            x: center.x,
            y: center.y,
            width: branch.x + branch.width / 2 - center.x,
            height: branch.y + branch.height / 2 - center.y,
            color: "slate",
        }));
        updateObjects((current) => [...current, ...connectors, root, ...branches]);
        setSelectedObjectId(root.id);
    }, [updateObjects]);

    const launchBlock = useCallback(
        async (key: string, blockDef: BlockDef) => {
            if (!blockDef || launchingWidget) {
                return undefined;
            }
            setLaunchingWidget(key);
            setExpandedBlockId(null);
            try {
                const blockId = await createBlock(blockDef, false);
                const preferred = makeViewportCenteredCanvasRect(
                    cameraRef.current,
                    viewportSizeRef.current,
                    DefaultWidgetSize
                );
                const rect = findNonOverlappingCanvasRect(
                    preferred,
                    [...Object.values(rectsRef.current), ...objectsRef.current.map(objectBounds)],
                    72
                );
                updateRects((current) => ({ ...current, [blockId]: rect }));
                setSelectedBlockId(blockId);
                setSelectedObjectId(null);
                setWidgetMenuOpen(false);
                return blockId;
            } finally {
                setLaunchingWidget(null);
            }
        },
        [launchingWidget, updateRects]
    );

    const launchWidget = useCallback(
        async (key: string, widget: WidgetConfigType) => {
            if (!widget.blockdef) {
                return;
            }
            await launchBlock(key, widget.blockdef);
        },
        [launchBlock]
    );

    const launchApps = useCallback(async () => {
        if (appsWidgetEntry) {
            await launchWidget(...appsWidgetEntry);
            return;
        }
        await launchBlock("system:apps", { meta: { view: "installedapps" } });
    }, [appsWidgetEntry, launchBlock, launchWidget]);

    const launchSettings = useCallback(async () => {
        if (settingsWidgetEntry) {
            await launchWidget(...settingsWidgetEntry);
            return;
        }
        await launchBlock("system:settings", { meta: { view: "kronsettings" } });
    }, [launchBlock, launchWidget, settingsWidgetEntry]);

    const runMenuAction = useCallback((action: () => void) => {
        action();
        setWidgetMenuOpen(false);
    }, []);

    const setAgentTaskContext = useCallback(
        (card: WorkspaceCanvasAgentCard, mode: "follow" | "quote", additive = false) => {
            setSelectedBlockId(null);
            setSelectedObjectId(card.id);
            setManualContextNodes([]);
            setSelectedContextIds((current) =>
                toggleCanvasContextSelection(current, card.id, mode, mode === "quote" && additive)
            );
            setComposerContext((current) => ({ ...current, mode, tabid: tabId }));
        },
        [setComposerContext, tabId]
    );

    const setBlockTaskContext = useCallback(
        (blockId: string, title: string, viewType: string, mode: "follow" | "quote") => {
            const contextNode: CanvasComposerContextNode = {
                action: "focus",
                blockid: blockId,
                detail: `Use the ${title} KronTerm widget (${viewType}) as active task context.`,
                id: `block:${blockId}`,
                phase: "succeeded",
                surface: canvasSurfaceForView(viewType),
                title,
            };
            setSelectedBlockId(blockId);
            setSelectedObjectId(null);
            setSelectedContextIds([]);
            setManualContextNodes([contextNode]);
            setComposerContext((current) => ({ ...current, mode, tabid: tabId }));
        },
        [setComposerContext, tabId]
    );

    const openRelatedWidget = useCallback(
        async (card: WorkspaceCanvasAgentCard, placement: "canvas" | "side") => {
            const linkedBlockId = card.agent.blockid;
            if (linkedBlockId && blockIds.includes(linkedBlockId)) {
                setSelectedBlockId(linkedBlockId);
                setSelectedObjectId(null);
                if (placement === "canvas") {
                    setExpandedBlockId(linkedBlockId);
                } else {
                    const center = screenPointToCanvas(cameraRef.current, {
                        x: viewportSizeRef.current.width / 2,
                        y: viewportSizeRef.current.height / 2,
                    });
                    updateRect(linkedBlockId, {
                        x: center.x + 150,
                        y: center.y - 280,
                        width: 520,
                        height: 560,
                    });
                }
                return;
            }
            const blockDef: BlockDef =
                card.agent.surface === "browser"
                    ? { meta: { view: "web" } }
                    : card.agent.surface === "sandbox" || card.agent.surface === "desktop"
                      ? { meta: { view: "sandbox" } }
                      : card.agent.surface === "terminal"
                        ? { meta: { view: "term", controller: "shell" } }
                        : card.agent.surface === "file"
                          ? { meta: { view: "preview", file: "~" } }
                          : { meta: { view: "chathubv2" } };
            const blockId = await launchBlock(`task:${card.id}`, blockDef);
            if (!blockId || placement !== "side") {
                return;
            }
            const center = screenPointToCanvas(cameraRef.current, {
                x: viewportSizeRef.current.width / 2,
                y: viewportSizeRef.current.height / 2,
            });
            updateRect(blockId, { x: center.x + 150, y: center.y - 280, width: 520, height: 560 });
        },
        [blockIdsKey, launchBlock, updateRect]
    );

    const showAgentContextMenu = useCallback(
        (event: ReactMouseEvent<HTMLElement>, card: WorkspaceCanvasAgentCard) => {
            event.preventDefault();
            event.stopPropagation();
            ContextMenuModel.getInstance().showContextMenu(
                [
                    { label: "Focus in Kronos task", click: () => setAgentTaskContext(card, "follow") },
                    { label: "Ask about selection", click: () => setAgentTaskContext(card, "follow") },
                    { label: "Use as evidence", click: () => setAgentTaskContext(card, "quote", true) },
                    { type: "separator" },
                    { label: "Open as widget", click: () => void openRelatedWidget(card, "canvas") },
                    { label: "Open as side widget", click: () => void openRelatedWidget(card, "side") },
                ],
                event
            );
        },
        [openRelatedWidget, setAgentTaskContext]
    );

    const showBlockContextMenu = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>, blockId: string, title: string, viewType: string) => {
            event.preventDefault();
            event.stopPropagation();
            ContextMenuModel.getInstance().showContextMenu(
                [
                    {
                        label: "Focus in Kronos task",
                        click: () => setBlockTaskContext(blockId, title, viewType, "follow"),
                    },
                    {
                        label: "Ask about widget",
                        click: () => setBlockTaskContext(blockId, title, viewType, "follow"),
                    },
                    {
                        label: "Use as evidence",
                        click: () => setBlockTaskContext(blockId, title, viewType, "quote"),
                    },
                    { type: "separator" },
                    { label: "Center window", click: () => focusCanvasBlock(blockId) },
                    {
                        label: "Fit window / restore",
                        click: () => {
                            selectedBlockIdRef.current = blockId;
                            setSelectedBlockId(blockId);
                            toggleFitFocused();
                        },
                    },
                    { label: "Toggle fullscreen", click: () => toggleExpand(blockId) },
                    { type: "separator" },
                    { label: "Close window", click: () => services.ObjectService.DeleteBlock(blockId) },
                ],
                event
            );
        },
        [focusCanvasBlock, setBlockTaskContext, toggleExpand, toggleFitFocused]
    );

    const showCanvasContextMenu = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>) => {
            if (isCanvasShortcutInteractiveTarget(event.target)) {
                return;
            }
            event.preventDefault();
            const point = canvasPoint(event.clientX, event.clientY);
            const selectedObject = selectedObjectIdRef.current
                ? objectsRef.current.find((object) => object.id === selectedObjectIdRef.current)
                : undefined;
            const widgetGroups = WidgetMenuGroups.map((group) => ({
                label: group,
                submenu: groupedWidgets[group].map(([key, widget]) => ({
                    label: widget.label || widget.blockdef?.meta?.view || key,
                    click: () => void launchWidget(key, widget),
                })),
            })).filter((group) => group.submenu.length > 0);
            ContextMenuModel.getInstance().showContextMenu(
                [
                    {
                        label: "New",
                        submenu: [
                            { label: "Note", click: () => addNoteAtPoint(point) },
                            { label: "Rectangle", click: () => setTool("rectangle") },
                            { label: "Ellipse", click: () => setTool("ellipse") },
                            { label: "Decision", click: () => setTool("diamond") },
                            { label: "Connector", click: () => setTool("connector") },
                            { label: "Freehand drawing", click: () => setTool("draw") },
                        ],
                    },
                    ...(widgetGroups.length > 0
                        ? [
                              {
                                  label: "Open widget",
                                  submenu: widgetGroups,
                              } as ContextMenuItem,
                          ]
                        : []),
                    ...(selectedObject
                        ? [
                              { type: "separator" as const },
                              {
                                  label: `Delete ${canvasObjectLabel(selectedObject)}`,
                                  click: () => {
                                      updateObjects((current) =>
                                          current.filter((object) => object.id !== selectedObject.id)
                                      );
                                      setSelectedContextIds((current) =>
                                          current.filter((id) => id !== selectedObject.id)
                                      );
                                      setSelectedObjectId(null);
                                  },
                              },
                          ]
                        : []),
                    { type: "separator" },
                    { label: "Fit all", click: fitAll },
                    { label: "Reset zoom to 100%", click: resetView },
                    { label: "Arrange widgets", enabled: blockIds.length > 0, click: arrangeWidgets },
                    { type: "separator" },
                    {
                        label: "Hermes canvas context",
                        submenu: [
                            {
                                type: "checkbox",
                                label: "Follow selection",
                                checked: contextMode === "follow",
                                click: () =>
                                    setComposerContext((current) => ({ ...current, mode: "follow", tabid: tabId })),
                            },
                            {
                                type: "checkbox",
                                label: "Quote selections",
                                checked: contextMode === "quote",
                                click: () =>
                                    setComposerContext((current) => ({ ...current, mode: "quote", tabid: tabId })),
                            },
                            {
                                label: "Clear context",
                                enabled: totalContextCount > 0,
                                click: () => {
                                    setSelectedContextIds([]);
                                    setManualContextNodes([]);
                                },
                            },
                        ],
                    },
                ],
                event
            );
        },
        [
            addNoteAtPoint,
            arrangeWidgets,
            blockIds.length,
            canvasPoint,
            contextMode,
            fitAll,
            groupedWidgets,
            launchWidget,
            resetView,
            setComposerContext,
            tabId,
            totalContextCount,
            updateObjects,
        ]
    );

    useEffect(() => {
        return registerWorkspaceSurfaceModeProvider(tabId, {
            snapshot: () => ({
                presentation: "canvas",
                selectedblockid: selectedBlockIdRef.current ?? undefined,
                selectedobjectid: selectedObjectIdRef.current ?? undefined,
                expandedblockid: expandedBlockId ?? undefined,
                contextids: selectedContextIdsRef.current,
                contextmode: contextModeRef.current,
                camera: cameraRef.current,
                rects: rectsRef.current,
                objects: objectsRef.current,
            }),
            control: (input) => {
                if (input.action === "fit") {
                    fitAll();
                    return { success: true, message: "Canvas fitted to visible content." };
                }
                if (input.action === "arrange") {
                    arrangeWidgets();
                    return { success: true, message: "Canvas widgets arranged into a fitted grid." };
                }
                if (input.action === "add_note") {
                    const color = ["amber", "blue", "green", "rose", "slate"].includes(input.color ?? "")
                        ? (input.color as WorkspaceCanvasColor)
                        : "amber";
                    const preferred = {
                        x:
                            input.x ??
                            (viewportSizeRef.current.width / 2 - cameraRef.current.x) / cameraRef.current.zoom,
                        y:
                            input.y ??
                            (viewportSizeRef.current.height / 2 - cameraRef.current.y) / cameraRef.current.zoom,
                        width: Math.max(120, input.width ?? DefaultNoteSize.width),
                        height: Math.max(96, input.height ?? DefaultNoteSize.height),
                    };
                    const placement = findNonOverlappingCanvasRect(
                        preferred,
                        [...Object.values(rectsRef.current), ...objectsRef.current.map(objectBounds)],
                        32
                    );
                    const note: WorkspaceCanvasPrimitiveObject = {
                        id: makeObjectId("note"),
                        kind: "note",
                        ...placement,
                        text: input.text ?? "New note",
                        color,
                    };
                    updateObjects((current) => [...current, note]);
                    setSelectedObjectId(note.id);
                    setSelectedBlockId(null);
                    return { success: true, message: `Created sticky note ${note.id}.` };
                }
                if (input.action === "update_object") {
                    const existing = objectsRef.current.find((object) => object.id === input.objectid);
                    if (!existing || existing.kind === "agent") {
                        return {
                            success: false,
                            message: `Editable canvas object not found: ${input.objectid ?? "<missing>"}`,
                        };
                    }
                    const color = ["amber", "blue", "green", "rose", "slate"].includes(input.color ?? "")
                        ? (input.color as WorkspaceCanvasColor)
                        : existing.color;
                    const requested = normalizeObjectRect({
                        ...existing,
                        x: input.x ?? existing.x,
                        y: input.y ?? existing.y,
                        width: input.width ?? existing.width,
                        height: input.height ?? existing.height,
                        text: input.text ?? existing.text,
                        color,
                    });
                    const placement =
                        requested.kind === "connector" || requested.kind === "draw"
                            ? requested
                            : {
                                  ...requested,
                                  ...findNonOverlappingCanvasRect(
                                      requested,
                                      [
                                          ...Object.values(rectsRef.current),
                                          ...objectsRef.current
                                              .filter((object) => object.id !== existing.id)
                                              .map(objectBounds),
                                      ],
                                      32
                                  ),
                              };
                    updateObjects((current) =>
                        current.map((object) => (object.id === existing.id ? placement : object))
                    );
                    setSelectedObjectId(existing.id);
                    return { success: true, message: `Updated canvas object ${existing.id}.` };
                }
                if (input.action === "delete_object") {
                    const existing = objectsRef.current.find((object) => object.id === input.objectid);
                    if (!existing || existing.kind === "agent") {
                        return {
                            success: false,
                            message: `Deletable canvas object not found: ${input.objectid ?? "<missing>"}`,
                        };
                    }
                    updateObjects((current) => current.filter((object) => object.id !== existing.id));
                    setSelectedObjectId(null);
                    return { success: true, message: `Deleted canvas object ${existing.id}.` };
                }
                if (input.action === "connect_objects") {
                    const from = objectsRef.current.find((object) => object.id === input.fromobjectid);
                    const to = objectsRef.current.find((object) => object.id === input.toobjectid);
                    if (!from || !to || from.id === to.id) {
                        return { success: false, message: "Two different canvas object IDs are required." };
                    }
                    const fromBounds = objectBounds(from);
                    const toBounds = objectBounds(to);
                    const start = {
                        x: fromBounds.x + fromBounds.width / 2,
                        y: fromBounds.y + fromBounds.height / 2,
                    };
                    const connector: WorkspaceCanvasPrimitiveObject = {
                        id: makeObjectId("connector"),
                        kind: "connector",
                        x: start.x,
                        y: start.y,
                        width: toBounds.x + toBounds.width / 2 - start.x,
                        height: toBounds.y + toBounds.height / 2 - start.y,
                        color: "slate",
                    };
                    updateObjects((current) => [...current, connector]);
                    return {
                        success: true,
                        message: `Connected ${from.id} to ${to.id} with ${connector.id}.`,
                    };
                }
                if (!input.blockid || !blockIds.includes(input.blockid)) {
                    return { success: false, message: `Canvas widget not found: ${input.blockid ?? "<missing>"}` };
                }
                if (input.action === "focus") {
                    selectedBlockIdRef.current = input.blockid;
                    setSelectedBlockId(input.blockid);
                    setSelectedObjectId(null);
                    return { success: true, message: `Focused canvas widget ${input.blockid}.` };
                }
                if (input.action === "move" || input.action === "resize") {
                    if (input.action === "move" && input.x == null && input.y == null) {
                        return { success: false, message: "Canvas move requires x or y world coordinates." };
                    }
                    if (
                        input.action === "resize" &&
                        input.x == null &&
                        input.y == null &&
                        input.width == null &&
                        input.height == null
                    ) {
                        return { success: false, message: "Canvas resize requires width, height, x, or y." };
                    }
                    const fallbackIndex = blockIds.indexOf(input.blockid);
                    const current = rectsRef.current[input.blockid] ?? {
                        x: 80 + (fallbackIndex % 3) * (DefaultWidgetSize.width + 84),
                        y: 80 + Math.floor(fallbackIndex / 3) * (DefaultWidgetSize.height + 84),
                        ...DefaultWidgetSize,
                    };
                    const requested = {
                        ...current,
                        x: input.x ?? current.x,
                        y: input.y ?? current.y,
                        width: Math.max(240, input.width ?? current.width),
                        height: Math.max(180, input.height ?? current.height),
                    };
                    const placement = findNonOverlappingCanvasRect(
                        requested,
                        [
                            ...Object.entries(rectsRef.current)
                                .filter(([blockId]) => blockId !== input.blockid)
                                .map(([, rect]) => rect),
                            ...objectsRef.current.map(objectBounds),
                        ],
                        72
                    );
                    updateRects((rects) => ({ ...rects, [input.blockid!]: placement }));
                    selectedBlockIdRef.current = input.blockid;
                    setSelectedBlockId(input.blockid);
                    return { success: true, message: `Updated canvas geometry for ${input.blockid}.` };
                }
                if (input.action === "navigate") {
                    const source = rectsRef.current[input.blockid];
                    if (!source || !input.direction) {
                        return {
                            success: false,
                            message: "Canvas navigation requires a positioned widget and direction.",
                        };
                    }
                    const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
                    const candidates = blockIds
                        .filter((blockId) => blockId !== input.blockid && rectsRef.current[blockId])
                        .map((blockId) => {
                            const rect = rectsRef.current[blockId];
                            const dx = rect.x + rect.width / 2 - sourceCenter.x;
                            const dy = rect.y + rect.height / 2 - sourceCenter.y;
                            return { blockId, dx, dy, distance: Math.hypot(dx, dy) };
                        })
                        .filter(({ dx, dy }) => {
                            if (input.direction === "left") return dx < 0 && Math.abs(dx) >= Math.abs(dy) / 2;
                            if (input.direction === "right") return dx > 0 && Math.abs(dx) >= Math.abs(dy) / 2;
                            if (input.direction === "up") return dy < 0 && Math.abs(dy) >= Math.abs(dx) / 2;
                            return dy > 0 && Math.abs(dy) >= Math.abs(dx) / 2;
                        })
                        .sort((left, right) => left.distance - right.distance);
                    if (!candidates[0]) {
                        return {
                            success: false,
                            message: `No canvas widget exists ${input.direction} of ${input.blockid}.`,
                        };
                    }
                    selectedBlockIdRef.current = candidates[0].blockId;
                    setSelectedBlockId(candidates[0].blockId);
                    return { success: true, message: `Focused canvas widget ${candidates[0].blockId}.` };
                }
                return { success: false, message: `Action ${input.action} is unavailable in canvas presentation.` };
            },
        });
    }, [arrangeWidgets, blockIdsKey, expandedBlockId, fitAll, selectedBlockId, tabId, updateObjects, updateRects]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const viewport = viewportRef.current;
            if (!viewport || !(event.target instanceof Node) || !viewport.contains(event.target)) {
                return;
            }
            const mod = event.metaKey || event.ctrlKey;
            if (isCanvasShortcutInteractiveTarget(event.target)) {
                return;
            }
            if (event.altKey && event.key === "Tab") {
                event.preventDefault();
                cycleMru(event.shiftKey);
                return;
            }
            if (mod) {
                const direction =
                    event.key === "ArrowLeft"
                        ? "left"
                        : event.key === "ArrowRight"
                          ? "right"
                          : event.key === "ArrowUp"
                            ? "up"
                            : event.key === "ArrowDown"
                              ? "down"
                              : null;
                if (direction) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        nudgeSelectedCluster(direction);
                    } else {
                        navigateCanvas(direction);
                    }
                    return;
                }
                if (/^[1-4]$/.test(event.key)) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        saveBookmark(event.key);
                    } else {
                        goToBookmark(event.key);
                    }
                    return;
                }
                const key = event.key.toLowerCase();
                if (key === "w") {
                    event.preventDefault();
                    fitAll();
                    return;
                }
                if (key === "a") {
                    event.preventDefault();
                    toggleHome();
                    return;
                }
                if (key === "c" && selectedBlockIdRef.current) {
                    event.preventDefault();
                    focusCanvasBlock(selectedBlockIdRef.current);
                    return;
                }
                if (key === "m") {
                    event.preventDefault();
                    toggleFitFocused();
                    return;
                }
                if (key === "f" && selectedBlockIdRef.current) {
                    event.preventDefault();
                    toggleExpand(selectedBlockIdRef.current);
                    return;
                }
                if (event.key === "0") {
                    event.preventDefault();
                    resetView();
                    return;
                }
                if (event.key === "=" || event.key === "+") {
                    event.preventDefault();
                    zoomBy(1.15);
                    return;
                }
                if (event.key === "-") {
                    event.preventDefault();
                    zoomBy(1 / 1.15);
                    return;
                }
                return;
            }
            if (event.altKey) {
                return;
            }
            if (event.code === "Space") {
                spacePressedRef.current = true;
                event.preventDefault();
                return;
            }
            if (event.key === "Escape") {
                if (expandedBlockId) {
                    setExpandedBlockId(null);
                } else {
                    setTool("select");
                    setSelectedObjectId(null);
                    setSelectedContextIds([]);
                    setManualContextNodes([]);
                }
                return;
            }
            if ((event.key === "Backspace" || event.key === "Delete") && selectedObjectId) {
                event.preventDefault();
                updateObjects((current) => current.filter((object) => object.id !== selectedObjectId));
                setSelectedContextIds((current) => current.filter((id) => id !== selectedObjectId));
                setSelectedObjectId(null);
                return;
            }
            const toolByKey: Record<string, WorkspaceCanvasTool> = {
                v: "select",
                h: "hand",
                n: "note",
                r: "rectangle",
                o: "ellipse",
                d: "diamond",
                c: "connector",
                p: "draw",
            };
            const nextTool = toolByKey[event.key.toLowerCase()];
            if (nextTool) {
                setTool(nextTool);
                event.preventDefault();
            } else if (event.key === "0") {
                fitAll();
            } else if (event.key === "=" || event.key === "+") {
                zoomBy(1.15);
            } else if (event.key === "-") {
                zoomBy(1 / 1.15);
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code === "Space") {
                spacePressedRef.current = false;
            }
        };
        const onWindowBlur = () => {
            spacePressedRef.current = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onWindowBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onWindowBlur);
        };
    }, [
        cycleMru,
        expandedBlockId,
        fitAll,
        focusCanvasBlock,
        goToBookmark,
        navigateCanvas,
        nudgeSelectedCluster,
        resetView,
        saveBookmark,
        selectedObjectId,
        toggleFitFocused,
        toggleHome,
        updateObjects,
        zoomBy,
    ]);

    const canvasInstructionsId = `workspace-canvas-instructions-${tabId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
    const selectedCanvasObject = selectedObjectId
        ? objects.find((object) => object.id === selectedObjectId)
        : undefined;
    const canvasSelectionStatus = selectedCanvasObject
        ? `${canvasObjectLabel(selectedCanvasObject)} selected`
        : selectedBlockId
          ? `Widget ${Math.max(1, blockIds.indexOf(selectedBlockId) + 1)} selected`
          : "No canvas item selected";

    return (
        <div
            ref={viewportRef}
            className={`workspace-canvas is-tool-${tool}`}
            tabIndex={0}
            onPointerDownCapture={onCanvasPointerDownCapture}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
            onWheel={onWheel}
            onContextMenu={showCanvasContextMenu}
            aria-label="Workspace canvas"
            aria-describedby={canvasInstructionsId}
        >
            <p id={canvasInstructionsId} className="workspace-canvas-accessibility-text">
                Infinite workspace canvas. Scroll to pan, hold Command or Control while scrolling to zoom, and use
                Command or Control with arrow keys to move spatial focus. Right-click for canvas commands.
            </p>
            <p className="workspace-canvas-accessibility-text" aria-live="polite" aria-atomic="true">
                {canvasSelectionStatus}
            </p>
            <div
                className="workspace-canvas-grid"
                style={{
                    backgroundSize: `${96 * camera.zoom}px ${96 * camera.zoom}px, ${96 * camera.zoom}px ${96 * camera.zoom}px, ${24 * camera.zoom}px ${24 * camera.zoom}px`,
                    backgroundPosition: `${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px`,
                }}
            />
            {CanvasChromeEnabled ? (
                <>
                    <div
                        className="workspace-canvas-hud"
                        data-canvas-overlay
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <div className="workspace-canvas-identity">
                            <LayoutGrid />
                            <span>KronTerm · Drift canvas</span>
                            <span className="workspace-canvas-zoom">{Math.round(camera.zoom * 100)}%</span>
                            <div className="workspace-canvas-bookmarks" role="group" aria-label="Canvas bookmarks">
                                <Bookmark aria-hidden="true" />
                                {["1", "2", "3", "4"].map((slot) => (
                                    <button
                                        type="button"
                                        key={slot}
                                        className={bookmarks[slot] ? "is-set" : ""}
                                        onClick={() => (bookmarks[slot] ? goToBookmark(slot) : saveBookmark(slot))}
                                        title={
                                            bookmarks[slot]
                                                ? `Go to bookmark ${slot} (Mod+${slot})`
                                                : `Save bookmark ${slot} (Mod+Shift+${slot})`
                                        }
                                        aria-label={
                                            bookmarks[slot] ? `Go to bookmark ${slot}` : `Save bookmark ${slot}`
                                        }
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                            {selectedClusterIds.length > 1 ? (
                                <span className="workspace-canvas-cluster-count">
                                    {selectedClusterIds.length} snapped
                                </span>
                            ) : null}
                            {totalContextCount > 0 ? (
                                <span className="workspace-canvas-context-count">
                                    {totalContextCount} {contextMode === "follow" ? "to follow" : "quoted"}
                                </span>
                            ) : null}
                            <div
                                className="workspace-canvas-context-mode"
                                role="group"
                                aria-label="Canvas chat context mode"
                            >
                                {(["follow", "quote"] as const).map((mode) => (
                                    <button
                                        type="button"
                                        key={mode}
                                        className={contextMode === mode ? "is-active" : ""}
                                        onClick={() =>
                                            setComposerContext((current) => ({
                                                ...current,
                                                mode,
                                                tabid: tabId,
                                            }))
                                        }
                                        aria-pressed={contextMode === mode}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                            {totalContextCount > 0 ? (
                                <button
                                    type="button"
                                    className="workspace-canvas-context-clear"
                                    onClick={() => {
                                        setSelectedContextIds([]);
                                        setManualContextNodes([]);
                                    }}
                                    title="Clear canvas chat context"
                                    aria-label="Clear canvas chat context"
                                >
                                    <X />
                                </button>
                            ) : null}
                        </div>
                        <div className="workspace-canvas-view-actions">
                            <button
                                type="button"
                                onClick={() => selectedBlockId && focusCanvasBlock(selectedBlockId)}
                                disabled={!selectedBlockId}
                                title="Center focused window (Mod+C)"
                            >
                                <Target />
                            </button>
                            <button type="button" onClick={() => zoomBy(1 / 1.15)} title="Zoom out (-)">
                                <ZoomOut />
                            </button>
                            <button type="button" onClick={() => zoomBy(1.15)} title="Zoom in (+)">
                                <ZoomIn />
                            </button>
                            <button type="button" onClick={fitAll} title="Fit everything (0)">
                                <Scan />
                                Fit
                            </button>
                            <button type="button" onClick={resetView} title="Reset camera to 100%">
                                <RotateCcw />
                                100%
                            </button>
                            <button type="button" onClick={arrangeWidgets} disabled={blockIds.length === 0}>
                                <LayoutGrid />
                                Arrange
                            </button>
                        </div>
                    </div>

                    <nav
                        className="workspace-canvas-tools"
                        aria-label="Canvas tools"
                        data-canvas-overlay
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {ToolDefinitions.map((definition) => {
                            const Icon = definition.icon;
                            return (
                                <button
                                    type="button"
                                    key={definition.id}
                                    className={tool === definition.id ? "is-active" : ""}
                                    onClick={() => setTool(definition.id)}
                                    title={`${definition.label} (${definition.shortcut})`}
                                    aria-label={`${definition.label}, shortcut ${definition.shortcut}`}
                                    aria-pressed={tool === definition.id}
                                >
                                    <Icon />
                                    <span>{definition.shortcut}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div
                        className="workspace-canvas-widget-dock"
                        data-canvas-overlay
                        onPointerDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                        role="toolbar"
                        aria-label="KronTerm widgets"
                    >
                        <div className="workspace-canvas-widget-dock-items">
                            {dockWidgets.map(([key, widget]) => {
                                const view = widget.blockdef?.meta?.view;
                                const chamber = view === "chathubv2";
                                const label = chamber ? "Chamber V2" : widget.label || view || key;
                                return (
                                    <button
                                        type="button"
                                        key={key}
                                        className={`workspace-canvas-widget-dock-button ${chamber ? "is-chamber" : ""}`}
                                        onClick={() => void launchWidget(key, widget)}
                                        disabled={launchingWidget != null}
                                        title={`Open ${label}`}
                                        aria-label={`Open ${label}`}
                                    >
                                        <i
                                            className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })}
                                            style={{ color: widget.color }}
                                        />
                                        {chamber && <span>Chamber V2</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <span className="workspace-canvas-dock-divider" />
                        <div className="workspace-canvas-widget-launcher">
                            <button
                                type="button"
                                className={`workspace-canvas-widget-dock-button is-system ${widgetMenuOpen ? "is-active" : ""}`}
                                onClick={() => setWidgetMenuOpen((open) => !open)}
                                title="Add widget or canvas item"
                                aria-label="Add widget or canvas item"
                                aria-expanded={widgetMenuOpen}
                            >
                                <i className={makeIconClass("plus", true)} />
                            </button>
                            {widgetMenuOpen ? (
                                <div className="workspace-canvas-widget-menu">
                                    <div className="workspace-canvas-widget-search">
                                        <Search />
                                        <input
                                            value={widgetQuery}
                                            onChange={(event) => setWidgetQuery(event.target.value)}
                                            placeholder="Search widgets and canvas items…"
                                            aria-label="Search widgets and canvas items"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setWidgetMenuOpen(false)}
                                            title="Close widget menu"
                                            aria-label="Close widget menu"
                                        >
                                            <X />
                                        </button>
                                    </div>
                                    <div className="workspace-canvas-widget-list">
                                        {WidgetMenuGroups.map((group) => {
                                            const entries = groupedWidgets[group];
                                            const includeApps = group === "System" && appsWidgetEntry == null;
                                            const includeSettings = group === "System" && settingsWidgetEntry == null;
                                            const includeCanvasItems = group === "Custom";
                                            if (
                                                entries.length === 0 &&
                                                !includeApps &&
                                                !includeSettings &&
                                                !includeCanvasItems
                                            ) {
                                                return null;
                                            }
                                            return (
                                                <section className="workspace-canvas-widget-group" key={group}>
                                                    <h3>{group}</h3>
                                                    <div className="workspace-canvas-widget-group-items">
                                                        {entries.map(([key, widget]) => {
                                                            const label =
                                                                widget.label || widget.blockdef?.meta?.view || key;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={key}
                                                                    onClick={() => void launchWidget(key, widget)}
                                                                    disabled={launchingWidget != null}
                                                                    title={`Open ${label}`}
                                                                    aria-label={`Open ${label}`}
                                                                >
                                                                    <i
                                                                        className={makeIconClass(widget.icon, true, {
                                                                            defaultIcon: "browser",
                                                                        })}
                                                                        style={{ color: widget.color }}
                                                                    />
                                                                    <span>
                                                                        <strong>{label}</strong>
                                                                        <small>
                                                                            {widget.description ||
                                                                                "Open at the center of this canvas"}
                                                                        </small>
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                        {includeApps ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void launchApps()}
                                                                disabled={launchingWidget != null}
                                                                title="Open Apps"
                                                                aria-label="Open Apps"
                                                            >
                                                                <i className={makeIconClass("shapes", true)} />
                                                                <span>
                                                                    <strong>Apps</strong>
                                                                    <small>
                                                                        Stream an installed app into the canvas
                                                                    </small>
                                                                </span>
                                                            </button>
                                                        ) : null}
                                                        {includeSettings ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void launchSettings()}
                                                                disabled={launchingWidget != null}
                                                                title="Open Settings"
                                                                aria-label="Open Settings"
                                                            >
                                                                <i className={makeIconClass("gear", true)} />
                                                                <span>
                                                                    <strong>Settings</strong>
                                                                    <small>Open KronTerm settings in the canvas</small>
                                                                </span>
                                                            </button>
                                                        ) : null}
                                                        {includeCanvasItems ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => runMenuAction(addNote)}
                                                                    title="Add note"
                                                                    aria-label="Add note"
                                                                >
                                                                    <StickyNote />
                                                                    <span>
                                                                        <strong>Note</strong>
                                                                        <small>Add a note at the canvas center</small>
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => runMenuAction(addFlowTemplate)}
                                                                    title="Add flow"
                                                                    aria-label="Add flow"
                                                                >
                                                                    <Network />
                                                                    <span>
                                                                        <strong>Flow</strong>
                                                                        <small>
                                                                            Insert a connected starter workflow
                                                                        </small>
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => runMenuAction(addMindMapTemplate)}
                                                                    title="Add mind map"
                                                                    aria-label="Add mind map"
                                                                >
                                                                    <GitFork />
                                                                    <span>
                                                                        <strong>Mind map</strong>
                                                                        <small>
                                                                            Insert a central idea with four branches
                                                                        </small>
                                                                    </span>
                                                                </button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </section>
                                            );
                                        })}
                                        {widgets.length === 0 && widgetQuery ? (
                                            <p>
                                                No widgets match “{widgetQuery}”. Canvas items remain available under
                                                Custom.
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </>
            ) : null}

            {objects.length === 0 && blockIds.length === 0 ? (
                <div className="workspace-canvas-empty-state" aria-live="polite">
                    <strong>Empty canvas</strong>
                    <span>Drop in a widget or start a Hermes task to build spatially.</span>
                </div>
            ) : null}

            <div
                className={`workspace-canvas-world ${expandedBlockId ? "has-expanded" : ""}`}
                style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}
            >
                <AgentLineageEdges objects={objects} />
                <WidgetTaskEdges objects={objects} rects={rects} />
                {objects.map((object) => (
                    <CanvasObjectView
                        key={object.id}
                        object={object}
                        selected={selectedObjectId === object.id}
                        contextSelected={selectedContextIds.includes(object.id)}
                        tool={tool}
                        onSelect={(id, additive) => {
                            setSelectedObjectId(id);
                            setSelectedBlockId(null);
                            const target = objectsRef.current.find((object) => object.id === id);
                            if (target?.kind === "agent") {
                                setManualContextNodes([]);
                                setSelectedContextIds((current) =>
                                    toggleCanvasContextSelection(current, id, contextMode, additive)
                                );
                            }
                        }}
                        onStartMove={startObjectMove}
                        onStartResize={startObjectResize}
                        onChange={updateObject}
                        onShowContextMenu={showAgentContextMenu}
                    />
                ))}
                {blockIds.map((blockId, index) => (
                    <WorkspaceCanvasNode
                        key={blockId}
                        blockId={blockId}
                        contextSelected={manualContextNodes.some((node) => node.blockid === blockId)}
                        index={index}
                        rect={
                            rects[blockId] ??
                            makeViewportCenteredCanvasRect(DefaultCamera, viewportSize, DefaultWidgetSize)
                        }
                        selected={selectedBlockId === blockId}
                        clustered={selectedClusterIds.includes(blockId)}
                        expanded={expandedBlockId === blockId}
                        zoom={camera.zoom}
                        camera={expandedBlockId === blockId ? camera : DefaultCamera}
                        viewportSize={viewportSize}
                        onSelect={(id) => {
                            focusCanvasBlock(id, false);
                        }}
                        onRectChange={updateRect}
                        onShowContextMenu={showBlockContextMenu}
                        onToggleExpand={toggleExpand}
                        onEdgePan={edgePanAtPoint}
                    />
                ))}
            </div>

            {latestBatchRun ? (
                <WorkspaceCanvasBatchPanel
                    run={latestBatchRun}
                    onFocusCurrent={() => {
                        if (latestBatchRun.current) {
                            setAgentTaskContext(latestBatchRun.current, "follow");
                        }
                    }}
                    onOpenOutputs={() => {
                        const outputIds = latestBatchRun.cards
                            .filter((card) => !isAgentActivityActive(card.agent.phase) && card.agent.phase !== "queued")
                            .map((card) => card.id);
                        setManualContextNodes([]);
                        setSelectedContextIds(outputIds);
                        setComposerContext((current) => ({ ...current, mode: "quote", tabid: tabId }));
                    }}
                />
            ) : null}

            {expandedBlockId ? <div className="workspace-canvas-expanded-backdrop" /> : null}

            {CanvasChromeEnabled ? (
                <div className="workspace-canvas-help">
                    Mod+Arrow jump · Shift+drag/resize acts on a snapped cluster · Mod+W overview · Mod+A home · Mod+1–4
                    bookmarks · Scroll pans · Mod+scroll zooms
                </div>
            ) : null}
        </div>
    );
});
WorkspaceCanvas.displayName = "WorkspaceCanvas";
