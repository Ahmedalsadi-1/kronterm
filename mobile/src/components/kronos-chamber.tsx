import { LayoutGrid, LoaderCircle, RefreshCw, Server, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KronosHostClient } from "../lib/kronos-client";
import type { HostProfile, KronosSession, Surface } from "../types";

interface KronosChamberProps {
    open: boolean;
    hostsLoaded: boolean;
    host?: HostProfile;
    session?: KronosSession;
    selectedSurface?: Surface;
    onOpenHosts: () => void;
    onOpenWorkspace: () => void;
    onOpenWidget: (widget: string, data: Record<string, unknown>) => void;
}

type FrameState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; url: string }
    | { status: "error"; message: string };

export const KronosChamber = ({
    open,
    hostsLoaded,
    host,
    session,
    selectedSurface,
    onOpenHosts,
    onOpenWorkspace,
    onOpenWidget,
}: KronosChamberProps) => {
    const [frameState, setFrameState] = useState<FrameState>({ status: "idle" });
    const [reloadKey, setReloadKey] = useState(0);
    const client = useMemo(() => (host ? new KronosHostClient(host) : null), [host]);

    const load = useCallback(() => setReloadKey((value) => value + 1), []);

    useEffect(() => {
        if (!client || !host) {
            if (hostsLoaded) {
                setFrameState({ status: "idle" });
            }
            return;
        }
        let cancelled = false;
        setFrameState({ status: "loading" });
        void client
            .createMobileUiSession({
                sessionId: session?.id,
                surfaceId: selectedSurface?.id ?? `iphone:${host.id}`,
            })
            .then(
                ({ url }) => {
                    if (!cancelled) {
                        setFrameState({ status: "ready", url });
                    }
                },
                (error) => {
                    if (!cancelled) {
                        setFrameState({
                            status: "error",
                            message: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
            );
        return () => {
            cancelled = true;
        };
    }, [client, host, hostsLoaded, reloadKey, selectedSurface?.id, session?.id]);

    useEffect(() => {
        if (!open || frameState.status !== "ready") {
            return;
        }
        const frameOrigin = new URL(frameState.url).origin;
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== frameOrigin || !event.data || typeof event.data !== "object") {
                return;
            }
            const data = event.data as Record<string, unknown>;
            if (data.type !== "kronterm:open-widget" || typeof data.widget !== "string") {
                return;
            }
            onOpenWidget(data.widget, data);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameState, onOpenWidget, open]);

    return (
        <section className={`kronos-chamber ${open ? "is-open" : ""}`} aria-hidden={!open}>
            <header className="chamber-shell-bar">
                <div className="chamber-shell-identity">
                    <span className="chamber-shell-mark" aria-hidden="true">
                        <Sparkles />
                    </span>
                    <span>
                        <strong>KronosChamber</strong>
                        <small>
                            <i className={frameState.status === "ready" ? "is-online" : ""} />
                            {frameState.status === "ready" ? "Online" : host ? host.label : "KronTerm Mobile"}
                        </small>
                    </span>
                </div>
                <div className="chamber-shell-actions">
                    <button type="button" aria-label="Choose KronosCode runtime" onClick={onOpenHosts}>
                        <Server />
                    </button>
                    <button type="button" onClick={onOpenWorkspace}>
                        <LayoutGrid />
                        <span>Workspace</span>
                    </button>
                </div>
            </header>
            <div className="chamber-mobile-body">
                {!hostsLoaded ? (
                    <div className="chamber-mobile-state">
                        <LoaderCircle className="spin" />
                        <strong>Opening KronosChamber</strong>
                        <p>Preparing your mobile workspace.</p>
                    </div>
                ) : !host ? (
                    <div className="chamber-mobile-state">
                        <span className="chamber-mobile-orbit" aria-hidden="true">
                            <Sparkles />
                        </span>
                        <strong>Start with KronosChamber</strong>
                        <p>Connect Kron Cloud to work without a Mac or PC, or pair an optional KronTerm device.</p>
                        <button type="button" onClick={onOpenHosts}>
                            <Server /> Connect runtime
                        </button>
                    </div>
                ) : frameState.status === "ready" ? (
                    <iframe
                        key={frameState.url}
                        src={frameState.url}
                        title="KronosChamber"
                        allow="clipboard-read; clipboard-write; fullscreen; microphone"
                        referrerPolicy="no-referrer"
                    />
                ) : frameState.status === "error" ? (
                    <div className="chamber-mobile-state is-error">
                        <TriangleAlert />
                        <strong>KronosChamber did not load</strong>
                        <p>{frameState.message}</p>
                        <button type="button" onClick={load}>
                            <RefreshCw /> Retry
                        </button>
                    </div>
                ) : (
                    <div className="chamber-mobile-state">
                        <LoaderCircle className="spin" />
                        <strong>Opening KronosChamber</strong>
                        <p>Connecting this iPhone surface to the selected KronosCode engine.</p>
                    </div>
                )}
            </div>
        </section>
    );
};
