// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { reportDesktopPetActivity, type AgentWidgetActivity } from "@/app/aipanel/desktop-pet-activity";
import { BlockNodeModel } from "@/app/block/blocktypes";
import { Search, useSearch } from "@/app/element/search";
import { getSettingsKeyAtom } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { getSimpleControlShiftAtom } from "@/app/store/keymodel";
import type { TabModel } from "@/app/store/tab-model";
import { makeORef } from "@/app/store/wos";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import {
    BlockHeaderSuggestionControl,
    SuggestionControlNoData,
    SuggestionControlNoResults,
} from "@/app/suggestion/suggestion";
import { ActionMarker } from "@/app/view/action-marker";
import {
    AgentWidgetInspectModeEvent,
    isAgentWidgetInspectModeActive,
    publishAgentWidgetDesignSelection,
    setAgentWidgetInspectMode,
    type AgentWidgetDesignSelection,
} from "@/app/view/agent-widget-bridge";
import { CURSOR_OVERLAY_SCRIPT, reportCursorToPet } from "@/app/view/cursor-overlay";
import { useAgentOverlays } from "@/app/view/use-agent-overlays";
import { WaterFlowOverlay } from "@/app/view/waterflow-overlay";
import { MockBoundary } from "@/app/waveenv/mockboundary";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { adaptFromReactOrNativeKeyEvent, checkKeyPressed } from "@/util/keyutil";
import { fireAndForget, useAtomValueSafe } from "@/util/util";
import clsx from "clsx";
import { WebviewTag } from "electron";
import { Atom, PrimitiveAtom, atom, useAtomValue, useSetAtom } from "jotai";
import { Fragment, createRef, memo, useCallback, useEffect, useRef, useState } from "react";
import { subscribeAgentActivityStream } from "../../../types/agent-activity";
import { makeBrowserPayload, publishCrossViewEvent } from "../../../types/cross-view-bus";
import { getBrowserTabIdAfterClose, getNextBrowserTabIndex, type BrowserTabOrientation } from "./webview-tabs";
import "./webview.scss";
import type { WebViewEnv } from "./webviewenv";

type BrowserTabRecord = {
    id: string;
    url: string;
    title?: string;
    favicon?: string;
};

type WebViewTabStripProps = {
    model: WebViewModel;
    tabs: BrowserTabRecord[];
    activeTabId: string;
    left?: boolean;
};

