import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { ActionMarker } from "@/app/view/action-marker";
import { CursorOverlay } from "@/app/view/cursor-overlay";
import { useAgentOverlays } from "@/app/view/use-agent-overlays";
import { WaterFlowOverlay } from "@/app/view/waterflow-overlay";
import { getWSServerEndpoint } from "@/util/endpoints";
import { fireAndForget } from "@/util/util";
import RFB from "@novnc/novnc";
import { type Atom, atom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";

// structural subset, not ViewComponentProps: web-mode embeds this view without a backing block
type SandboxViewFields = {
    blockId: string;
    modeAtom: Atom<MetaType["sandbox:mode"]>;
    browserUrlAtom: Atom<MetaType["sandbox:browserurl"]>;
    ensureBrowserBlock: (browserUrl?: string) => Promise<string>;
};

type SandboxDesktopStatus = "disconnected" | "connecting" | "connected" | "error";

const startingPollIntervalMs = 250;
const runningPollIntervalMs = 10000;

type SandboxStatusWithRuntime = SandboxStatusResponse & {
    runtime?: string;
    desktopUrl?: string;
};

const krontermDesktopDesktopUrl = "http://localhost:9990/novnc/vnc_lite.html?scale=true";

function makeKrontermDesktopVncWsUrl(desktopUrl: string): string {
    try {
        const url = new URL(desktopUrl || krontermDesktopDesktopUrl);
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${url.host}/websockify`;
    } catch {
        return "";
    }
}

function getSandboxRuntime(status: SandboxStatusResponse): string {
    return (status as SandboxStatusWithRuntime).runtime ?? "";
}

function getSandboxDesktopUrl(status: SandboxStatusResponse): string {
    return (status as SandboxStatusWithRuntime).desktopUrl ?? "";
}

function normalizeVncWsUrl(vncWsUrl: string): string {
    if (!vncWsUrl) {
        return "";
    }
    if (vncWsUrl.startsWith("ws://") || vncWsUrl.startsWith("wss://")) {
        return vncWsUrl;
    }
    const wsEndpoint = getWSServerEndpoint();
    if (!wsEndpoint) {
        return vncWsUrl;
    }
    return `${wsEndpoint}${vncWsUrl.startsWith("/") ? "" : "/"}${vncWsUrl}`;
}

function makeEmptyStatus(sessionId: string, mode: string): SandboxStatusResponse {
    return {
        sessionId,
        status: "stopped",
        mode,
        vncPort: 0,
        sshPort: 0,
        vncWsUrl: "",
        sshConn: "",
        error: "",
    };
}

export function SandboxView({ model }: { model: SandboxViewFields }) {
    const mode = useAtomValue(model.modeAtom) ?? "desktop";
    const browserUrl = useAtomValue(model.browserUrlAtom) ?? "about:blank";
    const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusResponse>(() =>
        makeEmptyStatus(model.blockId, mode)
    );
    const [desktopStatus, setDesktopStatus] = useState<SandboxDesktopStatus>("disconnected");
    const vncContainerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const autoStartRef = useRef(false);

    const cursorWrapperRef = useRef<HTMLDivElement>(null);
    const { waterflowActive, markers, cursorPoint, cursorActive, clickFlashCount } = useAgentOverlays(
        "sandbox",
        model.blockId
    );
    const cursorContainerRect = cursorWrapperRef.current?.getBoundingClientRect() ?? null;

    const effectiveMode = mode === "background" ? "background" : "desktop";
    const isRunning = sandboxStatus.status === "running";
    const isStarting = sandboxStatus.status === "starting";
    const isDesktopMode = effectiveMode === "desktop";
    const sandboxRuntime = getSandboxRuntime(sandboxStatus);
    const desktopUrl = getSandboxDesktopUrl(sandboxStatus);
    const rfbWsUrl =
        isDesktopMode && isRunning
            ? sandboxRuntime === "kronterm-desktop"
                ? makeKrontermDesktopVncWsUrl(desktopUrl)
                : normalizeVncWsUrl(sandboxStatus.vncWsUrl)
            : "";
    const usesEmbeddedRfb = isDesktopMode && Boolean(rfbWsUrl);

    const refreshStatus = async () => {
        try {
            const response = await RpcApi.SandboxStatusCommand(TabRpcClient, { sessionId: model.blockId });
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode),
                ...response,
            });
        } catch (err) {
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode),
                status: "error",
                error: String(err),
            });
        }
    };

    useEffect(() => {
        void refreshStatus();
    }, [model.blockId, effectiveMode, browserUrl]);

    useEffect(() => {
        if (sandboxStatus.status !== "starting" && sandboxStatus.status !== "running") {
            return;
        }
        const pollIntervalMs = sandboxStatus.status === "starting" ? startingPollIntervalMs : runningPollIntervalMs;
        let disposed = false;
        let timeoutId: number;
        const pollStatus = async () => {
            await refreshStatus();
            if (!disposed) {
                timeoutId = window.setTimeout(pollStatus, pollIntervalMs);
            }
        };
        timeoutId = window.setTimeout(pollStatus, pollIntervalMs);
        return () => {
            disposed = true;
            window.clearTimeout(timeoutId);
        };
    }, [sandboxStatus.status, model.blockId, effectiveMode, browserUrl]);

    useEffect(() => {
        if (!isDesktopMode || !isRunning || !rfbWsUrl || !vncContainerRef.current) {
            if (rfbRef.current) {
                rfbRef.current.disconnect();
                rfbRef.current = null;
            }
            setDesktopStatus(isDesktopMode && isStarting ? "connecting" : "disconnected");
            return;
        }

        const nextUrl = rfbWsUrl;
        if (!nextUrl) {
            setDesktopStatus("error");
            return;
        }

        const container = vncContainerRef.current;
        container.replaceChildren();
        setDesktopStatus("connecting");
        let disposed = false;
        const rfb = new RFB(container, nextUrl, {
            shared: true,
            credentials: { password: "wave123" },
        });
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.addEventListener("connect", () => {
            if (disposed) {
                return;
            }
            setDesktopStatus("connected");
        });
        rfb.addEventListener("disconnect", () => {
            if (disposed) {
                return;
            }
            setDesktopStatus("disconnected");
        });
        rfb.addEventListener("securityfailure", () => {
            if (disposed) {
                return;
            }
            setDesktopStatus("error");
        });
        rfbRef.current = rfb;

        return () => {
            disposed = true;
            rfb.disconnect();
            if (rfbRef.current === rfb) {
                rfbRef.current = null;
                container.replaceChildren();
            }
        };
    }, [isDesktopMode, isRunning, isStarting, rfbWsUrl]);

    const startSandbox = async () => {
        try {
            const ensureBrowser = effectiveMode === "background";
            if (ensureBrowser) {
                await model.ensureBrowserBlock(browserUrl);
            }
            const response = await RpcApi.SandboxStartCommand(TabRpcClient, {
                sessionId: model.blockId,
                mode: effectiveMode,
                browserUrl,
                ensureBrowser,
            });
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode),
                ...response,
            });
        } catch (err) {
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode),
                status: "error",
                mode: effectiveMode,
                error: String(err),
            });
        }
    };

    useEffect(() => {
        if (autoStartRef.current || !isDesktopMode || sandboxStatus.status !== "stopped") {
            return;
        }
        autoStartRef.current = true;
        fireAndForget(startSandbox);
    }, [isDesktopMode, sandboxStatus.status]);

    return (
        <div ref={cursorWrapperRef} className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-black">
            {isDesktopMode ? (
                usesEmbeddedRfb ? (
                    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-black">
                        <div
                            ref={vncContainerRef}
                            className="absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden bg-black"
                        />
                        {desktopStatus !== "connected" ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-sm text-zinc-400">
                                {desktopStatus === "error" ? "Sandbox display unavailable" : "Connecting to sandbox..."}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div
                        ref={vncContainerRef}
                        className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black"
                    >
                        {!isRunning || desktopStatus !== "connected" ? (
                            <div className="text-sm text-zinc-500">
                                {sandboxStatus.error ? "Sandbox unavailable" : "Starting sandbox..."}
                            </div>
                        ) : null}
                    </div>
                )
            ) : null}
            <CursorOverlay
                cursorPoint={cursorPoint}
                containerRect={cursorContainerRect}
                active={cursorActive}
                triggerClickFlash={clickFlashCount}
            />
            <WaterFlowOverlay active={waterflowActive} />
            {markers.map((m) => (
                <ActionMarker key={m.id} actionType={m.actionType} label={m.label} x={m.x} y={m.y} active={true} />
            ))}
        </div>
    );
}

export function SandboxDesktopPane({ sessionId }: { sessionId: string }) {
    const model = useMemo<SandboxViewFields>(
        () => ({
            blockId: sessionId,
            modeAtom: atom<MetaType["sandbox:mode"]>("desktop"),
            browserUrlAtom: atom<MetaType["sandbox:browserurl"]>("about:blank"),
            ensureBrowserBlock: async () => "",
        }),
        [sessionId]
    );
    return <SandboxView model={model} />;
}
