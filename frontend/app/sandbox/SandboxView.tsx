import RFB from "@novnc/novnc";
import React, { useEffect, useRef, useState } from "react";

export const SandboxView: React.FC = () => {
    const vncContainerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");

    useEffect(() => {
        if (!vncContainerRef.current) return;

        const url = "ws://localhost:5902"; // WebSocket proxy port from SandboxManager

        try {
            setStatus("connecting");
            const rfb = new RFB(vncContainerRef.current, url, {
                shared: true,
                credentials: { password: "password" }, // Default password
            });

            rfb.addEventListener("connect", () => {
                setStatus("connected");
                // Auto-scale
                rfb.scaleViewport = true;
                rfb.resizeSession = true;
            });

            rfb.addEventListener("disconnect", () => {
                setStatus("disconnected");
            });

            rfb.addEventListener("securityfailure", () => {
                setStatus("error");
            });

            rfbRef.current = rfb;
        } catch (error) {
            console.error("VNC Error:", error);
            setStatus("error");
        }

        return () => {
            if (rfbRef.current) {
                rfbRef.current.disconnect();
                rfbRef.current = null;
            }
        };
    }, []);

    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-white p-4 font-sans">
            <div className="flex items-center justify-between mb-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-lg">
                <h2 className="text-lg font-semibold tracking-wide text-gray-200">
                    Local Sandbox <span className="text-xs font-mono text-gray-500 ml-2">Ubuntu 24.04 (QEMU)</span>
                </h2>
                <div className="flex items-center space-x-2">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            status === "connected"
                                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                : status === "connecting"
                                  ? "bg-yellow-500 animate-pulse"
                                  : "bg-red-500"
                        }`}
                    ></span>
                    <span className="text-xs uppercase tracking-wider text-gray-400">{status}</span>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
                {status !== "connected" && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 backdrop-blur-sm">
                        <div className="text-gray-400 text-sm">
                            {status === "connecting" ? "Connecting to Sandbox..." : "Sandbox Disconnected"}
                        </div>
                    </div>
                )}
                <div
                    ref={vncContainerRef}
                    className="w-full h-full cursor-none" // Hide default cursor, let VNC handle it
                    style={{ minHeight: "600px" }}
                />
            </div>

            <div className="mt-4 flex gap-3 text-xs text-gray-400 font-mono">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Host: localhost</div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">VNC: :5901</div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">SSH: :2222</div>
            </div>
        </div>
    );
};
