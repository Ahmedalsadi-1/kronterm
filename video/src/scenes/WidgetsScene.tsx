import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, slideUp } from "../theme";

const WIDGETS = [
    { name: "Terminal", color: COLORS.accent, icon: ">" },
    { name: "Browser", color: COLORS.accentBlue, icon: "🌐" },
    { name: "Preview", color: "#c792ea", icon: "👁" },
    { name: "AI Chat", color: "#ffcb6b", icon: "◆" },
    { name: "Canvas", color: "#ff6d9a", icon: "⊞" },
    { name: "Sandbox", color: "#6dde7a", icon: "⬡" },
];

export const WidgetsScene: React.FC = () => {
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
                    top: "20%",
                    left: "10%",
                    width: "80%",
                    height: "40%",
                    background: `radial-gradient(ellipse, ${COLORS.accentBlue}15, transparent 70%)`,
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
                    marginBottom: 48,
                    textAlign: "center",
                }}
            >
                Extensible by <span style={{ color: COLORS.accent }}>Design</span>
            </div>

            {/* Widget cards grid */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 16,
                    maxWidth: 800,
                    margin: "0 auto",
                }}
            >
                {WIDGETS.map((w, i) => {
                    const cardDelay = 20 + i * 12;
                    const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 15], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                    });
                    const cardScale = interpolate(frame, [cardDelay, cardDelay + 15], [0.85, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                    });
                    const cardY = interpolate(frame, [cardDelay, cardDelay + 15], [30, 0], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                    });

                    return (
                        <div
                            key={w.name}
                            style={{
                                width: 220,
                                height: 160,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 10,
                                background: COLORS.panel,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 12,
                                opacity: cardOpacity,
                                transform: `translateY(${cardY}px) scale(${cardScale})`,
                                backdropFilter: "blur(8px)",
                                boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
                            }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: w.color + "18",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 22,
                                    color: w.color,
                                }}
                            >
                                {w.icon}
                            </div>
                            <div
                                style={{
                                    fontFamily: FONT_FAMILY,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    color: COLORS.text,
                                }}
                            >
                                {w.name}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom caption */}
            <div
                style={{
                    marginTop: 36,
                    fontFamily: FONT_FAMILY,
                    fontSize: 16,
                    color: COLORS.soft,
                    textAlign: "center",
                    opacity: fadeIn(frame, 20, 60),
                }}
            >
                Mix and match blocks for your workflow
            </div>
        </AbsoluteFill>
    );
};
