import { AppStreamViewModel } from "./appstream-model";
import { reportDesktopPetActivity } from "@/app/aipanel/desktop-pet-activity";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useCallback, useState } from "react";

type StreamFitMode = "fit" | "fill" | "actual";

export function AppStreamView({ model }: ViewComponentProps<AppStreamViewModel>) {
    const status = useAtomValue(model.statusAtom);
    const streamUrl = useAtomValue(model.streamUrlAtom);
    const error = useAtomValue(model.errorAtom);
    const appName = useAtomValue(model.appNameAtom);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cursorPosRef = useRef({ x: -1, y: -1 });
    const streamingRef = useRef(false);
    const [fitMode, setFitMode] = useState<StreamFitMode>("fit");
    const [fps, setFps] = useState(6);
    const [quality, setQuality] = useState(80);
    const [frameInfo, setFrameInfo] = useState<{ width: number; height: number; updatedAt: number } | null>(null);

    useEffect(() => {
        model.startStream().catch(console.error);
        return () => {
            model.dispose();
        };
    }, [model]);

    useEffect(() => {
        if (!streamUrl || status !== "streaming") {
            streamingRef.current = false;
            return;
        }

        streamingRef.current = true;
        let disposed = false;

        const pollFrame = async () => {
            if (!streamingRef.current || disposed) return;
            try {
                const response = await fetch(`${streamUrl}/screenshot?quality=${quality}`);
                if (!response.ok) throw new Error("HTTP " + response.status);
                const data = await response.json();
                if (disposed || !data.image) return;

                const img = new Image();
                img.onload = () => {
                    if (disposed) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    setFrameInfo({ width: img.naturalWidth, height: img.naturalHeight, updatedAt: Date.now() });

                    const cursor = cursorPosRef.current;
                    if (cursor.x >= 0 && cursor.y >= 0) {
                        ctx.beginPath();
                        ctx.moveTo(cursor.x, cursor.y);
                        ctx.lineTo(cursor.x + 12, cursor.y + 12);
                        ctx.moveTo(cursor.x, cursor.y);
                        ctx.lineTo(cursor.x - 3, cursor.y + 18);
                        ctx.moveTo(cursor.x, cursor.y);
                        ctx.lineTo(cursor.x + 16, cursor.y + 5);
                        ctx.closePath();
                        ctx.fillStyle = "white";
                        ctx.fill();
                        ctx.strokeStyle = "black";
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }

                    if (!disposed) {
                        setTimeout(pollFrame, Math.max(80, Math.round(1000 / fps)));
                    }
                };
                img.src = "data:image/png;base64," + data.image;
            } catch {
                if (!disposed) {
                    setTimeout(pollFrame, Math.max(150, Math.round(1000 / fps)));
                }
            }
        };

        void pollFrame();

        return () => {
            disposed = true;
            streamingRef.current = false;
        };
    }, [streamUrl, status, fps, quality]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        cursorPosRef.current = { x, y };
        reportDesktopPetActivity(
            { kind: "tool", detail: "desktop app click" },
            model.blockId,
            { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) }
        );
        void model.sendClick(x, y);
    }, [model]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        cursorPosRef.current = {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY),
        };
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        reportDesktopPetActivity(
            { kind: "tool", detail: "desktop app right click" },
            model.blockId,
            { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) }
        );
        void model.sendClick(x, y, "right");
    }, [model]);

    if (status === "starting") {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black text-zinc-400 text-sm">
                <div className="w-[320px] rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-zinc-200">
                        <i className="fa-solid fa-spinner fa-spin text-accent" />
                        Starting {appName}...
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent/60" />
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">Connecting to native app stream</div>
                </div>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black text-red-400 text-sm">
                {error || "Failed to start stream"}
            </div>
        );
    }

    if (status === "idle") {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black text-zinc-500 text-sm">
                App stream closed
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full flex-col bg-black overflow-hidden">
            <div className="flex h-9 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-2 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 text-zinc-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
                        {appName}
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span>{frameInfo ? `${frameInfo.width}x${frameInfo.height}` : "waiting for frame"}</span>
                    <span>{fps} fps</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {(["fit", "fill", "actual"] as StreamFitMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setFitMode(mode)}
                            className={cn(
                                "rounded-md border px-2 py-1 uppercase tracking-wide cursor-pointer",
                                fitMode === mode
                                    ? "border-accent/50 bg-accent/20 text-accent"
                                    : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-100"
                            )}
                        >
                            {mode === "actual" ? "100%" : mode}
                        </button>
                    ))}
                    <label className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1">
                        FPS
                        <select
                            value={fps}
                            onChange={(e) => setFps(Number(e.target.value))}
                            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
                        >
                            {[3, 6, 10, 15].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1">
                        Q
                        <select
                            value={quality}
                            onChange={(e) => setQuality(Number(e.target.value))}
                            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
                        >
                            {[60, 80, 95].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.055),transparent_60%)]">
                <canvas
                    ref={canvasRef}
                    className={cn(
                        "block cursor-crosshair rounded-sm shadow-2xl shadow-black/60",
                        fitMode === "fit" && "max-h-full max-w-full object-contain",
                        fitMode === "fill" && "h-full w-full object-cover",
                        fitMode === "actual" && "max-w-none max-h-none"
                    )}
                    onClick={handleClick}
                    onMouseMove={handleMouseMove}
                    onContextMenu={handleContextMenu}
                />
            </div>
        </div>
    );
}
