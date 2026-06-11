import { reportDesktopPetActivity } from "@/app/aipanel/desktop-pet-activity";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { CursorOverlay, reportCursorToPet } from "@/app/view/cursor-overlay";
import { WaterFlowOverlay } from "@/app/view/waterflow-overlay";
import { ActionMarker } from "@/app/view/action-marker";
import { useAgentOverlays } from "@/app/view/use-agent-overlays";
import { getWSServerEndpoint } from "@/util/endpoints";
import { base64ToArrayBuffer, fireAndForget } from "@/util/util";
import RFB from "@novnc/novnc";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { SandboxViewModel } from "./sandbox-model";

type SandboxDesktopStatus = "disconnected" | "connecting" | "connected" | "error";

const pollIntervalMs = 1500;

type SandboxStatusWithRuntime = SandboxStatusResponse & {
    runtime?: string;
    desktopUrl?: string;
    mcpUrl?: string;
};

type KrontermDesktopScreenshotResponse = {
    image?: string;
};

const krontermDesktopDesktopUrl = "http://localhost:9990/novnc/vnc_lite.html?scale=true";
const krontermDesktopPreviewIntervalMs = 1000;

function makeKrontermDesktopComputerUseUrl(desktopUrl: string): string {
    try {
        const url = new URL(desktopUrl || krontermDesktopDesktopUrl);
        return `${url.protocol}//${url.host}/computer-use`;
    } catch {
        return "http://localhost:9990/computer-use";
    }
}

function isKrontermDesktopUrl(desktopUrl: string, runtime: string): boolean {
    if (runtime === "kronterm-desktop") {
        return true;
    }
    try {
        const url = new URL(desktopUrl || krontermDesktopDesktopUrl);
        return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "9990";
    } catch {
        return false;
    }
}

function getSandboxRuntime(status: SandboxStatusResponse): string {
    return (status as SandboxStatusWithRuntime).runtime ?? "";
}

function getSandboxDesktopUrl(status: SandboxStatusResponse): string {
    return (status as SandboxStatusWithRuntime).desktopUrl ?? "";
}

