import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, slideUp } from "../theme";

const LAYOUT_PREVIEW = [
    { name: "Terminal", x: 0, y: 0, w: 50, h: 50, color: COLORS.accent },
    { name: "Browser", x: 50, y: 0, w: 50, h: 50, color: COLORS.accentBlue },
    { name: "AI Chat", x: 0, y: 50, w: 35, h: 50, color: "#c792ea" },
    { name: "Output", x: 35, y: 50, w: 65, h: 50, color: "#6dde7a" },
];

export const CanvasScene: React.FC = () => {
    const frame = useCurrentFrame();
    const opacity = fadeIn(frame, 25);
    const titleOpacity = fadeIn(frame, 20, 10);
    const titleY = slideUp(frame, 10);

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                opacity,
                padding: 60,
                justifyContent: "center",
            }}
        >
            {/* Glow */}
            <div
                style={{
                    position: "absolute",
                    top: "10%",
                    left: "5%",
                    width: "90%",
                    height: "50%",
                    background: `radial-gradient(ellipse, #a795ff18, transparent 70%)`,
                    filter: "blur(60px)",
                }}
            />

            {/* Title */}
            <div
                style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 32,
                    fontWeight: 430,
                    color: COLORS.text,
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px)`,
                    marginBottom: 40,
                    textAlign: "center",
                }}
            >
                Your Workspace, <span style={{ color: "#a795ff" }}>Your Rules</span>
            </div>

            {/* Split layout preview */}
            <div
                style={{
                    width: 700,
                    height: 500,
                    margin: "0 auto",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    background: COLORS.bg2,
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
                }}
            >
                {/* Layout title bar */}
                <div
                    style={{
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: COLORS.panel,
                        fontFamily: FONT_FAMILY,
                        fontSize: 11,
                        color: COLORS.soft,
                    }}
                >
                    Canvas · Split Layout
                </div>

                {/* Grid panes */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "calc(100% - 32px)",
                    }}
                >
                    {LAYOUT_PREVIEW.map((pane, i) => {
                        const paneDelay = 30 + i * 15;
                        const paneOpacity = interpolate(frame, [paneDelay, paneDelay + 12], [0, 1], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        });
                        const paneScale = interpolate(frame, [paneDelay, paneDelay + 12], [0.92, 1], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        });

                        return (
                            <div
                                key={pane.name}
                                style={{
                                    position: "absolute",
                                    left: `${pane.x}%`,
                                    top: `${pane.y}%`,
                                    width: `${pane.w}%`,
                                    height: `${pane.h}%`,
                                    padding: 6,
                                    opacity: paneOpacity,
                                    transform: `scale(${paneScale})`,
                                }}
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        border: `1px solid ${pane.color}33`,
                                        borderRadius: 6,
                                        background: pane.color + "0a",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontFamily: FONT_FAMILY,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: pane.color,
                                    }}
                                >
                                    {pane.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom caption */}
            <div
                style={{
                    marginTop: 32,
                    fontFamily: FONT_FAMILY,
                    fontSize: 16,
                    color: COLORS.soft,
                    textAlign: "center",
                    opacity: fadeIn(frame, 20, 60),
                }}
            >
                Drag, resize, arrange — it's your terminal
            </div>
        </AbsoluteFill>
    );
};
