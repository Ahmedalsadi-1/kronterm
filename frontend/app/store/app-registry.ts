// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";

import { blockViewToIcon, blockViewToName } from "@/app/block/blockutil";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

// InstalledAppInfo is an ambient global type (frontend/types/gotypes.d.ts)

export type AppKind = "view" | "installed";

// icon is either a "data:..." URL (platform icon) or an icon-font class name (built-in views)
export type AppDescriptor = {
    id: string;
    kind: AppKind;
    name: string;
    icon?: string;
    category?: string;
    aliases: string[];
    view?: string;
    runningBlockIds: string[];
    pinned: boolean;
    installedAppId?: string;
};

export type AppBlockRef = {
    blockId: string;
    view: string;
    title: string;
};

const BuiltinViewApps: Array<{
    view: string;
    aliases?: string[];
    pinned?: boolean;
    category?: string;
}> = [
    { view: "term", aliases: ["terminal", "shell", "console", "pty"], pinned: true, category: "System" },
    { view: "web", aliases: ["browser", "web browser", "webview", "internet"], pinned: true, category: "Applications" },
    {
        view: "chathubv2",
        aliases: ["kronoschamber", "hermes", "ai", "chat", "kronos", "agent"],
        pinned: true,
        category: "Agents",
    },
    { view: "preview", aliases: ["files", "file", "editor", "notes", "markdown", "pdf"], pinned: true, category: "Productivity" },
    { view: "sysinfo", aliases: ["system", "cpu", "memory", "monitor"], category: "System" },
    { view: "sandbox", aliases: ["linux", "vm", "isolated"], category: "System" },
    { view: "kronoscanvas", aliases: ["canvas", "draw", "diagram"], category: "Productivity" },
    { view: "appstream", aliases: ["app stream", "native app", "stream", "remote app"], category: "Applications" },
    { view: "installedapps", aliases: ["apps", "applications", "launcher"], category: "Applications" },
    { view: "kronsettings", aliases: ["settings", "preferences", "config"], category: "System" },
    { view: "help", aliases: ["docs", "documentation", "tips"], category: "System" },
];

export function makeViewAppDescriptor(view: string, runningBlockIds: string[]): AppDescriptor {
    const builtin = BuiltinViewApps.find((app) => app.view === view);
    return {
        id: `view:${view}`,
        kind: "view",
        name: blockViewToName(view),
        icon: blockViewToIcon(view),
        category: builtin?.category,
        aliases: builtin?.aliases ?? [],
        view,
        runningBlockIds,
        pinned: builtin?.pinned ?? false,
    };
}

export function makeInstalledAppDescriptor(app: InstalledAppInfo): AppDescriptor {
    return {
        id: `app:${app.appid || app.path}`,
        kind: "installed",
        name: app.name,
        icon: app.icon,
        category: app.category,
        aliases: [app.name.toLowerCase(), app.bundleid ?? "", app.description ?? ""].filter(Boolean),
        runningBlockIds: [],
        pinned: false,
        installedAppId: app.bundleid || app.appid,
    };
}

export function mergeAppDescriptors(builtins: AppDescriptor[], installed: AppDescriptor[], blocks: AppBlockRef[]): AppDescriptor[] {
    const runningByView = new Map<string, string[]>();
    for (const block of blocks) {
        const existing = runningByView.get(block.view) ?? [];
        existing.push(block.blockId);
        runningByView.set(block.view, existing);
    }
    const mergedBuiltins = builtins.map((descriptor) =>
        descriptor.kind === "view" && descriptor.view != null
            ? { ...descriptor, runningBlockIds: runningByView.get(descriptor.view) ?? [] }
            : descriptor
    );
    return [...mergedBuiltins, ...installed];
}

export function searchApps(descriptors: AppDescriptor[], query: string): AppDescriptor[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") return descriptors;
    return descriptors.filter((descriptor) => {
        const haystack = [descriptor.name, ...descriptor.aliases].join(" ").toLowerCase();
        return haystack.includes(needle);
    });
}

export type AppLaunchDecision =
    | { action: "focus"; blockId: string }
    | { action: "create"; view: string }
    | { action: "create-appstream"; appid: string; appname: string };

export function focusOrCreateDecision(descriptor: AppDescriptor): AppLaunchDecision {
    if (descriptor.runningBlockIds.length > 0) {
        return { action: "focus", blockId: descriptor.runningBlockIds[0] };
    }
    if (descriptor.kind === "view" && descriptor.view != null) {
        return { action: "create", view: descriptor.view };
    }
    return { action: "create-appstream", appid: descriptor.installedAppId ?? descriptor.id, appname: descriptor.name };
}

let installedAppsCache: Promise<InstalledAppInfo[]> | null = null;

export function fetchInstalledApps(force = false): Promise<InstalledAppInfo[]> {
    if (force || installedAppsCache == null) {
        installedAppsCache = RpcApi.ListInstalledAppsCommand(TabRpcClient).catch(() => [] as InstalledAppInfo[]);
    }
    return installedAppsCache;
}

export function getBuiltinViewDescriptors(blocks: AppBlockRef[]): AppDescriptor[] {
    return BuiltinViewApps.map((app) =>
        makeViewAppDescriptor(
            app.view,
            blocks.filter((block) => block.view === app.view).map((block) => block.blockId)
        )
    );
}

export function useInstalledAppDescriptors(): AppDescriptor[] {
    const [apps, setApps] = useState<AppDescriptor[]>([]);
    useEffect(() => {
        let cancelled = false;
        fetchInstalledApps().then((list) => {
            if (cancelled) return;
            setApps(list.map(makeInstalledAppDescriptor));
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return apps;
}
