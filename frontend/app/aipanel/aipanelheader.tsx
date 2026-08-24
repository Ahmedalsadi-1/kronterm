// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { handleWaveAIContextMenu } from "@/app/aipanel/aipanel-contextmenu";
import { SiriButton } from "@/app/aipanel/siri-button";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { ArrowUpRightFromSquare, CircuitBoard, EllipsisVertical, PanelRightOpen } from "lucide-react";
import { memo } from "react";
import { WaveAIModel } from "./waveai-model";

type AIPanelHeaderProps = {
    onFloatingIsland?: () => void;
    className?: string;
};

export const AIPanelHeader = memo(({ onFloatingIsland, className }: AIPanelHeaderProps) => {
    const model = WaveAIModel.getInstance();
    const widgetAccess = useAtomValue(model.widgetAccessAtom);
    const isSplitView = useAtomValue(model.isSplitViewAtom);
    const inBuilder = model.inBuilder;

    const handleKebabClick = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    return (
        <div
            className={cn(
                "ai-panel-shell-header flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-gradient-to-b from-surface-raised/95 to-surface-base/85 px-3 py-2.5",
                className
            )}
            onContextMenu={handleContextMenu}
        >
            <div className="flex items-center gap-2 min-w-0">
                <CircuitBoard className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate text-sm font-semibold text-primary">KronosCode</span>
            </div>

            <div className="flex items-center gap-1.5">
                {!inBuilder && (
                    <>
                        <SiriButton />
                        <button
                            onClick={() => model.toggleSplitView()}
                            className={cn(
                                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors",
                                isSplitView
                                    ? "bg-surface-selected text-accent"
                                    : "text-tertiary hover:bg-surface-hover hover:text-primary"
                            )}
                            title={isSplitView ? "Disable Split Layout" : "Enable Split Layout"}
                        >
                            <PanelRightOpen className="h-3.5 w-3.5" />
                        </button>

                        <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-tertiary">
                            <span className="hidden @[7rem]:inline">Context</span>
                            <button
                                onClick={() => {
                                    model.setWidgetAccess(!widgetAccess);
                                    setTimeout(() => model.focusInput(), 0);
                                }}
                                className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors duration-200 ease-out",
                                    widgetAccess ? "bg-accent" : "bg-surface-hover"
                                )}
                                title={`Widget Access ${widgetAccess ? "ON" : "OFF"}`}
                                role="switch"
                                aria-checked={widgetAccess}
                            >
                                <span
                                    className={cn(
                                        "inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-out",
                                        widgetAccess ? "translate-x-[18px]" : "translate-x-0.5"
                                    )}
                                />
                            </button>
                        </div>

                        {onFloatingIsland && (
                            <button
                                onClick={onFloatingIsland}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-hover hover:text-primary"
                                title="Pop out as floating island"
                            >
                                <ArrowUpRightFromSquare className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </>
                )}

                <button
                    onClick={handleKebabClick}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-hover hover:text-primary"
                    title="More options"
                >
                    <EllipsisVertical className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
});

AIPanelHeader.displayName = "AIPanelHeader";
