import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getWSServerEndpoint } from "@/util/endpoints";
import { base64ToArrayBuffer, fireAndForget } from "@/util/util";
import RFB from "@novnc/novnc";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { SandboxViewModel } from "./sandbox-model";

type SandboxDesktopStatus = "disconnected" | "connecting" | "connected" | "error";

const pollIntervalMs = 1500;

type SandboxStatusWithRuntime = SandboxStatusResponse & {
    runtime?: string;
    desktopUrl?: string;
    mcpUrl?: string;
};

type BytebotScreenshotResponse = {
    image?: string;
};

const bytebotDesktopUrl = "http://localhost:9990/novnc/vnc_lite.html?scale=true";
const bytebotPreviewIntervalMs = 1000;

function makeBytebotComputerUseUrl(desktopUrl: string): string {
    try {
        const url = new URL(desktopUrl || bytebotDesktopUrl);
        return `${url.protocol}//${url.host}/computer-use`;
    } catch {
        return "http://localhost:9990/computer-use";
    }
}

function isBytebotDesktopUrl(desktopUrl: string, runtime: string): boolean {
    if (runtime === "bytebot") {
        return true;
    }
    try {
        const url = new URL(desktopUrl || bytebotDesktopUrl);
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
    const bytebotImageRef = useRef<HTMLImageElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const autoStartRef = useRef(false);
    const bytebotObjectUrlRef = useRef("");
    const [bytebotScreenshotUrl, setBytebotScreenshotUrl] = useState("");

    const effectiveMode = mode === "background" ? "background" : "desktop";
    const sessionId = sandboxStatus.sessionId || model.blockId;
    const isRunning = sandboxStatus.status === "running";
    const isStarting = sandboxStatus.status === "starting";
    const isDesktopMode = effectiveMode === "desktop";
    const sandboxRuntime = getSandboxRuntime(sandboxStatus);
    const desktopUrl = getSandboxDesktopUrl(sandboxStatus);
    const mcpUrl = getSandboxMcpUrl(sandboxStatus);
    const previewDesktopUrl = desktopUrl || (isDesktopMode ? bytebotDesktopUrl : "");
    const usesBytebotPreview =
        isDesktopMode && Boolean(previewDesktopUrl) && isBytebotDesktopUrl(previewDesktopUrl, sandboxRuntime);
    const bytebotComputerUseUrl = usesBytebotPreview ? makeBytebotComputerUseUrl(previewDesktopUrl) : "";
    const rfbWsUrl = previewDesktopUrl ? "" : normalizeVncWsUrl(sandboxStatus.vncWsUrl);
    const usesEmbeddedRfb = isDesktopMode && !usesBytebotPreview && Boolean(rfbWsUrl);

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
        if (usesBytebotPreview) {
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
        usesBytebotPreview,
        usesEmbeddedRfb,
        isDesktopMode,
        isRunning,
        isStarting,
        rfbWsUrl,
    ]);

    useEffect(() => {
        if (!usesBytebotPreview || !bytebotComputerUseUrl) {
            setBytebotScreenshotUrl("");
            if (bytebotObjectUrlRef.current) {
                URL.revokeObjectURL(bytebotObjectUrlRef.current);
                bytebotObjectUrlRef.current = "";
            }
            return;
        }

        let disposed = false;
        let timeoutId: number | null = null;
        let controller: AbortController | null = null;

        const loadScreenshot = async () => {
            controller = new AbortController();
            try {
                const response = await fetch(bytebotComputerUseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "screenshot" }),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`Bytebot screenshot failed: ${response.status}`);
                }
                const data = (await response.json()) as BytebotScreenshotResponse;
                if (disposed || !data.image) {
                    return;
                }
                const imageBytes = base64ToArrayBuffer(data.image);
                const nextUrl = URL.createObjectURL(new Blob([imageBytes], { type: "image/png" }));
                if (disposed) {
                    URL.revokeObjectURL(nextUrl);
                    return;
                }
                const previousUrl = bytebotObjectUrlRef.current;
                bytebotObjectUrlRef.current = nextUrl;
                setBytebotScreenshotUrl(nextUrl);
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
                    timeoutId = window.setTimeout(loadScreenshot, bytebotPreviewIntervalMs);
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
            if (bytebotObjectUrlRef.current) {
                URL.revokeObjectURL(bytebotObjectUrlRef.current);
                bytebotObjectUrlRef.current = "";
            }
        };
    }, [usesBytebotPreview, bytebotComputerUseUrl]);

    const sendBytebotClick = async (event: MouseEvent<HTMLImageElement>) => {
        if (!usesBytebotPreview || !bytebotComputerUseUrl || !bytebotImageRef.current) {
            return;
        }
        const image = bytebotImageRef.current;
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
        try {
            await fetch(bytebotComputerUseUrl, {
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
        if (sandboxRuntime === "bytebot") {
            model.env.electron.openExternal(bytebotDesktopUrl);
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
        <div className="h-full min-h-0 bg-black">
            {isDesktopMode ? (
                usesBytebotPreview ? (
                    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black">
                        {bytebotScreenshotUrl ? (
                            <img
                                ref={bytebotImageRef}
                                src={bytebotScreenshotUrl}
                                alt="Sandbox desktop"
                                className="block h-full w-full select-none"
                                style={{ objectFit: "contain" }}
                                draggable={false}
                                onClick={(event) => {
                                    void sendBytebotClick(event);
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
        </div>
    );
}
