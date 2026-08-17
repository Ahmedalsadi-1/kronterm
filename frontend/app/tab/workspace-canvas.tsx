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
import { aggregateWorkspaceCanvasRuns, type WorkspaceCanvasRunAggregate } from "./workspace-canvas-task-graph";
import {
    canvasBoundsForRects,
    clampCanvasZoom,
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

const DefaultCamera: WorkspaceCanvasCamera = { x: 80, y: 70, zoom: 0.9 };
const DefaultWidgetSize: WorkspaceCanvasSize = { width: 840, height: 540 };
const DefaultNoteSize: WorkspaceCanvasSize = { width: 240, height: 176 };
const CanvasSaveDelayMs = 180;

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
        ["term", "preview", "chathubv2", "waveai", "kronoschat", "design", "vdom"].includes(view)
    ) {
        return "Work";
    }
    return "Custom";
}

function canvasSurfaceForView(view: string): CanvasComposerContextNode["surface"] {
    if (view === "web") {
        return "browser";
    }
    if (view === "sandbox" || view === "installedapps" || view === "design") {
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
    onRectChange: (blockId: string, rect: WorkspaceCanvasRect) => void;
    onToggleExpand: (blockId: string) => void;
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

const WorkspaceCanvasNode = memo(
    ({
        blockId,
        contextSelected,
        index,
        rect,
        selected,
        expanded,
        zoom,
        camera,
        viewportSize,
        onSelect,
        onShowContextMenu,
        onRectChange,
        onToggleExpand,
    }: CanvasNodeProps) => {
        const dragStartRef = useRef<{ x: number; y: number; rect: WorkspaceCanvasRect } | null>(null);
        const resizeStartRef = useRef<{ x: number; y: number; rect: WorkspaceCanvasRect } | null>(null);
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
                    onRectChange(blockId, {
                        ...start.rect,
                        x: start.rect.x + (event.clientX - start.x) / zoom,
                        y: start.rect.y + (event.clientY - start.y) / zoom,
                    });
                    return;
                }
                if (resizeStartRef.current) {
                    const start = resizeStartRef.current;
                    onRectChange(blockId, {
                        ...start.rect,
                        width: Math.max(400, start.rect.width + (event.clientX - start.x) / zoom),
                        height: Math.max(300, start.rect.height + (event.clientY - start.y) / zoom),
                    });
                }
            },
            [blockId, onRectChange, zoom]
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
            dragStartRef.current = { x: event.clientX, y: event.clientY, rect };
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
            resizeStartRef.current = { x: event.clientX, y: event.clientY, rect };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        return (
            <div
                className={`workspace-canvas-node ${selected ? "is-selected" : ""} ${
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
    const pendingRequestRef = useRef<string | null>(null);
    const activityRunAliasesRef = useRef(new Map<string, string>());
    const removedLegacyDemoRef = useRef(initialObjects.length !== storedObjects.length);
    const spacePressedRef = useRef(false);
    const [viewportSize, setViewportSize] = useState<WorkspaceCanvasSize>({ width: 0, height: 0 });
    const viewportSizeRef = useRef(viewportSize);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(tabData.blockids?.[0] ?? null);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    const [tool, setTool] = useState<WorkspaceCanvasTool>("select");
    const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
    const [widgetQuery, setWidgetQuery] = useState("");
    const [launchingWidget, setLaunchingWidget] = useState<string | null>(null);
    const [camera, setCamera] = useState<WorkspaceCanvasCamera>(() => canvasState.camera ?? DefaultCamera);
    const [rects, setRects] = useState<Record<string, WorkspaceCanvasRect>>(() => canvasState.rects ?? {});
    const [objects, setObjects] = useState<WorkspaceCanvasObject[]>(() => initialObjects);
    const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
    const [manualContextNodes, setManualContextNodes] = useState<CanvasComposerContextNode[]>([]);
    const cameraRef = useRef(camera);
    const rectsRef = useRef(rects);
    const objectsRef = useRef(objects);
    const blockIds = tabData.blockids ?? [];
    const blockIdsKey = blockIds.join("|");
    const contextMode = composerContext.tabid === tabId ? composerContext.mode : "follow";
    const totalContextCount = selectedContextIds.length + manualContextNodes.length;

    const latestBatchRun = useMemo(() => {
        const cards = objects.filter((object): object is WorkspaceCanvasAgentCard => object.kind === "agent");
        return aggregateWorkspaceCanvasRuns(cards).find((run) => run.total > 1);
    }, [objects]);

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
                    version: 3,
                    camera: cameraRef.current,
                    rects: rectsRef.current,
                    objects: objectsRef.current,
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

    useEffect(() => {
        if (!removedLegacyDemoRef.current) {
            return;
        }
        removedLegacyDemoRef.current = false;
        persistCanvasState();
    }, [persistCanvasState]);

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
        setComposerContext((current) => ({
            active: true,
            mode: current.tabid === tabId ? current.mode : "follow",
            nodes,
            tabid: tabId,
            viewport: viewportBounds
                ? {
                      left: viewportBounds.left,
                      width: viewportBounds.width,
                  }
                : undefined,
        }));
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
                const placement: WorkspaceCanvasRect = existing ?? {
                    x: parent
                        ? parent.x + parent.width + 96
                        : linkedBlock
                          ? linkedBlock.x + linkedBlock.width + 96
                          : viewportCenter.x - WorkspaceAgentCardSize.width / 2 + (rootIndex % 3) * 42,
                    y: parent
                        ? parent.y + siblingIndex * (WorkspaceAgentCardSize.height + 28)
                        : linkedBlock
                          ? linkedBlock.y
                          : viewportCenter.y -
                            WorkspaceAgentCardSize.height / 2 +
                            Math.floor(rootIndex / 3) * (WorkspaceAgentCardSize.height + 28),
                    ...WorkspaceAgentCardSize,
                };
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
            const request = makeCanvasRequestCard(detail.prompt, detail.contextids, {
                x: parent ? parent.x + parent.width + 96 : viewportCenter.x - WorkspaceAgentCardSize.width / 2,
                y: parent
                    ? parent.y + siblingIndex * (WorkspaceAgentCardSize.height + 28)
                    : viewportCenter.y - WorkspaceAgentCardSize.height / 2,
            });
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
        let placementIndex = 0;
        updateRects((current) => {
            const next = Object.fromEntries(Object.entries(current).filter(([blockId]) => activeIds.has(blockId)));
            let changed = Object.keys(next).length !== Object.keys(current).length;
            for (const blockId of blockIds) {
                if (next[blockId]) {
                    continue;
                }
                const column = placementIndex % 2;
                const row = Math.floor(placementIndex / 2);
                next[blockId] = makeViewportCenteredCanvasRect(cameraRef.current, viewportSize, DefaultWidgetSize, {
                    x: column * 70 - 35,
                    y: row * 56 - 28,
                });
                placementIndex += 1;
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
        (blockId: string, rect: WorkspaceCanvasRect) => {
            updateRects((current) => ({ ...current, [blockId]: rect }));
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

    const startPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        interactionRef.current = {
            kind: "pan",
            pointerId: event.pointerId,
            startClient: { x: event.clientX, y: event.clientY },
            startCamera: cameraRef.current,
        };
        capturePointer(event.pointerId);
    }, []);

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
            const object: WorkspaceCanvasObject = {
                id: makeObjectId("note"),
                kind: "note",
                x: Math.round(point.x - DefaultNoteSize.width / 2),
                y: Math.round(point.y - DefaultNoteSize.height / 2),
                ...DefaultNoteSize,
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
            const moved = {
                ...interaction.startObject,
                x: interaction.startObject.x + dx,
                y: interaction.startObject.y + dy,
                ...("points" in interaction.startObject
                    ? {
                          points: interaction.startObject.points?.map((point) => ({
                              x: point.x + dx,
                              y: point.y + dy,
                          })),
                      }
                    : {}),
            };
            objectsRef.current = objectsRef.current.map((object) =>
                object.id === interaction.objectId ? moved : object
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
        persistCanvasState();
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
            try {
                const blockId = await createBlock(blockDef, false);
                const rect = makeViewportCenteredCanvasRect(
                    cameraRef.current,
                    viewportSizeRef.current,
                    DefaultWidgetSize,
                    {
                        x: (Object.keys(rectsRef.current).length % 5) * 30,
                        y: (Object.keys(rectsRef.current).length % 5) * 24,
                    }
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
                    { label: "Expand widget", click: () => setExpandedBlockId(blockId) },
                ],
                event
            );
        },
        [setBlockTaskContext]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const viewport = viewportRef.current;
            if (!viewport || !(event.target instanceof Node) || !viewport.contains(event.target)) {
                return;
            }
            if (isCanvasShortcutInteractiveTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
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
    }, [expandedBlockId, fitAll, selectedObjectId, updateObjects, zoomBy]);

    const toggleExpand = useCallback((blockId: string) => {
        setExpandedBlockId((current) => (current === blockId ? null : blockId));
        setSelectedBlockId(blockId);
    }, []);

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
            aria-label="Workspace canvas"
        >
            <div
                className="workspace-canvas-grid"
                style={{
                    backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px`,
                    backgroundPosition: `${camera.x}px ${camera.y}px`,
                }}
            />
            <div
                className="workspace-canvas-hud"
                data-canvas-overlay
                onPointerDown={(event) => event.stopPropagation()}
            >
                <div className="workspace-canvas-identity">
                    <LayoutGrid />
                    <span>Context playground</span>
                    <span className="workspace-canvas-zoom">{Math.round(camera.zoom * 100)}%</span>
                    {totalContextCount > 0 ? (
                        <span className="workspace-canvas-context-count">
                            {totalContextCount} {contextMode === "follow" ? "to follow" : "quoted"}
                        </span>
                    ) : null}
                    <div className="workspace-canvas-context-mode" role="group" aria-label="Canvas chat context mode">
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
                                                    const label = widget.label || widget.blockdef?.meta?.view || key;
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
                                                            <small>Stream an installed app into the canvas</small>
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
                                                                <small>Insert a connected starter workflow</small>
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
                                                                <small>Insert a central idea with four branches</small>
                                                            </span>
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </section>
                                    );
                                })}
                                {widgets.length === 0 && widgetQuery ? (
                                    <p>No widgets match “{widgetQuery}”. Canvas items remain available under Custom.</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {objects.length === 0 && blockIds.length === 0 ? (
                <div className="workspace-canvas-empty-state" aria-live="polite">
                    <Bot aria-hidden="true" />
                    <strong>Live Kronos task map</strong>
                    <span>
                        Start a task below. Decisions, tools, evidence, and outputs will connect here as they happen.
                    </span>
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
                        expanded={expandedBlockId === blockId}
                        zoom={camera.zoom}
                        camera={camera}
                        viewportSize={viewportSize}
                        onSelect={(id) => {
                            setSelectedBlockId(id);
                            setSelectedObjectId(null);
                        }}
                        onRectChange={updateRect}
                        onShowContextMenu={showBlockContextMenu}
                        onToggleExpand={toggleExpand}
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

            <div className="workspace-canvas-help">
                Select an agent card to continue from it · Quote mode + Shift/⌘ selects multiple cards · Scroll to pan ·
                Ctrl/⌘ + scroll to zoom
            </div>
        </div>
    );
});
WorkspaceCanvas.displayName = "WorkspaceCanvas";
