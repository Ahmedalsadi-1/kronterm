// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Portions adapted from MIT-licensed canvas-cowork projects:
// - https://github.com/inspirepan/canvas-cowork
// - https://github.com/flowith-ai/canvas-cowork

import { createBlockSplitHorizontally } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { atoms } from "@/store/global";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { Bot, Boxes, FileText, Folder, Image, Layers, MonitorPlay, Save, Type } from \"lucide-react\";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AssetRecordType,
    createShapeId,
    getSnapshot,
    loadSnapshot,
    toRichText,
    type Editor,
    type TLShape,
} from "tldraw";
import "tldraw/tldraw.css";
import { CanvasEditor } from "./canvas-cowork/canvas-editor";
import { OutlinePanel } from "./canvas-cowork/outline-panel";
import type { KronosCanvasViewModel } from "./kronoscanvas-model";
import {
    extractCanvasEdgesFromArrowBindings,
    type ArrowBindingLike,
    type KronosCanvasNodeType,
} from "./kronoscanvas-utils";
import "./kronoscanvas.scss";

type SaveState = "idle" | "saving" | "saved" | "error";

type ShapeMeta = {
    kronosNodeId?: string;
    kronosNodeType?: KronosCanvasNodeType;
    kronosWidgetId?: string;
    kronosAppId?: string;
    kronosAppName?: string;
    kronosSessionId?: string;
    kronosStatus?: string;
};

const SaveDelayMs = 650;

function readShapeMeta(shape: TLShape | null | undefined): ShapeMeta {
    return ((shape?.meta ?? {}) as ShapeMeta) ?? {};
}

function shapeIdString(shape: TLShape): string {
    return String(shape.id);
}

function nodeIdForShape(shape: TLShape): string {
    return readShapeMeta(shape).kronosNodeId || shapeIdString(shape);
}

function shapeNodeType(shape: TLShape): KronosCanvasNodeType | null {
    const metaType = readShapeMeta(shape).kronosNodeType;
    if (metaType) {
        return metaType;
    }
    if (shape.type === "frame") {
        return "frame";
    }
    if (shape.type === "named_text" || shape.type === "text" || shape.type === "geo") {
        return "text";
    }
    if (shape.type === "image") {
        return "image";
    }
    return null;
}

function shapeTitle(editor: Editor, shape: TLShape): string {
    const meta = readShapeMeta(shape);
    if (meta.kronosAppName) {
        return meta.kronosAppName;
    }
    const text = shapePlainText(shape)?.trim();
    if (text) {
        return text.split("\n")[0].slice(0, 120);
    }
    if (shape.type === "named_text") {
        return String((shape.props as any).name || "Text");
    }
    if (shape.type === "frame") {
        return String((shape.props as any).name || "Frame");
    }
    if (shape.type === "image") {
        const assetId = (shape.props as any).assetId;
        const asset = assetId ? editor.getAsset(assetId) : null;
        return String((asset?.props as any)?.name || "Image");
    }
    return shape.type;
}

function shapePlainText(shape: TLShape): string {
    const props = (shape.props ?? {}) as { richText?: unknown; name?: string; text?: string };
    if (typeof props.text === "string" && props.text.trim()) {
        return props.text;
    }
    if (shape.type !== "named_text" && typeof props.name === "string" && props.name.trim()) {
        return props.name;
    }
    return richTextToPlainText(props.richText);
}

function richTextToPlainText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(richTextToPlainText).join("");
    }
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.text === "string") {
            return record.text;
        }
        return Object.values(record).map(richTextToPlainText).join("");
    }
    return "";
}

