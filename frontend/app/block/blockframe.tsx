// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { AgentWidgetActivity } from "@/app/aipanel/desktop-pet-activity";
import {
    AgentWidgetSettingsEvent,
    type AgentWidgetVisualSettings,
    loadAgentWidgetVisualSettings,
} from "@/app/block/agent-widget-settings";
import { BlockModel } from "@/app/block/block-model";
import { BlockFrame_Header } from "@/app/block/blockframe-header";
import { blockViewToIcon, getViewIconElem } from "@/app/block/blockutil";
import { ConnStatusOverlay } from "@/app/block/connstatusoverlay";
import { FlickeringGrid } from "@/app/element/flickering-grid";
import { ChangeConnectionBlockModal } from "@/app/modals/conntypeahead";
import { getBlockComponentModel, globalStore, refocusNode, useBlockAtom } from "@/app/store/global";
import { useTabModel } from "@/app/store/tab-model";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { ErrorBoundary } from "@/element/errorboundary";
import { NodeModel } from "@/layout/index";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { makeORef } from "@/store/wos";
import * as util from "@/util/util";
import { makeIconClass } from "@/util/util";
import { computeBgStyleFromMeta } from "@/util/waveutil";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";
import "./agent-aura.scss";
import { BlockEnv } from "./blockenv";
import { BlockFrameProps } from "./blocktypes";
import "./typing-keyboard.scss";
import { getAdjacentWidgetFocus } from "./widget-focus-utils";

const BlockMask = React.memo(({ nodeModel }: { nodeModel: NodeModel }) => {
    const waveEnv = useWaveEnv<BlockEnv>();
    const tabModel = useTabModel();
    const isFocused = jotai.useAtomValue(nodeModel.isFocused);
    const isEphemeral = jotai.useAtomValue(nodeModel.isEphemeral);
    const blockNum = jotai.useAtomValue(nodeModel.blockNum);
    const isLayoutMode = jotai.useAtomValue(waveEnv.atoms.controlShiftDelayAtom);
    const showOverlayBlockNums = jotai.useAtomValue(waveEnv.getSettingsKeyAtom("app:showoverlayblocknums")) ?? true;
    const blockHighlight = jotai.useAtomValue(BlockModel.getInstance().getBlockHighlightAtom(nodeModel.blockId));
    const frameActiveBorderColor = jotai.useAtomValue(
        waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "frame:activebordercolor")
    );
    const frameBorderColor = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "frame:bordercolor"));
    const tabActiveBorderColor = jotai.useAtomValue(tabModel.getTabMetaAtom("bg:activebordercolor"));
    const tabBorderColor = jotai.useAtomValue(tabModel.getTabMetaAtom("bg:bordercolor"));
    const style: React.CSSProperties = {};
    let showBlockMask = false;

    if (isFocused) {
        if (tabActiveBorderColor) {
            style.borderColor = tabActiveBorderColor;
        }
        if (frameActiveBorderColor) {
            style.borderColor = frameActiveBorderColor;
        }
    } else {
        if (tabBorderColor) {
            style.borderColor = tabBorderColor;
        }
        if (frameBorderColor) {
            style.borderColor = frameBorderColor;
        }
        if (isEphemeral && !style.borderColor) {
            style.borderColor = "rgba(255, 255, 255, 0.7)";
        }
    }

    if (blockHighlight && !style.borderColor) {
        style.borderColor = "rgb(0, 155, 255)";
    }

    let innerElem = null;
    if (isLayoutMode && showOverlayBlockNums) {
        showBlockMask = true;
        innerElem = (
            <div className="block-mask-inner">
                <div className="bignum">{blockNum}</div>
            </div>
        );
    } else if (blockHighlight) {
        showBlockMask = true;
        const iconClass = makeIconClass(blockHighlight.icon, false);
        innerElem = (
            <div className="block-mask-inner">
                <i className={iconClass} style={{ fontSize: "48px", opacity: 0.5 }} />
            </div>
        );
    }

    return (
        <div
            className={clsx("block-mask", { "show-block-mask": showBlockMask, "bg-blue-500/10": blockHighlight })}
            style={style}
        >
            {innerElem}
        </div>
    );
});

const keyboardRows = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
];