const WebViewTabStrip = memo(({ model, tabs, activeTabId, left = false }: WebViewTabStripProps) => {
    const tabRefs = useRef(new Map<string, HTMLButtonElement>());
    const tabListRef = useRef<HTMLDivElement>(null);
    const orientation: BrowserTabOrientation = left ? "vertical" : "horizontal";

    const activateAndFocusTab = (index: number) => {
        const tab = tabs[index];
        if (!tab) {
            return;
        }
        model.activateBrowserTab(tab.id);
        window.requestAnimationFrame(() => tabRefs.current.get(tab.id)?.focus());
    };

    const closeAndRestoreFocus = (index: number) => {
        const closedTab = tabs[index];
        const nextTabId = getBrowserTabIdAfterClose(
            tabs.map((tab) => tab.id),
            activeTabId,
            closedTab.id
        );
        model.closeBrowserTab(closedTab.id);
        window.requestAnimationFrame(() => {
            if (nextTabId && tabRefs.current.get(nextTabId)) {
                tabRefs.current.get(nextTabId)?.focus();
                return;
            }
            tabListRef.current?.querySelector<HTMLButtonElement>('[role="tab"][tabindex="0"]')?.focus();
        });
    };

    return (
        <div
            ref={tabListRef}
            className={clsx("webview-tab-strip", left && "is-left")}
            role="tablist"
            aria-label="Browser tabs"
            aria-orientation={orientation}
        >
            <div className="webview-tab-scroll">
                {tabs.map((tab, index) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <div key={tab.id} className={clsx("webview-tab", isActive && "is-active")}>
                            <button
                                ref={(element) => {
                                    if (element) {
                                        tabRefs.current.set(tab.id, element);
                                    } else {
                                        tabRefs.current.delete(tab.id);
                                    }
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                tabIndex={isActive ? 0 : -1}
                                className="webview-tab-main"
                                title={tab.url}
                                onClick={() => model.activateBrowserTab(tab.id)}
                                onKeyDown={(event) => {
                                    if (event.key === "Delete") {
                                        event.preventDefault();
                                        closeAndRestoreFocus(index);
                                        return;
                                    }
                                    const nextIndex = getNextBrowserTabIndex(
                                        event.key,
                                        index,
                                        tabs.length,
                                        orientation
                                    );
                                    if (nextIndex == null) {
                                        return;
                                    }
                                    event.preventDefault();
                                    activateAndFocusTab(nextIndex);
                                }}
                            >
                                {tab.favicon ? (
                                    <img className="webview-tab-favicon" src={tab.favicon} alt="" />
                                ) : (
                                    <i className="fa-solid fa-globe webview-tab-icon" aria-hidden="true" />
                                )}
                                <span className="webview-tab-title">{tab.title || tab.url || "New tab"}</span>
                            </button>
                            <button
                                type="button"
                                tabIndex={isActive ? 0 : -1}
                                className="webview-tab-close"
                                aria-label={`Close ${tab.title || tab.url || "new tab"}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    closeAndRestoreFocus(index);
                                }}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
            <button
                type="button"
                className="webview-tab-add"
                title="New tab"
                aria-label="New browser tab"
                onClick={() => model.addBrowserTab()}
            >
                <i className="fa-solid fa-plus" aria-hidden="true" />
            </button>
        </div>
    );
});
WebViewTabStrip.displayName = "WebViewTabStrip";

const WebViewBrowserChrome = memo(
    ({ activeTabId, model, showTabs, tabs }: WebViewTabStripProps & { showTabs: boolean }) => {
        const block = useAtomValue(model.blockAtom);
        const currentUrl = useAtomValue(model.url);
        const homepageUrl = useAtomValue(model.homepageUrl);
        const canGoBack = useAtomValue(model.canGoBack);
        const canGoForward = useAtomValue(model.canGoForward);
        const refreshIcon = useAtomValue(model.refreshIcon);
        const [inspectMode, setInspectMode] = useState(() => isAgentWidgetInspectModeActive(model.blockId));
        const url = currentUrl ?? block?.meta?.url ?? homepageUrl ?? "";

        useEffect(() => {
            const handleInspectMode = (event: Event) => {
                const detail = (event as CustomEvent<{ blockId: string; enabled: boolean }>).detail;
                if (detail.blockId !== model.blockId) {
                    return;
                }
                setInspectMode(detail.enabled);
                model.webviewRef.current?.send("open-design-set-inspect-mode", { enabled: detail.enabled });
            };
            window.addEventListener(AgentWidgetInspectModeEvent, handleInspectMode);
            return () => window.removeEventListener(AgentWidgetInspectModeEvent, handleInspectMode);
        }, [model]);

        return (
            <div className="webview-browser-chrome">
                {showTabs && <WebViewTabStrip model={model} tabs={tabs} activeTabId={activeTabId} />}
                <div className="webview-navigation" role="toolbar" aria-label="Browser navigation">
                    <button
                        type="button"
                        onClick={() => model.handleBack()}
                        disabled={!canGoBack}
                        aria-label="Back"
                        title="Back"
                    >
                        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => model.handleForward()}
                        disabled={!canGoForward}
                        aria-label="Forward"
                        title="Forward"
                    >
                        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => model.handleRefresh(null)} aria-label="Reload" title="Reload">
                        <i className={`fa-solid fa-${refreshIcon}`} aria-hidden="true" />
                    </button>
                    <div className="webview-omnibox">
                        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                        <input
                            ref={model.urlInputRef}
                            value={url}
                            onChange={(event) => model.handleUrlChange(event)}
                            onKeyDown={(event) => model.handleKeyDown(event)}
                            onFocus={(event) => model.handleFocus(event)}
                            onBlur={(event) => model.handleBlur(event)}
                            aria-label="Address and search"
                            spellCheck={false}
                        />
                    </div>
                    <button
                        type="button"
                        className={clsx("webview-open-design", inspectMode && "is-active")}
                        onClick={() => setAgentWidgetInspectMode(model.blockId, !inspectMode)}
                        aria-label={inspectMode ? "Stop selecting design components" : "Select design components"}
                        aria-pressed={inspectMode}
                        title={
                            inspectMode
                                ? "Stop Open Design inspection"
                                : "Open Design: select and comment on components"
                        }
                    >
                        <i className="fa-solid fa-object-group" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (url) {
                                void model.env.electron.openExternal(model.modifyExternalUrl?.(url) ?? url);
                            }
                        }}
                        aria-label="Open in external browser"
                        title="Open in external browser"
                    >
                        <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                    </button>
                </div>
            </div>
        );
    }
);
WebViewBrowserChrome.displayName = "WebViewBrowserChrome";

// User agent strings for mobile emulation
const USER_AGENT_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const USER_AGENT_ANDROID =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";

let webviewPreloadUrl = null;

function makeBrowserTabId(): string {
    return `webtab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBrowserTabs(block: Block | null | undefined, fallbackUrl: string): BrowserTabRecord[] {
    const meta = block?.meta as Record<string, any> | undefined;
    const rawTabs = meta?.["web:tabs"];
    if (Array.isArray(rawTabs)) {
        const tabs = rawTabs
            .map((tab) => ({
                id: String(tab?.id ?? makeBrowserTabId()),
                url: String(tab?.url ?? fallbackUrl ?? "about:blank"),
                title: typeof tab?.title === "string" ? tab.title : undefined,
                favicon: typeof tab?.favicon === "string" ? tab.favicon : undefined,
            }))
            .filter((tab) => tab.url);
        if (tabs.length > 0) {
            return tabs;
        }
    }
    return [
        {
            id: String(meta?.["web:activetabid"] ?? makeBrowserTabId()),
            url: fallbackUrl || "about:blank",
            title: fallbackUrl || "New tab",
        },
    ];
}

function getWebviewPreloadUrl(env: WebViewEnv) {
    if (webviewPreloadUrl == null) {
        webviewPreloadUrl = env.electron.getWebviewPreload();
        console.log("webviewPreloadUrl", webviewPreloadUrl);
    }
    if (webviewPreloadUrl == null) {
        return null;
    }
    return "file://" + webviewPreloadUrl;
}

export class WebViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    tabModel: TabModel;
    noPadding?: Atom<boolean>;
    blockAtom: Atom<Block>;
    viewIcon: Atom<string | IconButtonDecl>;
    viewName: Atom<string>;
    viewText: Atom<HeaderElem[]>;
    headerTop: Atom<React.ReactNode>;
    hideViewName: Atom<boolean>;
    url: PrimitiveAtom<string>;
    homepageUrl: Atom<string>;
    urlInputFocused: PrimitiveAtom<boolean>;
    isLoading: PrimitiveAtom<boolean>;
    urlWrapperClassName: PrimitiveAtom<string>;
    refreshIcon: PrimitiveAtom<string>;
    webviewRef: React.RefObject<WebviewTag>;
    urlInputRef: React.RefObject<HTMLInputElement>;
    nodeModel: BlockNodeModel;
    endIconButtons?: Atom<IconButtonDecl[]>;
    mediaPlaying: PrimitiveAtom<boolean>;
    mediaMuted: PrimitiveAtom<boolean>;
    canGoBack: PrimitiveAtom<boolean>;
    canGoForward: PrimitiveAtom<boolean>;
    modifyExternalUrl?: (url: string) => string;
    domReady: PrimitiveAtom<boolean>;
    hideNav: Atom<boolean>;
    searchAtoms?: SearchAtoms;
    typeaheadOpen: PrimitiveAtom<boolean>;
    partitionOverride: PrimitiveAtom<string> | null;
    userAgentType: Atom<string>;
    env: WebViewEnv;

    constructor({ blockId, nodeModel, tabModel, waveEnv }: ViewModelInitType) {
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.viewType = "web";
        this.blockId = blockId;
        this.env = waveEnv;
        this.noPadding = atom(true);
        this.blockAtom = this.env.wos.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.url = atom();
        const defaultUrlAtom = this.env.getSettingsKeyAtom("web:defaulturl");
        this.homepageUrl = atom((get) => {
            const defaultUrl = get(defaultUrlAtom);
            const pinnedUrl = get(this.blockAtom)?.meta?.pinnedurl;
            return pinnedUrl ?? defaultUrl;
        });
        this.urlWrapperClassName = atom("");
        this.urlInputFocused = atom(false);
        this.isLoading = atom(false);
        this.refreshIcon = atom("rotate-right");
        this.viewIcon = atom("globe");
        this.viewName = atom("Web");
        this.hideViewName = atom(true);
        this.urlInputRef = createRef<HTMLInputElement>();
        this.webviewRef = createRef<WebviewTag>();
        this.domReady = atom(false);
        this.hideNav = this.env.getBlockMetaKeyAtom(blockId, "web:hidenav");
        this.typeaheadOpen = atom(false);
        this.partitionOverride = null;
        this.userAgentType = this.env.getBlockMetaKeyAtom(blockId, "web:useragenttype");

        this.mediaPlaying = atom(false);
        this.mediaMuted = atom(false);
        this.canGoBack = atom(false);
        this.canGoForward = atom(false);

        this.viewText = atom((get) => {
            const homepageUrl = get(this.homepageUrl);
            const metaUrl = get(this.blockAtom)?.meta?.url;
            const currUrl = get(this.url);
            const urlWrapperClassName = get(this.urlWrapperClassName);
            const refreshIcon = get(this.refreshIcon);
            const mediaPlaying = get(this.mediaPlaying);
            const mediaMuted = get(this.mediaMuted);
            const canGoBack = get(this.canGoBack);
            const canGoForward = get(this.canGoForward);
            const url = currUrl ?? metaUrl ?? homepageUrl ?? "";
            const rtn: HeaderElem[] = [];
            if (get(this.hideNav)) {
                return rtn;
            }

            rtn.push({
                elemtype: "iconbutton",
                icon: "chevron-left",
                click: this.handleBack.bind(this),
                disabled: !canGoBack,
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: "chevron-right",
                click: this.handleForward.bind(this),
                disabled: !canGoForward,
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: "house",
                click: this.handleHome.bind(this),
                disabled: this.shouldDisableHomeButton(),
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: refreshIcon,
                click: this.handleRefresh.bind(this),
            });
            const divChildren: HeaderElem[] = [];
            divChildren.push({
                elemtype: "iconbutton",
                icon: "shield-halved",
                title: "Site information",
                noAction: true,
            });
            divChildren.push({
                elemtype: "input",
                value: url,
                ref: this.urlInputRef,
                className: "url-input",
                onChange: this.handleUrlChange.bind(this),
                onKeyDown: this.handleKeyDown.bind(this),
                onFocus: this.handleFocus.bind(this),
                onBlur: this.handleBlur.bind(this),
            });
            if (mediaPlaying) {
                divChildren.push({
                    elemtype: "iconbutton",
                    icon: mediaMuted ? "volume-slash" : "volume",
                    click: this.handleMuteChange.bind(this),
                });
            }
            rtn.push({
                elemtype: "div",
                className: clsx("block-frame-div-url", urlWrapperClassName),
                onMouseOver: this.handleUrlWrapperMouseOver.bind(this),
                onMouseOut: this.handleUrlWrapperMouseOut.bind(this),
                children: divChildren,
            });
            return rtn;
        });

        const tabStripPositionAtom = this.env.getSettingsKeyAtom("web:tabstripposition");
        this.headerTop = atom((get) => {
            if (get(this.hideNav)) {
                return null;
            }
            const tabStripPosition = get(tabStripPositionAtom) ?? "top";
            const blockData = get(this.blockAtom);
            const meta = blockData?.meta as Record<string, any> | undefined;
            const fallbackUrl = meta?.url || get(this.homepageUrl) || "about:blank";
            const tabs = normalizeBrowserTabs(blockData, fallbackUrl);
            const requestedActiveTabId = typeof meta?.["web:activetabid"] === "string" ? meta["web:activetabid"] : "";
            const activeTabId = tabs.some((tab) => tab.id === requestedActiveTabId)
                ? requestedActiveTabId
                : tabs[0]?.id;
            return (
                <WebViewBrowserChrome
                    model={this}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    showTabs={tabStripPosition !== "left"}
                />
            );
        });

        this.endIconButtons = atom((get) => {
            if (get(this.hideNav)) {
                return null;
            }
            const url = get(this.url);
            const userAgentType = get(this.userAgentType);
            const buttons: IconButtonDecl[] = [];

            // Add mobile indicator icon if using mobile user agent
            if (userAgentType === "mobile:iphone" || userAgentType === "mobile:android") {
                const mobileIcon = userAgentType === "mobile:iphone" ? "mobile-screen" : "mobile-screen-button";
                const mobileTitle =
                    userAgentType === "mobile:iphone" ? "Mobile User Agent: iPhone" : "Mobile User Agent: Android";
                buttons.push({
                    elemtype: "iconbutton",
                    icon: mobileIcon,
                    title: mobileTitle,
                    noAction: true,
                });
            }

            buttons.push({
                elemtype: "iconbutton",
                icon: "arrow-up-right-from-square",
                title: "Open in External Browser",
                click: () => {
                    console.log("open external", url);
                    if (url != null && url != "") {
                        const externalUrl = this.modifyExternalUrl?.(url) ?? url;
                        return this.env.electron.openExternal(externalUrl);
                    }
                },
            });

            return buttons;
        });
    }

    get viewComponent(): ViewComponent {
        return WebView;
    }

    /**
     * Whether the back button in the header should be disabled.
     * @returns True if the WebView cannot go back or if the WebView call fails. False otherwise.
     */
    shouldDisableBackButton() {
        try {
            return !this.webviewRef.current?.canGoBack();
        } catch (_) {}
        return true;
    }

    /**
     * Whether the forward button in the header should be disabled.
     * @returns True if the WebView cannot go forward or if the WebView call fails. False otherwise.
     */
    shouldDisableForwardButton() {
        try {
            return !this.webviewRef.current?.canGoForward();
        } catch (_) {}
        return true;
    }

    /**
     * Whether the home button in the header should be disabled.
     * @returns True if the current url is the pinned url or the pinned url is not set. False otherwise.
     */
    shouldDisableHomeButton() {
        try {
            const homepageUrl = globalStore.get(this.homepageUrl);
            return !homepageUrl || this.getUrl() === homepageUrl;
        } catch (_) {}
        return true;
    }

    handleHome(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.loadUrl(globalStore.get(this.homepageUrl), "home");
    }

    setMediaPlaying(isPlaying: boolean) {
        globalStore.set(this.mediaPlaying, isPlaying);
    }

    handleMuteChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const newMutedVal = !this.webviewRef.current?.isAudioMuted();
            globalStore.set(this.mediaMuted, newMutedVal);
            this.webviewRef.current?.setAudioMuted(newMutedVal);
        } catch (e) {
            console.error("Failed to change mute value", e);
        }
    }

    setTypeaheadOpen(open: boolean) {
        globalStore.set(this.typeaheadOpen, open);
    }

    async fetchBookmarkSuggestions(
        query: string,
        reqContext: SuggestionRequestContext
    ): Promise<FetchSuggestionsResponse> {
        const result = await this.env.rpc.FetchSuggestionsCommand(TabRpcClient, {
            suggestiontype: "bookmark",
            query,
            widgetid: reqContext.widgetid,
            reqnum: reqContext.reqnum,
        });
        return result;
    }

    handleUrlWrapperMouseOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseover" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "hovered");
        }
    }

    handleUrlWrapperMouseOut(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseout" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "");
        }
    }

    handleBack(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goBack();
    }

    handleForward(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goForward();
    }

    updateNavState() {
        try {
            globalStore.set(this.canGoBack, this.webviewRef.current?.canGoBack() ?? false);
            globalStore.set(this.canGoForward, this.webviewRef.current?.canGoForward() ?? false);
        } catch (_) {}
    }

    handleRefresh(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (this.webviewRef.current) {
                if (globalStore.get(this.isLoading)) {
                    this.webviewRef.current.stop();
                } else {
                    this.webviewRef.current.reload();
                }
            }
        } catch (e) {
            console.warn("handleRefresh catch", e);
        }
    }

    handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
        globalStore.set(this.url, event.target.value);
    }

    handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        const waveEvent = adaptFromReactOrNativeKeyEvent(event);
        if (checkKeyPressed(waveEvent, "Enter")) {
            const url = globalStore.get(this.url);
            this.loadUrl(url, "enter");
            this.urlInputRef.current?.blur();
            return;
        }
        if (checkKeyPressed(waveEvent, "Escape")) {
            this.webviewRef.current?.focus();
        }
    }

    handleFocus(event: React.FocusEvent<HTMLInputElement>) {
        globalStore.set(this.urlWrapperClassName, "focused");
        globalStore.set(this.urlInputFocused, true);
        this.urlInputRef.current.focus();
        event.target.select();
    }

    handleBlur(event: React.FocusEvent<HTMLInputElement>) {
        globalStore.set(this.urlWrapperClassName, "");
        globalStore.set(this.urlInputFocused, false);
    }

    /**
     * Update the URL in the state when a navigation event has occurred.
     * @param url The URL that has been navigated to.
     */
    handleNavigate(url: string) {
        const blockData = globalStore.get(this.blockAtom);
        const tabs = this.getBrowserTabs(blockData);
        const activeTabId = this.getActiveBrowserTabId(blockData, tabs);
        const nextTabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, url } : tab));
        fireAndForget(() =>
            this.env.rpc.SetMetaCommand(TabRpcClient, {
                oref: makeORef("block", this.blockId),
                meta: { url, "web:tabs": nextTabs, "web:activetabid": activeTabId } as unknown as MetaType,
            })
        );
        globalStore.set(this.url, url);
        if (this.searchAtoms) {
            globalStore.set(this.searchAtoms.isOpen, false);
        }
    }

    getBrowserTabs(blockData?: Block | null): BrowserTabRecord[] {
        const defaultUrl = globalStore.get(this.homepageUrl) || "";
        const fallbackUrl = (blockData?.meta as Record<string, any> | undefined)?.url || defaultUrl || "about:blank";
        return normalizeBrowserTabs(blockData, fallbackUrl);
    }

    getActiveBrowserTabId(blockData?: Block | null, tabs?: BrowserTabRecord[]): string {
        const meta = blockData?.meta as Record<string, any> | undefined;
        const browserTabs = tabs ?? this.getBrowserTabs(blockData);
        const activeTabId = typeof meta?.["web:activetabid"] === "string" ? meta["web:activetabid"] : "";
        if (browserTabs.some((tab) => tab.id === activeTabId)) {
            return activeTabId;
        }
        return browserTabs[0]?.id ?? makeBrowserTabId();
    }

    persistBrowserTabs(tabs: BrowserTabRecord[], activeTabId: string, url?: string) {
        fireAndForget(() =>
            this.env.rpc.SetMetaCommand(TabRpcClient, {
                oref: makeORef("block", this.blockId),
                meta: {
                    url: url ?? tabs.find((tab) => tab.id === activeTabId)?.url ?? null,
                    "web:tabs": tabs,
                    "web:activetabid": activeTabId,
                } as unknown as MetaType,
            })
        );
    }

    addBrowserTab(url?: string, title?: string) {
        const blockData = globalStore.get(this.blockAtom);
        const defaultUrl = globalStore.get(this.homepageUrl) || "about:blank";
        const nextUrl = this.ensureUrlScheme(
            url || defaultUrl,
            globalStore.get(this.env.getSettingsKeyAtom("web:defaultsearch"))
        );
        const tabs = this.getBrowserTabs(blockData);
        const tab: BrowserTabRecord = {
            id: makeBrowserTabId(),
            url: nextUrl,
            title: title || nextUrl,
        };
        const nextTabs = [...tabs, tab];
        this.persistBrowserTabs(nextTabs, tab.id, nextUrl);
        this.loadUrl(nextUrl, "new-tab");
    }

    activateBrowserTab(tabId: string) {
        const blockData = globalStore.get(this.blockAtom);
        const tabs = this.getBrowserTabs(blockData);
        const tab = tabs.find((candidate) => candidate.id === tabId);
        if (!tab) {
            return;
        }
        this.persistBrowserTabs(tabs, tab.id, tab.url);
        this.loadUrl(tab.url, "activate-tab");
    }

    closeBrowserTab(tabId: string) {
        const blockData = globalStore.get(this.blockAtom);
        const tabs = this.getBrowserTabs(blockData);
        if (tabs.length <= 1) {
            const defaultUrl = globalStore.get(this.homepageUrl) || "about:blank";
            const nextTab = { id: makeBrowserTabId(), url: defaultUrl, title: "New tab" };
            this.persistBrowserTabs([nextTab], nextTab.id, defaultUrl);
            this.loadUrl(defaultUrl, "close-last-tab");
            return;
        }
        const closeIndex = tabs.findIndex((tab) => tab.id === tabId);
        const nextTabs = tabs.filter((tab) => tab.id !== tabId);
        const activeTabId = this.getActiveBrowserTabId(blockData, tabs);
        const nextActiveTab =
            activeTabId === tabId
                ? (nextTabs[Math.max(0, closeIndex - 1)] ?? nextTabs[0])
                : nextTabs.find((tab) => tab.id === activeTabId);
        if (!nextActiveTab) {
            return;
        }
        this.persistBrowserTabs(nextTabs, nextActiveTab.id, nextActiveTab.url);
        if (activeTabId === tabId) {
            this.loadUrl(nextActiveTab.url, "close-tab");
        }
    }

    updateActiveBrowserTab(patch: Partial<BrowserTabRecord>) {
        const blockData = globalStore.get(this.blockAtom);
        const tabs = this.getBrowserTabs(blockData);
        const activeTabId = this.getActiveBrowserTabId(blockData, tabs);
        const nextTabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, ...patch } : tab));
        this.persistBrowserTabs(nextTabs, activeTabId, nextTabs.find((tab) => tab.id === activeTabId)?.url);
    }

    ensureUrlScheme(url: string, searchTemplate: string) {
        if (url == null) {
            url = "";
        }

        if (/^(http|https|file):/.test(url)) {
            // If the URL starts with http: or https:, return it as is
            return url;
        }

        // Check if the URL looks like a local URL
        const isLocal = /^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(url.split("/")[0]);

        if (isLocal) {
            // If it is a local URL, ensure it has http:// scheme
            return `http://${url}`;
        }

        // Check if the URL looks like a domain
        const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
        const isDomain = domainRegex.test(url.split("/")[0]);

        if (isDomain) {
            // If it looks like a domain, ensure it has https:// scheme
            return `https://${url}`;
        }

        // Otherwise, treat it as a search query
        if (searchTemplate == null) {
            return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        return searchTemplate.replace("{query}", encodeURIComponent(url));
    }

    /**
     * Load a new URL in the webview.
     * @param newUrl The new URL to load in the webview.
     */
    loadUrl(newUrl: string, reason: string) {
        const defaultSearchAtom = this.env.getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrl", reason, nextUrl, "cur=", this.webviewRef.current.getURL());
        if (!this.webviewRef.current) {
            return;
        }
        if (this.webviewRef.current.getURL() != nextUrl) {
            fireAndForget(() => this.webviewRef.current.loadURL(nextUrl));
        }
        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }
    }

    /**
     * Load a new URL in the webview and return a promise.
     * @param newUrl The new URL to load in the webview.
     * @param reason The reason for loading the URL.
     * @returns Promise that resolves when the URL is loaded.
     */
    loadUrlPromise(newUrl: string, reason: string): Promise<void> {
        const defaultSearchAtom = this.env.getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrlPromise", reason, nextUrl, "cur=", this.webviewRef.current?.getURL());

        if (!this.webviewRef.current) {
            return Promise.reject(new Error("WebView ref not available"));
        }

        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }

        if (this.webviewRef.current.getURL() != nextUrl) {
            return this.webviewRef.current.loadURL(nextUrl);
        }

        return Promise.resolve();
    }

    /**
     * Get the current URL from the state.
     * @returns The URL from the state.
     */
    getUrl() {
        return globalStore.get(this.url);
    }

    setRefreshIcon(refreshIcon: string) {
        globalStore.set(this.refreshIcon, refreshIcon);
    }

    setIsLoading(isLoading: boolean) {
        globalStore.set(this.isLoading, isLoading);
    }

    async setHomepageUrl(url: string, scope: "global" | "block") {
        if (url != null && url != "") {
            switch (scope) {
                case "block":
                    await this.env.rpc.SetMetaCommand(TabRpcClient, {
                        oref: makeORef("block", this.blockId),
                        meta: { pinnedurl: url },
                    });
                    break;
                case "global":
                    await this.env.rpc.SetMetaCommand(TabRpcClient, {
                        oref: makeORef("block", this.blockId),
                        meta: { pinnedurl: null },
                    });
                    await this.env.rpc.SetConfigCommand(TabRpcClient, { "web:defaulturl": url });
                    break;
            }
        }
    }

    giveFocus(): boolean {
        console.log("webview giveFocus");
        if (this.searchAtoms && globalStore.get(this.searchAtoms.isOpen)) {
            console.log("search is open, not giving focus");
            return true;
        }
        const ctrlShiftState = globalStore.get(getSimpleControlShiftAtom());
        if (ctrlShiftState) {
            // this is really weird, we don't get keyup events from webview
            const unsubFn = globalStore.sub(getSimpleControlShiftAtom(), () => {
                const state = globalStore.get(getSimpleControlShiftAtom());
                if (!state) {
                    unsubFn();
                    const isStillFocused = globalStore.get(this.nodeModel.isFocused);
                    if (isStillFocused) {
                        this.webviewRef.current?.focus();
                    }
                }
            });
            return false;
        }
        this.webviewRef.current?.focus();
        return true;
    }

    copyUrlToClipboard() {
        const url = this.getUrl();
        if (url != null && url != "") {
            fireAndForget(() => navigator.clipboard.writeText(url));
        }
    }

    clearHistory() {
        try {
            this.webviewRef.current?.clearHistory();
        } catch (e) {
            console.error("Failed to clear history", e);
        }
    }

    async clearCookiesAndStorage() {
        try {
            const webContentsId = this.webviewRef.current?.getWebContentsId();
            if (webContentsId) {
                await this.env.electron.clearWebviewStorage(webContentsId);
            }
        } catch (e) {
            console.error("Failed to clear cookies and storage", e);
        }
    }

    keyDownHandler(e: WaveKeyboardEvent): boolean {
        if (checkKeyPressed(e, "Cmd:l")) {
            this.urlInputRef?.current?.focus();
            this.urlInputRef?.current?.select();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:r")) {
            this.webviewRef.current?.reload();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowLeft")) {
            this.handleBack(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowRight")) {
            this.handleForward(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:o")) {
            const curVal = globalStore.get(this.typeaheadOpen);
            globalStore.set(this.typeaheadOpen, !curVal);
            return true;
        }
        return false;
    }

    setZoomFactor(factor: number | null) {
        // null is ok (will reset to default)
        if (factor != null && factor < 0.1) {
            factor = 0.1;
        }
        if (factor != null && factor > 5) {
            factor = 5;
        }
        const domReady = globalStore.get(this.domReady);
        if (!domReady) {
            return;
        }
        this.webviewRef.current?.setZoomFactor(factor || 1);
        this.env.rpc.SetMetaCommand(TabRpcClient, {
            oref: makeORef("block", this.blockId),
            meta: { "web:zoom": factor }, // allow null so we can remove the zoom factor here
        });
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const zoomSubMenu: ContextMenuItem[] = [];
        let curZoom = 1;
        if (globalStore.get(this.domReady)) {
            curZoom = this.webviewRef.current?.getZoomFactor() || 1;
        }
        const makeZoomFactorMenuItem = (label: string, factor: number): ContextMenuItem => {
            return {
                label: label,
                type: "checkbox",
                click: () => {
                    this.setZoomFactor(factor);
                },
                checked: curZoom == factor,
            };
        };
        zoomSubMenu.push({
            label: "Reset",
            click: () => {
                this.setZoomFactor(null);
            },
        });
        zoomSubMenu.push(makeZoomFactorMenuItem("25%", 0.25));
        zoomSubMenu.push(makeZoomFactorMenuItem("50%", 0.5));
        zoomSubMenu.push(makeZoomFactorMenuItem("70%", 0.7));
        zoomSubMenu.push(makeZoomFactorMenuItem("80%", 0.8));
        zoomSubMenu.push(makeZoomFactorMenuItem("90%", 0.9));
        zoomSubMenu.push(makeZoomFactorMenuItem("100%", 1));
        zoomSubMenu.push(makeZoomFactorMenuItem("110%", 1.1));
        zoomSubMenu.push(makeZoomFactorMenuItem("120%", 1.2));
        zoomSubMenu.push(makeZoomFactorMenuItem("130%", 1.3));
        zoomSubMenu.push(makeZoomFactorMenuItem("150%", 1.5));
        zoomSubMenu.push(makeZoomFactorMenuItem("175%", 1.75));
        zoomSubMenu.push(makeZoomFactorMenuItem("200%", 2));

        // User Agent Type submenu
        const curUserAgentType = globalStore.get(this.userAgentType) || "default";
        const userAgentSubMenu: ContextMenuItem[] = [
            {
                label: "Default",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return this.env.rpc.SetMetaCommand(TabRpcClient, {
                            oref: makeORef("block", this.blockId),
                            meta: { "web:useragenttype": null },
                        });
                    });
                },
                checked: curUserAgentType === "default" || curUserAgentType === "",
            },
            {
                label: "Mobile: iPhone",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return this.env.rpc.SetMetaCommand(TabRpcClient, {
                            oref: makeORef("block", this.blockId),
                            meta: { "web:useragenttype": "mobile:iphone" },
                        });
                    });
                },
                checked: curUserAgentType === "mobile:iphone",
            },
            {
                label: "Mobile: Android",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return this.env.rpc.SetMetaCommand(TabRpcClient, {
                            oref: makeORef("block", this.blockId),
                            meta: { "web:useragenttype": "mobile:android" },
                        });
                    });
                },
                checked: curUserAgentType === "mobile:android",
            },
        ];

        const isNavHidden = globalStore.get(this.hideNav);
        return [
            {
                label: "Copy URL to Clipboard",
                click: () => this.copyUrlToClipboard(),
            },
            {
                label: "Set Block Homepage",
                click: () => fireAndForget(() => this.setHomepageUrl(this.getUrl(), "block")),
            },
            {
                label: "Set Default Homepage",
                click: () => fireAndForget(() => this.setHomepageUrl(this.getUrl(), "global")),
            },
            {
                type: "separator",
            },
            {
                label: "User Agent Type",
                submenu: userAgentSubMenu,
            },
            {
                type: "separator",
            },
            {
                label: isNavHidden ? "Un-Hide Navigation" : "Hide Navigation",
                click: () =>
                    fireAndForget(() => {
                        return this.env.rpc.SetMetaCommand(TabRpcClient, {
                            oref: makeORef("block", this.blockId),
                            meta: { "web:hidenav": !isNavHidden },
                        });
                    }),
            },
            {
                label: "Set Zoom Factor",
                submenu: zoomSubMenu,
            },
            {
                label: this.webviewRef.current?.isDevToolsOpened() ? "Close DevTools" : "Open DevTools",
                click: () => {
                    if (this.webviewRef.current) {
                        if (this.webviewRef.current.isDevToolsOpened()) {
                            this.webviewRef.current.closeDevTools();
                        } else {
                            this.webviewRef.current.openDevTools();
                        }
                    }
                },
            },
            {
                type: "separator",
            },
            {
                label: "Clear History",
                click: () => this.clearHistory(),
            },
            {
                label: "Clear Cookies and Storage (All Web Widgets)",
                click: () => fireAndForget(() => this.clearCookiesAndStorage()),
            },
        ];
    }
}