function buildCanvasDocument(editor: Editor): CanvasDocument {
    const shapes = editor.getCurrentPageShapes();
    const shapeToNode = new Map<string, string>();
    const nodes: CanvasNode[] = [];
    for (const shape of shapes) {
        const type = shapeNodeType(shape);
        if (!type) {
            continue;
        }
        const id = nodeIdForShape(shape);
        shapeToNode.set(shapeIdString(shape), id);
        const meta = readShapeMeta(shape);
        nodes.push({
            id,
            shapeid: shapeIdString(shape),
            type,
            title: shapeTitle(editor, shape),
            content: shapePlainText(shape),
            parentid: String(shape.parentId ?? ""),
            appid: meta.kronosAppId,
            appname: meta.kronosAppName,
            sessionid: meta.kronosSessionId,
            status: meta.kronosStatus,
            meta: { ...shape.meta },
        });
    }
    const arrowBindings = shapes
        .filter((shape) => shape.type === "arrow")
        .flatMap((shape) => editor.getBindingsFromShape(shape, "arrow") as unknown as ArrowBindingLike[]);
    return {
        version: 1,
        snapshot: getSnapshot(editor.store) as unknown as Record<string, unknown>,
        shapetonode: Object.fromEntries(shapeToNode.entries()),
        nodes,
        edges: extractCanvasEdgesFromArrowBindings(arrowBindings, shapeToNode),
    };
}

function canvasPoint(editor: Editor, offsetX = 0, offsetY = 0): { x: number; y: number } {
    const bounds = editor.getViewportPageBounds();
    return {
        x: Math.round(bounds.x + bounds.w / 2 + offsetX),
        y: Math.round(bounds.y + bounds.h / 2 + offsetY),
    };
}

function createGeoNode(editor: Editor, title: string, type: KronosCanvasNodeType, meta: ShapeMeta, offsetX = 0) {
    const id = createShapeId();
    const point = canvasPoint(editor, offsetX);
    editor.createShape({
        id,
        type: "geo",
        x: point.x,
        y: point.y,
        props: {
            geo: "rectangle",
            w: type === \"appstream\" ? 260 : 220,
            h: type === \"appstream\" ? 120 : 92,
            color: type === \"appstream\" ? \"violet\" : type === \"aichat\" ? \"orange\" : type === \"widget\" ? \"blue\" : \"black\",
            fill: \"solid\",
            dash: "solid",
            size: "m",
            font: "draw",
            align: "middle",
            verticalAlign: "middle",
            labelColor: "black",
            richText: toRichText(title),
            growY: 0,
            url: "",
            scale: 1,
        },
        meta: {
            ...meta,
            kronosNodeId: String(id),
            kronosNodeType: type,
        },
    } as any);
    editor.select(id);
}

function ensureDocumentNodesHaveShapes(editor: Editor, nodes: CanvasNode[]): boolean {
    const existingNodeIds = new Set(editor.getCurrentPageShapes().map((shape) => nodeIdForShape(shape)));
    let changed = false;
    let offset = 0;
    for (const node of nodes) {
        if (!node.id || existingNodeIds.has(node.id)) {
            continue;
        }
        const type = (node.type || "text") as KronosCanvasNodeType;
        const point = canvasPoint(editor, offset, offset / 2);
        const id = createShapeId();
        if (type === "frame") {
            editor.createShape({
                id,
                type: "frame",
                x: point.x,
                y: point.y,
                props: { w: 420, h: 280, name: node.title || "Canvas group" },
                meta: {
                    ...(node.meta ?? {}),
                    kronosNodeId: node.id,
                    kronosNodeType: \"frame\",
                },
            } as any);
        } else if (type === \"widget\" || type === \"appstream\" || type === \"aichat\") {
            editor.createShape({
                id,
                type: \"geo\",
                x: point.x,
                y: point.y,
                props: {
                    geo: \"rectangle\",
                    w: type === \"appstream\" ? 260 : 220,
                    h: type === \"appstream\" ? 120 : 92,
                    color: type === \"appstream\" ? \"violet\" : type === \"aichat\" ? \"orange\" : \"blue\",
                    fill: \"solid\",
                    dash: \"solid\",
                    size: \"m\",
                    font: \"draw\",
                    align: \"middle\",
                    verticalAlign: \"middle\",
                    labelColor: \"black\",
                    richText: toRichText(node.title || node.appname || type),
                    growY: 0,
                    url: \"\",
                    scale: 1,
                },
                meta: {
                    ...(node.meta ?? {}),
                    kronosNodeId: node.id,
                    kronosNodeType: type,
                    kronosAppId: node.appid,
                    kronosAppName: node.appname,
                    kronosSessionId: node.sessionid,
                    kronosStatus: node.status,
                },
            } as any);
        } else {
            editor.createShape({
                id,
                type: "named_text",
                x: point.x,
                y: point.y,
                props: {
                    name: node.title || "note",
                    text: node.content || node.title || "",
                    w: 260,
                },
                meta: {
                    ...(node.meta ?? {}),
                    kronosNodeId: node.id,
                    kronosNodeType: "text",
                    kronosStatus: node.status,
                },
            } as any);
        }
        existingNodeIds.add(node.id);
        changed = true;
        offset += 36;
    }
    return changed;
}

