// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block } from "@/app/block/block";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { CenteredDiv } from "@/element/quickelems";
import { TileLayout } from "@/layout/lib/TileLayout";
import { ContentRenderer, NodeModel, PreviewRenderer, TileLayoutContents } from "@/layout/lib/types";
import { atoms, getApi, getSettingsKeyAtom } from "@/store/global";
import * as services from "@/store/services";
import * as WOS from "@/store/wos";
import { atom, useAtomValue } from "jotai";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const tileGapSizeAtom = atom((get) => {
    const settings = get(atoms.settingsAtom);
    return settings["window:tilegapsize"];
});

const LayoutModeStorageKey = "kronterm:layoutmode";
const LayoutModeChangedEvent = "kronterm:layoutmode-changed";

type CanvasRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type CanvasState = {
    camera?: { x: number; y: number; zoom: number };
    rects?: Record<string, CanvasRect>;
};

type CanvasCamera = {
    x: number;
    y: number;
    zoom: number;
};

function makeDefaultCanvasRect(index: number): CanvasRect {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return {
        x: 80 + column * 1280,
        y: 80 + row * 980,
        width: 1200,
        height: 900,
    };
}

function readCanvasState(tabData: Tab): CanvasState {
    const meta = (tabData as any)?.meta as Record<string, any> | undefined;
    return (meta?.["layout:canvas"] ?? {}) as CanvasState;
}

