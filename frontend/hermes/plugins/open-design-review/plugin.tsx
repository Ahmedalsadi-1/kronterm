import {
    atom,
    cn,
    Codicon,
    COMPOSER_AREAS,
    type ComposerMiddleware,
    type HermesPlugin,
    host,
    type KronTermInspectableElement,
    PALETTE_AREA,
    type PaletteContribution,
    PANES_AREA,
    STATUSBAR_AREAS,
    Tip,
    useQuery,
    useValue,
} from "@hermes/plugin-sdk";
import { useEffect, useMemo, useState } from "react";

import { activeSurfaceUrl, type DesignReviewComment, formatReviewComments } from "./model";

const PaneId = "open-design-review:inspector";
const SurfacesQueryKey = ["plugin:open-design-review", "surfaces"] as const;
const $comments = atom<DesignReviewComment[]>([]);
let persistComments = (_comments: DesignReviewComment[]) => undefined;

function updateComments(update: (current: DesignReviewComment[]) => DesignReviewComment[]) {
    const next = update($comments.get());
    $comments.set(next);
    persistComments(next);
}

function queuedComments() {
    return $comments.get().filter((comment) => comment.status === "queued");
}

function ReviewComposerBanner() {
    const comments = useValue($comments);
    const count = comments.filter((comment) => comment.status === "queued").length;

    if (count === 0) {
        return null;
    }

    return (
        <button
            className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-(--ui-border) bg-(--ui-bg-secondary) px-2.5 py-1.5 text-left text-[0.6875rem] text-foreground transition-colors hover:bg-(--chrome-action-hover)"
            onClick={() => host.revealPane(PaneId)}
            type="button"
        >
            <Codicon name="inspect" size="0.8rem" />
            <span className="min-w-0 flex-1 truncate">
                {count} design {count === 1 ? "comment" : "comments"} will be included with your next message
            </span>
            <Codicon name="chevron-right" size="0.7rem" />
        </button>
    );
}

function ReviewStatus() {
    const comments = useValue($comments);
    const count = comments.filter((comment) => comment.status === "queued").length;

    return (
        <Tip label="Open Design component review">
            <button
                className={cn(
                    "inline-flex h-full cursor-pointer items-center gap-1 px-1.5 text-[0.6875rem] transition-colors",
                    count > 0 ? "text-foreground" : "text-(--ui-text-tertiary)",
                    "hover:bg-(--chrome-action-hover) hover:text-foreground"
                )}
                onClick={() => host.revealPane(PaneId)}
                type="button"
            >
                <Codicon name="inspect" size="0.72rem" />
                {count > 0 ? <span>{count}</span> : null}
            </button>
        </Tip>
    );
}

