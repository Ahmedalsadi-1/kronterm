// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AIPanelComponentInner } from "@/app/aipanel/aipanel";
import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { focusedBlockId } from "@/util/focusutil";
import { cn } from "@/util/util";
import * as jotai from "jotai";
import * as React from "react";

type FloatingIslandMode = "collapsed" | "expanded";

type BlockContext = {
    blockId: string;
    blockType: string;
    label: string;
};

const FloatingIslandStorageKey = "kronoscode:floating-island:state";

function getFocusedBlockContext(): BlockContext | null {
    const focused = focusedBlockId();
    if (!focused) return null;
    const blockEl = document.querySelector(`[data-blockid="${focused}"]`);
    if (!blockEl) return null;
    const headerEl = blockEl.querySelector(".block-frame-view-type, .block-frame-text");
    const label = headerEl?.textContent?.trim() ?? "";
    return { blockId: focused, blockType: "term", label };
}

function loadFloatingIslandState(): { enabled: boolean; mode: FloatingIslandMode } {
    try {
        const stored = window.localStorage.getItem(FloatingIslandStorageKey);
        if (stored) return JSON.parse(stored);
    } catch {}
    return { enabled: false, mode: "collapsed" };
}

function saveFloatingIslandState(state: { enabled: boolean; mode: FloatingIslandMode }): void {
    try {
        window.localStorage.setItem(FloatingIslandStorageKey, JSON.stringify(state));
    } catch {}
}

type FloatingIslandProps = {
    onClose: () => void;
    onReturnToPanel: () => void;
};

const FloatingIsland = React.memo(({ onClose, onReturnToPanel }: FloatingIslandProps) => {
    const model = WaveAIModel.getInstance();
    const isStreaming = jotai.useAtomValue(model.isAIStreaming);
    const [mode, setMode] = React.useState<FloatingIslandMode>(() => loadFloatingIslandState().mode);
    const [position, setPosition] = React.useState({ x: window.innerWidth - 420, y: 60 });
    const [size, setSize] = React.useState({ width: 400, height: 520 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [isResizing, setIsResizing] = React.useState(false);
    const [blockContext, setBlockContext] = React.useState<BlockContext | null>(null);
    const dragStart = React.useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const resizeStart = React.useRef({ x: 0, y: 0, w: 0, h: 0 });
    const islandRef = React.useRef<HTMLDivElement>(null);

    const handleModeChange = React.useCallback((newMode: FloatingIslandMode) => {
        setMode(newMode);
        saveFloatingIslandState({ enabled: true, mode: newMode });
    }, []);

    const handleDragStart = React.useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            setIsDragging(true);
            dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
        },
        [position]
    );

    const handleResizeStart = React.useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
        },
        [size]
    );

    React.useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setPosition({
                x: Math.max(0, Math.min(window.innerWidth - 200, dragStart.current.posX + dx)),
                y: Math.max(0, Math.min(window.innerHeight - 100, dragStart.current.posY + dy)),
            });
        };
        const handleUp = () => setIsDragging(false);
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
        return () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
        };
    }, [isDragging]);

    React.useEffect(() => {
        if (!isResizing) return;
        const handleMove = (e: MouseEvent) => {
            const dx = e.clientX - resizeStart.current.x;
            const dy = e.clientY - resizeStart.current.y;
            setSize({
                width: Math.max(320, Math.min(window.innerWidth - position.x - 20, resizeStart.current.w + dx)),
                height: Math.max(200, Math.min(window.innerHeight - position.y - 20, resizeStart.current.h + dy)),
            });
        };
        const handleUp = () => setIsResizing(false);
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
        return () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
        };
    }, [isResizing, position]);

    React.useEffect(() => {
        const updateContext = () => setBlockContext(getFocusedBlockContext());
        updateContext();
        const interval = setInterval(updateContext, 2000);
        return () => clearInterval(interval);
    }, []);

    const isCollapsed = mode === "collapsed";

    return (
        <div
            ref={islandRef}
            className={cn(
                "fixed z-[9999] flex flex-col overflow-hidden shadow-2xl border border-border",
                "bg-panel backdrop-blur-xl",
                isCollapsed ? "rounded-2xl" : "rounded-xl",
                isStreaming && "ring-1 ring-saturn/40"
            )}
            style={{
                left: position.x,
                top: position.y,
                width: isCollapsed ? undefined : size.width,
                height: isCollapsed ? undefined : size.height,
                maxWidth: "calc(100vw - 40px)",
                maxHeight: "calc(100vh - 80px)",
                transition: isDragging || isResizing ? "none" : "width 0.2s, height 0.2s",
            }}
        >
            <div
                className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none shrink-0"
                onMouseDown={handleDragStart}
            >
                <div className="flex items-center gap-1.5">
                    <i className="fa fa-circle-nodes text-saturn text-sm" />
                    <span className="text-xs font-semibold text-primary">KronosCode</span>
                    {isStreaming && (
                        <span className="flex gap-0.5 ml-1">
                            <span className="w-1 h-1 rounded-full bg-saturn animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-1 rounded-full bg-saturn animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-1 rounded-full bg-saturn animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                    )}
                </div>
                {blockContext && (
                    <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] text-muted bg-hoverbg/50 max-w-[150px]">
                        <i className="fa-solid fa-circle-nodes text-saturn/60" style={{ fontSize: 8 }} />
                        <span className="truncate">{blockContext.label || blockContext.blockId.slice(0, 8)}</span>
                    </div>
                )}
                <div className="flex-1" />
                <button
                    className="text-xs text-muted hover:text-primary cursor-pointer px-1.5 py-0.5 rounded hover:bg-hoverbg transition-colors"
                    onClick={onReturnToPanel}
                    title="Dock to side panel"
                >
                    <i className="fa-solid fa-arrow-right-to-bracket" />
                </button>
                <button
                    className="text-xs text-muted hover:text-primary cursor-pointer px-1 py-0.5 rounded hover:bg-hoverbg transition-colors"
                    onClick={() => handleModeChange(isCollapsed ? "expanded" : "collapsed")}
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    <i className={cn("fa-solid", isCollapsed ? "fa-chevron-down" : "fa-chevron-up")} />
                </button>
                <button
                    className="text-xs text-muted hover:text-primary cursor-pointer px-1 py-0.5 rounded hover:bg-hoverbg transition-colors"
                    onClick={onClose}
                    title="Close"
                >
                    <i className="fa-solid fa-xmark" />
                </button>
            </div>

            {!isCollapsed && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <AIPanelComponentInner roundTopLeft={false} floatingIslandActive={true} />
                </div>
            )}
            {!isCollapsed && (
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-30 hover:opacity-100 transition-opacity"
                    onMouseDown={handleResizeStart}
                >
                    <svg className="w-4 h-4 text-muted" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M14 14H10L14 10V14ZM14 14H12L14 12V14Z" />
                    </svg>
                </div>
            )}
        </div>
    );
});
FloatingIsland.displayName = "FloatingIsland";

export { FloatingIsland, loadFloatingIslandState, saveFloatingIslandState };
export type { FloatingIslandMode };
