// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getApi } from "@/store/global";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./web-mode.scss";

// The krondesign (open-design) daemon surface. Re-point this constant to turn
// web mode into a full-screen surface for any other local web app.
const WebModeFallbackUrl = "http://127.0.0.1:7456";
const StartPollMs = 1000;
const StartTimeoutMs = 20000;

type WebModeDaemonState = "checking" | "online" | "starting" | "offline";

async function probeDaemon(): Promise<{ running: boolean; url: string }> {
    try {
        const api = getApi();
        if (api?.krondesignStatus != null) {
            const status = await api.krondesignStatus();
            return { running: status.running, url: status.url || "" };
        }
        const resp = await fetch(`${WebModeFallbackUrl}/api/health`, { mode: "cors" });
        return { running: resp.ok, url: "" };
    } catch {
        return { running: false, url: "" };
    }
}

const WebModeView = memo(() => {
    const [daemonState, setDaemonState] = useState<WebModeDaemonState>("checking");
    const [daemonUrl, setDaemonUrl] = useState("");
    const [startError, setStartError] = useState<string | null>(null);
    const startingRef = useRef(false);

    const checkDaemon = useCallback(async () => {
        const { running, url } = await probeDaemon();
        if (running) {
            setDaemonUrl(url);
            setDaemonState("online");
            return;
        }
        setDaemonState("offline");
    }, []);

    const startDaemon = useCallback(async () => {
        if (startingRef.current) {
            return;
        }
        startingRef.current = true;
        setDaemonState("starting");
        setStartError(null);
        try {
            const api = getApi();
            if (api?.krondesignStart != null) {
                const result = await api.krondesignStart().catch((err: unknown) => ({
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                }));
                if (!result.success) {
                    setStartError(result.error ?? "Failed to start the web engine");
                }
            }
            const startedAt = Date.now();
            while (Date.now() - startedAt < StartTimeoutMs) {
                await new Promise((resolve) => setTimeout(resolve, StartPollMs));
                const { running, url } = await probeDaemon();
                if (running) {
                    setDaemonUrl(url);
                    setDaemonState("online");
                    return;
                }
            }
            setDaemonState("offline");
        } finally {
            startingRef.current = false;
        }
    }, [probeDaemon]);

    useEffect(() => {
        void (async () => {
            const { running, url } = await probeDaemon();
            if (running) {
                setDaemonUrl(url);
                setDaemonState("online");
            } else {
                await startDaemon();
            }
        })();
    }, [startDaemon, probeDaemon]);

    const exitWebMode = useCallback(() => {
        window.localStorage.setItem("kronterm:layoutmode", "widgets");
        window.dispatchEvent(new CustomEvent("kronterm:layoutmode-changed", { detail: { mode: "widgets" } }));
        void RpcApi.SetConfigCommand(TabRpcClient, { "app:layoutmode": "widgets" });
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                exitWebMode();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [exitWebMode]);

    return (
        <div className="web-mode" aria-label="Web mode">
            {daemonState === "online" ? (
                <iframe
                    className="web-mode-frame"
                    src={`${daemonUrl}/`}
                    title="KronTerm Web"
                    allow="clipboard-read; clipboard-write"
                />
            ) : (
                <div className="web-mode-status">
                    {daemonState === "checking" || daemonState === "starting" ? (
                        <>
                            <div className="web-mode-spinner" />
                            <span>
                                {daemonState === "checking" ? "Connecting to web engine…" : "Starting web engine…"}
                            </span>
                        </>
                    ) : (
                        <>
                            <h3>Web engine not running</h3>
                            {startError != null && <p className="web-mode-error">{startError}</p>}
                            <button type="button" className="web-mode-retry" onClick={() => void startDaemon()}>
                                Retry
                            </button>
                        </>
                    )}
                </div>
            )}
            <button
                type="button"
                className="web-mode-exit"
                onClick={exitWebMode}
                aria-label="Exit web mode"
                title="Exit web mode (Esc)"
            >
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                <span>Exit Web</span>
            </button>
        </div>
    );
});
WebModeView.displayName = "WebModeView";

export { WebModeView };