const TypingKeyboard = React.memo(({ text }: { text: string }) => {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [charIndex, setCharIndex] = React.useState(0);

    React.useEffect(() => {
        if (charIndex >= text.length) {
            return;
        }
        const timer = setTimeout(() => {
            setCharIndex((i) => i + 1);
            setActiveIndex((i) => (i + 1) % 30);
        }, 50);
        return () => clearTimeout(timer);
    }, [charIndex, text.length]);

    const currentChar = text[charIndex - 1]?.toLowerCase() ?? "";

    const getKeyClass = (key: string, idx: number): string => {
        const classes = ["keyboard-key"];
        if (key === " ") classes.push("key-space");
        if (key.toLowerCase() === currentChar) classes.push("key-active");
        return classes.join(" ");
    };

    return (
        <div className="agent-typing-keyboard">
            <div className="typing-text-preview">
                {text.slice(0, charIndex)}
                <span className="typing-cursor-blink" />
                {text.slice(charIndex)}
            </div>
            <div className="keyboard-body">
                {keyboardRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="keyboard-row">
                        {row.map((key, keyIdx) => (
                            <span key={keyIdx} className={getKeyClass(key, keyIdx)}>
                                {key}
                            </span>
                        ))}
                    </div>
                ))}
                <div className="keyboard-row">
                    <span className="keyboard-key key-space">space</span>
                </div>
            </div>
        </div>
    );
});
TypingKeyboard.displayName = "TypingKeyboard";