const CanvasNode = React.memo(
    ({
        blockId,
        index,
        rect,
        selected,
        zoom,
        onSelect,
        onRectChange,
    }: {
        blockId: string;
        index: number;
        rect: CanvasRect;
        selected: boolean;
        zoom: number;
        onSelect: (blockId: string) => void;
        onRectChange: (blockId: string, rect: CanvasRect) => void;
    }) => {
        const dragStartRef = useRef<{ x: number; y: number; rect: CanvasRect } | null>(null);
        const resizeStartRef = useRef<{ x: number; y: number; rect: CanvasRect } | null>(null);
        const nodeModel = useMemo<NodeModel>(() => {
            const rectAtom = atom({
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
            return {
                additionalProps: atom({}),
                innerRect: rectAtom,
                blockNum: atom(index + 1),
                numLeafs: atom(1),
                nodeId: `canvas-${blockId}`,
                blockId,
                addEphemeralNodeToLayout: () => {},
                animationTimeS: atom(0),
                isResizing: atom(false),
                isFocused: atom(selected),
                isMagnified: atom(false),
                isFolded: atom(false),
                anyMagnified: atom(false),
                isEphemeral: atom(false),
                ready: atom(true),
                disablePointerEvents: atom(false),
                toggleMagnify: () => {},
                toggleFold: () => {},
                focusNode: () => onSelect(blockId),
                onClose: () => services.ObjectService.DeleteBlock(blockId),
                dragHandleRef: React.createRef<HTMLDivElement>(),
                displayContainerRef: React.createRef<HTMLDivElement>(),
            } as unknown as NodeModel;
        }, [blockId, index, onSelect, rect.height, rect.width, selected]);

        const onPointerMove = useCallback(
            (event: PointerEvent) => {
                if (dragStartRef.current) {
                    const start = dragStartRef.current;
                    onRectChange(blockId, {
                        ...start.rect,
                        x: Math.max(0, start.rect.x + (event.clientX - start.x) / zoom),
                        y: Math.max(0, start.rect.y + (event.clientY - start.y) / zoom),
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

        const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(blockId);
            dragStartRef.current = { x: event.clientX, y: event.clientY, rect };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(blockId);
            resizeStartRef.current = { x: event.clientX, y: event.clientY, rect };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        return (
            <div
                className={`absolute overflow-hidden rounded-xl border bg-black/30 shadow-2xl shadow-black/35 ${
                    selected ? "border-accent/60 ring-2 ring-accent/20" : "border-white/12"
                }`}
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(blockId);
                }}
            >
                <div
                    className="absolute left-0 right-0 top-0 z-20 flex h-8 cursor-grab items-center justify-between border-b border-white/10 bg-zinc-950/92 px-2 text-[11px] text-white/65 active:cursor-grabbing"
                    onPointerDown={startDrag}
                >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(177,185,85,0.75)]" />
                        Canvas Node {index + 1}
                    </span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">move</span>
                </div>
                <div className="h-full pt-8">
                    <Block key={blockId} nodeModel={nodeModel} preview={false} />
                </div>
                <div
                    className="absolute bottom-1 right-1 z-30 h-4 w-4 cursor-nwse-resize rounded border border-white/25 bg-white/15"
                    onPointerDown={startResize}
                    title="Resize"
                />
            </div>
        );
    }
);
CanvasNode.displayName = "CanvasNode";

const CanvasLayout = React.memo(({ tabId, tabData }: { tabId: string; tabData: Tab }) => {
    const canvasState = readCanvasState(tabData);
    const viewportRef = useRef<HTMLDivElement>(null);
    const panStartRef = useRef<{ x: number; y: number; camera: CanvasCamera } | null>(null);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(tabData.blockids?.[0] ?? null);
    const [camera, setCamera] = useState<CanvasCamera>(() => canvasState.camera ?? { x: 80, y: 70, zoom: 0.9 });
    const cameraRef = useRef<CanvasCamera>(camera);
    const [rects, setRects] = useState<Record<string, CanvasRect>>(() => {
        const stored = canvasState.rects ?? {};
        const next = { ...stored };
        tabData.blockids?.forEach((blockId, index) => {
            if (!next[blockId]) {
                next[blockId] = makeDefaultCanvasRect(index);
            }
        });
        return next;
    });

    const persistCanvasState = useCallback(
        (nextRects: Record<string, CanvasRect>, nextCamera: CanvasCamera = camera) => {
            RpcApi.SetMetaCommand(TabRpcClient, {
                oref: WOS.makeORef("tab", tabId),
                meta: {
                    "layout:mode": "canvas",
                    "layout:canvas": {
                        camera: nextCamera,
                        rects: nextRects,
                    },
                } as unknown as MetaType,
            });
        },
        [camera, tabId]
    );

    const setAndPersistCamera = useCallback(
        (nextCamera: CanvasCamera) => {
            const boundedCamera = {
                x: nextCamera.x,
                y: nextCamera.y,
                zoom: Math.min(2, Math.max(0.35, nextCamera.zoom)),
            };
            cameraRef.current = boundedCamera;
            setCamera(boundedCamera);
            persistCanvasState(rects, boundedCamera);
        },
        [persistCanvasState, rects]
    );

    const updateRect = useCallback(
        (blockId: string, rect: CanvasRect) => {
            setRects((current) => {
                const next = { ...current, [blockId]: rect };
                persistCanvasState(next);
                return next;
            });
        },
        [persistCanvasState]
    );

    const resetLayout = () => {
        const next: Record<string, CanvasRect> = {};
        tabData.blockids?.forEach((blockId, index) => {
            next[blockId] = makeDefaultCanvasRect(index);
        });
        setRects(next);
        persistCanvasState(next);
    };

    const fitToNodes = () => {
        const viewport = viewportRef.current?.getBoundingClientRect();
        const nodeRects = Object.values(rects);
        if (!viewport || nodeRects.length === 0) {
            setAndPersistCamera({ x: 80, y: 70, zoom: 0.9 });
            return;
        }
        const minX = Math.min(...nodeRects.map((rect) => rect.x));
        const minY = Math.min(...nodeRects.map((rect) => rect.y));
        const maxX = Math.max(...nodeRects.map((rect) => rect.x + rect.width));
        const maxY = Math.max(...nodeRects.map((rect) => rect.y + rect.height));
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const zoom = Math.min(
            1.2,
            Math.max(0.35, Math.min((viewport.width - 160) / width, (viewport.height - 160) / height))
        );
        setAndPersistCamera({
            zoom,
            x: 80 - minX * zoom,
            y: 80 - minY * zoom,
        });
    };

    const onCanvasPointerMove = useCallback((event: PointerEvent) => {
        const start = panStartRef.current;
        if (!start) {
            return;
        }
        const nextCamera = {
            ...start.camera,
            x: start.camera.x + event.clientX - start.x,
            y: start.camera.y + event.clientY - start.y,
        };
        cameraRef.current = nextCamera;
        setCamera(nextCamera);
    }, []);

    const onCanvasPointerUp = useCallback(() => {
        if (panStartRef.current) {
            persistCanvasState(rects, cameraRef.current);
        }
        panStartRef.current = null;
        window.removeEventListener("pointermove", onCanvasPointerMove);
        window.removeEventListener("pointerup", onCanvasPointerUp);
    }, [onCanvasPointerMove, persistCanvasState, rects]);

    const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        panStartRef.current = { x: event.clientX, y: event.clientY, camera };
        window.addEventListener("pointermove", onCanvasPointerMove);
        window.addEventListener("pointerup", onCanvasPointerUp);
    };

    const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!viewportRef.current) {
            return;
        }
        event.preventDefault();
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const nextZoom = Math.min(2, Math.max(0.35, camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
        const worldX = (mouseX - camera.x) / camera.zoom;
        const worldY = (mouseY - camera.y) / camera.zoom;
        setAndPersistCamera({
            zoom: nextZoom,
            x: mouseX - worldX * nextZoom,
            y: mouseY - worldY * nextZoom,
        });
    };

    return (
        <div
            ref={viewportRef}
            className="relative h-full w-full cursor-grab overflow-hidden bg-[#080a0d] active:cursor-grabbing"
            onPointerDown={startPan}
            onWheel={onWheel}
        >
            <div
                className="absolute inset-0 opacity-80"
                style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)",
                    backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px`,
                    backgroundPosition: `${camera.x}px ${camera.y}px`,
                }}
            />
            <div className="absolute left-3 top-3 z-40 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950/85 px-3 py-2 text-xs text-white/70 shadow-xl backdrop-blur">
                <i className="fa-solid fa-vector-square text-accent" />
                <span className="font-semibold text-white/85">Canvas mode</span>
                <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px]">
                    {Math.round(camera.zoom * 100)}%
                </span>
                <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={fitToNodes}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 hover:bg-white/[0.08] hover:text-white"
                >
                    Fit
                </button>
                <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={resetLayout}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 hover:bg-white/[0.08] hover:text-white"
                >
                    Reset layout
                </button>
            </div>
            <div
                className="absolute left-0 top-0 h-[2200px] w-[2600px] origin-top-left"
                style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
            >
                {tabData.blockids?.map((blockId, index) => (
                    <CanvasNode
                        key={blockId}
                        blockId={blockId}
                        index={index}
                        rect={rects[blockId] ?? makeDefaultCanvasRect(index)}
                        selected={selectedBlockId === blockId}
                        zoom={camera.zoom}
                        onSelect={setSelectedBlockId}
                        onRectChange={updateRect}
                    />
                ))}
            </div>
        </div>
    );
});
CanvasLayout.displayName = "CanvasLayout";

const TabContent = React.memo(({ tabId, noTopPadding }: { tabId: string; noTopPadding?: boolean }) => {
    const oref = useMemo(() => WOS.makeORef("tab", tabId), [tabId]);
    const loadingAtom = useMemo(() => WOS.getWaveObjectLoadingAtom(oref), [oref]);
    const tabLoading = useAtomValue(loadingAtom);
    const tabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(oref), [oref]);
    const tabData = useAtomValue(tabAtom);
    const tileGapSize = useAtomValue(tileGapSizeAtom);
    const settingsLayoutModeValue = useAtomValue(getSettingsKeyAtom("app:layoutmode" as keyof SettingsType)) as
        | string
        | null;
    const settingsLayoutMode = settingsLayoutModeValue === "canvas" ? "canvas" : "widgets";
    const [layoutModeOverride, setLayoutModeOverride] = useState<string | null>(() => {
        try {
            return window.localStorage.getItem(LayoutModeStorageKey);
        } catch {
            return null;
        }
    });
    const layoutMode = layoutModeOverride === "canvas" || settingsLayoutMode === "canvas" ? "canvas" : "widgets";

    useEffect(() => {
        (window as any).__krontermLayoutMode = layoutMode;
        console.info("[KronTerm] layout mode", layoutMode);
    }, [layoutMode]);

    useEffect(() => {
        const handleLayoutModeChanged = (event: Event) => {
            const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
            if (mode === "canvas" || mode === "widgets") {
                setLayoutModeOverride(mode);
            }
        };
        const handleLayoutModeStorage = (event: StorageEvent) => {
            if (event.key !== LayoutModeStorageKey) {
                return;
            }
            if (event.newValue === "canvas" || event.newValue === "widgets") {
                setLayoutModeOverride(event.newValue);
            }
        };
        window.addEventListener(LayoutModeChangedEvent, handleLayoutModeChanged);
        window.addEventListener("storage", handleLayoutModeStorage);
        return () => {
            window.removeEventListener(LayoutModeChangedEvent, handleLayoutModeChanged);
            window.removeEventListener("storage", handleLayoutModeStorage);
        };
    }, []);

    const tileLayoutContents = useMemo(() => {
        const renderContent: ContentRenderer = (nodeModel: NodeModel) => {
            return <Block key={nodeModel.blockId} nodeModel={nodeModel} preview={false} />;
        };

        const renderPreview: PreviewRenderer = (nodeModel: NodeModel) => {
            return <Block key={nodeModel.blockId} nodeModel={nodeModel} preview={true} />;
        };

        function onNodeDelete(data: TabLayoutData) {
            return services.ObjectService.DeleteBlock(data.blockId);
        }

        return {
            renderContent,
            renderPreview,
            tabId,
            onNodeDelete,
            gapSizePx: tileGapSize,
        } as TileLayoutContents;
    }, [tabId, tileGapSize]);

    let innerContent;

    if (tabLoading) {
        innerContent = <CenteredDiv>Tab Loading</CenteredDiv>;
    } else if (!tabData) {
        innerContent = <CenteredDiv>Tab Not Found</CenteredDiv>;
    } else if (tabData?.blockids?.length == 0) {
        innerContent = null;
    } else if (layoutMode === "canvas") {
        innerContent = <CanvasLayout key={`canvas-${tabId}`} tabId={tabId} tabData={tabData} />;
    } else {
        innerContent = (
            <TileLayout
                key={tabId}
                contents={tileLayoutContents}
                tabAtom={tabAtom}
                getCursorPoint={getApi().getCursorPoint}
            />
        );
    }

    return (
        <div
            className={`flex flex-col flex-grow min-h-0 w-full items-center justify-center overflow-hidden relative ${noTopPadding ? "" : "pt-[3px]"} pr-[3px]`}
        >
            {innerContent}
        </div>
    );
});

export { TabContent };