const BookmarkTypeahead = memo(
    ({ model, blockRef }: { model: WebViewModel; blockRef: React.RefObject<HTMLDivElement> }) => {
        const env = useWaveEnv<WebViewEnv>();
        const openBookmarksJson = () => {
            fireAndForget(async () => {
                const path = `${env.electron.getConfigDir()}/presets/bookmarks.json`;
                const blockDef: BlockDef = {
                    meta: {
                        view: "preview",
                        file: path,
                    },
                };
                await env.createBlock(blockDef, false, true);
                model.setTypeaheadOpen(false);
            });
        };
        return (
            <BlockHeaderSuggestionControl
                blockRef={blockRef}
                openAtom={model.typeaheadOpen}
                onClose={() => model.setTypeaheadOpen(false)}
                onSelect={(suggestion) => {
                    if (suggestion == null || suggestion.type != "url") {
                        return true;
                    }
                    model.loadUrl(suggestion["url:url"], "bookmark-typeahead");
                    return true;
                }}
                fetchSuggestions={model.fetchBookmarkSuggestions}
                placeholderText="Open Bookmark..."
            >
                <SuggestionControlNoData>
                    <div className="text-center">
                        <p className="text-lg font-bold text-gray-100">No Bookmarks Configured</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Edit your <code className="font-mono">bookmarks.json</code> file to configure bookmarks.
                        </p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Open bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoData>

                <SuggestionControlNoResults>
                    <div className="text-center">
                        <p className="text-sm text-gray-400">No matching bookmarks</p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Edit bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoResults>
            </BlockHeaderSuggestionControl>
        );
    }
);