const WidgetFocusArrows = React.memo(() => {
    const moveFocus = (offset: -1 | 1) => {
        const layoutModel = getLayoutModelForStaticTab();
        const focusedNode = globalStore.get(layoutModel.focusedNode);
        const nextFocus = getAdjacentWidgetFocus(globalStore.get(layoutModel.leafOrder), focusedNode?.id, offset);
        if (nextFocus == null) {
            return;
        }
        layoutModel.focusNode(nextFocus.nodeid);
        window.requestAnimationFrame(() => refocusNode(nextFocus.blockid));
    };
    const controls = [
        { offset: -1 as const, name: "left", icon: "arrow-left" },
        { offset: 1 as const, name: "right", icon: "arrow-right" },
    ];
    return (
        <div className="widget-focus-arrows" aria-label="Move focus between widgets">
            {controls.map((control) => (
                <button
                    type="button"
                    key={control.name}
                    className={`widget-focus-arrow widget-focus-arrow-${control.name}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        moveFocus(control.offset);
                    }}
                    aria-label={`Focus widget ${control.name}`}
                    title={`Focus widget ${control.name}`}
                >
                    <i className={`fa-solid fa-${control.icon}`} aria-hidden="true" />
                </button>
            ))}
        </div>
    );
});
WidgetFocusArrows.displayName = "WidgetFocusArrows";
const AgentWidgetOverlay = React.memo(
    ({ activity, settings }: { activity: AgentWidgetActivity; settings: AgentWidgetVisualSettings }) => {
        const cursorStyle = activity.point
            ? ({
                  left: activity.point.x,
                  top: activity.point.y,
              } as React.CSSProperties)
            : undefined;

        const pointerStyle = settings.pointerStyle ?? "pixel";
        const gridColor = pointerStyle === "pixel" ? "30, 144, 255" : "99, 102, 241";

        const isTyping = activity.action === "typing";
        const typingText = activity.typingText ?? (isTyping ? activity.detail : undefined);
        const isSmoothCursor = settings.cursor;

        return (
            <div className="agent-widget-overlay" aria-hidden="true">
                {settings.aura && (
                    <>
                        <FlickeringGrid
                            squareSize={3}
                            gridGap={5}
                            flickerChance={0.15}
                            color={`rgb(${gridColor})`}
                            maxOpacity={0.15}
                            className="absolute inset-0 z-0"
                        />
                        <div className={clsx("agent-widget-aura", `aura-style-${pointerStyle}`)} />
                    </>
                )}
                {isSmoothCursor && (
                    <div
                        className={clsx(
                            "agent-smooth-cursor",
                            activity.action === "cursor" && "cursor-clicking",
                            isTyping && "cursor-typing"
                        )}
                        style={cursorStyle}
                    >
                        <div className="cursor-trail" />
                        <div className="cursor-ring" />
                        <div className="cursor-dot" />
                    </div>
                )}
                {isTyping && typingText && <TypingKeyboard text={typingText} />}
                {settings.screenshots && activity.previewImageUrl ? (
                    <figure className="agent-capture-preview">
                        <figcaption>Agent screenshot</figcaption>
                        <img src={activity.previewImageUrl} alt="" />
                    </figure>
                ) : null}
                <div className="agent-pulse-border" />
            </div>
        );
    }
);
AgentWidgetOverlay.displayName = "AgentWidgetOverlay";

const BlockFrame_Default_Component = (props: BlockFrameProps) => {
    const waveEnv = useWaveEnv<BlockEnv>();
    const { nodeModel, viewModel, blockModel, preview, numBlocksInTab, children } = props;
    const isFocused = jotai.useAtomValue(nodeModel.isFocused);
    const aiPanelVisible = jotai.useAtomValue(WorkspaceLayoutModel.getInstance().panelVisibleAtom);
    const metaView = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "view"));
    const viewIconUnion = util.useAtomValueSafe(viewModel?.viewIcon) ?? blockViewToIcon(metaView);
    const customBg = util.useAtomValueSafe(viewModel?.blockBg);
    const manageConnection = util.useAtomValueSafe(viewModel?.manageConnection);
    const changeConnModalAtom = useBlockAtom(nodeModel.blockId, "changeConn", () => {
        return jotai.atom(false);
    }) as jotai.PrimitiveAtom<boolean>;
    const connModalOpen = jotai.useAtomValue(changeConnModalAtom);
    const isMagnified = jotai.useAtomValue(nodeModel.isMagnified);
    const isEphemeral = jotai.useAtomValue(nodeModel.isEphemeral);
    const isFolded = jotai.useAtomValue(nodeModel.isFolded);
    const [magnifiedBlockBlurAtom] = React.useState(() =>
        waveEnv.getSettingsKeyAtom("window:magnifiedblockblurprimarypx")
    );
    const magnifiedBlockBlur = jotai.useAtomValue(magnifiedBlockBlurAtom);
    const [magnifiedBlockOpacityAtom] = React.useState(() =>
        waveEnv.getSettingsKeyAtom("window:magnifiedblockopacity")
    );
    const magnifiedBlockOpacity = jotai.useAtomValue(magnifiedBlockOpacityAtom);
    const connBtnRef = React.useRef<HTMLDivElement>(null);
    const connName = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "connection"));
    const iconColor = jotai.useAtomValue(waveEnv.getBlockMetaKeyAtom(nodeModel.blockId, "icon:color"));
    const noHeader = util.useAtomValueSafe(viewModel?.noHeader);
    const [agentActivity, setAgentActivity] = React.useState<AgentWidgetActivity | null>(null);
    const [agentSettings, setAgentSettings] = React.useState<AgentWidgetVisualSettings>(() =>
        loadAgentWidgetVisualSettings(nodeModel.blockId)
    );
    const visualAgentSurface = true;

    React.useEffect(() => {
        if (!visualAgentSurface) {
            return;
        }
        let clearTimer: ReturnType<typeof setTimeout> = null;
        const handleActivity = (event: Event) => {
            const activity = (event as CustomEvent<AgentWidgetActivity>).detail;
            if (activity.blockId !== nodeModel.blockId) {
                return;
            }
            setAgentActivity(activity);
            if (clearTimer != null) {
                clearTimeout(clearTimer);
            }
            clearTimer = setTimeout(() => setAgentActivity(null), activity.previewImageUrl ? 6000 : 1800);
        };
        window.addEventListener("agent-widget-activity", handleActivity);
        return () => {
            window.removeEventListener("agent-widget-activity", handleActivity);
            if (clearTimer != null) {
                clearTimeout(clearTimer);
            }
        };
    }, [nodeModel.blockId, visualAgentSurface]);

    React.useEffect(() => {
        const handleSettings = (event: Event) => {
            const detail = (event as CustomEvent<{ blockId: string; settings: AgentWidgetVisualSettings }>).detail;
            if (detail.blockId === nodeModel.blockId) {
                setAgentSettings(detail.settings);
            }
        };
        setAgentSettings(loadAgentWidgetVisualSettings(nodeModel.blockId));
        window.addEventListener(AgentWidgetSettingsEvent, handleSettings);
        return () => window.removeEventListener(AgentWidgetSettingsEvent, handleSettings);
    }, [nodeModel.blockId]);

    React.useEffect(() => {
        if (!manageConnection) {
            return;
        }
        const bcm = getBlockComponentModel(nodeModel.blockId);
        if (bcm != null) {
            bcm.openSwitchConnection = () => {
                globalStore.set(changeConnModalAtom, true);
            };
        }
        return () => {
            const bcm = getBlockComponentModel(nodeModel.blockId);
            if (bcm != null) {
                bcm.openSwitchConnection = null;
            }
        };
    }, [manageConnection]);
    React.useEffect(() => {
        // on mount, if manageConnection, call ConnEnsure
        if (!manageConnection || preview) {
            return;
        }
        if (!util.isLocalConnName(connName)) {
            console.log("ensure conn", nodeModel.blockId, connName);
            waveEnv.rpc
                .ConnEnsureCommand(
                    TabRpcClient,
                    { connname: connName, logblockid: nodeModel.blockId },
                    { timeout: 60000 }
                )
                .catch((e) => {
                    console.log("error ensuring connection", nodeModel.blockId, connName, e);
                });
        }
    }, [manageConnection, connName]);

    const viewIconElem = getViewIconElem(viewIconUnion, iconColor);
    let innerStyle: React.CSSProperties = {};
    if (!preview) {
        innerStyle = computeBgStyleFromMeta(customBg);
    }
    const previewElem = <div className="block-frame-preview">{viewIconElem}</div>;
    const headerElem = (
        <BlockFrame_Header {...props} connBtnRef={connBtnRef} changeConnModalAtom={changeConnModalAtom} />
    );
    const headerElemNoView = React.cloneElement(headerElem, { viewModel: null });
    return (
        <div
            className={clsx("block", "block-frame-default", "block-" + nodeModel.blockId, {
                "block-focused": isFocused || preview,
                "block-preview": preview,
                "block-no-highlight": numBlocksInTab === 1 && !aiPanelVisible,
                ephemeral: isEphemeral,
                magnified: isMagnified,
                "block-folded": isFolded,
                "agent-widget-active": agentActivity != null && agentSettings.glow,
            })}
            data-blockid={nodeModel.blockId}
            onClick={blockModel?.onClick}
            onPointerEnter={blockModel?.onPointerEnter}
            onFocusCapture={blockModel?.onFocusCapture}
            ref={blockModel?.blockRef}
            style={
                {
                    "--magnified-block-opacity": magnifiedBlockOpacity,
                    "--magnified-block-blur": `${magnifiedBlockBlur}px`,
                } as React.CSSProperties
            }
            inert={preview || undefined}
        >
            {agentActivity != null && <AgentWidgetOverlay activity={agentActivity} settings={agentSettings} />}
            <BlockMask nodeModel={nodeModel} />
            {isFocused &&
                !preview &&
                numBlocksInTab > 1 &&
                ((window as any).__krontermLayoutMode ?? "widgets") !== "canvas" && <WidgetFocusArrows />}
            {preview || viewModel == null || !manageConnection ? null : (
                <ConnStatusOverlay
                    nodeModel={nodeModel}
                    viewModel={viewModel}
                    changeConnModalAtom={changeConnModalAtom}
                />
            )}
            <div className="block-frame-default-inner" style={innerStyle}>
                {noHeader || <ErrorBoundary fallback={headerElemNoView}>{headerElem}</ErrorBoundary>}
                {preview ? previewElem : children}
            </div>
            {preview || viewModel == null || !connModalOpen ? null : (
                <ChangeConnectionBlockModal
                    blockId={nodeModel.blockId}
                    nodeModel={nodeModel}
                    viewModel={viewModel}
                    blockRef={blockModel?.blockRef}
                    changeConnModalAtom={changeConnModalAtom}
                    connBtnRef={connBtnRef}
                />
            )}
        </div>
    );
};

const BlockFrame_Default = React.memo(BlockFrame_Default_Component) as typeof BlockFrame_Default_Component;

const BlockFrame = React.memo((props: BlockFrameProps) => {
    const waveEnv = useWaveEnv<BlockEnv>();
    const tabModel = useTabModel();
    const blockId = props.nodeModel.blockId;
    const blockIsNull = jotai.useAtomValue(waveEnv.wos.isWaveObjectNullAtom(makeORef("block", blockId)));
    const numBlocks = jotai.useAtomValue(tabModel.tabNumBlocksAtom);
    if (!blockId || blockIsNull) {
        return null;
    }
    return <BlockFrame_Default {...props} numBlocksInTab={numBlocks} />;
});

export { BlockFrame };
