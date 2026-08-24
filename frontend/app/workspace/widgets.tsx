// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { AppStreamCreatedEvent } from "@/app/view/appstream/computer-use-stream-manager";
import {
    applyThemePreset,
    readStoredThemePresetId,
    THEME_PRESETS,
} from "@/app/view/kronsettings/kronsettings-theme-presets";
import { useWaveEnv, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import { updateFoldState, widgetFoldStateAtom } from "@/app/workspace/widget-fold-state";
import { shouldIncludeWidgetForWorkspace } from "@/app/workspace/widgetfilter";
import {
    publishWorkspaceAppearance,
    readWorkspaceAppearance,
    type WorkspaceAppearance,
} from "@/app/workspace/workspace-appearance";
import { modalsModel } from "@/store/modalmodel";
import { fireAndForget, isBlank, makeIconClass } from "@/util/util";
import {
    autoUpdate,
    FloatingPortal,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Boxes, ChevronRight, Settings, TriangleAlert, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./widgets.scss";

export type WidgetsEnv = WaveEnvSubset<{
    isDev: WaveEnv["isDev"];
    electron: object;
    rpc: {
        ListInstalledAppsCommand: WaveEnv["rpc"]["ListInstalledAppsCommand"];
    };
    atoms: {
        fullConfigAtom: WaveEnv["atoms"]["fullConfigAtom"];
        hasConfigErrors: WaveEnv["atoms"]["hasConfigErrors"];
        workspaceId: WaveEnv["atoms"]["workspaceId"];
    };
    createBlock: WaveEnv["createBlock"];
    showContextMenu: WaveEnv["showContextMenu"];
}>;

function sortByDisplayOrder(wmap: { [key: string]: WidgetConfigType }): WidgetConfigType[] {
    if (wmap == null) {
        return [];
    }
    const wlist = Object.values(wmap);
    wlist.sort((a, b) => {
        return (a["display:order"] ?? 0) - (b["display:order"] ?? 0);
    });
    return wlist;
}

type WidgetGroupKey = string;

const DefaultWidgetGroups: Record<string, { label: string; order: number }> = {
    terminal: { label: "Terminal", order: 0 },
    browser: { label: "Browser", order: 1 },
    ai: { label: "AI", order: 2 },
    sandbox: { label: "Sandbox", order: 3 },
    design: { label: "Design", order: 4 },
    apps: { label: "Apps", order: 5 },
    tools: { label: "Tools", order: 6 },
};

const WidgetGroupColors: Record<string, string> = {
    terminal: "#4ade80",
    browser: "#60a5fa",
    ai: "#e8c47c",
    sandbox: "#f472b6",
    design: "#38bdf8",
    apps: "#a78bfa",
    tools: "#94a3b8",
};

const CompactPrimaryWidgetViews = ["chathubv2", "term", "preview", "web", "appstream"];

function getCompactPrimaryWidgets(widgets: WidgetConfigType[]): WidgetConfigType[] {
    const selected = new Set<WidgetConfigType>();
    for (const view of CompactPrimaryWidgetViews) {
        const match = widgets.find((widget) => widget.blockdef?.meta?.view === view && !selected.has(widget));
        if (match) {
            selected.add(match);
        }
    }
    return Array.from(selected);
}

function widgetGroupKey(widget: WidgetConfigType): WidgetGroupKey {
    const group = widget["display:group"];
    if (group && DefaultWidgetGroups[group]) {
        return group;
    }
    const view = widget.blockdef?.meta?.view ?? "";
    if (view === "term" || view === "vdom") return "terminal";
    if (view === "web") return "browser";
    if (view === "sandbox") return "sandbox";
    if (view === "design") return "design";
    if (view === "waveai" || view === "kronoschat" || view === "chathubv2" || view === "waveconfig") return "ai";
    if (view === "tsunami") return "apps";
    return "tools";
}

function groupWidgets(widgets: WidgetConfigType[]): Map<WidgetGroupKey, WidgetConfigType[]> {
    const groups = new Map<WidgetGroupKey, WidgetConfigType[]>();
    for (const widget of widgets) {
        const key = widgetGroupKey(widget);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(widget);
    }
    return groups;
}

const AppRecentStorageKey = "kronoscode:app-launcher:recents";

function loadRecentApps(): string[] {
    try {
        const stored = window.localStorage.getItem(AppRecentStorageKey);
        if (stored) return JSON.parse(stored);
    } catch {}
    return [];
}

function saveRecentApps(ids: string[]): void {
    try {
        window.localStorage.setItem(AppRecentStorageKey, JSON.stringify(ids.slice(0, 12)));
    } catch {}
}

type WidgetPropsType = {
    widget: WidgetConfigType;
    mode: "normal" | "compact" | "supercompact";
    env: WidgetsEnv;
};

function isChatHubWidget(widget: WidgetConfigType): boolean {
    const view = widget.blockdef?.meta?.view;
    return view === "waveai" || view === "kronoschat" || view === "chathubv2";
}

function getWidgetLabel(widget: WidgetConfigType): string {
    if (isChatHubWidget(widget)) {
        return "Chamber V2";
    }
    return widget.label;
}

function getWidgetDescription(widget: WidgetConfigType): string {
    if (isChatHubWidget(widget)) {
        return "Open the canonical Kronos workspace";
    }
    return widget.description || widget.label;
}

async function handleWidgetSelect(widget: WidgetConfigType, env: WidgetsEnv) {
    // Redirect the old deprecated WaveAI/ACP chat widgets to ChatHub V2.
    if (isChatHubWidget(widget)) {
        env.createBlock({ meta: { view: "chathubv2" } }, widget.magnified);
        return;
    }
    const blockDef = widget.blockdef;
    env.createBlock(blockDef, widget.magnified);
}

const Widget = memo(({ widget, mode, env }: WidgetPropsType) => {
    const [isTruncated, setIsTruncated] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);
    const label = getWidgetLabel(widget);

    useEffect(() => {
        if (mode === "normal" && labelRef.current) {
            const element = labelRef.current;
            setIsTruncated(element.scrollWidth > element.clientWidth);
        }
    }, [mode, label]);

    const shouldDisableTooltip = mode !== "normal" ? false : !isTruncated;

    return (
        <Tooltip content={getWidgetDescription(widget)} placement="left" disable={shouldDisableTooltip}>
            <button
                type="button"
                className={clsx(
                    "widget-rail-item",
                    mode === "supercompact" ? "text-sm" : "text-lg",
                    widget["display:hidden"] && "hidden"
                )}
                onClick={() => handleWidgetSelect(widget, env)}
                aria-label={`Open ${label || "widget"}`}
            >
                <div style={{ color: widget.color }}>
                    <i className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })}></i>
                </div>
                {mode === "normal" && !isBlank(label) ? (
                    <div
                        ref={labelRef}
                        className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                        {label}
                    </div>
                ) : null}
            </button>
        </Tooltip>
    );
});

