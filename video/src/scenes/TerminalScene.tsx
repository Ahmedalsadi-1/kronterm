import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, FONT_MONO, fadeIn, slideUp } from "../theme";

const TERMINAL_LINES = [
    "❯ cd kronterm",
    "❯ task dev",
    "  ✓ TypeScript compilation done",
    "  ✓ Go build complete",
    "  ✓ Electron ready on port 3000",
    "  KronTerm v0.14.3 running...",
];

export const TerminalScene: React.FC = () => {
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
            {/* Screen glow */}
            <div
                style={{
                    position: "absolute",
                    top: "10%",
                    left: "5%",
                    width: "90%",
                    height: "50%",
                    background: `radial-gradient(ellipse, ${COLORS.accentBlue}11, transparent 70%)`,
                    filter: "blur(50px)",
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
                A Terminal — <span style={{ color: COLORS.accent }}>Reimagined</span>
            </div>

            {/* Terminal window */}
            <div
                style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    background: COLORS.bg2,
                    overflow: "hidden",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
                }}
            >
                {/* Window toolbar */}
                <div
                    style={{
                        display: "flex",
                        height: 36,
                        alignItems: "center",
                        gap: 8,
                        padding: "0 14px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: COLORS.panel,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff6961" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffcc4d" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6dde7a" }} />
                    <span style={{ marginLeft: 12, fontSize: 11, color: COLORS.soft, fontFamily: FONT_FAMILY }}>
                        kronterm — bash — 80×24
                    </span>
                </div>

                {/* Terminal lines */}
                <div
                    style={{
                        padding: "20px 18px",
                        fontFamily: FONT_MONO,
                        fontSize: 13,
                        lineHeight: 1.8,
                        color: COLORS.muted,
                    }}
                >
                    {TERMINAL_LINES.map((line, i) => {
                        const lineDelay = 20 + i * 18;
                        const lineOpacity = interpolate(frame, [lineDelay, lineDelay + 12], [0, 1], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        });
                        const isPrompt = line.startsWith("❯");
                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: lineOpacity,
                                    color: isPrompt ? COLORS.accent : line.includes("✓") ? "#6dde7a" : COLORS.muted,
                                    transform: `translateX(${interpolate(frame, [lineDelay, lineDelay + 12], [-10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                                }}
                            >
                                {line}
                            </div>
                        );
                    })}

                    {/* Blinking cursor */}
                    <div
                        style={{
                            opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0,
                            color: COLORS.accent,
                        }}
                    >
                        ❯ _
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};
