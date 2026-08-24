// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { requestTabsAgentCompanion } from "@/app/tab/tabs-agent-workspace";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { atoms, refocusNode } from "@/store/global";
import {
    isAgentActivityActive,
    subscribeAgentActivityStream,
    type LiveAgentSurfaceActivity,
} from "../../types/agent-activity";

const PreviewMaxAgeMs = 15_000;
const HiddenChatViews = new Set(["chathubv2", "hermes"]);

export type AgentWidgetDescriptor = {
    id: string;
    view: string;
    title: string;
    focused: boolean;
    active: boolean;
    action?: string;
    detail?: string;
    previewImageUrl?: string;
    surfaceKind?: "widget";
    browserTabs?: Array<{
        id: string;
        title: string;
        url: string;
        active: boolean;
    }>;
};

export type AgentWidgetElement = Pick<
    WidgetElementData,
    "ref" | "role" | "name" | "value" | "x" | "y" | "width" | "height" | "focusable" | "visible"
>;

export type AgentWidgetSnapshot = {
    blockId: string;
    width: number;
    height: number;
    timestamp: number;
    elements: AgentWidgetElement[];
};

const activityByBlockId = new Map<string, LiveAgentSurfaceActivity>();
const latestActivityBySurface = new Map<LiveAgentSurfaceActivity["surface"], LiveAgentSurfaceActivity>();
let activitySubscriptionInstalled = false;

function ensureActivitySubscription(): void {
    if (activitySubscriptionInstalled) {
        return;
    }
    activitySubscriptionInstalled = true;
    subscribeAgentActivityStream((activity) => {
        latestActivityBySurface.set(activity.surface, activity);
        if (activity.blockid) {
            activityByBlockId.set(activity.blockid, activity);
        }
    });
}

function viewMatchesSurface(view: string, surface: LiveAgentSurfaceActivity["surface"]): boolean {
    if (surface === "browser") return view === "web" || view === "webview";
    if (surface === "terminal") return view === "term";
    if (surface === "desktop") return view === "appstream";
    if (surface === "file") return view === "file" || view === "preview";
    return view === surface;
}

function activityFields(activity: LiveAgentSurfaceActivity): Partial<AgentWidgetDescriptor> {
    const previewIsFresh = activity.previewimageurl && Date.now() - activity.timestamp <= PreviewMaxAgeMs;
    return {
        active: isAgentActivityActive(activity.phase),
        ...(activity.action ? { action: activity.action } : {}),
        ...(activity.detail ? { detail: activity.detail } : {}),
        ...(previewIsFresh ? { previewImageUrl: activity.previewimageurl } : {}),
    };
}

export function listAgentWidgets(excludeBlockId?: string): AgentWidgetDescriptor[] {
    ensureActivitySubscription();
    const tabId = globalStore.get(atoms.staticTabId);
    const tab = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)));
    if (!tab) {
        return [];
    }

    const layoutModel = getLayoutModelForStaticTab();
    const focusedBlockId = layoutModel ? globalStore.get(layoutModel.focusedNode)?.data?.blockId : null;
    const widgets = (tab.blockids ?? []).flatMap((blockId): AgentWidgetDescriptor[] => {
        if (!blockId || blockId === excludeBlockId) {
            return [];
        }
        const block = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)));
        const view = String(block?.meta?.view ?? "widget");
        if (HiddenChatViews.has(view)) {
            return [];
        }
        const title = String(block?.meta?.["frame:title"] ?? "").trim() || view;
        const activity = activityByBlockId.get(blockId);
        const rawTabs = block?.meta?.["web:tabs"];
        const activeTabId = String(
            block?.meta?.["web:activetabid"] ?? (Array.isArray(rawTabs) ? rawTabs[0]?.id : "") ?? ""
        );
        const browserTabs =
            view === "web"
                ? (Array.isArray(rawTabs) && rawTabs.length > 0
                      ? rawTabs
                      : [
                            {
                                id: activeTabId || `${blockId}:active`,
                                title: block?.meta?.["frame:title"],
                                url: block?.meta?.url,
                            },
                        ]
                  )
                      .map((tab) => ({
                          id: String(tab?.id ?? ""),
                          title: String(tab?.title ?? tab?.url ?? "Browser tab"),
                          url: String(tab?.url ?? ""),
                          active: String(tab?.id ?? "") === activeTabId,
                      }))
                      .filter((tab) => tab.url)
                : undefined;
        return [
            {
                id: blockId,
                view,
                title,
                focused: blockId === focusedBlockId,
                active: false,
                surfaceKind: "widget",
                ...(browserTabs ? { browserTabs } : {}),
                ...(activity ? activityFields(activity) : {}),
            },
        ];
    });

    if (widgets.some((widget) => widget.active)) {
        return widgets;
    }
    const fallbackActivity = [...latestActivityBySurface.values()]
        .filter((activity) => isAgentActivityActive(activity.phase))
        .sort((left, right) => right.timestamp - left.timestamp)[0];
    if (!fallbackActivity) {
        return widgets;
    }
    const fallbackIndex = widgets.findIndex(
        (widget) => widget.focused && viewMatchesSurface(widget.view, fallbackActivity.surface)
    );
    const matchingIndex =
        fallbackIndex >= 0
            ? fallbackIndex
            : widgets.findIndex((widget) => viewMatchesSurface(widget.view, fallbackActivity.surface));
    if (matchingIndex >= 0) {
        widgets[matchingIndex] = { ...widgets[matchingIndex], ...activityFields(fallbackActivity) };
    }
    return widgets;
}

export async function previewAgentWidget(blockId: string): Promise<string> {
    const target = listAgentWidgets().find((widget) => widget.id === blockId);
    if (!target) {
        throw new Error("widget-not-in-current-tab");
    }
    if (target.previewImageUrl) {
        return target.previewImageUrl;
    }
    return RpcApi.CaptureBlockScreenshotCommand(TabRpcClient, { blockid: blockId }, { timeout: 5000 });
}

export async function snapshotAgentWidget(blockId: string): Promise<AgentWidgetSnapshot> {
    const target = listAgentWidgets().find((widget) => widget.id === blockId);
    if (!target) {
        throw new Error("widget-not-in-current-tab");
    }
    if (target.view !== "web") {
        throw new Error("widget-is-not-an-inspectable-browser");
    }

    const [snapshot, state] = await Promise.all([
        RpcApi.WidgetSnapshotCommand(TabRpcClient, { blockid: blockId }, { timeout: 5000 }),
        RpcApi.WidgetGetStateCommand(TabRpcClient, { blockid: blockId }, { timeout: 5000 }),
    ]);

    return {
        blockId,
        width: Math.max(1, Math.round(state.width)),
        height: Math.max(1, Math.round(state.height)),
        timestamp: snapshot.timestamp,
        elements: snapshot.elements
            .filter((element) => element.visible && element.width > 0 && element.height > 0)
            .slice(0, 500)
            .map((element) => ({
                ref: element.ref,
                role: element.role,
                name: element.name,
                value: element.value,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                focusable: element.focusable,
                visible: element.visible,
            })),
    };
}

export function focusAgentWidget(blockId: string): { ok: boolean; error?: string } {
    const targetId = blockId.trim();
    if (!targetId || targetId.length > 128) {
        return { ok: false, error: "invalid-block-id" };
    }
    if (!listAgentWidgets().some((widget) => widget.id === targetId)) {
        return { ok: false, error: "widget-not-in-current-tab" };
    }
    requestTabsAgentCompanion(targetId);
    refocusNode(targetId);
    return { ok: true };
}
