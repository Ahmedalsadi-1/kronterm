// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AIPanelComponentInner } from "@/app/aipanel/aipanel";
import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { focusedBlockId } from "@/util/focusutil";
import { cn } from "@/util/util";
import {
    ChevronDown,
    ChevronUp,
    CircuitBoard,
    GripHorizontal,
    LogIn,
    X,
} from "lucide-react";
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

const BouncingDot = ({ delay }: { delay: number }) => (
    <span
        className="inline-block h-1 w-1 rounded-full bg-saturn animate-bounce"
        style={{ animationDelay: `${delay}ms` }}
    />
);

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
                "fixed z-[9999] flex flex-col overflow-hidden shadow-2xl shadow-black/50",
                "bg-panel/95 backdrop-blur-xl border border-border",
                isCollapsed ? "rounded-2xl" : "rounded-xl",
                isStreaming && "ring-1 ring-saturn/40",
                !isDragging && !isResizing && "transition-[width,height,border-radius] duration-200 ease-out"
            )}
            style={{
                left: position.x,
                top: position.y,
                width: isCollapsed ? undefined : size.width,
                height: isCollapsed ? undefined : size.height,
                maxWidth: "calc(100vw - 40px)",
                maxHeight: "calc(100vh - 80px)",
            }}
        >
            <div
                className="flex items-center gap-2 border-b border-border bg-surface-base/50 px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none shrink-0"
                onMouseDown={handleDragStart}
            >
                <GripHorizontal className="h-3 w-3 shrink-0 text-muted/50" />
                <CircuitBoard className="h-3.5 w-3.5 shrink-0 text-saturn" />
                <span className="text-xs font-semibold text-primary">KronosCode</span>
                {isStreaming && (
                    <span className="ml-0.5 flex items-center gap-0.5">
                        <BouncingDot delay={0} />
                        <BouncingDot delay={150} />
                        <BouncingDot delay={300} />
                    </span>
                )}
                {blockContext && (
                    <span className="ml-auto flex items-center gap-1 truncate rounded bg-hoverbg/50 px-1.5 py-0.5 text-[10px] text-muted max-w-[140px]">
                        <CircuitBoard className="h-2.5 w-2.5 shrink-0 text-saturn/60" />
                        <span className="truncate">{blockContext.label || blockContext.blockId.slice(0, 8)}</span>
                    </span>
                )}

                <div className="ml-2 flex items-center gap-0.5">
                    <button
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hoverbg hover:text-primary"
                        onClick={onReturnToPanel}
                        title="Dock to side panel"
                    >
                        <LogIn className="h-3 w-3" />
                    </button>
                    <button
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hoverbg hover:text-primary"
                        onClick={() => handleModeChange(isCollapsed ? "expanded" : "collapsed")}
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronUp className="h-3 w-3" />
                        )}
                    </button>
                    <button
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hoverbg hover:text-primary"
                        onClick={onClose}
                        title="Close"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <AIPanelComponentInner roundTopLeft={false} floatingIslandActive={true} />
                </div>
            )}

            {!isCollapsed && (
                <div
                    className="absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-se-resize items-center justify-center opacity-40 transition-opacity hover:opacity-100"
                    onMouseDown={handleResizeStart}
                >
                    <svg className="h-3 w-3 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 14L10 10M14 14H12L14 12V14ZM14 14H12L14 12" strokeLinecap="round" />
                        <path d="M14 14L10 10M14 14H12L14 12V14ZM14 14H12L14 12" strokeLinecap="round" opacity="0.5" />
                    </svg>
                </div>
            )}
        </div>
    );
});
FloatingIsland.displayName = "FloatingIsland";

export { FloatingIsland, loadFloatingIslandState, saveFloatingIslandState };
export type { FloatingIslandMode };
