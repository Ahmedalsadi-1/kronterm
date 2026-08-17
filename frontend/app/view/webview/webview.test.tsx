// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { makeMockWaveEnv } from "@/preview/mock/mockwaveenv";
import { atom } from "jotai";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getWebPreviewDisplayUrl, WebViewModel, WebViewPreviewFallback } from "./webview";

describe("webview preview fallback", () => {
    it("shows the requested URL", () => {
        const markup = renderToStaticMarkup(<WebViewPreviewFallback url="https://kronterm.dev/docs" />);

        expect(markup).toContain("electron webview unavailable");
        expect(markup).toContain("https://kronterm.dev/docs");
    });

    it("falls back to about:blank when no URL is available", () => {
        expect(getWebPreviewDisplayUrl("")).toBe("about:blank");
        expect(getWebPreviewDisplayUrl(null)).toBe("about:blank");
    });

    it("uses the supplied env for homepage atoms and config updates", async () => {
        const blockId = "webview-env-block";
        const env = makeMockWaveEnv({
            settings: {
                "web:defaulturl": "https://default.example",
            },
            mockWaveObjs: {
                [`block:${blockId}`]: {
                    otype: "block",
                    oid: blockId,
                    version: 1,
                    meta: {
                        pinnedurl: "https://block.example",
                    },
                } as Block,
            },
        });
        const model = new WebViewModel({
            blockId,
            nodeModel: {
                isFocused: atom(true),
                focusNode: () => {},
            } as any,
            tabModel: {} as any,
            waveEnv: env,
        });

        expect(globalStore.get(model.homepageUrl)).toBe("https://block.example");

        await model.setHomepageUrl("https://global.example", "global");

        expect(globalStore.get(model.homepageUrl)).toBe("https://global.example");
        expect(globalStore.get(env.getSettingsKeyAtom("web:defaulturl"))).toBe("https://global.example");
        expect(globalStore.get(env.wos.getWaveObjectAtom<Block>(`block:${blockId}`))?.meta?.pinnedurl).toBeUndefined();
    });

    it("keeps widget actions out of the browser navigation controls", () => {
        const blockId = "webview-header-block";
        const env = makeMockWaveEnv({
            settings: {
                "web:defaulturl": "https://kronterm.dev",
            },
            mockWaveObjs: {
                [`block:${blockId}`]: {
                    otype: "block",
                    oid: blockId,
                    version: 1,
                    meta: {},
                } as Block,
            },
        });
        const model = new WebViewModel({
            blockId,
            nodeModel: {
                blockId,
                isFocused: atom(true),
                isMagnified: atom(false),
                isFolded: atom(false),
                focusNode: () => {},
                toggleMagnify: () => {},
                toggleFold: () => {},
                onClose: () => {},
            },
            tabModel: {} as any,
            waveEnv: env,
        });

        const header = globalStore.get(model.viewText) as HeaderElem[];
        const topLevelIcons = header
            .filter((element): element is IconButtonDecl => element.elemtype === "iconbutton")
            .map((element) => element.icon);

        expect(topLevelIcons).not.toContain("expand");
        expect(topLevelIcons).not.toContain("compress");
        expect(topLevelIcons).not.toContain("sliders");
    });

    it("provides top-positioned browser tabs to the block header", () => {
        const blockId = "webview-tabs-block";
        const env = makeMockWaveEnv({
            settings: {
                "web:defaulturl": "https://kronterm.dev",
                "web:tabstripposition": "top",
            },
            mockWaveObjs: {
                [`block:${blockId}`]: {
                    otype: "block",
                    oid: blockId,
                    version: 1,
                    meta: {
                        "web:tabs": [
                            { id: "docs", url: "https://kronterm.dev/docs", title: "Docs" },
                            { id: "api", url: "https://kronterm.dev/api", title: "API" },
                        ],
                        "web:activetabid": "docs",
                    },
                } as Block,
            },
        });
        const model = new WebViewModel({
            blockId,
            nodeModel: {
                blockId,
                isFocused: atom(true),
                isMagnified: atom(false),
                isFolded: atom(false),
                focusNode: () => {},
                toggleMagnify: () => {},
                toggleFold: () => {},
                onClose: () => {},
            },
            tabModel: {} as any,
            waveEnv: env,
        });

        const markup = renderToStaticMarkup(<>{globalStore.get(model.headerTop)}</>);

        expect(markup).toContain("webview-tab-strip");
        expect(markup).toContain("Docs");
        expect(markup).toContain('role="tablist"');
        expect(markup).toContain('role="tab"');
        expect(markup).toContain('aria-selected="true"');
        expect(markup).toContain('aria-selected="false"');
        expect(markup).toContain('aria-orientation="horizontal"');
        expect(markup).toContain('tabindex="0"');
        expect(markup).toContain('tabindex="-1"');
        expect(markup).toContain('aria-label="Close Docs"');
        expect(markup).toContain('aria-label="New browser tab"');
    });
});