function calculateGridSize(appCount: number): number {
    if (appCount <= 4) return 2;
    if (appCount <= 9) return 3;
    if (appCount <= 16) return 4;
    if (appCount <= 25) return 5;
    return 6;
}

function SettingsTooltipContent({ hasConfigErrors }: { hasConfigErrors: boolean }) {
    if (!hasConfigErrors) {
        return "Settings & Help";
    }
    return (
        <div className="flex flex-col p-1">
            <div className="mb-1">Settings &amp; Help</div>
            <div className="flex items-center gap-1 mt-0.5 text-error">
                <i className="fa fa-solid fa-circle-exclamation"></i>
                <span>Config Errors</span>
            </div>
        </div>
    );
}

type FloatingWindowPropsType = {
    isOpen: boolean;
    onClose: () => void;
    referenceElement: HTMLElement;
    hasConfigErrors?: boolean;
    placement?: "left-start" | "right-start";
};

type LauncherAppInfo = {
    appid: string;
    manifest?: {
        appmeta?: {
            displayname?: string;
            icon?: string;
            iconcolor?: string;
        };
    };
};

const AppsFloatingWindow = memo(
    ({ isOpen, onClose, referenceElement, placement = "left-start" }: FloatingWindowPropsType) => {
        const [apps, setApps] = useState<LauncherAppInfo[]>([]);
        const [desktopApps, setDesktopApps] = useState<InstalledAppInfo[]>([]);
        const [loading, setLoading] = useState(true);
        const [query, setQuery] = useState("");
        const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentApps());
        const env = useWaveEnv<WidgetsEnv>();

        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement,
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);
        const handleOpenBuilder = useCallback(() => {
            (env.electron as { openBuilder?: (appId: string | null) => void }).openBuilder?.(null);
            onClose();
        }, [onClose, env]);

        const rememberRecent = useCallback((id: string) => {
            setRecentIds((prev) => {
                const next = [id, ...prev.filter((item) => item !== id)].slice(0, 12);
                saveRecentApps(next);
                return next;
            });
        }, []);

        useEffect(() => {
            if (!isOpen) return;

            const fetchApps = async () => {
                setLoading(true);
                try {
                    const rpc = env.rpc as WidgetsEnv["rpc"] & {
                        ListAllAppsCommand?: (client: typeof TabRpcClient) => Promise<LauncherAppInfo[]>;
                    };
                    const listWaveApps = rpc.ListAllAppsCommand;
                    const [waveAppsResult, desktopAppsResult] = await Promise.allSettled([
                        typeof listWaveApps === "function" ? listWaveApps(TabRpcClient) : Promise.resolve([]),
                        env.rpc.ListInstalledAppsCommand(TabRpcClient),
                    ]);
                    const allApps = waveAppsResult.status === "fulfilled" ? waveAppsResult.value : [];
                    const installedApps = desktopAppsResult.status === "fulfilled" ? desktopAppsResult.value : [];
                    const localApps = allApps
                        .filter((app) => !app.appid.startsWith("draft/"))
                        .sort((a, b) => {
                            const aName = a.appid.replace(/^local\//, "");
                            const bName = b.appid.replace(/^local\//, "");
                            return aName.localeCompare(bName);
                        });
                    setApps(localApps);
                    setDesktopApps(installedApps.sort((a, b) => a.name.localeCompare(b.name)));
                    if (waveAppsResult.status === "rejected") {
                        console.error("Failed to fetch WaveApps:", waveAppsResult.reason);
                    }
                    if (desktopAppsResult.status === "rejected") {
                        console.error("Failed to fetch desktop apps:", desktopAppsResult.reason);
                    }
                } catch (error) {
                    console.error("Failed to fetch apps:", error);
                    setApps([]);
                    setDesktopApps([]);
                } finally {
                    setLoading(false);
                }
            };

            fetchApps();
        }, [isOpen]);

        if (!isOpen) return null;

        const normalizedQuery = query.trim().toLowerCase();
        const filteredDesktopApps = normalizedQuery
            ? desktopApps.filter((app) =>
                  `${app.name} ${app.appid} ${app.bundleid ?? ""}`.toLowerCase().includes(normalizedQuery)
              )
            : desktopApps;
        const filteredApps = normalizedQuery
            ? apps.filter((app) =>
                  `${app.appid} ${app.manifest?.appmeta?.displayname ?? ""}`.toLowerCase().includes(normalizedQuery)
              )
            : apps;
        const allLaunchables = [
            ...desktopApps.map((app) => ({
                kind: "desktop" as const,
                id: `desktop:${app.appid}`,
                label: app.name,
                app,
            })),
            ...apps.map((app) => ({
                kind: "wave" as const,
                id: `wave:${app.appid}`,
                label: app.appid.replace(/^local\//, ""),
                app,
            })),
        ];
        const recentLaunchables = recentIds
            .map((id) => allLaunchables.find((item) => item.id === id))
            .filter(Boolean)
            .slice(0, 8);
        const gridSize = calculateGridSize(
            Math.max(filteredApps.length, filteredDesktopApps.length, recentLaunchables.length)
        );

        const renderIcon = (icon: string | undefined, fallback: string, color?: string) => {
            if (icon?.startsWith("data:") || icon?.startsWith("file:") || icon?.startsWith("http")) {
                return (
                    <img
                        src={icon}
                        alt=""
                        className="h-8 w-8 rounded-lg object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                );
            }
            return <i className={makeIconClass(icon || fallback, false)} style={{ color }}></i>;
        };

        const launchDesktopApp = (app: InstalledAppInfo) => {
            const blockDef: BlockDef = {
                meta: {
                    view: "appstream",
                    "appstream:appid": app.bundleid || app.appid,
                    "appstream:appname": app.name,
                } as unknown as MetaType,
            };
            Promise.resolve(env.createBlock(blockDef)).then((blockId) => {
                if (blockId) {
                    window.dispatchEvent(
                        new CustomEvent(AppStreamCreatedEvent, { detail: { appName: app.name, blockId } })
                    );
                }
            });
            rememberRecent(`desktop:${app.appid}`);
            onClose();
        };

        const launchWaveApp = (app: LauncherAppInfo) => {
            const blockDef: BlockDef = {
                meta: {
                    view: "tsunami",
                    controller: "tsunami",
                    "tsunami:appid": app.appid,
                },
            };
            env.createBlock(blockDef);
            rememberRecent(`wave:${app.appid}`);
            onClose();
        };

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="bg-modalbg border border-border rounded-xl shadow-xl z-50 overflow-hidden min-w-[360px]"
                >
                    <div className="border-b border-border/70 p-3">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-black/20 px-3 py-2">
                            <i className="fa-solid fa-magnifying-glass text-muted text-xs" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search apps, desktop streams, tools..."
                                className="min-w-0 flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none"
                            />
                        </div>
                    </div>
                    <div className="p-4">
                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <i className="fa fa-solid fa-spinner fa-spin text-2xl text-muted"></i>
                            </div>
                        ) : apps.length === 0 && desktopApps.length === 0 ? (
                            <div className="text-muted text-sm p-4 text-center">No desktop apps found</div>
                        ) : filteredApps.length === 0 && filteredDesktopApps.length === 0 ? (
                            <div className="text-muted text-sm p-4 text-center">No apps match “{query}”</div>
                        ) : (
                            <div className="max-h-[65vh] overflow-y-auto">
                                {!normalizedQuery && recentLaunchables.length > 0 ? (
                                    <>
                                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Recent
                                        </div>
                                        <div
                                            className="grid gap-3 mb-4"
                                            style={{
                                                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                                                maxWidth: `${gridSize * 88}px`,
                                            }}
                                        >
                                            {recentLaunchables.map((item) => {
                                                if (!item) return null;
                                                const app = item.app as any;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={item.id}
                                                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-transparent hover:border-border hover:bg-hoverbg cursor-pointer transition-colors"
                                                        title={item.label}
                                                        onClick={() =>
                                                            item.kind === "desktop"
                                                                ? launchDesktopApp(item.app as InstalledAppInfo)
                                                                : launchWaveApp(item.app as LauncherAppInfo)
                                                        }
                                                    >
                                                        <div className="text-3xl mb-1 text-accent">
                                                            {renderIcon(
                                                                app.icon || app.manifest?.appmeta?.icon,
                                                                "cube",
                                                                app.manifest?.appmeta?.iconcolor
                                                            )}
                                                        </div>
                                                        <div className="text-xxs text-center text-secondary break-words w-full px-1">
                                                            {item.label}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : null}
                                {filteredDesktopApps.length > 0 ? (
                                    <>
                                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Desktop Apps
                                        </div>
                                        <div
                                            className="grid gap-3"
                                            style={{
                                                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                                                maxWidth: `${gridSize * 88}px`,
                                            }}
                                        >
                                            {filteredDesktopApps.map((app) => (
                                                <button
                                                    type="button"
                                                    key={app.appid}
                                                    className="flex flex-col items-center justify-center p-2 rounded-lg border border-transparent hover:border-border hover:bg-hoverbg cursor-pointer transition-colors"
                                                    title={`Stream ${app.name} in KronTerm`}
                                                    onClick={() => launchDesktopApp(app)}
                                                >
                                                    <div className="text-3xl mb-1 text-accent">
                                                        {renderIcon(app.icon, "cube")}
                                                    </div>
                                                    <div className="text-xxs text-center text-secondary break-words w-full px-1">
                                                        {app.name}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                                {filteredApps.length > 0 ? (
                                    <>
                                        <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            WaveApps
                                        </div>
                                        <div
                                            className="grid gap-3"
                                            style={{
                                                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                                                maxWidth: `${gridSize * 88}px`,
                                            }}
                                        >
                                            {filteredApps.map((app) => {
                                                const appMeta = app.manifest?.appmeta;
                                                const displayName = app.appid.replace(/^local\//, "");
                                                const icon = appMeta?.icon || "cube";
                                                const iconColor = appMeta?.iconcolor || "white";

                                                return (
                                                    <div
                                                        key={app.appid}
                                                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-transparent hover:border-border hover:bg-hoverbg cursor-pointer transition-colors"
                                                        onClick={() => launchWaveApp(app)}
                                                    >
                                                        <div style={{ color: iconColor }} className="text-3xl mb-1">
                                                            {renderIcon(icon, "cube", iconColor)}
                                                        </div>
                                                        <div className="text-xxs text-center text-secondary break-words w-full px-1">
                                                            {displayName}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="w-full px-4 py-2 border-t border-border text-xs text-secondary text-center hover:bg-hoverbg hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
                        onClick={handleOpenBuilder}
                    >
                        <i className="fa fa-solid fa-hammer"></i>
                        Build/Edit Apps
                    </button>
                </div>
            </FloatingPortal>
        );
    }
);

const SettingsFloatingWindow = memo(
    ({ isOpen, onClose, referenceElement, hasConfigErrors, placement = "left-start" }: FloatingWindowPropsType) => {
        const env = useWaveEnv<WidgetsEnv>();
        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement,
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);

        if (!isOpen) return null;

        const menuItems = [
            {
                icon: "gear",
                label: "Settings",
                hasError: hasConfigErrors,
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "kronsettings",
                        },
                    };
                    env.createBlock(blockDef, false, true);
                    onClose();
                },
            },
            {
                icon: "lightbulb",
                label: "Tips",
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "tips",
                        },
                    };
                    env.createBlock(blockDef, true, true);
                    onClose();
                },
            },
            {
                icon: "lock",
                label: "Secrets",
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "waveconfig",
                            file: "secrets",
                        },
                    };
                    env.createBlock(blockDef, false, true);
                    onClose();
                },
            },
            {
                icon: "book-open",
                label: "Release Notes",
                onClick: () => {
                    modalsModel.pushModal("UpgradeOnboardingPatch", { isReleaseNotes: true });
                    onClose();
                },
            },
            {
                icon: "circle-question",
                label: "Help",
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "help",
                        },
                    };
                    env.createBlock(blockDef);
                    onClose();
                },
            },
        ];

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="bg-modalbg border border-border rounded-lg shadow-xl p-2 z-50"
                >
                    {menuItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-hoverbg cursor-pointer transition-colors text-secondary hover:text-white"
                            onClick={item.onClick}
                        >
                            <div className="text-lg w-5 flex justify-center">
                                <i className={makeIconClass(item.icon, false)}></i>
                            </div>
                            <div className="text-sm whitespace-nowrap">{item.label}</div>
                            {item.hasError && (
                                <i className="fa fa-solid fa-circle-exclamation text-error text-[14px] ml-auto"></i>
                            )}
                        </div>
                    ))}
                </div>
            </FloatingPortal>
        );
    }
);

SettingsFloatingWindow.displayName = "SettingsFloatingWindow";

const WidgetGroupHeader = memo(
    ({
        groupKey,
        count,
        isFolded,
        onToggleFold,
        mode,
    }: {
        groupKey: string;
        count: number;
        isFolded: boolean;
        onToggleFold: () => void;
        mode: "normal" | "compact" | "supercompact";
    }) => {
        const groupInfo = DefaultWidgetGroups[groupKey] ?? { label: groupKey, order: 99 };
        const color = WidgetGroupColors[groupKey] ?? "#94a3b8";

        if (mode === "supercompact") {
            return (
                <div className="flex items-center justify-center w-full py-0.5 cursor-pointer" onClick={onToggleFold}>
                    <div
                        className="w-3 h-1 rounded-full opacity-60"
                        style={{ backgroundColor: color }}
                        title={`${groupInfo.label}${isFolded ? ` (${count})` : ""}`}
                    />
                </div>
            );
        }

        return (
            <div
                className="flex items-center w-full px-1 py-0.5 cursor-pointer group hover:bg-hoverbg/30 rounded-sm transition-colors"
                onClick={onToggleFold}
            >
                <div className="flex items-center gap-1 min-w-0 flex-1">
                    <ChevronRight
                        className={clsx("w-2.5 h-2.5 transition-transform duration-200", !isFolded && "rotate-90")}
                        style={{ color }}
                    />
                    {mode === "normal" && (
                        <span
                            className="text-[9px] uppercase tracking-wider font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ color: `${color}cc` }}
                        >
                            {groupInfo.label}
                        </span>
                    )}
                    {isFolded && <span className="text-[9px] text-muted ml-0.5">{count}</span>}
                </div>
            </div>
        );
    }
);
WidgetGroupHeader.displayName = "WidgetGroupHeader";

const WidgetGroupSection = memo(
    ({
        groupKey,
        widgets,
        isFolded,
        mode,
        env,
        onToggleFold,
    }: {
        groupKey: string;
        widgets: WidgetConfigType[];
        isFolded: boolean;
        mode: "normal" | "compact" | "supercompact";
        env: WidgetsEnv;
        onToggleFold: () => void;
    }) => {
        // When folded, render nothing — the group completely disappears from the
        // sidebar and reclaims all vertical space. Unfold via FoldedWidgetsBar pill.
        if (isFolded) return null;
        return (
            <div className="widget-group-section">
                <WidgetGroupHeader
                    groupKey={groupKey}
                    count={widgets.length}
                    isFolded={isFolded}
                    onToggleFold={onToggleFold}
                    mode={mode}
                />
                <div className="widget-group-items overflow-hidden transition-all duration-200 max-h-[2000px] opacity-100">
                    {mode === "supercompact" ? (
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {widgets.map((data, idx) => (
                                <Widget key={`widget-${groupKey}-${idx}`} widget={data} mode={mode} env={env} />
                            ))}
                        </div>
                    ) : (
                        widgets.map((data, idx) => (
                            <Widget key={`widget-${groupKey}-${idx}`} widget={data} mode={mode} env={env} />
                        ))
                    )}
                </div>
            </div>
        );
    }
);
WidgetGroupSection.displayName = "WidgetGroupSection";

type WidgetsProps = {
    position?: "left" | "right";
    compact?: boolean;
    catalog?: boolean;
    onDismiss?: () => void;
    showCompactAddButton?: boolean;
    compactTrailingAction?: React.ReactNode;
};

const Widgets = memo((props: WidgetsProps) => {
    const {
        position = "right",
        compact = false,
        catalog = false,
        onDismiss,
        showCompactAddButton = true,
        compactTrailingAction,
    } = props;
    const env = useWaveEnv<WidgetsEnv>();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const hasConfigErrors = useAtomValue(env.atoms.hasConfigErrors);
    const workspaceId = useAtomValue(env.atoms.workspaceId);
    const [mode, setMode] = useState<"normal" | "compact" | "supercompact">("normal");
    const [foldState, setFoldState] = useAtom(widgetFoldStateAtom);
    const containerRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement>(null);

    const featureWaveAppBuilder = fullConfig?.settings?.["feature:waveappbuilder"] ?? false;
    const widgetsMap = fullConfig?.widgets ?? {};
    const filteredWidgets = Object.fromEntries(
        Object.entries(widgetsMap).filter(([_key, widget]) => {
            return shouldIncludeWidgetForWorkspace(widget, workspaceId);
        })
    );
    const widgets = sortByDisplayOrder(filteredWidgets);

    const [isAppsOpen, setIsAppsOpen] = useState(false);
    const appsButtonRef = useRef<HTMLButtonElement>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);
    const [compactMenuOpen, setCompactMenuOpen] = useState(false);
    const [catalogQuery, setCatalogQuery] = useState("");
    const [appearancePanel, setAppearancePanel] = useState<"icons" | "spacing" | "theme" | "typography">();
    const [appearance, setAppearance] = useState<WorkspaceAppearance>(readWorkspaceAppearance);
    const [themePresetId, setThemePresetId] = useState(readStoredThemePresetId);

    const checkModeNeeded = useCallback(() => {
        if (!containerRef.current || !measurementRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const normalHeight = measurementRef.current.scrollHeight;
        const gracePeriod = 10;

        let newMode: "normal" | "compact" | "supercompact" = "normal";

        if (normalHeight > containerHeight - gracePeriod) {
            newMode = "compact";

            // Calculate total widget count for supercompact check
            const totalWidgets = (widgets?.length || 0) + 1;
            const minHeightPerWidget = 32;
            const requiredHeight = totalWidgets * minHeightPerWidget;

            if (requiredHeight > containerHeight) {
                newMode = "supercompact";
            }
        }

        if (newMode !== mode) {
            setMode(newMode);
        }
    }, [mode, widgets]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            checkModeNeeded();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [checkModeNeeded]);

    useEffect(() => {
        checkModeNeeded();
    }, [widgets, checkModeNeeded]);

    const handleWidgetsBarContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu: ContextMenuItem[] = [
            {
                label: "Edit widgets.json",
                click: () => {
                    fireAndForget(async () => {
                        const blockDef: BlockDef = {
                            meta: {
                                view: "waveconfig",
                                file: "widgets.json",
                            },
                        };
                        await env.createBlock(blockDef, false, true);
                    });
                },
            },
            {
                label: "Expand All Groups",
                click: () => {
                    setFoldState(updateFoldState(foldState, () => ({})));
                },
            },
            {
                label: "Collapse All Groups",
                click: () => {
                    const grouped = groupWidgets(widgets);
                    const keys = Array.from(grouped.keys());
                    setFoldState(
                        updateFoldState(foldState, () => {
                            const collapsed: Record<string, boolean> = {};
                            for (const key of keys) {
                                collapsed[key] = true;
                            }
                            return collapsed;
                        })
                    );
                },
            },
        ];
        env.showContextMenu(menu, e);
    };

    const toggleGroupFold = useCallback(
        (groupKey: string) => {
            setFoldState(updateFoldState(foldState, (prev) => ({ ...prev, [groupKey]: !prev[groupKey] })));
        },
        [foldState]
    );

    const normalizedCatalogQuery = catalogQuery.trim().toLowerCase();
    const catalogWidgets = normalizedCatalogQuery
        ? widgets.filter((widget) => {
              const group = widget["display:group"] ?? "tools";
              return `${getWidgetLabel(widget)} ${getWidgetDescription(widget)} ${group}`
                  .toLowerCase()
                  .includes(normalizedCatalogQuery);
          })
        : widgets;
    const groupedWidgets = groupWidgets(catalog ? catalogWidgets : widgets);
    const sortedGroupKeys = Array.from(groupedWidgets.keys()).sort((a, b) => {
        const aOrder = DefaultWidgetGroups[a]?.order ?? 99;
        const bOrder = DefaultWidgetGroups[b]?.order ?? 99;
        return aOrder - bOrder;
    });

    if (catalog) {
        const openAppearanceSettings = (section: "theme" | "visual") => {
            void env.createBlock({
                meta: {
                    view: "kronsettings",
                    "kronsettings:section": section,
                } as MetaType,
            });
            onDismiss?.();
        };
        const updateAppearance = (next: Partial<WorkspaceAppearance>) => {
            const updated = { ...appearance, ...next };
            setAppearance(updated);
            publishWorkspaceAppearance(updated);
        };
        return (
            <section className="widget-catalog" aria-label="Widget catalog">
                <header className="widget-catalog-header">
                    <div>
                        <div className="widget-catalog-kicker">Launcher</div>
                        <h2>All widgets</h2>
                    </div>
                    <div className="widget-catalog-header-actions">
                        <span>{widgets.length}</span>
                        {onDismiss && (
                            <button type="button" onClick={onDismiss} aria-label="Close widget catalog">
                                <X aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </header>
                <div className="widget-catalog-tools">
                    <label className="widget-catalog-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                        <input
                            value={catalogQuery}
                            onChange={(event) => setCatalogQuery(event.target.value)}
                            placeholder="Search widgets"
                            aria-label="Search widgets"
                            autoFocus
                        />
                    </label>
                    <div className="widget-catalog-style" aria-label="Writing and appearance settings">
                        <button
                            type="button"
                            className={appearancePanel === "theme" ? "is-active" : ""}
                            onClick={() => setAppearancePanel((panel) => (panel === "theme" ? undefined : "theme"))}
                        >
                            <i className="fa-solid fa-swatchbook" aria-hidden="true" />
                            Theme
                        </button>
                        <button
                            type="button"
                            className={appearancePanel === "typography" ? "is-active" : ""}
                            onClick={() =>
                                setAppearancePanel((panel) => (panel === "typography" ? undefined : "typography"))
                            }
                        >
                            <i className="fa-solid fa-font" aria-hidden="true" />
                            Typography
                        </button>
                        <button
                            type="button"
                            className={appearancePanel === "spacing" ? "is-active" : ""}
                            onClick={() => setAppearancePanel((panel) => (panel === "spacing" ? undefined : "spacing"))}
                        >
                            <i className="fa-solid fa-arrows-left-right-to-line" aria-hidden="true" />
                            Spacing
                        </button>
                        <button
                            type="button"
                            className={appearancePanel === "icons" ? "is-active" : ""}
                            onClick={() => setAppearancePanel((panel) => (panel === "icons" ? undefined : "icons"))}
                        >
                            <i className="fa-solid fa-icons" aria-hidden="true" />
                            Icons
                        </button>
                    </div>
                    {appearancePanel && (
                        <div className="widget-catalog-appearance-panel">
                            {appearancePanel === "theme" &&
                                THEME_PRESETS.slice(0, 8).map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        className={themePresetId === preset.id ? "is-selected" : ""}
                                        onClick={() => {
                                            applyThemePreset(preset.id);
                                            setThemePresetId(preset.id);
                                        }}
                                    >
                                        <span
                                            style={{ background: preset.colors["--accent-color"] }}
                                            aria-hidden="true"
                                        />
                                        {preset.label}
                                    </button>
                                ))}
                            {appearancePanel === "typography" &&
                                (
                                    [
                                        ["hermes", "Hermes Mono"],
                                        ["mono", "Compact Mono"],
                                        ["system", "System Sans"],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={appearance.font === value ? "is-selected" : ""}
                                        onClick={() => updateAppearance({ font: value })}
                                    >
                                        {label}
                                    </button>
                                ))}
                            {appearancePanel === "spacing" &&
                                (
                                    [
                                        ["comfortable", "Comfortable"],
                                        ["compact", "Compact"],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={appearance.density === value ? "is-selected" : ""}
                                        onClick={() => updateAppearance({ density: value })}
                                    >
                                        {label}
                                    </button>
                                ))}
                            {appearancePanel === "icons" &&
                                (
                                    [
                                        ["soft", "Soft Tiles"],
                                        ["minimal", "Minimal"],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={appearance.icons === value ? "is-selected" : ""}
                                        onClick={() => updateAppearance({ icons: value })}
                                    >
                                        {label}
                                    </button>
                                ))}
                            <button
                                type="button"
                                className="widget-catalog-all-settings"
                                onClick={() => openAppearanceSettings(appearancePanel === "theme" ? "theme" : "visual")}
                            >
                                All settings
                            </button>
                        </div>
                    )}
                </div>
                <div className="widget-catalog-scroll">
                    {sortedGroupKeys.length === 0 && <p className="widget-catalog-empty">No matching widget</p>}
                    {sortedGroupKeys.map((groupKey) => {
                        const groupWidgetsList = groupedWidgets.get(groupKey) ?? [];
                        const group = DefaultWidgetGroups[groupKey] ?? { label: groupKey, order: 99 };
                        return (
                            <section className="widget-catalog-group" key={groupKey}>
                                <h3>{group.label}</h3>
                                <div className="widget-catalog-grid">
                                    {groupWidgetsList.map((widget, index) => {
                                        const label = getWidgetLabel(widget);
                                        return (
                                            <button
                                                type="button"
                                                className="widget-catalog-item"
                                                key={`${groupKey}-${index}`}
                                                onClick={() => {
                                                    void handleWidgetSelect(widget, env);
                                                    onDismiss?.();
                                                }}
                                                aria-label={`Open ${label || "widget"}`}
                                            >
                                                <span
                                                    className="widget-catalog-item-icon"
                                                    style={{ color: widget.color }}
                                                >
                                                    <i
                                                        className={makeIconClass(widget.icon, true, {
                                                            defaultIcon: "browser",
                                                        })}
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="widget-catalog-item-copy">
                                                    <strong>{label}</strong>
                                                    <small>{getWidgetDescription(widget)}</small>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </section>
        );
    }

    if (compact) {
        const primaryWidgets = getCompactPrimaryWidgets(widgets);
        const primaryWidgetSet = new Set(primaryWidgets);
        const overflowWidgets = widgets.filter((widget) => !primaryWidgetSet.has(widget));
        return (
            <>
                <div ref={containerRef} className="widget-rail-compact" onContextMenu={handleWidgetsBarContextMenu}>
                    <div className="widget-rail-compact-grid">
                        {primaryWidgets.map((widget, idx) => {
                            const chamber = isChatHubWidget(widget);
                            const label = chamber ? "Chamber V2" : getWidgetLabel(widget);
                            return (
                                <Tooltip
                                    key={`compact-widget-${idx}`}
                                    content={widget.description || label}
                                    placement="right"
                                    disable={false}
                                >
                                    <button
                                        type="button"
                                        className={clsx("widget-rail-compact-item", chamber && "is-chamber")}
                                        onClick={() => handleWidgetSelect(widget, env)}
                                        aria-label={`Open ${label || "widget"}`}
                                    >
                                        <div style={{ color: widget.color }} className="text-sm">
                                            <i
                                                className={makeIconClass(widget.icon, true, {
                                                    defaultIcon: "browser",
                                                })}
                                            ></i>
                                        </div>
                                        {chamber && <span>Chamber V2</span>}
                                    </button>
                                </Tooltip>
                            );
                        })}
                        {showCompactAddButton ? (
                            <>
                                <span className="widget-rail-compact-divider" aria-hidden="true" />
                                <button
                                    type="button"
                                    className={clsx(
                                        "widget-rail-compact-item",
                                        "is-add",
                                        compactMenuOpen && "is-active"
                                    )}
                                    onClick={() => setCompactMenuOpen((open) => !open)}
                                    aria-label="Show more widgets"
                                    aria-expanded={compactMenuOpen}
                                >
                                    <i className="fa-solid fa-plus" aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="widget-rail-compact-divider" aria-hidden="true" />
                                {compactTrailingAction}
                                {(env.isDev() || featureWaveAppBuilder) && (
                                    <Tooltip content="Local WaveApps" placement="right" disable={isAppsOpen}>
                                        <button
                                            type="button"
                                            ref={appsButtonRef}
                                            className="widget-rail-compact-item"
                                            onClick={() => setIsAppsOpen(!isAppsOpen)}
                                            aria-label="Local WaveApps"
                                        >
                                            <Boxes className="widget-rail-compact-icon" />
                                        </button>
                                    </Tooltip>
                                )}
                                <Tooltip
                                    content={<SettingsTooltipContent hasConfigErrors={hasConfigErrors} />}
                                    placement="right"
                                    disable={isSettingsOpen}
                                >
                                    <button
                                        type="button"
                                        ref={settingsButtonRef}
                                        className="widget-rail-compact-item"
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        aria-label="Settings and help"
                                    >
                                        <span className="relative">
                                            <Settings className="widget-rail-compact-icon" />
                                            {hasConfigErrors && <TriangleAlert className="widget-rail-error-icon" />}
                                        </span>
                                    </button>
                                </Tooltip>
                            </>
                        )}
                    </div>
                    {compactMenuOpen && (
                        <div className="widget-rail-compact-menu" role="menu" aria-label="More widgets">
                            <div className="widget-rail-compact-menu-heading">More widgets</div>
                            <div className="widget-rail-compact-menu-grid">
                                {overflowWidgets.map((widget, idx) => (
                                    <button
                                        type="button"
                                        key={`compact-overflow-${idx}`}
                                        className="widget-rail-compact-menu-item"
                                        onClick={() => {
                                            void handleWidgetSelect(widget, env);
                                            setCompactMenuOpen(false);
                                        }}
                                        role="menuitem"
                                        title={getWidgetDescription(widget)}
                                    >
                                        <i
                                            className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })}
                                            style={{ color: widget.color }}
                                        />
                                        <span>{getWidgetLabel(widget)}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="widget-rail-compact-menu-system">
                                {(env.isDev() || featureWaveAppBuilder) && (
                                    <button
                                        type="button"
                                        ref={appsButtonRef}
                                        className="widget-rail-compact-menu-item"
                                        onClick={() => setIsAppsOpen(!isAppsOpen)}
                                        role="menuitem"
                                    >
                                        <Boxes className="widget-rail-compact-icon" />
                                        <span>Local apps</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    ref={settingsButtonRef}
                                    className="widget-rail-compact-menu-item"
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    role="menuitem"
                                >
                                    <span className="relative">
                                        <Settings className="widget-rail-compact-icon" />
                                        {hasConfigErrors && <TriangleAlert className="widget-rail-error-icon" />}
                                    </span>
                                    <span>Settings</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {(env.isDev() || featureWaveAppBuilder) && appsButtonRef.current && (
                    <AppsFloatingWindow
                        isOpen={isAppsOpen}
                        onClose={() => setIsAppsOpen(false)}
                        referenceElement={appsButtonRef.current}
                        placement="right-start"
                    />
                )}
                {settingsButtonRef.current && (
                    <SettingsFloatingWindow
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        referenceElement={settingsButtonRef.current}
                        hasConfigErrors={hasConfigErrors}
                        placement="right-start"
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div
                ref={containerRef}
                className={clsx(
                    "widget-rail flex flex-col overflow-hidden py-1 select-none shrink-0",
                    position === "left" ? "widget-rail-left -mr-1" : "widget-rail-right -ml-1"
                )}
                onContextMenu={handleWidgetsBarContextMenu}
            >
                {mode === "normal" && <div className="widget-rail-heading">Launch</div>}
                {mode === "supercompact" ? (
                    <>
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {sortedGroupKeys.map((groupKey) => {
                                const groupWidgetsList = groupedWidgets.get(groupKey) ?? [];
                                const isFolded = !!foldState[groupKey];
                                return (
                                    <WidgetGroupSection
                                        key={groupKey}
                                        groupKey={groupKey}
                                        widgets={groupWidgetsList}
                                        isFolded={isFolded}
                                        mode={mode}
                                        env={env}
                                        onToggleFold={() => toggleGroupFold(groupKey)}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex-grow" />
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {env.isDev() || featureWaveAppBuilder ? (
                                <button
                                    type="button"
                                    ref={appsButtonRef}
                                    className="widget-rail-action text-sm"
                                    onClick={() => setIsAppsOpen(!isAppsOpen)}
                                    aria-label="Local WaveApps"
                                >
                                    <Tooltip content="Local WaveApps" placement="left" disable={isAppsOpen}>
                                        <Boxes className="widget-rail-system-icon" />
                                    </Tooltip>
                                </button>
                            ) : null}
                            <button
                                type="button"
                                ref={settingsButtonRef}
                                className="widget-rail-action text-sm"
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                aria-label="Settings and help"
                            >
                                <Tooltip
                                    content={<SettingsTooltipContent hasConfigErrors={hasConfigErrors} />}
                                    placement="left"
                                    disable={isSettingsOpen}
                                >
                                    <div className="relative">
                                        <Settings className="widget-rail-system-icon" />
                                        {hasConfigErrors && <TriangleAlert className="widget-rail-error-icon" />}
                                    </div>
                                </Tooltip>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {sortedGroupKeys.map((groupKey) => {
                            const groupWidgetsList = groupedWidgets.get(groupKey) ?? [];
                            const isFolded = !!foldState[groupKey];
                            return (
                                <WidgetGroupSection
                                    key={groupKey}
                                    groupKey={groupKey}
                                    widgets={groupWidgetsList}
                                    isFolded={isFolded}
                                    mode={mode}
                                    env={env}
                                    onToggleFold={() => toggleGroupFold(groupKey)}
                                />
                            );
                        })}
                        <div className="flex-grow" />
                        {env.isDev() || featureWaveAppBuilder ? (
                            <button
                                type="button"
                                ref={appsButtonRef}
                                className="widget-rail-action flex-col text-lg"
                                onClick={() => setIsAppsOpen(!isAppsOpen)}
                                aria-label="Local WaveApps"
                            >
                                <Tooltip content="Local WaveApps" placement="left" disable={isAppsOpen}>
                                    <div className="flex flex-col items-center w-full">
                                        <Boxes className="widget-rail-system-icon" />
                                        {mode === "normal" && (
                                            <div className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                                apps
                                            </div>
                                        )}
                                    </div>
                                </Tooltip>
                            </button>
                        ) : null}
                        <button
                            type="button"
                            ref={settingsButtonRef}
                            className="widget-rail-action flex-col text-lg"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            aria-label="Settings and help"
                        >
                            <Tooltip
                                content={<SettingsTooltipContent hasConfigErrors={hasConfigErrors} />}
                                placement="left"
                                disable={isSettingsOpen}
                            >
                                <div className="flex flex-col items-center w-full">
                                    <div className="relative">
                                        <Settings className="widget-rail-system-icon" />
                                        {hasConfigErrors && <TriangleAlert className="widget-rail-error-icon" />}
                                    </div>
                                    {mode === "normal" && (
                                        <div className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                            settings
                                        </div>
                                    )}
                                </div>
                            </Tooltip>
                        </button>
                    </>
                )}
                {env.isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running Wave Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>
            {(env.isDev() || featureWaveAppBuilder) && appsButtonRef.current && (
                <AppsFloatingWindow
                    isOpen={isAppsOpen}
                    onClose={() => setIsAppsOpen(false)}
                    referenceElement={appsButtonRef.current}
                />
            )}
            {settingsButtonRef.current && (
                <SettingsFloatingWindow
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    referenceElement={settingsButtonRef.current}
                    hasConfigErrors={hasConfigErrors}
                />
            )}

            <div
                ref={measurementRef}
                className={clsx(
                    "flex flex-col w-12 py-1 select-none absolute -z-10 opacity-0 pointer-events-none",
                    position === "left" ? "widget-rail-left -mr-1" : "widget-rail-right -ml-1"
                )}
            >
                {widgets?.map((data, idx) => (
                    <Widget key={`measurement-widget-${idx}`} widget={data} mode="normal" env={env} />
                ))}
                <div className="flex-grow" />
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <div>
                        <i className={makeIconClass("gear", true)}></i>
                    </div>
                    <div className="text-xxs mt-0.5 w-full px-0.5 text-center">settings</div>
                </div>
                {env.isDev() ? (
                    <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                        <div>
                            <i className={makeIconClass("cube", true)}></i>
                        </div>
                        <div className="text-xxs mt-0.5 w-full px-0.5 text-center">apps</div>
                    </div>
                ) : null}
                {env.isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running Wave Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>
        </>
    );
});

export { Widgets };
