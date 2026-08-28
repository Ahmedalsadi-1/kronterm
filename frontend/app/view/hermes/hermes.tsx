import { uxCloseBlock } from "@/app/store/keymodel";
import { createBlock, getApi, refocusNode } from "@/store/global";
import { markKronTermWidgetHost } from "@hermes/lib/kronterm-host";
import { useAtomValue } from "jotai";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { configureHermesDesktopShim, installHermesDesktopShim } from "./hermes-desktop-shim";
import type { HermesViewModel } from "./hermes-model";
import { hermesSurfaceController } from "./hermes-surface-controller";

type HermesViewProps = {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: HermesViewModel;
};

let shimInstalled = false;

const LazyHermesApp = lazy(async () => ({ default: (await import("./hermes-app")).HermesApp }));

function ensureShim(): void {
    markKronTermWidgetHost();
    if (shimInstalled) {
        return;
    }
    shimInstalled = true;
    installHermesDesktopShim({ baseUrl: "http://127.0.0.1:9119" });
}

type RuntimeState =
    | { status: "starting" }
    | { status: "ready"; connection: HermesConnectionDescriptor }
    | { status: "error"; message: string };

export function HermesView({ blockId, contentRef, model }: HermesViewProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [runtime, setRuntime] = useState<RuntimeState>({ status: "starting" });
    const [retryKey, setRetryKey] = useState(0);
    const magnified = useAtomValue(model.nodeModel.isMagnified);
    const folded = useAtomValue(model.nodeModel.isFolded);
    const surface = useSyncExternalStore(
        hermesSurfaceController.subscribe,
        hermesSurfaceController.getSnapshot,
        hermesSurfaceController.getSnapshot
    );
    const surfaceActive = surface.presentation === "widget" && surface.widgetBlockId === blockId;
    ensureShim();

    useEffect(
        () =>
            hermesSurfaceController.registerWidgetHost({
                blockId,
                closeToHud: () => uxCloseBlock(model.blockId, () => model.nodeModel.onClose()),
            }),
        [blockId, model]
    );

    useEffect(() => {
        const handler = (e: Event) => {
            const view = (e as CustomEvent).detail?.view;
            if (typeof view === "string" && view) {
                createBlock({ meta: { view } }, false);
            }
        };
        window.addEventListener("kronterm:create-widget", handler);
        return () => window.removeEventListener("kronterm:create-widget", handler);
    }, []);

    useEffect(() => {
        if (surface.presentation === "widget" && surface.widgetBlockId && surface.widgetBlockId !== blockId) {
            refocusNode(surface.widgetBlockId);
        }
    }, [blockId, surface.presentation, surface.widgetBlockId]);

    useEffect(() => {
        if (!surfaceActive) {
            return;
        }
        let active = true;
        const applyConnection = (connection: HermesConnectionDescriptor) => {
            if (!active) {
                return;
            }
            configureHermesDesktopShim({ baseUrl: connection.baseUrl, token: connection.token });
            setRuntime({ status: "ready", connection });
        };
        const unsubscribe = getApi().onHermesConnection(applyConnection);
        setRuntime({ status: "starting" });
        void getApi()
            .hermesGetConnection({ tabId: model.tabModel.tabId, blockId })
            .then(applyConnection)
            .catch((error) => {
                if (!active) {
                    return;
                }
                setRuntime({ status: "error", message: error instanceof Error ? error.message : String(error) });
            });
        return () => {
            active = false;
            unsubscribe();
        };
    }, [blockId, model.tabModel.tabId, retryKey, surfaceActive]);

    const toggleMagnify = () => {
        model.nodeModel.toggleMagnify();
        setTimeout(() => refocusNode(model.blockId), 50);
    };

    const close = () => hermesSurfaceController.requestOpenHud();
    const activateSurface = () => {
        if (!surfaceActive) {
            hermesSurfaceController.activateWidget(blockId);
            return;
        }
        void getApi()
            .hermesGetConnection({ tabId: model.tabModel.tabId, blockId })
            .catch((error) => console.warn("Kronos surface activation failed", error));
    };

    return (
        <div
            ref={contentRef}
            onFocusCapture={activateSurface}
            onPointerDown={activateSurface}
            className="hermes-view-container relative"
            style={{ width: "100%", height: "100%", overflow: "hidden" }}
        >
            <div
                className="group absolute top-3 left-3 z-[100] flex gap-1.5 rounded-full bg-black/15 p-1.5 backdrop-blur-sm"
                aria-label="Kronos widget window controls"
            >
                <button
                    type="button"
                    title="Return Kronos to HUD"
                    aria-label="Return Kronos to HUD"
                    onClick={close}
                    className="grid h-3 w-3 cursor-pointer place-items-center rounded-full bg-[#ff5f57] text-[6px] text-black/70 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.2)]"
                >
                    <i
                        className="fa-solid fa-xmark opacity-0 transition-opacity group-hover:opacity-80"
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    title={folded ? "Restore Kronos widget" : "Fold Kronos widget"}
                    aria-label={folded ? "Restore Kronos widget" : "Fold Kronos widget"}
                    aria-pressed={folded}
                    onClick={() => model.nodeModel.toggleFold()}
                    className="grid h-3 w-3 cursor-pointer place-items-center rounded-full bg-[#febc2e] text-[6px] text-black/70 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.2)]"
                >
                    <i
                        className="fa-solid fa-minus opacity-0 transition-opacity group-hover:opacity-80"
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    title={magnified ? "Restore Kronos widget" : "Expand Kronos widget"}
                    aria-label={magnified ? "Restore Kronos widget" : "Expand Kronos widget"}
                    aria-pressed={magnified}
                    onClick={toggleMagnify}
                    className="grid h-3 w-3 cursor-pointer place-items-center rounded-full bg-[#28c840] text-[5px] text-black/70 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.2)]"
                >
                    <i
                        className="fa-solid fa-up-right-and-down-left-from-center opacity-0 transition-opacity group-hover:opacity-80"
                        aria-hidden="true"
                    />
                </button>
            </div>
            <div ref={mountRef} style={{ width: "100%", height: "100%" }}>
                {!surfaceActive && (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                        Kronos is active in another widget.
                    </div>
                )}
                {surfaceActive && runtime.status === "starting" && (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Starting Kronos…
                    </div>
                )}
                {surfaceActive && runtime.status === "error" && (
                    <div className="flex h-full items-center justify-center p-8">
                        <div className="max-w-xl rounded-lg border border-red-500/30 bg-red-500/5 p-5">
                            <div className="font-semibold">Kronos could not start</div>
                            <div className="mt-2 text-sm text-muted-foreground">{runtime.message}</div>
                            <button
                                type="button"
                                onClick={() => setRetryKey((value) => value + 1)}
                                className="mt-4 cursor-pointer rounded bg-accent/80 px-3 py-2 text-primary transition-colors hover:bg-accent"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}
                {surfaceActive && runtime.status === "ready" && (
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Loading Kronos…
                            </div>
                        }
                    >
                        <LazyHermesApp key={runtime.connection.baseUrl} kronSettingsModel={model.kronSettingsModel} />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
