// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { handleWaveAIContextMenu } from "@/app/aipanel/aipanel-contextmenu";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { WaveAIModel } from "./waveai-model";
import { RiLayoutColumnLine } from "@remixicon/react";
import { cn } from "@/util/util";

type AIPanelHeaderProps = {
    onFloatingIsland?: () => void;
};

export const AIPanelHeader = memo(({ onFloatingIsland }: AIPanelHeaderProps) => {
    const model = WaveAIModel.getInstance();
    const widgetAccess = useAtomValue(model.widgetAccessAtom);
    const isSplitView = useAtomValue(model.isSplitViewAtom);
    const inBuilder = model.inBuilder;
    const aiPanelOpen = useAtomValue(WorkspaceLayoutModel.getInstance().panelVisibleAtom);

    const handleKebabClick = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    return (
        <div className="ai-panel-header" onContextMenu={handleContextMenu}>
            <div className="ai-panel-title">
                <i className="fa fa-circle-nodes ai-panel-title-icon"></i>
                <span>KronosCode</span>
            </div>

            <div className="ai-panel-header-actions">
                {!inBuilder && (
                    <>
                        <button
                            onClick={() => {
                                model.toggleSplitView();
                            }}
                            className={cn("ai-panel-kebab", isSplitView && "text-accent")}
                            title={isSplitView ? "Disable Split Layout" : "Enable Split Layout"}
                        >
                            <RiLayoutColumnLine className="h-4 w-4" />
                        </button>
                        <div className="ai-panel-context-toggle">
                            <span className="toggle-label @xs:hidden">Context</span>
                            <span className="toggle-label hidden @xs:inline">Widget Context</span>
                            <button
                                onClick={() => {
                                    model.setWidgetAccess(!widgetAccess);
                                    setTimeout(() => {
                                        model.focusInput();
                                    }, 0);
                                }}
                                className={`toggle-switch ${widgetAccess ? "is-on" : "is-off"}`}
                                title={`Widget Access ${widgetAccess ? "ON" : "OFF"}`}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        {onFloatingIsland && (
                            <button
                                onClick={onFloatingIsland}
                                className="ai-panel-kebab"
                                title="Pop out as floating island"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square text-sm"></i>
                            </button>
                        )}
                    </>
                )}

                <button onClick={handleKebabClick} className="ai-panel-kebab" title="More options">
                    <i className="fa fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
    );
});

AIPanelHeader.displayName = "AIPanelHeader";
