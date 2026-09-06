// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { createBlockSplitHorizontally } from "@/app/store/global";
import { WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import type { PrimitiveAtom } from "jotai";
import * as jotai from "jotai";
import * as React from "react";

const featuredApps = ["browseros", "messages", "preview", "iterm"];

export type InstalledAppsEnv = WaveEnvSubset<{
    rpc: {
        ListInstalledAppsCommand: WaveEnv["rpc"]["ListInstalledAppsCommand"];
    };
}>;

export class InstalledAppsViewModel implements ViewModel {
    viewType = "installedapps";
    viewIcon = jotai.atom("desktop");
    viewName = jotai.atom("Installed Apps");
    appsAtom = jotai.atom<InstalledAppInfo[]>([]);
    loadingAtom = jotai.atom(true);
    loadErrorAtom = jotai.atom("");
    searchTerm = jotai.atom("");
    categoryAtom = jotai.atom("All");
    launchStateAtom = jotai.atom<LaunchState | null>(null) as PrimitiveAtom<LaunchState | null>;
    blockId: string;
    env: InstalledAppsEnv;

    constructor({ blockId, waveEnv }: ViewModelInitType) {
        this.blockId = blockId;
        this.env = waveEnv as InstalledAppsEnv;
        this.loadApps();
    }

    get viewComponent(): ViewComponent {
        return InstalledAppsView;
    }

    async loadApps() {
        globalStore.set(this.loadingAtom, true);
        globalStore.set(this.loadErrorAtom, "");
        try {
            const apps = await this.env.rpc.ListInstalledAppsCommand(TabRpcClient);
            globalStore.set(this.appsAtom, apps);
        } catch (e) {
            console.error("Failed to load installed apps:", e);
            globalStore.set(this.appsAtom, []);
            globalStore.set(this.loadErrorAtom, "Could not load installed applications.");
        } finally {
            globalStore.set(this.loadingAtom, false);
        }
    }
}

type LaunchState = {
    execpath: string;
    name: string;
    status: "launching" | "launched" | "error";
};

function InstalledAppsView({ model }: ViewComponentProps<InstalledAppsViewModel>) {
    const apps = jotai.useAtomValue(model.appsAtom);
    const loading = jotai.useAtomValue(model.loadingAtom);
    const loadError = jotai.useAtomValue(model.loadErrorAtom);
    const [searchTerm, setSearchTerm] = jotai.useAtom(model.searchTerm);
    const [category, setCategory] = jotai.useAtom(model.categoryAtom);
    const [launchState, setLaunchState] = jotai.useAtom(model.launchStateAtom);

    const categories = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const app of apps) {
            const appCategory = getCategory(app);
            counts.set(appCategory, (counts.get(appCategory) ?? 0) + 1);
        }
        return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [apps]);

    const filteredApps = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return apps.filter((app) => {
            if (category != "All" && getCategory(app) != category) {
                return false;
            }
            if (!query) {
                return true;
            }
            return [app.name, app.category, app.description, app.bundleid]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [apps, category, searchTerm]);

    const quickLaunchApps = React.useMemo(() => {
        if (category != "All" || searchTerm.trim()) {
            return [];
        }
        return apps.filter((app) => getFeaturedRank(app) != -1).sort((a, b) => getFeaturedRank(a) - getFeaturedRank(b));
    }, [apps, category, searchTerm]);

    const listedApps = React.useMemo(() => {
        if (quickLaunchApps.length == 0) {
            return filteredApps;
        }
        const quickLaunchPaths = new Set(quickLaunchApps.map((app) => app.execpath));
        return filteredApps.filter((app) => !quickLaunchPaths.has(app.execpath));
    }, [filteredApps, quickLaunchApps]);

    const groupedApps = React.useMemo(() => {
        const groups: Record<string, InstalledAppInfo[]> = {};
        for (const app of listedApps) {
            const cat = getCategory(app);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(app);
        }
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [listedApps]);

    const handleLaunch = React.useCallback(
        async (app: InstalledAppInfo) => {
            setLaunchState({ execpath: app.execpath, name: app.name, status: "launching" });
            try {
                await createBlockSplitHorizontally(
                    {
                        meta: {
                            view: "appstream",
                            "appstream:appid": app.bundleid || app.appid,
                            "appstream:appname": app.name,
                        } as unknown as MetaType,
                    },
                    model.blockId,
                    "after"
                );
                setLaunchState({ execpath: app.execpath, name: app.name, status: "launched" });
            } catch (e) {
                console.error(`Failed to stream ${app.name}:`, e);
                setLaunchState({ execpath: app.execpath, name: app.name, status: "error" });
            }
        },
        [model.blockId, setLaunchState]
    );

    const handleSearchKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key != "Enter" || filteredApps.length == 0) {
                return;
            }
            handleLaunch(filteredApps[0]);
        },
        [filteredApps, handleLaunch]
    );

    const statusMessage = React.useMemo(() => {
        if (launchState?.status == "launching") {
            return `Starting ${launchState.name} stream...`;
        }
        if (launchState?.status == "launched") {
            return `Streaming ${launchState.name}`;
        }
        if (launchState?.status == "error") {
            return `Could not stream ${launchState.name}`;
        }
        return "";
    }, [launchState]);

    return (
        <div className="flex flex-col h-full bg-panel">
            <div className="p-3 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-primary">Stream an app</div>
                        <div className="text-xs text-muted">
                            Stream installed macOS applications without leaving Wave.
                        </div>
                    </div>
                    <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-1 text-xs text-secondary hover:bg-hoverbg hover:text-primary cursor-pointer"
                        onClick={() => model.loadApps()}
                        aria-label="Refresh installed applications"
                    >
                        <i className={clsx("fa fa-solid fa-rotate-right mr-1.5", loading && "fa-spin")}></i>
                        Refresh
                    </button>
                </div>
                <div className="relative">
                    <i className="fa fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm"></i>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search apps, categories, or bundle IDs"
                        aria-label="Search installed applications"
                        className="w-full bg-bginput border border-border rounded-md py-2 pl-9 pr-9 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-muted hover:text-primary hover:bg-hoverbg cursor-pointer"
                            aria-label="Clear search"
                        >
                            <i className="fa fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    <CategoryButton
                        active={category == "All"}
                        label="All"
                        count={apps.length}
                        onSelect={() => setCategory("All")}
                    />
                    {categories.map(([name, count]) => (
                        <CategoryButton
                            key={name}
                            active={category == name}
                            label={name}
                            count={count}
                            onSelect={() => setCategory(name)}
                        />
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {loading && apps.length == 0 ? (
                    <div className="flex items-center justify-center h-full text-muted">
                        <i className="fa fa-solid fa-spinner fa-spin text-xl mr-2"></i>
                        Finding applications...
                    </div>
                ) : loadError ? (
                    <div className="text-center text-muted py-10">
                        <i className="fa fa-solid fa-circle-exclamation text-error text-2xl mb-3 block"></i>
                        <p className="text-sm mb-3">{loadError}</p>
                        <button
                            type="button"
                            onClick={() => model.loadApps()}
                            className="px-3 py-1.5 rounded-md border border-border text-secondary hover:bg-hoverbg hover:text-primary cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                ) : filteredApps.length === 0 ? (
                    <div className="text-center text-muted py-8">
                        <i className="fa fa-solid fa-magnifying-glass text-3xl mb-3 block"></i>
                        <p className="text-sm">
                            {searchTerm ? `No apps match "${searchTerm.trim()}"` : "No apps in this category"}
                        </p>
                        {(searchTerm || category != "All") && (
                            <button
                                type="button"
                                className="text-xs text-accent hover:underline cursor-pointer mt-3"
                                onClick={() => {
                                    setSearchTerm("");
                                    setCategory("All");
                                }}
                            >
                                Show all apps
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {quickLaunchApps.length > 0 && (
                            <AppGroup
                                title="Quick Launch"
                                apps={quickLaunchApps}
                                onLaunch={handleLaunch}
                                launchState={launchState}
                                featured
                            />
                        )}
                        {groupedApps.map(([groupCategory, grouped]) => (
                            <AppGroup
                                key={groupCategory}
                                title={groupCategory}
                                apps={grouped}
                                onLaunch={handleLaunch}
                                launchState={launchState}
                            />
                        ))}
                    </>
                )}
            </div>

            <div className="px-3 py-2 border-t border-border text-xs flex items-center justify-between gap-3">
                <span className="text-muted">
                    {filteredApps.length} of {apps.length} app{apps.length != 1 ? "s" : ""}
                    {category != "All" && ` in ${category}`}
                </span>
                {statusMessage && (
                    <span
                        className={clsx("truncate", launchState?.status == "error" ? "text-error" : "text-secondary")}
                    >
                        {statusMessage}
                    </span>
                )}
            </div>
        </div>
    );
}

type CategoryButtonProps = {
    active: boolean;
    label: string;
    count: number;
    onSelect: () => void;
};

const CategoryButton = React.memo(({ active, label, count, onSelect }: CategoryButtonProps) => (
    <button
        type="button"
        onClick={onSelect}
        className={clsx(
            "shrink-0 rounded-full px-2.5 py-1 text-xs border cursor-pointer transition-colors",
            active
                ? "bg-accent/20 text-accent border-accent/40"
                : "text-secondary border-border hover:bg-hoverbg hover:text-primary"
        )}
    >
        {label} <span className="text-muted ml-1">{count}</span>
    </button>
));
CategoryButton.displayName = "CategoryButton";

type AppGroupProps = {
    title: string;
    apps: InstalledAppInfo[];
    launchState: LaunchState | null;
    onLaunch: (app: InstalledAppInfo) => void;
    featured?: boolean;
};

const AppGroup = React.memo(({ title, apps, launchState, onLaunch, featured }: AppGroupProps) => (
    <section className="mb-5">
        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            {title}
            <span className="rounded-full bg-white/5 px-1.5 py-0.5">{apps.length}</span>
        </h3>
        <div
            className={clsx(
                "grid gap-2",
                featured ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            )}
        >
            {apps.map((app) => (
                <AppTile
                    key={app.execpath}
                    app={app}
                    featured={featured}
                    launching={launchState?.execpath == app.execpath && launchState.status == "launching"}
                    launched={launchState?.execpath == app.execpath && launchState.status == "launched"}
                    onLaunch={onLaunch}
                />
            ))}
        </div>
    </section>
));
AppGroup.displayName = "AppGroup";

type AppTileProps = {
    app: InstalledAppInfo;
    onLaunch: (app: InstalledAppInfo) => void;
    featured?: boolean;
    launching?: boolean;
    launched?: boolean;
};

const AppTile = React.memo(({ app, onLaunch, featured, launching, launched }: AppTileProps) => {
    const commonAppIcon = React.useMemo(() => getCommonAppIcon(app), [app]);

    const iconSrc = React.useMemo(() => {
        if (!commonAppIcon && app.icon?.startsWith("data:")) {
            return app.icon;
        }
        return null;
    }, [app.icon, commonAppIcon]);

    const iconClass = React.useMemo(() => {
        if (commonAppIcon) {
            return makeIconClass(commonAppIcon, true);
        }
        if (app.icon && !app.icon.startsWith("data:")) {
            return makeIconClass(app.icon, true, { defaultIcon: "cube" });
        }
        return makeIconClass("cube", true);
    }, [app.icon, commonAppIcon]);

    return (
        <button
            type="button"
            className={clsx(
                "group relative flex flex-col items-center justify-center rounded-md border cursor-pointer transition-colors",
                featured
                    ? "p-3 bg-black/15 border-border hover:border-accent/40"
                    : "p-2.5 bg-white/5 border-transparent",
                "hover:bg-hoverbg focus:outline-none focus:border-accent",
                launched && "border-accent/30 bg-accent/10",
                launching && "opacity-70"
            )}
            onClick={() => onLaunch(app)}
            disabled={launching}
            title={app.description || `Stream ${app.name}`}
            aria-label={`Stream ${app.name}`}
        >
            <div className={clsx("flex items-center justify-center mb-2", featured ? "w-12 h-12" : "w-10 h-10")}>
                {iconSrc ? (
                    <img src={iconSrc} alt="" className={clsx("object-contain", featured ? "w-10 h-10" : "w-8 h-8")} />
                ) : (
                    <div className={clsx("text-accent", featured ? "text-3xl" : "text-2xl")}>
                        <i className={iconClass}></i>
                    </div>
                )}
            </div>
            <div className="text-xs font-medium text-center text-primary leading-tight w-full truncate">{app.name}</div>
            <div className="text-[10px] text-muted mt-1 w-full truncate">{app.description || app.source}</div>
            <span className="absolute right-2 top-2 text-[10px] text-muted opacity-0 group-hover:opacity-100">
                {launching ? (
                    <i className="fa fa-spinner fa-spin"></i>
                ) : (
                    <i className="fa fa-arrow-up-right-from-square"></i>
                )}
            </span>
            <span className="absolute left-1 bottom-1 text-[11px] text-accent/70 opacity-0 group-hover:opacity-100 rounded px-1 py-0.5">
                <i className="fa fa-solid fa-tower-broadcast mr-1"></i>
                Stream
            </span>
        </button>
    );
});
AppTile.displayName = "AppTile";

function getCategory(app: InstalledAppInfo): string {
    return app.category || "Other";
}

function getFeaturedRank(app: InstalledAppInfo): number {
    const identity = `${app.name} ${app.bundleid ?? ""}`.toLowerCase();
    return featuredApps.findIndex((name) => identity.includes(name));
}

function getCommonAppIcon(app: InstalledAppInfo): string | null {
    const identity = `${app.name} ${app.bundleid ?? ""}`.toLowerCase();
    if (identity.includes("browseros")) {
        return "globe";
    }
    if (identity.includes("messages") || identity.includes("mobilesms")) {
        return "comment-dots";
    }
    if (identity.includes("preview")) {
        return "file-image";
    }
    if (identity.includes("iterm")) {
        return "terminal";
    }
    return null;
}