interface WebViewProps {
    blockId: string;
    model: WebViewModel;
    onFailLoad?: (url: string) => void;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    initialSrc?: string;
}

function getWebPreviewDisplayUrl(url?: string | null): string {
    return url?.trim() || "about:blank";
}

function normalizeOpenDesignSelection(blockId: string, payload: unknown): AgentWidgetDesignSelection | null {
    const raw = payload as Record<string, any> | null;
    const element = raw?.element as Record<string, any> | null;
    const numbers = [element?.x, element?.y, element?.width, element?.height];
    if (!element || numbers.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return null;
    }
    const text = (value: unknown, max: number) =>
        String(value ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, max);
    const selection: AgentWidgetDesignSelection = {
        blockId,
        url: text(raw?.url, 2_048),
        element: {
            ref: text(element.ref, 512),
            role: text(element.role, 80) || "element",
            name: text(element.name, 240),
            ...(text(element.value, 240) ? { value: text(element.value, 240) } : {}),
            x: Math.round(element.x),
            y: Math.round(element.y),
            width: Math.max(0, Math.round(element.width)),
            height: Math.max(0, Math.round(element.height)),
            focusable: element.focusable === true,
            visible: element.visible !== false,
            ...(text(element.selector, 512) ? { selector: text(element.selector, 512) } : {}),
            ...(text(element.tagName, 80) ? { tagName: text(element.tagName, 80) } : {}),
            ...(text(element.componentName, 120) ? { componentName: text(element.componentName, 120) } : {}),
        },
    };
    const comment = text(raw?.comment, 2_000);
    return comment ? { ...selection, comment } : selection;
}