function OpenDesignInspector() {
    const comments = useValue($comments);
    const [surfaceId, setSurfaceId] = useState("");
    const [selectedElement, setSelectedElement] = useState<KronTermInspectableElement | null>(null);
    const [selectedUrl, setSelectedUrl] = useState("");
    const [isInspecting, setIsInspecting] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [error, setError] = useState("");
    const { data: surfaces, isLoading } = useQuery({
        queryFn: host.krontermSurfaces.list,
        queryKey: SurfacesQueryKey,
        refetchInterval: 1_500,
    });
    const browserSurfaces = useMemo(() => surfaces?.filter((surface) => surface.view === "web") ?? [], [surfaces]);
    const selectedSurface = browserSurfaces.find((surface) => surface.id === surfaceId) ?? browserSurfaces[0];
    const surfaceComments = comments.filter((comment) => comment.surfaceId === selectedSurface?.id);

    useEffect(() => {
        if (!surfaceId && browserSurfaces[0]) {
            setSurfaceId(browserSurfaces[0].id);
        }
    }, [browserSurfaces, surfaceId]);

    useEffect(() => {
        setSelectedElement(null);
        setSelectedUrl("");
        setCommentText("");
        setIsInspecting(false);
    }, [selectedSurface?.id]);

    useEffect(() => {
        return host.krontermSurfaces.onSelection((selection) => {
            const surface = browserSurfaces.find((entry) => entry.id === selection.blockId);
            if (!surface) {
                return;
            }
            setSurfaceId(selection.blockId);
            setSelectedElement(selection.element);
            setSelectedUrl(selection.url);
        });
    }, [browserSurfaces]);

    const focusSurface = async () => {
        if (!selectedSurface) {
            return;
        }
        setError("");
        try {
            await host.krontermSurfaces.openSplit(selectedSurface.id);
            await host.krontermSurfaces.inspect(selectedSurface.id, true);
            setIsInspecting(true);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Unable to open the browser beside Hermes.");
        }
    };

    const addComment = () => {
        const text = commentText.trim();
        if (!selectedSurface || !selectedElement || !text) {
            return;
        }
        const next: DesignReviewComment = {
            id: `design-comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            surfaceId: selectedSurface.id,
            surfaceTitle: selectedSurface.title,
            url: selectedUrl || activeSurfaceUrl(selectedSurface),
            element: selectedElement,
            text,
            createdAt: Date.now(),
            status: "queued",
        };
        updateComments((current) => [...current, next].slice(-50));
        setCommentText("");
    };

    return (
        <section className="flex h-full min-h-0 flex-col bg-(--ui-bg)" aria-label="Open Design component review">
            <header className="border-b border-(--ui-border) px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg border border-(--ui-border) bg-(--ui-bg-secondary) text-(--ui-text-secondary)">
                        <Codicon name="inspect" size="0.9rem" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xs font-semibold text-foreground">Open Design review</h2>
                        <p className="truncate text-[0.625rem] text-(--ui-text-tertiary)">
                            Select a live component, then comment for Hermes.
                        </p>
                    </div>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                {isLoading ? (
                    <p className="px-2 py-6 text-center text-xs text-(--ui-text-tertiary)" role="status">
                        Finding browser widgets…
                    </p>
                ) : browserSurfaces.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-(--ui-border) px-4 py-8 text-center">
                        <Codicon name="globe" className="text-(--ui-text-tertiary)" size="1rem" />
                        <p className="mt-2 text-xs font-medium text-foreground">Open your design in a browser widget</p>
                        <p className="mt-1 text-[0.6875rem] leading-4 text-(--ui-text-tertiary)">
                            It will appear here as an inspectable live surface.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-xl border border-(--ui-border) bg-(--ui-bg-secondary) p-1">
                            {browserSurfaces.map((surface) => (
                                <button
                                    className={cn(
                                        "min-w-24 max-w-40 cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-left text-[0.6875rem] transition-colors",
                                        surface.id === selectedSurface?.id
                                            ? "bg-(--ui-bg) text-foreground shadow-sm ring-1 ring-(--ui-border)"
                                            : "text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
                                    )}
                                    key={surface.id}
                                    onClick={() => setSurfaceId(surface.id)}
                                    title={surface.title}
                                    type="button"
                                >
                                    <Codicon name="globe" className="mr-1.5 inline" size="0.68rem" />
                                    {surface.title}
                                </button>
                            ))}
                            <button
                                aria-label="Inspect selected browser beside Hermes"
                                className={cn(
                                    "ml-auto grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-(--chrome-action-hover) hover:text-foreground",
                                    isInspecting
                                        ? "bg-(--chrome-action-hover) text-foreground"
                                        : "text-(--ui-text-tertiary)"
                                )}
                                onClick={() => void focusSurface()}
                                title="Inspect in KronTerm browser"
                                type="button"
                            >
                                <Codicon name="inspect" size="0.75rem" />
                            </button>
                        </div>

                        {selectedSurface?.browserTabs?.length ? (
                            <div className="mb-2 flex gap-1 overflow-x-auto px-1" aria-label="Browser tabs">
                                {selectedSurface.browserTabs.map((tab) => (
                                    <span
                                        className={cn(
                                            "max-w-36 shrink-0 truncate rounded-full border px-2 py-1 text-[0.625rem]",
                                            tab.active
                                                ? "border-(--ui-border) bg-(--ui-bg-secondary) text-foreground"
                                                : "border-transparent text-(--ui-text-tertiary)"
                                        )}
                                        key={tab.id}
                                        title={tab.url}
                                    >
                                        {tab.title}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <button
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                                isInspecting
                                    ? "border-(--ui-border) bg-(--chrome-action-hover)"
                                    : "border-(--ui-border) bg-(--ui-bg-secondary)/60 hover:bg-(--chrome-action-hover)"
                            )}
                            onClick={() => void focusSurface()}
                            type="button"
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--ui-border) bg-(--ui-bg-secondary) text-(--ui-text-secondary)">
                                <Codicon name="inspect" size="0.9rem" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-foreground">
                                    {isInspecting ? "Selecting in KronTerm browser" : "Select in KronTerm browser"}
                                </span>
                                <span className="mt-0.5 block text-[0.6875rem] leading-4 text-(--ui-text-tertiary)">
                                    Hover a live component, click it, then comment directly on the page.
                                </span>
                            </span>
                            <Codicon name="arrow-right" className="text-(--ui-text-tertiary)" size="0.72rem" />
                        </button>

                        {selectedElement ? (
                            <div className="mt-2 rounded-xl border border-(--ui-border) bg-(--ui-bg-secondary)/60 p-2.5">
                                <div className="flex items-start gap-2">
                                    <Codicon
                                        name="symbol-field"
                                        className="mt-0.5 text-(--ui-text-secondary)"
                                        size="0.75rem"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[0.6875rem] font-medium text-foreground">
                                            {selectedElement.componentName ||
                                                selectedElement.name ||
                                                selectedElement.role}
                                        </p>
                                        <p className="mt-0.5 truncate font-mono text-[0.5625rem] text-(--ui-text-tertiary)">
                                            {selectedElement.role} · {selectedElement.ref}
                                        </p>
                                    </div>
                                </div>
                                <textarea
                                    aria-label="Component comment"
                                    className="mt-2 min-h-20 w-full resize-y rounded-lg border border-(--ui-border) bg-(--ui-bg) px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-(--ui-text-tertiary) focus:border-(--ui-text-secondary)"
                                    onChange={(event) => setCommentText(event.target.value)}
                                    placeholder="Tell Hermes what to change in this component…"
                                    value={commentText}
                                />
                                <button
                                    className="mt-2 w-full cursor-pointer rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                                    disabled={!commentText.trim()}
                                    onClick={addComment}
                                    type="button"
                                >
                                    Add to next Hermes message
                                </button>
                            </div>
                        ) : (
                            <p className="px-2 py-3 text-center text-[0.6875rem] text-(--ui-text-tertiary)">
                                Use the Open Design cursor in the browser toolbar, then click a live component.
                            </p>
                        )}

                        {surfaceComments.length > 0 ? (
                            <div className="mt-3 space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[0.625rem] font-semibold uppercase tracking-wider text-(--ui-text-tertiary)">
                                        Review comments
                                    </h3>
                                    <button
                                        className="cursor-pointer text-[0.625rem] text-(--ui-text-tertiary) hover:text-foreground"
                                        onClick={() =>
                                            updateComments((current) =>
                                                current.filter((comment) => comment.surfaceId !== selectedSurface?.id)
                                            )
                                        }
                                        type="button"
                                    >
                                        Clear
                                    </button>
                                </div>
                                {surfaceComments.map((comment) => (
                                    <div
                                        className="flex gap-2 rounded-lg border border-(--ui-border) bg-(--ui-bg-secondary)/60 p-2"
                                        key={comment.id}
                                    >
                                        <span
                                            className={cn(
                                                "mt-1 size-1.5 shrink-0 rounded-full",
                                                comment.status === "queued"
                                                    ? "bg-foreground"
                                                    : "bg-(--ui-text-tertiary)"
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[0.6875rem] leading-4 text-foreground">{comment.text}</p>
                                            <p className="mt-1 truncate text-[0.5625rem] text-(--ui-text-tertiary)">
                                                {comment.element.role} · {comment.element.name || comment.element.ref}
                                            </p>
                                        </div>
                                        <button
                                            aria-label="Remove comment"
                                            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
                                            onClick={() =>
                                                updateComments((current) =>
                                                    current.filter((entry) => entry.id !== comment.id)
                                                )
                                            }
                                            type="button"
                                        >
                                            <Codicon name="close" size="0.65rem" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </>
                )}

                {error ? (
                    <p
                        className="mt-2 rounded-lg border border-red-500/25 bg-red-500/5 px-2.5 py-2 text-[0.6875rem] text-red-400"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
            </div>
        </section>
    );
}

const plugin: HermesPlugin = {
    id: "open-design-review",
    name: "Open Design Review",
    description: "Select live browser components, comment on them, and send precise edit context to Hermes.",
    defaultEnabled: true,
    register(ctx) {
        $comments.set(ctx.storage.get("comments", [] as DesignReviewComment[]));
        persistComments = (comments) => ctx.storage.set("comments", comments);
        const unsubscribeSelection = host.krontermSurfaces.onSelection((selection) => {
            const text = selection.comment?.trim();
            if (!text) {
                return;
            }
            const next: DesignReviewComment = {
                id: `design-comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                surfaceId: selection.blockId,
                surfaceTitle: "KronTerm browser",
                url: selection.url,
                element: selection.element,
                text,
                createdAt: Date.now(),
                status: "queued",
            };
            updateComments((current) => [...current, next].slice(-50));
            host.revealPane(PaneId);
        });
        ctx.onDispose(() => {
            unsubscribeSelection();
            persistComments = () => undefined;
        });

        const middleware: ComposerMiddleware = {
            handler: (draft) => {
                const queued = queuedComments();
                if (queued.length === 0) {
                    return draft;
                }
                const reviewContext = formatReviewComments(queued);
                updateComments((current) =>
                    current.map((comment) => (comment.status === "queued" ? { ...comment, status: "sent" } : comment))
                );
                return { ...draft, text: `${draft.text.trim()}\n\n${reviewContext}`.trim() };
            },
        };

        ctx.registerMany([
            {
                id: "inspector",
                area: PANES_AREA,
                title: "Open Design",
                data: { placement: "right", collapsible: true, width: "21rem", minWidth: "17rem", maxWidth: "32rem" },
                render: () => <OpenDesignInspector />,
            },
            { id: "composer-banner", area: COMPOSER_AREAS.top, order: 35, render: () => <ReviewComposerBanner /> },
            { id: "composer-context", area: COMPOSER_AREAS.middleware, order: 35, data: middleware },
            { id: "status", area: STATUSBAR_AREAS.right, order: 64, render: () => <ReviewStatus /> },
            {
                id: "open",
                area: PALETTE_AREA,
                data: {
                    id: "open-design-review.open",
                    label: "Open Design: Review live components",
                    keywords: ["design", "component", "comment", "inspect", "browser"],
                    run: () => host.revealPane(PaneId),
                } satisfies PaletteContribution,
            },
        ]);
    },
};

export default plugin;
