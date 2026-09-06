// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { loadAgentWidgetVisualSettings, updateAgentWidgetVisualSetting } from "@/app/block/agent-widget-settings";
import { buildAgentWidgetShortcutText, isAgentWidgetShortcutView } from "@/app/block/agent-widget-shortcuts";
import { blockViewToName, renderHeaderElements } from "@/app/block/blockutil";
import { ConnectionButton } from "@/app/block/connectionbutton";
import { DurableSessionFlyover } from "@/app/block/durable-session-flyover";
import { getBlockBadgeAtom } from "@/app/store/badge";
import { recordTEvent, refocusNode } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { uxCloseBlock } from "@/app/store/keymodel";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { IconButton } from "@/element/iconbutton";
import { NodeModel } from "@/layout/index";
import * as util from "@/util/util";
import { cn, makeIconClass } from "@/util/util";
import * as jotai from "jotai";
import * as React from "react";
import { BlockEnv } from "./blockenv";
import { BlockFrameProps } from "./blocktypes";
import { getSurfaceChromeLabel, getSurfaceChromeName } from "./surface-chrome";

function handleHeaderContextMenu(
    e: React.MouseEvent<HTMLDivElement>,
    blockId: string,
    viewModel: ViewModel,
    nodeModel: NodeModel,
    blockEnv: BlockEnv,
    metaView?: string
) {
    e.preventDefault();
    e.stopPropagation();
    const magnified = globalStore.get(nodeModel.isMagnified);
    const folded = globalStore.get(nodeModel.isFolded);
    const menu: ContextMenuItem[] = [
        {
            label: folded ? "Unfold Block" : "Fold Block",
            click: () => {
                nodeModel.toggleFold();
            },
        },
        {
            label: magnified ? "Un-Magnify Block" : "Magnify Block",
            click: () => {
                nodeModel.toggleMagnify();
            },
        },
        { type: "separator" },
        {
            label: "Copy BlockId",
            click: () => {
                navigator.clipboard.writeText(blockId);
            },
        },
    ];
    if (isAgentWidgetShortcutView(metaView)) {
        menu.push({
            label: "Copy Agent Widget Shortcuts",
            click: () => {
                navigator.clipboard.writeText(buildAgentWidgetShortcutText(blockId, metaView));
            },
        });
    }
    const extraItems = viewModel?.getSettingsMenuItems?.();
    if (extraItems && extraItems.length > 0) menu.push({ type: "separator" }, ...extraItems);
    if (metaView === "web" || metaView === "sandbox") {
        const activitySettings = loadAgentWidgetVisualSettings(blockId);
        menu.push(
            { type: "separator" },
            {
                label: "Agent Activity Indicator",
                type: "submenu",
                submenu: [
                    {
                        label: "Glow",
                        type: "checkbox",
                        checked: activitySettings.glow,
                        click: () => updateAgentWidgetVisualSetting(blockId, "glow", !activitySettings.glow),
                    },
                    {
                        label: "Pixel Aura",
                        type: "checkbox",
                        checked: activitySettings.aura,
                        click: () => updateAgentWidgetVisualSetting(blockId, "aura", !activitySettings.aura),
                    },
                    {
                        label: "Action Chip",
                        type: "checkbox",
                        checked: activitySettings.actionChip,
                        click: () =>
                            updateAgentWidgetVisualSetting(blockId, "actionChip", !activitySettings.actionChip),
                    },
                    {
                        label: "Agent Cursor",
                        type: "checkbox",
                        checked: activitySettings.cursor,
                        click: () => updateAgentWidgetVisualSetting(blockId, "cursor", !activitySettings.cursor),
                    },
                    {
                        label: "Screenshot Preview",
                        type: "checkbox",
                        checked: activitySettings.screenshots,
                        click: () =>
                            updateAgentWidgetVisualSetting(blockId, "screenshots", !activitySettings.screenshots),
                    },
                    { type: "separator" },
                    {
                        label: "Pointer Style",
                        type: "submenu",
                        submenu: [
                            {
                                label: "Pixel (Stepped)",
                                type: "radio",
                                checked: activitySettings.pointerStyle === "pixel",
                                click: () => updateAgentWidgetVisualSetting(blockId, "pointerStyle", "pixel"),
                            },
                            {
                                label: "Smooth",
                                type: "radio",
                                checked: activitySettings.pointerStyle === "smooth",
                                click: () => updateAgentWidgetVisualSetting(blockId, "pointerStyle", "smooth"),
                            },
                            {
                                label: "Minimal",
                                type: "radio",
                                checked: activitySettings.pointerStyle === "minimal",
                                click: () => updateAgentWidgetVisualSetting(blockId, "pointerStyle", "minimal"),
                            },
                        ],
                    },
                ],
            }
        );
    }
    menu.push(
        { type: "separator" },
        {
            label: "KronosCode",
            type: "submenu" as const,
            submenu: [
                {
                    label: "Explain Output",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "explain-output", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Fix Error",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "fix-error", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Suggest Command",
                    visible: metaView === "term",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "suggest-command", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Summarize Page",
                    visible: metaView === "webview" || metaView === "preview",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "summarize-page", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Extract Data",
                    visible: metaView === "webview",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "extract-data", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Refactor Code",
                    visible:
                        metaView === "waveai" ||
                        metaView === "kronoschat" ||
                        metaView === "chathubv2" ||
                        metaView === "codeeditor",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "refactor", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Improve Response",
                    visible: metaView === "waveai" || metaView === "kronoschat" || metaView === "chathubv2",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "improve", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                { type: "separator" as const },
                {
                    label: "Take Screenshot",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "screenshot", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
                {
                    label: "Send to AI Panel",
                    click: () => {
                        document.dispatchEvent(
                            new CustomEvent("kronoscode:block-action", {
                                detail: { actionId: "send-to-panel", blockId, blockType: metaView },
                                bubbles: true,
                            })
                        );
                    },
                },
            ],
        },
        {
            label: "Close Block",
            click: () => uxCloseBlock(blockId, () => nodeModel.onClose()),
        }
    );
    blockEnv.showContextMenu(menu, e);
}

type HeaderTextElemsProps = {
    viewModel: ViewModel;
    blockId: string;
    preview: boolean;
    error?: Error;
};

const HeaderTextElems = React.memo(({ viewModel, blockId, preview, error }: HeaderTextElemsProps) => {
    const waveEnv = useWaveEnv<BlockEnv>();
    const frameTextAtom = waveEnv.getBlockMetaKeyAtom(blockId, "frame:text");
    const frameText = jotai.useAtomValue(frameTextAtom);
    let headerTextUnion = util.useAtomValueSafe(viewModel?.viewText);
    headerTextUnion = frameText ?? headerTextUnion;

    const headerTextElems: React.ReactElement[] = [];
    if (typeof headerTextUnion === "string") {
        if (!util.isBlank(headerTextUnion)) {
            headerTextElems.push(
                <div key="text" className="block-frame-text ellipsis">
                    &lrm;{headerTextUnion}
                </div>
            );
        }
    } else if (Array.isArray(headerTextUnion)) {
        headerTextElems.push(...renderHeaderElements(headerTextUnion, preview));
    }
    if (error != null) {
        const copyHeaderErr = () => {
            navigator.clipboard.writeText(error.message + "\n" + error.stack);
        };
        headerTextElems.push(
            <div className="iconbutton disabled" key="controller-status" onClick={copyHeaderErr}>
                <i
                    className="fa-sharp fa-solid fa-triangle-exclamation"
                    title={"Error Rendering View Header: " + error.message}
                />
            </div>
        );
    }

    return <div className="block-frame-textelems-wrapper">{headerTextElems}</div>;
});
HeaderTextElems.displayName = "HeaderTextElems";

type WidgetTrafficLightsProps = {
    nodeModel: NodeModel;
    magnified: boolean;
    folded: boolean;
};

const WidgetTrafficLights = React.memo(({ nodeModel, magnified, folded }: WidgetTrafficLightsProps) => {
    const stopDrag = (event: React.PointerEvent<HTMLButtonElement>) => event.stopPropagation();
    return (
        <div className="block-frame-traffic-lights" aria-label="Widget window controls">
            <button
                type="button"
                className="is-close"
                title="Close widget"
                aria-label="Close widget"
                onPointerDown={stopDrag}
                onClick={() => uxCloseBlock(nodeModel.blockId, () => nodeModel.onClose())}
            >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="is-fold"
                title={folded ? "Restore widget" : "Fold widget"}
                aria-label={folded ? "Restore widget" : "Fold widget"}
                aria-pressed={folded}
                onPointerDown={stopDrag}
                onClick={() => nodeModel.toggleFold()}
            >
                <i className="fa-solid fa-minus" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="is-expand"
                title={magnified ? "Restore widget" : "Expand widget"}
                aria-label={magnified ? "Restore widget" : "Expand widget"}
                aria-pressed={magnified}
                onPointerDown={stopDrag}
                onClick={() => {
                    nodeModel.toggleMagnify();
                    setTimeout(() => refocusNode(nodeModel.blockId), 50);
                }}
            >
                <i className="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true" />
            </button>
        </div>
    );
});
WidgetTrafficLights.displayName = "WidgetTrafficLights";

const BlockFrame_Header = ({
    nodeModel,
    viewModel,
    preview,
    connBtnRef,
    changeConnModalAtom,
    error,
}: BlockFrameProps & { changeConnModalAtom: jotai.PrimitiveAtom<boolean>; error?: Error }) => {
    const waveEnv = useWaveEnv<BlockEnv>();
    const metaView = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "view"));
    const metaFrameTitle = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "frame:title"));
    const metaConnection = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "connection"));
    let viewName = util.useAtomValueSafe(viewModel?.viewName) ?? blockViewToName(metaView);
    const preIconButton = util.useAtomValueSafe(viewModel?.preIconButton);
    const useTermHeader = util.useAtomValueSafe(viewModel?.useTermHeader);
    const termConfigedDurable = util.useAtomValueSafe(viewModel?.termConfigedDurable);
    const headerTop = util.useAtomValueSafe(viewModel?.headerTop);
    const badge = jotai.useAtomValue(getBlockBadgeAtom(useTermHeader ? nodeModel.blockId : null));
    const magnified = jotai.useAtomValue(nodeModel.isMagnified);
    const folded = jotai.useAtomValue(nodeModel.isFolded);
    const prevMagifiedState = React.useRef(magnified);
    const manageConnection = util.useAtomValueSafe(viewModel?.manageConnection);
    const dragHandleRef = preview ? null : nodeModel.dragHandleRef;
    const isTerminalBlock = metaView === "term";
    viewName = metaFrameTitle ?? viewName;
    const surfaceLabel = getSurfaceChromeLabel(metaView, viewName);
    const surfaceName = getSurfaceChromeName(metaView);

    React.useEffect(() => {
        if (magnified && !preview && !prevMagifiedState.current) {
            waveEnv.rpc.ActivityCommand(TabRpcClient, { nummagnify: 1 });
            recordTEvent("action:magnify", { "block:view": viewName });
        }
        prevMagifiedState.current = magnified;
    }, [magnified]);

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) =>
        handleHeaderContextMenu(event, nodeModel.blockId, viewModel, nodeModel, waveEnv, metaView);

    return (
        <>
            {headerTop && (
                <div className="block-frame-header-top" onContextMenu={handleContextMenu}>
                    {headerTop}
                </div>
            )}
            <div
                className={cn("block-frame-default-header", useTermHeader && "!pl-[2px]")}
                data-role="block-header"
                data-surface={surfaceName}
                role="toolbar"
                aria-label={`${surfaceLabel} widget controls`}
                ref={dragHandleRef}
                onContextMenu={handleContextMenu}
                onDoubleClick={handleContextMenu}
            >
                <WidgetTrafficLights nodeModel={nodeModel} magnified={magnified} folded={folded} />
                {!useTermHeader && preIconButton && (
                    <IconButton decl={preIconButton} className="block-frame-widget-action block-frame-preicon-button" />
                )}
                {manageConnection && (
                    <ConnectionButton
                        ref={connBtnRef}
                        key="connbutton"
                        connection={metaConnection}
                        changeConnModalAtom={changeConnModalAtom}
                        isTerminalBlock={isTerminalBlock}
                    />
                )}
                {useTermHeader && termConfigedDurable != null && (
                    <DurableSessionFlyover
                        key="durable-status"
                        blockId={nodeModel.blockId}
                        viewModel={viewModel}
                        placement="bottom"
                        divClassName="iconbutton disabled text-[13px] ml-[-4px]"
                    />
                )}
                {useTermHeader && badge && (
                    <div
                        className="pointer-events-none flex items-center px-1"
                        style={{ color: badge.color || "#fbbf24" }}
                    >
                        <i className={makeIconClass(badge.icon, true, { defaultIcon: "circle-small" })} />
                    </div>
                )}
                <HeaderTextElems viewModel={viewModel} blockId={nodeModel.blockId} preview={preview} error={error} />
            </div>
        </>
    );
};

export { BlockFrame_Header };
