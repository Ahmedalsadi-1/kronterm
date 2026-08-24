// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    publishWorkspaceCanvasComposerSubmit,
    type WorkspaceCanvasComposerContext,
} from "@/app/tab/workspace-canvas-context";
import { getApi } from "@/store/global";
import {
    HermesComposerSubmittedEvent,
    type HermesComposerSubmitted,
} from "@hermes/app/chat/composer/hooks/use-composer-submit";
import { markKronTermWidgetHost } from "@hermes/lib/kronterm-host";
import { ComposerAttachmentUserRemovedEvent, mainComposerScope, type ComposerAttachment } from "@hermes/store/composer";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { makeCanvasAttachments, mergeCanvasAttachments } from "./hermes-canvas-context";
import { configureHermesDesktopShim, installHermesDesktopShim } from "./hermes-desktop-shim";
import { hermesSurfaceController } from "./hermes-surface-controller";

const LazyHermesApp = lazy(async () => ({ default: (await import("./hermes-app")).HermesApp }));

let shimInstalled = false;

function ensureShim(): void {
    markKronTermWidgetHost();
    if (shimInstalled) {
        return;
    }
    shimInstalled = true;
    installHermesDesktopShim({ baseUrl: "http://127.0.0.1:9119" });
}

export function HermesHudHost({
    autoOpen,
    canvasContext,
    onExpand,
    tabId,
}: {
    autoOpen: boolean;
    canvasContext: WorkspaceCanvasComposerContext;
    onExpand: () => Promise<void>;
    tabId: string;
}) {
    const surface = useSyncExternalStore(
        hermesSurfaceController.subscribe,
        hermesSurfaceController.getSnapshot,
        hermesSurfaceController.getSnapshot
    );
    const [connectionReady, setConnectionReady] = useState(false);
    const previousAutoOpenRef = useRef(false);
    const managedAttachmentsRef = useRef<ComposerAttachment[]>([]);
    const dismissedIdsRef = useRef(new Set<string>());
    const selectionKeyRef = useRef("");
    ensureShim();

    useEffect(() => hermesSurfaceController.setExpandHandler(onExpand), [onExpand]);

    useEffect(() => {
        if (
            autoOpen &&
            !previousAutoOpenRef.current &&
            hermesSurfaceController.getSnapshot().presentation === "closed"
        ) {
            hermesSurfaceController.requestOpenHud();
        }
        previousAutoOpenRef.current = autoOpen;
    }, [autoOpen, surface.presentation]);

    useEffect(() => {
        const onRemoved = (event: Event) => {
            const attachment = (event as CustomEvent<ComposerAttachment>).detail;
            if (attachment.source !== "kronterm-canvas") {
                return;
            }
            dismissedIdsRef.current.add(attachment.id);
        };
        window.addEventListener(ComposerAttachmentUserRemovedEvent, onRemoved);
        return () => window.removeEventListener(ComposerAttachmentUserRemovedEvent, onRemoved);
    }, []);

    useEffect(() => {
        const selectionKey = `${canvasContext.tabid}:${canvasContext.nodes.map((node) => node.id).join("|")}`;
        if (selectionKey !== selectionKeyRef.current) {
            selectionKeyRef.current = selectionKey;
            dismissedIdsRef.current.clear();
        }
        const managed = makeCanvasAttachments(canvasContext);
        managedAttachmentsRef.current = managed;
        mainComposerScope.$attachments.set(
            mergeCanvasAttachments(mainComposerScope.$attachments.get(), managed, dismissedIdsRef.current)
        );
    }, [canvasContext]);

    useEffect(() => {
        const onSubmitted = (event: Event) => {
            const detail = (event as CustomEvent<HermesComposerSubmitted>).detail;
            const canvasAttachments = detail.attachments.filter(
                (attachment) => attachment.source === "kronterm-canvas" && attachment.sourceId
            );
            if (canvasAttachments.length === 0) {
                return;
            }
            const submitted = canvasAttachments[0];
            publishWorkspaceCanvasComposerSubmit({
                contextids: canvasAttachments
                    .filter(
                        (attachment) =>
                            attachment.sourceTabId === submitted.sourceTabId &&
                            attachment.sourceMode === submitted.sourceMode
                    )
                    .map((attachment) => attachment.sourceId!),
                mode: submitted.sourceMode ?? "follow",
                prompt: detail.text,
                tabid: submitted.sourceTabId ?? "",
            });
            queueMicrotask(() => {
                mainComposerScope.$attachments.set(
                    mergeCanvasAttachments(
                        mainComposerScope.$attachments.get(),
                        managedAttachmentsRef.current,
                        dismissedIdsRef.current
                    )
                );
            });
        };
        window.addEventListener(HermesComposerSubmittedEvent, onSubmitted);
        return () => window.removeEventListener(HermesComposerSubmittedEvent, onSubmitted);
    }, []);

    useEffect(() => {
        const clamp = () => hermesSurfaceController.clampToViewport();
        window.addEventListener("resize", clamp);
        return () => window.removeEventListener("resize", clamp);
    }, []);

    useEffect(() => {
        const toggleFromShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "h") {
                event.preventDefault();
                event.stopPropagation();
                const presentation = hermesSurfaceController.getSnapshot().presentation;
                if (presentation === "hud") {
                    void hermesSurfaceController
                        .expandToWidget()
                        .catch((error) => console.warn("Kronos HUD could not expand", error));
                } else {
                    hermesSurfaceController.requestOpenHud();
                }
            }
        };
        window.addEventListener("keydown", toggleFromShortcut, true);
        return () => window.removeEventListener("keydown", toggleFromShortcut, true);
    }, []);

    useEffect(() => {
        if (surface.presentation !== "hud" || !tabId) {
            setConnectionReady(false);
            return;
        }
        let active = true;
        const applyConnection = (connection: HermesConnectionDescriptor) => {
            if (active) {
                configureHermesDesktopShim({ baseUrl: connection.baseUrl, token: connection.token });
                setConnectionReady(true);
            }
        };
        const unsubscribe = getApi().onHermesConnection(applyConnection);
        void getApi().hermesGetConnection({ tabId }).then(applyConnection).catch(console.warn);
        return () => {
            active = false;
            unsubscribe();
        };
    }, [surface.presentation, tabId]);

    if (surface.presentation !== "hud") {
        return null;
    }

    const { x, y, width, height } = surface.geometry;

    return (
        <div
            aria-label="Kronos HUD"
            className="pointer-events-none fixed z-[115] overflow-visible"
            data-kronterm-hermes-hud=""
            style={{ left: x, top: y, width, height }}
        >
            {connectionReady ? (
                <Suspense
                    fallback={
                        <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-[#080a0df2] text-xs text-white/55 shadow-2xl backdrop-blur-xl">
                            Loading Kronos…
                        </div>
                    }
                >
                    <LazyHermesApp hudMode />
                </Suspense>
            ) : (
                <div className="grid h-full place-items-center rounded-xl border border-white/10 bg-[#080a0df2] text-xs text-white/55 shadow-2xl backdrop-blur-xl">
                    Starting Kronos…
                </div>
            )}
        </div>
    );
}