function getSandboxMcpUrl(status: SandboxStatusResponse): string {
    return (status as SandboxStatusWithRuntime).mcpUrl ?? "";
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

function makeEmptyStatus(sessionId: string, mode: string, browserUrl: string): SandboxStatusResponse {
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

function statusColor(status: string): string {
    if (status === "running") {
        return "bg-emerald-500";
    }
    if (status === "starting") {
        return "bg-amber-400 animate-pulse";
    }
    if (status === "error") {
        return "bg-red-500";
    }
    return "bg-zinc-500";
}

function SandboxControlButton({
    label,
    onClick,
    disabled,
    variant = "secondary",
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary" | "danger";
}) {
    const className =
        variant === "primary"
            ? "bg-blue-600 text-white hover:bg-blue-500"
            : variant === "danger"
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700";
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`cursor-pointer rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {label}
        </button>
    );
}

export function SandboxView({ model }: ViewComponentProps<SandboxViewModel>) {
    const mode = useAtomValue(model.modeAtom) ?? "desktop";
    const browserUrl = useAtomValue(model.browserUrlAtom) ?? "about:blank";
    const browserBlockId = useAtomValue(model.browserBlockIdAtom) ?? "";
    const blockData = useAtomValue(model.blockAtom);
    const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusResponse>(() =>
        makeEmptyStatus(model.blockId, mode, browserUrl)
    );
    const [desktopStatus, setDesktopStatus] = useState<SandboxDesktopStatus>("disconnected");
    const [isBusy, setIsBusy] = useState(false);
    const vncContainerRef = useRef<HTMLDivElement>(null);
    const krontermDesktopImageRef = useRef<HTMLImageElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const autoStartRef = useRef(false);
    const krontermDesktopObjectUrlRef = useRef("");
    const [krontermDesktopScreenshotUrl, setKrontermDesktopScreenshotUrl] = useState("");

    // Agent overlay state from activity stream
    const { waterflowActive, markers } = useAgentOverlays("sandbox");

    // Cursor overlay for agent activity tracking
    const cursorWrapperRef = useRef<HTMLDivElement>(null);
    const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
    const [cursorContainerRect, setCursorContainerRect] = useState<DOMRect | null>(null);
    const [clickFlashCount, setClickFlashCount] = useState(0);

    const handleCursorMove = useCallback((e: globalThis.MouseEvent) => {
        const wrapper = cursorWrapperRef.current;
        if (!wrapper) {
            return;
        }
        const rect = wrapper.getBoundingClientRect();
        setCursorContainerRect(rect);
        const point = {
            x: Math.round(e.clientX - rect.left),
            y: Math.round(e.clientY - rect.top),
        };
        setCursorPoint(point);
        reportCursorToPet(point, "sandbox");
    }, []);

    const handleCursorClick = useCallback(() => {
        setClickFlashCount((c) => c + 1);
    }, []);

    // Attach mouse event listeners to wrapper for cursor overlay positioning and pet tracking
    useEffect(() => {
        const wrapper = cursorWrapperRef.current;
        if (!wrapper) {
            return;
        }
        wrapper.addEventListener("mousemove", handleCursorMove, { passive: true });
        wrapper.addEventListener("click", handleCursorClick, { passive: true });
        return () => {
            wrapper.removeEventListener("mousemove", handleCursorMove);
            wrapper.removeEventListener("click", handleCursorClick);
        };
    }, [handleCursorMove, handleCursorClick]);

    const effectiveMode = mode === "background" ? "background" : "desktop";
    const sessionId = sandboxStatus.sessionId || model.blockId;
    const isRunning = sandboxStatus.status === "running";
    const isStarting = sandboxStatus.status === "starting";
    const isDesktopMode = effectiveMode === "desktop";
    const sandboxRuntime = getSandboxRuntime(sandboxStatus);
    const desktopUrl = getSandboxDesktopUrl(sandboxStatus);
    const mcpUrl = getSandboxMcpUrl(sandboxStatus);
    const previewDesktopUrl = desktopUrl || (isDesktopMode ? krontermDesktopDesktopUrl : "");
    const usesKrontermDesktopPreview =
        isDesktopMode && Boolean(previewDesktopUrl) && isKrontermDesktopUrl(previewDesktopUrl, sandboxRuntime);
    const krontermDesktopComputerUseUrl = usesKrontermDesktopPreview
        ? makeKrontermDesktopComputerUseUrl(previewDesktopUrl)
        : "";
    const rfbWsUrl = previewDesktopUrl ? "" : normalizeVncWsUrl(sandboxStatus.vncWsUrl);
    const usesEmbeddedRfb = isDesktopMode && !usesKrontermDesktopPreview && Boolean(rfbWsUrl);

    const refreshStatus = async () => {
        try {
            const response = await RpcApi.SandboxStatusCommand(TabRpcClient, { sessionId: model.blockId });
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode, browserUrl),
                ...response,
            });
        } catch (err) {
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode, browserUrl),
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
        const intervalId = window.setInterval(() => {
            void refreshStatus();
        }, pollIntervalMs);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [sandboxStatus.status, model.blockId, effectiveMode, browserUrl]);

    useEffect(() => {
        if (usesKrontermDesktopPreview) {
            if (rfbRef.current) {
                rfbRef.current.disconnect();
                rfbRef.current = null;
            }
            return;
        }

        if (!usesEmbeddedRfb && previewDesktopUrl) {
            if (rfbRef.current) {
                rfbRef.current.disconnect();
                rfbRef.current = null;
            }
            setDesktopStatus(isRunning ? "connected" : isStarting ? "connecting" : "disconnected");
            return;
        }

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
    }, [
        previewDesktopUrl,
        usesKrontermDesktopPreview,
        usesEmbeddedRfb,
        isDesktopMode,
        isRunning,
        isStarting,
        rfbWsUrl,
    ]);

    useEffect(() => {
        if (!usesKrontermDesktopPreview || !krontermDesktopComputerUseUrl) {
            setKrontermDesktopScreenshotUrl("");
            if (krontermDesktopObjectUrlRef.current) {
                URL.revokeObjectURL(krontermDesktopObjectUrlRef.current);
                krontermDesktopObjectUrlRef.current = "";
            }
            return;
        }

        let disposed = false;
        let timeoutId: number | null = null;
        let controller: AbortController | null = null;

        const loadScreenshot = async () => {
            controller = new AbortController();
            try {
                const response = await fetch(krontermDesktopComputerUseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "screenshot" }),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`Kronterm Desktop screenshot failed: ${response.status}`);
                }
                const data = (await response.json()) as KrontermDesktopScreenshotResponse;
                if (disposed || !data.image) {
                    return;
                }
                const imageBytes = base64ToArrayBuffer(data.image);
                const nextUrl = URL.createObjectURL(new Blob([imageBytes], { type: "image/png" }));
                if (disposed) {
                    URL.revokeObjectURL(nextUrl);
                    return;
                }
                const previousUrl = krontermDesktopObjectUrlRef.current;
                krontermDesktopObjectUrlRef.current = nextUrl;
                setKrontermDesktopScreenshotUrl(nextUrl);
                if (previousUrl) {
                    URL.revokeObjectURL(previousUrl);
                }
                setDesktopStatus("connected");
            } catch {
                if (!disposed) {
                    setDesktopStatus("error");
                }
            } finally {
                if (!disposed) {
                    timeoutId = window.setTimeout(loadScreenshot, krontermDesktopPreviewIntervalMs);
                }
            }
        };

        setDesktopStatus("connecting");
        void loadScreenshot();

        return () => {
            disposed = true;
            controller?.abort();
            if (timeoutId != null) {
                window.clearTimeout(timeoutId);
            }
            if (krontermDesktopObjectUrlRef.current) {
                URL.revokeObjectURL(krontermDesktopObjectUrlRef.current);
                krontermDesktopObjectUrlRef.current = "";
            }
        };
    }, [usesKrontermDesktopPreview, krontermDesktopComputerUseUrl]);

    const sendKrontermDesktopClick = async (event: MouseEvent<HTMLImageElement>) => {
        if (!usesKrontermDesktopPreview || !krontermDesktopComputerUseUrl || !krontermDesktopImageRef.current) {
            return;
        }
        const image = krontermDesktopImageRef.current;
        if (!image.naturalWidth || !image.naturalHeight) {
            return;
        }
        const rect = image.getBoundingClientRect();
        const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
        const renderedWidth = image.naturalWidth * scale;
        const renderedHeight = image.naturalHeight * scale;
        const offsetX = (rect.width - renderedWidth) / 2;
        const offsetY = (rect.height - renderedHeight) / 2;
        const x = Math.round((event.clientX - rect.left - offsetX) / scale);
        const y = Math.round((event.clientY - rect.top - offsetY) / scale);
        if (x < 0 || y < 0 || x > image.naturalWidth || y > image.naturalHeight) {
            return;
        }
        const blockRect = image.closest<HTMLElement>("div[data-blockid]")?.getBoundingClientRect();
        reportDesktopPetActivity(
            { kind: "tool", detail: "sandbox click" },
            model.blockId,
            blockRect
                ? {
                      x: Math.round(event.clientX - blockRect.left),
                      y: Math.round(event.clientY - blockRect.top),
                  }
                : undefined
        );
        try {
            await fetch(krontermDesktopComputerUseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "click_mouse",
                    button: "left",
                    clickCount: 1,
                    coordinates: { x, y },
                }),
            });
        } catch {
            setDesktopStatus("error");
        }
    };

    const setMode = async (nextMode: "desktop" | "background") => {
        setIsBusy(true);
        try {
            await model.setMode(nextMode);
            if (nextMode === "background") {
                await model.ensureBrowserBlock(browserUrl);
            }
            setSandboxStatus((prev) => ({
                ...prev,
                mode: nextMode,
            }));
        } finally {
            setIsBusy(false);
        }
    };

    const startSandbox = async () => {
        setIsBusy(true);
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
                ...makeEmptyStatus(model.blockId, effectiveMode, browserUrl),
                ...response,
            });
        } catch (err) {
            setSandboxStatus({
                ...makeEmptyStatus(model.blockId, effectiveMode, browserUrl),
                status: "error",
                mode: effectiveMode,
                error: String(err),
            });
        } finally {
            setIsBusy(false);
        }
    };

    useEffect(() => {
        if (autoStartRef.current || !isDesktopMode || sandboxStatus.status !== "stopped") {
            return;
        }
        autoStartRef.current = true;
        fireAndForget(startSandbox);
    }, [isDesktopMode, sandboxStatus.status]);

    const stopSandbox = async () => {
        setIsBusy(true);
        try {
            await RpcApi.SandboxStopCommand(TabRpcClient, { sessionId: model.blockId });
            setSandboxStatus(makeEmptyStatus(model.blockId, effectiveMode, browserUrl));
            setDesktopStatus("disconnected");
        } catch (err) {
            setSandboxStatus((prev) => ({
                ...prev,
                status: "error",
                error: String(err),
            }));
        } finally {
            setIsBusy(false);
        }
    };

    const openBrowser = async () => {
        setIsBusy(true);
        try {
            await model.ensureBrowserBlock(browserUrl);
        } finally {
            setIsBusy(false);
        }
    };

    const openExternalDesktop = () => {
        if (previewDesktopUrl) {
            model.env.electron.openExternal(previewDesktopUrl);
            return;
        }
        if (sandboxRuntime === "kronterm-desktop") {
            model.env.electron.openExternal(krontermDesktopDesktopUrl);
            return;
        }
        if (!sandboxStatus.vncPort) {
            return;
        }
        const vncUrl = `vnc://localhost:${sandboxStatus.vncPort}`;
        model.env.electron.openExternal(vncUrl);
    };

    const desktopStatusLabel =
        desktopStatus === "connected"
            ? "desktop connected"
            : desktopStatus === "connecting"
              ? "desktop connecting"
              : desktopStatus === "error"
                ? "desktop error"
                : "desktop idle";

    return (
        <div ref={cursorWrapperRef} className="h-full min-h-0 bg-black" style={{ position: "relative" }}>
            {isDesktopMode ? (
                usesKrontermDesktopPreview ? (
                    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black">
                        {krontermDesktopScreenshotUrl ? (
                            <img
                                ref={krontermDesktopImageRef}
                                src={krontermDesktopScreenshotUrl}
                                alt="Sandbox desktop"
                                className="block h-full w-full select-none"
                                style={{ objectFit: "contain" }}
                                draggable={false}
                                onClick={(event) => {
                                    void sendKrontermDesktopClick(event);
                                }}
                            />
                        ) : null}
                    </div>
                ) : usesEmbeddedRfb ? (
                    <div
                        ref={vncContainerRef}
                        className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black"
                    />
                ) : previewDesktopUrl ? (
                    <div className="h-full min-h-0 w-full overflow-hidden bg-black">
                        <iframe
                            key={`${sessionId}:${previewDesktopUrl}`}
                            name="sandbox-desktop"
                            className="block h-full min-h-full w-full border-0 bg-black"
                            src={previewDesktopUrl}
                            title="Sandbox desktop"
                            allow="clipboard-read; clipboard-write"
                        />
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
                active={true}
                triggerClickFlash={clickFlashCount}
            />
            <WaterFlowOverlay active={waterflowActive} />
            {markers.map((m) => (
                <ActionMarker
                    key={m.id}
                    actionType={m.actionType}
                    label={m.label}
                    x={m.x}
                    y={m.y}
                    active={true}
                />
            ))}
        </div>
    );
}
