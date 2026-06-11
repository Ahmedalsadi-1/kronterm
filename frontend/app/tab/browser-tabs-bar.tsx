// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { globalStore } from "@/app/store/jotaiStore";
import { makeORef } from "@/app/store/wos";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import { fireAndForget } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo } from "react";

type BrowserTabsEnv = WaveEnvSubset<{
    wos: WaveEnv["wos"];
    rpc: {
        SetMetaCommand: WaveEnv["rpc"]["SetMetaCommand"];
    };
    createBlock: WaveEnv["createBlock"];
}>;

type BrowserTabRecord = {
    id: string;
    url: string;
    title?: string;
    favicon?: string;
};

type BrowserBlockTabs = {
    blockId: string;
    tabs: BrowserTabRecord[];
    activeTabId: string;
};

/**
 * Shows browser widget tabs in the workspace tab bar.
 * When a browser block has multiple tabs, they appear as clickable pills.
 * Clicking a pill focuses the browser block and activates that tab.
 */
const BrowserTabsBar = memo(({ currentTabId }: { currentTabId: string }) => {
    const env = useWaveEnv<BrowserTabsEnv>();

    // Get all blocks in the current tab
    const tabORef = makeORef("tab", currentTabId);
    const tabAtom = env.wos.getWaveObjectAtom<Tab>(tabORef);
    const tabData = useAtomValue(tabAtom);

    // Find all browser blocks and their tabs
    const browserBlocks = useMemo(() => {
        if (!tabData?.blockids) return [];

        const blocks: BrowserBlockTabs[] = [];
        for (const blockId of tabData.blockids) {
            const blockORef = makeORef("block", blockId);
            const blockAtom = env.wos.getWaveObjectAtom<Block>(blockORef);
            const blockData = globalStore.get(blockAtom);
            if (!blockData) continue;

            const meta = blockData.meta as Record<string, any> | undefined;
            if (meta?.view !== "web") continue;

            const rawTabs = meta?.["web:tabs"];
            if (!Array.isArray(rawTabs) || rawTabs.length <= 1) continue;

            const tabs: BrowserTabRecord[] = rawTabs.map((tab: any) => ({
                id: String(tab?.id ?? ""),
                url: String(tab?.url ?? ""),
                title: typeof tab?.title === "string" ? tab.title : undefined,
                favicon: typeof tab?.favicon === "string" ? tab.favicon : undefined,
            }));

            const activeTabId =
                typeof meta?.["web:activetabid"] === "string" ? meta["web:activetabid"] : (tabs[0]?.id ?? "");

            blocks.push({ blockId, tabs, activeTabId });
        }
        return blocks;
    }, [tabData?.blockids, env.wos]);

    const handleTabClick = useCallback(
        (blockId: string, tabId: string, url: string) => {
            fireAndForget(async () => {
                await env.rpc.SetMetaCommand(TabRpcClient, {
                    oref: makeORef("block", blockId),
                    meta: {
                        "web:activetabid": tabId,
                        url,
                    } as unknown as MetaType,
                });
            });
        },
        [env]
    );

    if (browserBlocks.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 mx-1 mb-[3px]">
            {browserBlocks.map((block) =>
                block.tabs.map((tab) => (
                    <Tooltip
                        key={`${block.blockId}-${tab.id}`}
                        content={tab.url}
                        placement="bottom"
                        divClassName={`browser-tab-pill ${tab.id === block.activeTabId ? "is-active" : ""}`}
                        divOnClick={() => handleTabClick(block.blockId, tab.id, tab.url)}
                    >
                        {tab.favicon ? (
                            <img className="browser-tab-pill-favicon" src={tab.favicon} alt="" />
                        ) : (
                            <i className="fa-solid fa-globe text-[10px] text-blue-400" />
                        )}
                        <span className="text-[10px] font-medium text-secondary truncate max-w-[80px]">
                            {tab.title || tab.url || "New tab"}
                        </span>
                    </Tooltip>
                ))
            )}
        </div>
    );
});

BrowserTabsBar.displayName = "BrowserTabsBar";

export { BrowserTabsBar };