function useInstalledApps() {
    const [apps, setApps] = useState<InstalledAppInfo[]>([]);
    useEffect(() => {
        let cancelled = false;
        void RpcApi.ListInstalledAppsCommand(TabRpcClient)
            .then((nextApps) => {
                if (!cancelled) {
                    setApps(nextApps ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setApps([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);
    return apps;
}

function useWidgetOptions(): WidgetConfigType[] {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    return useMemo(() => {
        const widgets = Object.values(fullConfig?.widgets ?? {}) as WidgetConfigType[];
        return widgets
            .filter((widget) => widget && widget["display:hidden"] !== true)
            .sort((a, b) => (a["display:order"] ?? 0) - (b["display:order"] ?? 0));
    }, [fullConfig]);
}

export const KronosCanvasView = memo(({ blockId }: ViewComponentProps<KronosCanvasViewModel>) => {
    const workspaceId = useAtomValue(atoms.workspaceId);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [outlineNodes, setOutlineNodes] = useState<CanvasNode[]>([]);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [selectedWidgetId, setSelectedWidgetId] = useState("");
    const [selectedAppId, setSelectedAppId] = useState("");
    const saveTimerRef = useRef<number | null>(null);
    const loadedRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const widgets = useWidgetOptions();
    const apps = useInstalledApps();

    useEffect(() => {
        if (!selectedWidgetId && widgets[0]) {
            setSelectedWidgetId(widgets[0].label || widgets[0].blockdef?.meta?.view || "widget");
        }
    }, [selectedWidgetId, widgets]);

    useEffect(() => {
        if (!selectedAppId && apps[0]) {
            setSelectedAppId(apps[0].bundleid || apps[0].appid || apps[0].name);
        }
    }, [apps, selectedAppId]);

    const saveDocument = useCallback(
        async (nextEditor: Editor) => {
            setSaveState("saving");
            try {
                await RpcApi.CanvasSaveCommand(TabRpcClient, {
                    workspaceid: workspaceId,
                    blockid: blockId,
                    document: buildCanvasDocument(nextEditor),
                });
                setSaveState("saved");
            } catch (e) {
                console.error("failed to save kronos canvas", e);
                setSaveState("error");
            }
        },
        [blockId, workspaceId]
    );

    const scheduleSave = useCallback(
        (nextEditor: Editor) => {
            if (!loadedRef.current) {
                return;
            }
            if (saveTimerRef.current != null) {
                window.clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = window.setTimeout(() => {
                saveTimerRef.current = null;
                void saveDocument(nextEditor);
            }, SaveDelayMs);
        },
        [saveDocument]
    );

    const refreshOutline = useCallback((nextEditor: Editor) => {
        const doc = buildCanvasDocument(nextEditor);
        setOutlineNodes(doc.nodes);
    }, []);

    useEffect(() => {
        if (!editor) {
            return;
        }
        let disposed = false;
        loadedRef.current = false;
        void RpcApi.CanvasLoadCommand(TabRpcClient, { workspaceid: workspaceId, blockid: blockId })
            .then((response) => {
                if (disposed) {
                    return;
                }
                const document = response.document;
                const snapshot = document?.snapshot;
                if (snapshot && Object.keys(snapshot).length > 0) {
                    loadSnapshot(editor.store, snapshot as any);
                }
                return ensureDocumentNodesHaveShapes(editor, document?.nodes ?? []);
            })
            .catch((e) => {
                console.error("failed to load kronos canvas", e);
            })
            .then((hydrated) => {
                if (!disposed) {
                    loadedRef.current = true;
                    refreshOutline(editor);
                    if (hydrated) {
                        void saveDocument(editor);
                    }
                }
            })
            .finally(() => {
                if (!disposed) {
                    loadedRef.current = true;
                }
            });
        const unsubDocument = editor.store.listen(
            () => {
                refreshOutline(editor);
                scheduleSave(editor);
            },
            { scope: "document", source: "all" }
        );
        const unsubSession = editor.store.listen(
            () => {
                const selected = editor.getSelectedShapeIds();
                setSelectedShapeId(selected.length === 1 ? String(selected[0]) : null);
            },
            { scope: "session", source: "all" }
        );
        return () => {
            disposed = true;
            unsubDocument();
            unsubSession();
            if (saveTimerRef.current != null) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [blockId, editor, refreshOutline, scheduleSave, workspaceId]);

    const addTextNode = useCallback(() => {
        if (!editor) {
            return;
        }
        const id = createShapeId();
        const point = canvasPoint(editor);
        editor.createShape({
            id,
            type: "named_text",
            x: point.x,
            y: point.y,
            props: {
                name: "note",
                text: "New canvas note",
                w: 260,
            },
            meta: {
                kronosNodeId: String(id),
                kronosNodeType: "text",
            },
        } as any);
        editor.select(id);
    }, [editor]);

    const addFrame = useCallback(() => {
        if (!editor) {
            return;
        }
        const id = createShapeId();
        const point = canvasPoint(editor, -40, -30);
        editor.createShape({
            id,
            type: "frame",
            x: point.x,
            y: point.y,
            props: { w: 420, h: 280, name: "Canvas group" },
            meta: {
                kronosNodeId: String(id),
                kronosNodeType: "frame",
            },
        } as any);
        editor.select(id);
    }, [editor]);

    const addWidgetNode = useCallback(() => {
        if (!editor) {
            return;
        }
        const widget =
            widgets.find((item) => (item.label || item.blockdef?.meta?.view) === selectedWidgetId) ?? widgets[0];
        const label = widget?.label || widget?.blockdef?.meta?.view || "Widget";
        createGeoNode(editor, label, "widget", {
            kronosWidgetId: label,
            kronosStatus: "ready",
        });
    }, [editor, selectedWidgetId, widgets]);

    const addAppStreamNode = useCallback(() => {
        if (!editor) {
            return;
        }
        const app = apps.find((item) => (item.bundleid || item.appid || item.name) === selectedAppId) ?? apps[0];
        const appId = app?.bundleid || app?.appid || app?.name || \"app\";
        const appName = app?.name || appId;
        createGeoNode(editor, appName, \"appstream\", {
            kronosAppId: appId,
            kronosAppName: appName,
            kronosSessionId: `${blockId}:${appId}`,
            kronosStatus: \"idle\",
        });
    }, [apps, blockId, editor, selectedAppId]);

    const addAIChatNode = useCallback(() => {
        if (!editor) {
            return;
        }
        createGeoNode(editor, \"AI Chat\", \"aichat\", {
            kronosStatus: \"ready\",
        });
    }, [editor]);

    const uploadCanvasAsset = useCallback(
        async (file: File, fileName: string) => {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ""));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            const data64 = dataUrl.split(",")[1] ?? "";
            const upload = await RpcApi.CanvasAssetUploadCommand(TabRpcClient, {
                workspaceid: workspaceId,
                blockid: blockId,
                filename: fileName,
                mimetype: file.type || "application/octet-stream",
                data64,
            });
            return upload;
        },
        [blockId, workspaceId]
    );

    const uploadImage = useCallback(
        async (file: File) => {
            if (!editor) {
                return;
            }
            const upload = await uploadCanvasAsset(file, file.name);
            const assetId = AssetRecordType.createId();
            const shapeId = createShapeId();
            const point = canvasPoint(editor);
            editor.createAssets([
                AssetRecordType.create({
                    id: assetId,
                    type: "image",
                    props: {
                        w: 640,
                        h: 420,
                        name: upload.filename,
                        isAnimated: file.type === "image/gif",
                        mimeType: upload.mimetype,
                        src: upload.dataurl,
                    },
                }),
            ]);
            editor.createShape({
                id: shapeId,
                type: "image",
                x: point.x,
                y: point.y,
                props: { w: 320, h: 210, assetId },
                meta: {
                    kronosNodeId: String(shapeId),
                    kronosNodeType: "image",
                },
            } as any);
            editor.select(shapeId);
        },
        [editor, uploadCanvasAsset]
    );

    const selectedShape = useMemo(() => {
        if (!editor || !selectedShapeId) {
            return null;
        }
        return editor.getShape(selectedShapeId as any) ?? null;
    }, [editor, selectedShapeId]);
    const selectedMeta = readShapeMeta(selectedShape);

    const launchSelectedAppStream = useCallback(async () => {
        if (!selectedShape || selectedMeta.kronosNodeType !== "appstream") {
            return;
        }
        await createBlockSplitHorizontally(
            {
                meta: {
                    view: "appstream",
                    "appstream:appid": selectedMeta.kronosAppId,
                    "appstream:appname": selectedMeta.kronosAppName,
                } as unknown as MetaType,
            },
            blockId,
            "after"
        );
        if (editor) {
            editor.updateShapes([
                {
                    ...selectedShape,
                    meta: {
                        ...selectedShape.meta,
                        kronosStatus: "launched",
                    },
                } as any,
            ]);
        }
    }, [
        blockId,
        editor,
        selectedMeta.kronosAppId,
        selectedMeta.kronosAppName,
        selectedMeta.kronosNodeType,
        selectedShape,
    ]);

    return (
        <div className="kronos-canvas-view">
            <CanvasEditor
                onMount={(mountedEditor) => {
                    setEditor(mountedEditor);
                }}
                onOrganize={() => {
                    if (editor) {
                        refreshOutline(editor);
                    }
                }}
                onUploadAsset={async (file, fileName) => {
                    const upload = await uploadCanvasAsset(file, fileName);
                    return { src: upload.dataurl, name: upload.filename };
                }}
            />
            <div className="kronos-canvas-toolbar">
                <button type="button" onClick={addTextNode} title="Add text node">
                    <Type className="h-3.5 w-3.5" />
                    Text
                </button>
                <button type="button" onClick={addFrame} title="Add frame">
                    <Folder className="h-3.5 w-3.5" />
                    Frame
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} title="Add image">
                    <Image className="h-3.5 w-3.5" />
                    Image
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (file) {
                            void uploadImage(file);
                        }
                    }}
                />
                <select
                    value={selectedWidgetId}
                    onChange={(e) => setSelectedWidgetId(e.target.value)}
                    title="Widget source"
                >
                    {widgets.length === 0 ? (
                        <option value="">No widgets</option>
                    ) : (
                        widgets.map((widget) => {
                            const value = widget.label || widget.blockdef?.meta?.view || "widget";
                            return (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            );
                        })
                    )}
                </select>
                <button type="button" onClick={addWidgetNode} disabled={widgets.length === 0} title="Add widget node">
                    <Boxes className="h-3.5 w-3.5" />
                    Widget
                </button>
                <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    title="App stream source"
                >
                    {apps.length === 0 ? (
                        <option value="">No apps</option>
                    ) : (
                        apps.slice(0, 80).map((app) => {
                            const value = app.bundleid || app.appid || app.name;
                            return (
                                <option key={value} value={value}>
                                    {app.name}
                                </option>
                            );
                        })
                    )}
                </select>
                <button
                    type=\"button\"
                    onClick={addAppStreamNode}
                    disabled={apps.length === 0}
                    title=\"Add app stream node\"
                >
                    <MonitorPlay className=\"h-3.5 w-3.5\" />
                    App
                </button>
                <button type=\"button\" onClick={addAIChatNode} title=\"Add AI Chat node\">
                    <Bot className=\"h-3.5 w-3.5\" />
                    AI
                </button>
                <span className={cn(\"kronos-canvas-save-state\", saveState === \"error\" && \"text-red-400\")}>
                    <Save className="mr-1 inline h-3 w-3" />
                    {saveState === "saving"
                        ? "Saving"
                        : saveState === "saved"
                          ? "Saved"
                          : saveState === "error"
                            ? "Save failed"
                            : "Ready"}
                </span>
            </div>
            <OutlinePanel editor={editor} nodes={outlineNodes} />
            {selectedShape ? (
                <div className="kronos-canvas-selection">
                    <div className="kronos-canvas-selection-title">{shapeTitle(editor!, selectedShape)}</div>
                    <div className="kronos-canvas-selection-meta">
                        {selectedMeta.kronosNodeType ?? shapeNodeType(selectedShape) ?? selectedShape.type}
                        {selectedMeta.kronosStatus ? ` · ${selectedMeta.kronosStatus}` : ""}
                    </div>
                    {selectedMeta.kronosNodeType === "appstream" ? (
                        <button type="button" className="mt-3" onClick={() => void launchSelectedAppStream()}>
                            <MonitorPlay className="h-3.5 w-3.5" />
                            Launch stream block
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
});

KronosCanvasView.displayName = "KronosCanvasView";

const CanvasOutline = memo(({ editor, nodes }: { editor: Editor | null; nodes: CanvasNode[] }) => {
    if (!editor) {
        return null;
    }
    return (
        <div className="kronos-canvas-outline">
            <div className="kronos-canvas-outline-header">
                <Layers className="h-3.5 w-3.5" />
                Canvas Outline
            </div>
            {nodes.length === 0 ? (
                <div className="kronos-canvas-outline-empty">No canvas nodes</div>
            ) : (
                nodes.map((node) => (
                    <button
                        key={node.id}
                        type="button"
                        className="kronos-canvas-outline-item"
                        onClick={() => {
                            editor.select(node.shapeid as any);
                            editor.zoomToSelection({ animation: { duration: 180 } });
                        }}
                    >
                        {node.type === \"frame\" ? (
                            <Folder className=\"h-3.5 w-3.5\" />
                        ) : node.type === \"image\" ? (
                            <Image className=\"h-3.5 w-3.5\" />
                        ) : node.type === \"appstream\" ? (
                            <MonitorPlay className=\"h-3.5 w-3.5\" />
                        ) : node.type === \"aichat\" ? (
                            <Bot className=\"h-3.5 w-3.5\" />
                        ) : node.type === \"widget\" ? (
                            <Boxes className=\"h-3.5 w-3.5\" />
                        ) : (
                            <FileText className=\"h-3.5 w-3.5\" />
                        )}
                        <span className="min-w-0 truncate">{node.title || node.type}</span>
                    </button>
                ))
            )}
        </div>
    );
});

CanvasOutline.displayName = "CanvasOutline";