function WebViewPreviewFallback({ url }: { url?: string | null }) {
    const displayUrl = getWebPreviewDisplayUrl(url);

    return (
        <div className="flex h-full w-full items-center justify-center bg-panel">
            <div className="mx-6 flex max-w-[720px] flex-col gap-3 rounded-lg border border-dashed border-border bg-background px-6 py-5 shadow-sm">
                <div className="text-xs font-mono text-muted">preview mock · electron webview unavailable</div>
                <div className="text-sm text-foreground">web widget placeholder</div>
                <div className="rounded-md border border-border bg-panel px-3 py-2 font-mono text-xs text-foreground break-all">
                    {displayUrl}
                </div>
            </div>
        </div>
    );
}

const WebView = memo(({ model, onFailLoad, blockRef, initialSrc }: WebViewProps) => {
    const env = useWaveEnv<WebViewEnv>();
    const blockData = useAtomValue(model.blockAtom);
    const defaultUrl = useAtomValue(model.homepageUrl);
    const defaultSearchAtom = env.getSettingsKeyAtom("web:defaultsearch");
    const defaultSearch = useAtomValue(defaultSearchAtom);
    const browserTabs = model.getBrowserTabs(blockData);
    const activeTabId = model.getActiveBrowserTabId(blockData, browserTabs);
    const activeTab = browserTabs.find((tab) => tab.id === activeTabId) ?? browserTabs[0];
    let metaUrl = activeTab?.url || blockData?.meta?.url || defaultUrl || "";
    if (metaUrl) {
        metaUrl = model.ensureUrlScheme(metaUrl, defaultSearch);
    }
    const metaUrlRef = useRef(metaUrl);
    const zoomFactor = useAtomValue(env.getBlockMetaKeyAtom(model.blockId, "web:zoom")) || 1;
    const partitionOverride = useAtomValueSafe(model.partitionOverride);
    const metaPartition = useAtomValue(env.getBlockMetaKeyAtom(model.blockId, "web:partition"));
    const webPartition = partitionOverride || metaPartition || undefined;
    const userAgentType = useAtomValue(model.userAgentType) || "default";
    const hideNav = useAtomValue(model.hideNav);
    const tabStripPosition =
        (useAtomValue(getSettingsKeyAtom("web:tabstripposition" as keyof SettingsType)) as string | null) ?? "top";

    // Determine user agent string based on type
    let userAgent: string | undefined = undefined;
    if (userAgentType === "mobile:iphone") {
        userAgent = USER_AGENT_IPHONE;
    } else if (userAgentType === "mobile:android") {
        userAgent = USER_AGENT_ANDROID;
    }

    // Search
    const searchProps = useSearch({ anchorRef: model.webviewRef, viewModel: model });
    const searchVal = useAtomValue<string>(searchProps.searchValue);
    const setSearchIndex = useSetAtom(searchProps.resultsIndex);
    const setNumSearchResults = useSetAtom(searchProps.resultsCount);
    searchProps.onSearch = useCallback((search: string) => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            if (search) {
                model.webviewRef.current?.findInPage(search, { findNext: true });
            } else {
                model.webviewRef.current?.stopFindInPage("clearSelection");
            }
        } catch (e) {
            console.error("Failed to search", e);
        }
    }, []);
    searchProps.onNext = useCallback(() => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            console.log("search next", searchVal);
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: true });
        } catch (e) {
            console.error("Failed to search next", e);
        }
    }, [searchVal]);
    searchProps.onPrev = useCallback(() => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            console.log("search prev", searchVal);
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: false });
        } catch (e) {
            console.error("Failed to search prev", e);
        }
    }, [searchVal]);
    const onFoundInPage = useCallback((event: any) => {
        const result = event.result;
        console.log("found in page", result);
        if (!result) {
            return;
        }
        setNumSearchResults(result.matches);
        setSearchIndex(result.activeMatchOrdinal - 1);
    }, []);
    // End Search

    // The initial value of the block metadata URL when the component first renders. Used to set the starting src value for the webview.
    const [metaUrlInitial] = useState(initialSrc || metaUrl);
    const prevUserAgentTypeRef = useRef(userAgentType);

    const [webContentsId, setWebContentsId] = useState(null);
    const domReady = useAtomValue(model.domReady);

    const [errorText, setErrorText] = useState("");

    function setBgColor() {
        const webview = model.webviewRef.current;
        if (!webview) {
            return;
        }
        setTimeout(() => {
            webview
                .executeJavaScript(
                    `!!document.querySelector('meta[name="color-scheme"]') && document.querySelector('meta[name="color-scheme"]').content?.includes('dark') || false`
                )
                .then((hasDarkMode) => {
                    if (hasDarkMode) {
                        webview.style.backgroundColor = "black"; // Dark mode background
                    } else {
                        webview.style.backgroundColor = "white"; // Light mode background
                    }
                })
                .catch((e) => {
                    webview.style.backgroundColor = "black"; // Dark mode background
                    console.log("Error getting color scheme, defaulting to dark", e);
                });
        }, 100);
    }

    useEffect(() => {
        return () => {
            globalStore.set(model.domReady, false);
        };
    }, []);

    useEffect(() => {
        if (model.webviewRef.current == null || !domReady) {
            return;
        }
        try {
            const wcId = model.webviewRef.current.getWebContentsId?.();
            if (wcId) {
                setWebContentsId(wcId);
                if (model.webviewRef.current.getZoomFactor() != zoomFactor) {
                    model.webviewRef.current.setZoomFactor(zoomFactor);
                }
            }
        } catch (e) {
            console.error("Failed to get webcontentsid / setzoomlevel (webview)", e);
        }
    }, [model.webviewRef.current, domReady, zoomFactor]);

    // Load a new URL if the block metadata is updated.
    useEffect(() => {
        if (initialSrc) {
            // Skip URL loading if initialSrc is provided (it's already loaded via src attribute)
            return;
        }
        if (metaUrlRef.current != metaUrl) {
            metaUrlRef.current = metaUrl;
            model.loadUrl(metaUrl, "meta");
        }
    }, [metaUrl, initialSrc]);

    // Reload webview when user agent type changes
    useEffect(() => {
        if (prevUserAgentTypeRef.current !== userAgentType && domReady && model.webviewRef.current) {
            let newUserAgent: string | undefined = undefined;
            if (userAgentType === "mobile:iphone") {
                newUserAgent = USER_AGENT_IPHONE;
            } else if (userAgentType === "mobile:android") {
                newUserAgent = USER_AGENT_ANDROID;
            }

            if (newUserAgent) {
                model.webviewRef.current.setUserAgent(newUserAgent);
            } else {
                model.webviewRef.current.setUserAgent("");
            }
            model.webviewRef.current.reload();
        }
        prevUserAgentTypeRef.current = userAgentType;
    }, [userAgentType, domReady]);

    useEffect(() => {
        const webview = model.webviewRef.current;
        if (!webview) {
            return;
        }
        const navigateListener = (e: any) => {
            setErrorText("");
            if (e.isMainFrame) {
                model.handleNavigate(e.url);
                publishCrossViewEvent("browser:navigate", model.blockId, makeBrowserPayload(model.blockId, e.url));
            }
            model.updateNavState();
        };
        const newWindowHandler = (e: any) => {
            e.preventDefault();
            const newUrl = e?.detail?.url || e?.url;
            if (!newUrl) {
                return;
            }
            model.addBrowserTab(newUrl);
        };
        const titleUpdatedHandler = (e: any) => {
            if (typeof e?.title !== "string" || e.title.length === 0) {
                return;
            }
            model.updateActiveBrowserTab({ title: e.title });
            publishCrossViewEvent(
                "browser:title-change",
                model.blockId,
                makeBrowserPayload(model.blockId, undefined, e.title)
            );
        };
        const faviconUpdatedHandler = (e: any) => {
            const favicons = e?.favicons;
            if (!Array.isArray(favicons) || favicons.length === 0) {
                return;
            }
            model.updateActiveBrowserTab({ favicon: favicons[0] });
        };
        const startLoadingHandler = () => {
            model.setRefreshIcon("xmark-large");
            model.setIsLoading(true);
            webview.style.backgroundColor = "transparent";
        };
        const stopLoadingHandler = () => {
            model.setRefreshIcon("rotate-right");
            model.setIsLoading(false);
            setBgColor();
        };
        const failLoadHandler = (e: any) => {
            if (e.errorCode === -3) {
                console.warn("Suppressed ERR_ABORTED error", e);
            } else {
                const errorMessage = `Failed to load ${e.validatedURL}: ${e.errorDescription}`;
                console.error(errorMessage);
                setErrorText(errorMessage);
                if (onFailLoad) {
                    const curUrl = model.webviewRef.current.getURL();
                    onFailLoad(curUrl);
                }
            }
        };
        const webviewFocus = () => {
            env.electron.setWebviewFocus(webview.getWebContentsId());
            model.nodeModel.focusNode();
        };
        const webviewBlur = () => {
            env.electron.setWebviewFocus(null);
        };
        const handleDomReady = () => {
            globalStore.set(model.domReady, true);
            setBgColor();
            webview.send("open-design-set-inspect-mode", {
                enabled: isAgentWidgetInspectModeActive(model.blockId),
            });
            // Inject cursor overlay (starts hidden, activated by agent activity events)
            webview.executeJavaScript(CURSOR_OVERLAY_SCRIPT).catch((err: unknown) => {
                console.warn("cursor overlay inject failed", err);
            });
        };
        const handleMediaPlaying = () => {
            model.setMediaPlaying(true);
        };
        const handleMediaPaused = () => {
            model.setMediaPlaying(false);
        };
        const handleIpcMessage = (event: any) => {
            if (event.channel !== "open-design-selection" && event.channel !== "open-design-comment") {
                return;
            }
            const selection = normalizeOpenDesignSelection(model.blockId, event.args?.[0]);
            if (selection) {
                publishAgentWidgetDesignSelection(selection);
            }
        };

        webview.addEventListener("did-frame-navigate", navigateListener);
        webview.addEventListener("did-navigate-in-page", navigateListener);
        webview.addEventListener("did-navigate", navigateListener);
        webview.addEventListener("did-start-loading", startLoadingHandler);
        webview.addEventListener("did-stop-loading", stopLoadingHandler);
        webview.addEventListener("new-window", newWindowHandler);
        webview.addEventListener("page-title-updated", titleUpdatedHandler);
        webview.addEventListener("page-favicon-updated", faviconUpdatedHandler);
        webview.addEventListener("did-fail-load", failLoadHandler);
        webview.addEventListener("focus", webviewFocus);
        webview.addEventListener("blur", webviewBlur);
        webview.addEventListener("dom-ready", handleDomReady);
        webview.addEventListener("media-started-playing", handleMediaPlaying);
        webview.addEventListener("media-paused", handleMediaPaused);
        webview.addEventListener("found-in-page", onFoundInPage);
        webview.addEventListener("ipc-message", handleIpcMessage);

        // Clean up event listeners on component unmount
        return () => {
            webview.removeEventListener("did-frame-navigate", navigateListener);
            webview.removeEventListener("did-navigate", navigateListener);
            webview.removeEventListener("did-navigate-in-page", navigateListener);
            webview.removeEventListener("new-window", newWindowHandler);
            webview.removeEventListener("page-title-updated", titleUpdatedHandler);
            webview.removeEventListener("page-favicon-updated", faviconUpdatedHandler);
            webview.removeEventListener("did-fail-load", failLoadHandler);
            webview.removeEventListener("did-start-loading", startLoadingHandler);
            webview.removeEventListener("did-stop-loading", stopLoadingHandler);
            webview.removeEventListener("focus", webviewFocus);
            webview.removeEventListener("blur", webviewBlur);
            webview.removeEventListener("dom-ready", handleDomReady);
            webview.removeEventListener("media-started-playing", handleMediaPlaying);
            webview.removeEventListener("media-paused", handleMediaPaused);
            webview.removeEventListener("found-in-page", onFoundInPage);
            webview.removeEventListener("ipc-message", handleIpcMessage);
        };
    }, []);

    // Listen for agent activity events to show/hide cursor overlay in webview
    useEffect(() => {
        const webview = model.webviewRef.current;
        if (!webview) {
            return;
        }

        let previewCapturePending = false;
        let previewCaptureTimer: number | null = null;

        const requestPreviewCapture = (detail: AgentWidgetActivity) => {
            if (detail.previewImageUrl || previewCapturePending || typeof webview.capturePage !== "function") {
                return;
            }
            previewCapturePending = true;
            previewCaptureTimer = window.setTimeout(() => {
                void webview
                    .capturePage()
                    .then((image) => {
                        const previewImageUrl = image.toDataURL();
                        if (!previewImageUrl || previewImageUrl === "data:image/png;base64,") {
                            return;
                        }
                        const action =
                            detail.action === "typing"
                                ? "type"
                                : detail.action === "scroll"
                                  ? "scroll"
                                  : detail.action === "cursor"
                                    ? "click"
                                    : detail.action === "view"
                                      ? "inspect"
                                      : "open";
                        reportDesktopPetActivity(
                            { kind: "tool", detail: detail.detail, previewImageUrl },
                            model.blockId,
                            detail.point,
                            { surface: "browser", action }
                        );
                    })
                    .catch(() => {})
                    .finally(() => {
                        previewCapturePending = false;
                    });
            }, 90);
        };

        const handleWidgetActivity = (e: Event) => {
            const detail = (e as CustomEvent<AgentWidgetActivity>).detail;
            if (detail.blockId !== model.blockId) {
                return;
            }
            webview.executeJavaScript("window.__showKronCursor(true)").catch(() => {});
            if (detail.point) {
                reportCursorToPet(detail.point, "browser");
            }
            requestPreviewCapture(detail);
        };

        const unsubscribeSurfaceActivity = subscribeAgentActivityStream((detail) => {
            if (detail.blockid !== model.blockId) {
                return;
            }
            const phase = detail.phase;
            if (phase === "succeeded" || phase === "failed" || phase === "cancelled") {
                webview.executeJavaScript("window.__showKronCursor(false)").catch(() => {});
            } else if (phase === "running") {
                webview.executeJavaScript("window.__showKronCursor(true)").catch(() => {});
            }
        });

        window.addEventListener("agent-widget-activity", handleWidgetActivity);

        return () => {
            if (previewCaptureTimer != null) {
                window.clearTimeout(previewCaptureTimer);
            }
            window.removeEventListener("agent-widget-activity", handleWidgetActivity);
            unsubscribeSurfaceActivity();
        };
    }, [model.blockId]);

    const { waterflowActive, markers } = useAgentOverlays("browser", model.blockId);

    const tabStrip =
        !hideNav && tabStripPosition === "left" ? (
            <WebViewTabStrip model={model} tabs={browserTabs} activeTabId={activeTabId} left />
        ) : null;

    return (
        <Fragment>
            <div className={clsx("webview-shell", tabStripPosition === "left" ? "is-left-tabs" : "is-top-tabs")}>
                {tabStrip}
                <div className="webview-stage">
                    <MockBoundary fallback={<WebViewPreviewFallback url={metaUrl} />}>
                        <webview
                            id="webview"
                            className="webview"
                            ref={model.webviewRef}
                            src={metaUrlInitial}
                            data-blockid={model.blockId}
                            data-webcontentsid={webContentsId} // needed for emain
                            preload={getWebviewPreloadUrl(env)}
                            // @ts-expect-error This is a discrepancy between the React typing and the Chromium impl for webviewTag. Chrome webviewTag expects a string, while React expects a boolean.
                            allowpopups="true"
                            partition={webPartition}
                            useragent={userAgent}
                        />
                    </MockBoundary>
                    {errorText && (
                        <div className="webview-error">
                            <div>{errorText}</div>
                        </div>
                    )}
                    <WaterFlowOverlay active={waterflowActive} />
                    {markers.map((m) => (
                        <ActionMarker
                            key={m.id}
                            actionType={m.actionType}
                            label={m.label}
                            x={m.x}
                            y={m.y}
                            active={true}
                        />
                    ))}
                </div>
            </div>
            <Search {...searchProps} />
            <BookmarkTypeahead model={model} blockRef={blockRef} />
        </Fragment>
    );
});

export { WebView, WebViewPreviewFallback, getWebPreviewDisplayUrl };
