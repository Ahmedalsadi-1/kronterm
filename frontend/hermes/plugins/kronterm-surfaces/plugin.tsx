/**
 * Live, least-privilege view of the real KronTerm blocks surrounding Hermes.
 * The embedding shim returns display-safe descriptors and accepts focus only;
 * this plugin never imports KronTerm internals or receives an ambient RPC door.
 */

import {
    cn,
    Codicon,
    type HermesPlugin,
    host,
    PALETTE_AREA,
    type PaletteContribution,
    PANES_AREA,
    STATUSBAR_AREAS,
    Tip,
    useQuery,
} from "@hermes/plugin-sdk";
import { useState } from "react";

const PaneId = "kronterm-surfaces:surfaces";
const SurfacesQueryKey = ["plugin:kronterm-surfaces", "surfaces"] as const;

const viewIcon = (view: string): string => {
    if (view === "term") return "terminal";
    if (view === "web") return "globe";
    if (view === "canvas") return "layout";
    if (view === "sandbox") return "server-environment";
    if (view === "preview") return "open-preview";
    if (view === "file") return "file";
    return "window";
};

export function AgentSurfaceMicroWindow() {
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState("");
    const { data: surfaces, refetch } = useQuery({
        queryFn: host.krontermSurfaces.list,
        queryKey: SurfacesQueryKey,
        refetchInterval: 1_200,
    });
    const surface = surfaces?.find((candidate) => candidate.active);
    const { data: fetchedPreview } = useQuery({
        enabled: Boolean(surface && expanded),
        queryFn: () => host.krontermSurfaces.preview(surface!.id),
        queryKey: [...SurfacesQueryKey, "preview", surface?.id ?? "none"],
        refetchInterval: expanded ? 1_500 : false,
        retry: false,
    });

    if (!surface) return null;

    const previewImageUrl = fetchedPreview || surface.previewImageUrl;
    const popOut = async () => {
        setError("");
        try {
            await host.krontermSurfaces.promote(surface.id);
            setExpanded(false);
            await refetch();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Unable to open that widget.");
        }
    };

    return (
        <section
            aria-label={`Agent is using ${surface.title}`}
            className="mb-1 overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg-secondary)/92 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            data-expanded={expanded ? "" : undefined}
        >
            <div className="flex min-h-11 items-center gap-2 p-1.5">
                {!expanded ? (
                    <button
                        aria-label={`Expand ${surface.title} inside chat`}
                        className="relative h-9 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-(--ui-border) bg-black/25"
                        onClick={() => setExpanded(true)}
                        type="button"
                    >
                        {surface.previewImageUrl ? (
                            <img alt="" className="h-full w-full object-cover" src={surface.previewImageUrl} />
                        ) : (
                            <span className="grid h-full place-items-center text-(--ui-text-secondary)">
                                <Codicon name={viewIcon(surface.view)} size="0.9rem" />
                            </span>
                        )}
                        <span className="absolute inset-0 ring-1 ring-inset ring-white/5" />
                    </button>
                ) : null}
                <button
                    className="min-w-0 flex-1 cursor-pointer px-1 text-left"
                    onClick={() => setExpanded((current) => !current)}
                    type="button"
                >
                    <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-(--ui-text-secondary)">
                        <span
                            className="size-1.5 animate-pulse rounded-full bg-(--ui-text-secondary)"
                            aria-hidden="true"
                        />
                        Agent surface
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-foreground">
                        {surface.detail || `Using ${surface.title}`}
                    </span>
                </button>
                <button
                    aria-label={expanded ? "Collapse agent widget" : "Expand agent widget inside chat"}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
                    onClick={() => setExpanded((current) => !current)}
                    type="button"
                >
                    <Codicon name={expanded ? "chevron-down" : "screen-full"} size="0.85rem" />
                </button>
                <button
                    aria-label={`Pop out ${surface.title}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
                    onClick={() => void popOut()}
                    type="button"
                >
                    <Codicon name="open-preview" size="0.85rem" />
                </button>
            </div>
            {expanded ? (
                <div className="border-t border-(--ui-border) p-1.5 pt-0">
                    <div className="relative min-h-64 w-full overflow-hidden rounded-lg border border-(--ui-border) bg-black/30">
                        {previewImageUrl ? (
                            <img
                                alt={`${surface.title} live preview`}
                                className="absolute inset-0 h-full w-full object-contain"
                                src={previewImageUrl}
                            />
                        ) : (
                            <div
                                className="grid h-full place-items-center text-xs text-(--ui-text-tertiary)"
                                role="status"
                            >
                                Fetching widget preview…
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-[0.625rem] text-white/75">
                            <span className="truncate">{surface.title}</span>
                            <span>{surface.view}</span>
                        </div>
                    </div>
                </div>
            ) : null}
            {error ? (
                <p className="border-t border-red-500/20 px-2.5 py-1.5 text-[0.625rem] text-red-400">{error}</p>
            ) : null}
        </section>
    );
}

function SurfacesPane() {
    const [focusing, setFocusing] = useState<null | string>(null);
    const [focusError, setFocusError] = useState("");
    const {
        data: surfaces,
        error,
        isLoading,
        refetch,
    } = useQuery({
        queryFn: host.krontermSurfaces.list,
        queryKey: SurfacesQueryKey,
        refetchInterval: 1_500,
    });

    const focus = async (blockId: string) => {
        setFocusing(blockId);
        setFocusError("");

        try {
            await host.krontermSurfaces.openSplit(blockId);
            await refetch();
        } catch (focusFailure) {
            setFocusError(focusFailure instanceof Error ? focusFailure.message : "Unable to focus that surface.");
        } finally {
            setFocusing(null);
        }
    };

    return (
        <section className="flex h-full min-h-0 flex-col bg-(--ui-bg)" aria-label="KronTerm surfaces">
            <div className="border-b border-(--ui-border) px-3 py-2">
                <p className="text-xs font-medium text-foreground">Workspace surfaces</p>
                <p className="mt-0.5 text-[0.6875rem] leading-4 text-(--ui-text-tertiary)">
                    Focus a live terminal, browser, canvas, or sandbox beside this chat.
                </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <p className="px-2 py-4 text-xs text-(--ui-text-tertiary)" role="status">
                        Finding open surfaces…
                    </p>
                ) : error ? (
                    <div className="rounded-md border border-(--ui-border) p-3 text-xs">
                        <p className="text-foreground">KronTerm controls are unavailable.</p>
                        <button
                            className="mt-2 cursor-pointer text-(--ui-text-secondary) hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2"
                            onClick={() => void refetch()}
                            type="button"
                        >
                            Try again
                        </button>
                    </div>
                ) : surfaces?.length ? (
                    <div className="space-y-1">
                        {surfaces.map((surface) => (
                            <button
                                aria-current={surface.focused ? "true" : undefined}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ui-text-secondary)",
                                    surface.focused
                                        ? "border-(--ui-border) bg-(--chrome-action-hover)"
                                        : "border-transparent hover:border-(--ui-border) hover:bg-(--chrome-action-hover)"
                                )}
                                disabled={focusing === surface.id}
                                key={surface.id}
                                onClick={() => void focus(surface.id)}
                                type="button"
                            >
                                <span className="grid size-7 shrink-0 place-items-center rounded bg-(--ui-bg-secondary) text-(--ui-text-secondary)">
                                    <Codicon name={viewIcon(surface.view)} size="0.875rem" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-foreground">
                                        {surface.title}
                                    </span>
                                    <span className="block truncate text-[0.625rem] text-(--ui-text-tertiary)">
                                        {surface.view} · {surface.id.slice(0, 8)}
                                    </span>
                                </span>
                                {surface.focused ? (
                                    <span className="text-[0.625rem] font-medium text-foreground">in split</span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="px-2 py-4 text-xs leading-5 text-(--ui-text-tertiary)">
                        No other surfaces are open in this workspace tab.
                    </p>
                )}

                {focusError ? (
                    <p
                        className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[0.6875rem] text-red-400"
                        role="alert"
                    >
                        {focusError}
                    </p>
                ) : null}
            </div>
        </section>
    );
}

function SurfacesStatus() {
    const { data: surfaces } = useQuery({
        queryFn: host.krontermSurfaces.list,
        queryKey: SurfacesQueryKey,
        refetchInterval: 3_000,
    });

    return (
        <Tip label="Open KronTerm workspace surfaces">
            <button
                className="inline-flex h-full cursor-pointer items-center gap-1 px-1.5 text-[0.6875rem] text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
                onClick={() => host.revealPane(PaneId)}
                type="button"
            >
                <Codicon name="multiple-windows" size="0.7rem" />
                <span>{surfaces?.length ?? 0}</span>
            </button>
        </Tip>
    );
}

const plugin: HermesPlugin = {
    id: "kronterm-surfaces",
    name: "KronTerm Surfaces",
    description: "Live micro-widget for focusing terminal, browser, canvas, sandbox, and other KronTerm blocks.",
    defaultEnabled: true,
    register(ctx) {
        ctx.registerMany([
            {
                id: "surfaces",
                area: PANES_AREA,
                title: "KronTerm",
                data: {
                    placement: "right",
                    collapsible: true,
                    width: "17rem",
                    minWidth: "13rem",
                    maxWidth: "24rem",
                },
                render: () => <SurfacesPane />,
            },
            {
                id: "status",
                area: STATUSBAR_AREAS.right,
                order: 65,
                render: () => <SurfacesStatus />,
            },
            {
                id: "open",
                area: PALETTE_AREA,
                data: {
                    id: "kronterm-surfaces.open",
                    label: "KronTerm: Open workspace surfaces",
                    keywords: ["kronterm", "terminal", "browser", "canvas", "sandbox", "widgets"],
                    run: () => host.revealPane(PaneId),
                } satisfies PaletteContribution,
            },
        ]);
    },
};

export default plugin;
