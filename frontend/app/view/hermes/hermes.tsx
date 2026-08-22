import { uxCloseBlock } from "@/app/store/keymodel";
import { getApi, refocusNode } from "@/store/global";
import { makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { configureHermesDesktopShim, installHermesDesktopShim } from "./hermes-desktop-shim";
import type { HermesViewModel } from "./hermes-model";

type HermesViewProps = {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: HermesViewModel;
};

let shimInstalled = false;

const LazyHermesApp = lazy(async () => ({ default: (await import("./hermes-app")).HermesApp }));

function ensureShim(): void {
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

export function HermesView({ contentRef, model }: HermesViewProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [runtime, setRuntime] = useState<RuntimeState>({ status: "starting" });
    const [retryKey, setRetryKey] = useState(0);
    const magnified = useAtomValue(model.nodeModel.isMagnified);
    ensureShim();

    useEffect(() => {
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
            .hermesGetConnection()
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
    }, [retryKey]);

    const toggleMagnify = () => {
        model.nodeModel.toggleMagnify();
        setTimeout(() => refocusNode(model.blockId), 50);
    };

    const close = () => uxCloseBlock(model.blockId, () => model.nodeModel.onClose());

    return (
        <div
            ref={contentRef}
            className="hermes-view-container relative"
            style={{ width: "100%", height: "100%", overflow: "hidden" }}
        >
            <div className="absolute top-2 right-2 z-[100] flex gap-1 rounded-md border border-black/10 bg-white/85 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/70">
                <button
                    type="button"
                    title={magnified ? "Restore Hermes widget" : "Expand Hermes widget"}
                    aria-label={magnified ? "Restore Hermes widget" : "Expand Hermes widget"}
                    onClick={toggleMagnify}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                >
                    <i className={makeIconClass(magnified ? "compress" : "expand", true)} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    title="Close Hermes widget"
                    aria-label="Close Hermes widget"
                    onClick={close}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                >
                    <i className={makeIconClass("xmark-large", true)} aria-hidden="true" />
                </button>
            </div>
            <div ref={mountRef} style={{ width: "100%", height: "100%" }}>
                {runtime.status === "starting" && (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Starting Hermes backend…
                    </div>
                )}
                {runtime.status === "error" && (
                    <div className="flex h-full items-center justify-center p-8">
                        <div className="max-w-xl rounded-lg border border-red-500/30 bg-red-500/5 p-5">
                            <div className="font-semibold">Hermes could not start</div>
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
                {runtime.status === "ready" && (
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Loading Hermes Desktop…
                            </div>
                        }
                    >
                        <LazyHermesApp key={runtime.connection.baseUrl} />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