export function HermesPanelHost({ tabId }: { tabId: string }) {
    const surface = useSyncExternalStore(
        hermesSurfaceController.subscribe,
        hermesSurfaceController.getSnapshot,
        hermesSurfaceController.getSnapshot
    );
    const [connectionReady, setConnectionReady] = useState(false);
    ensureShim();

    useEffect(() => {
        if (surface.presentation !== "panel" || !tabId) {
            setConnectionReady(false);
            return;
        }
        let active = true;
        const applyConnection = (connection: HermesConnectionDescriptor) => {
            if (!active) {
                return;
            }
            configureHermesDesktopShim({ baseUrl: connection.baseUrl, token: connection.token });
            setConnectionReady(true);
        };
        const unsubscribe = getApi().onHermesConnection(applyConnection);
        void getApi().hermesGetConnection({ tabId }).then(applyConnection).catch(console.warn);
        return () => {
            active = false;
            unsubscribe();
        };
    }, [surface.presentation, tabId]);

    return (
        <section className="hermes-workspace-panel" aria-label="Kronos side panel">
            <header className="hermes-workspace-panel-header">
                <div>
                    <span className="hermes-workspace-panel-status" aria-hidden="true" />
                    <strong>Kronos</strong>
                </div>
                <div className="hermes-workspace-panel-actions">
                    <button
                        type="button"
                        onClick={() => hermesSurfaceController.requestOpenHud()}
                        aria-label="Move Kronos to HUD"
                        title="Move to HUD"
                    >
                        <i className="fa-solid fa-window-restore" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void hermesSurfaceController.expandToWidget()}
                        aria-label="Open Kronos as a widget"
                        title="Open as widget"
                    >
                        <i className="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => hermesSurfaceController.dismiss()}
                        aria-label="Close Kronos side panel"
                        title="Close panel"
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </div>
            </header>
            <div className="hermes-workspace-panel-content">
                {connectionReady ? (
                    <Suspense fallback={<div className="hermes-workspace-panel-state">Loading Kronos…</div>}>
                        <LazyHermesApp />
                    </Suspense>
                ) : (
                    <div className="hermes-workspace-panel-state">Starting Kronos…</div>
                )}
            </div>
        </section>
    );
}
