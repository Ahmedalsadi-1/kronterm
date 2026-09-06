import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, FONT_MONO, fadeIn } from "../theme";

const TERMINAL_LINES = ["❯ kronterm", "  ✓ workspace restored", "  ✓ agent runtime healthy"];

export const IntroSurfacesScene: React.FC = () => {
    const frame = useCurrentFrame();
    const terminalOpacity = fadeIn(frame, 55);
    const browserDelay = 90;
    const browserOpacity = fadeIn(frame, 55, browserDelay);
    const captionOpacity = fadeIn(frame, 45, 200);
    const urlPillGlow = interpolate(frame, [browserDelay + 40, browserDelay + 80], [0.25, 0.6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: "0 70px" }}>
            <div
                style={{
                    position: "absolute",
                    top: "8%",
                    left: "10%",
                    width: "80%",
                    height: "40%",
                    background: `radial-gradient(ellipse, ${COLORS.accentBlue}11, transparent 70%)`,
                    filter: "blur(60px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    top: 380,
                    left: 70,
                    right: 70,
                    opacity: terminalOpacity,
                }}
            >
                <div
                    style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 12,
                        background: COLORS.bg2,
                        overflow: "hidden",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            height: 38,
                            padding: "0 16px",
                            borderBottom: `1px solid ${COLORS.border}`,
                            background: COLORS.panel,
                        }}
                    >
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff6961" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffcc4d" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6dde7a" }} />
                        <span style={{ marginLeft: 12, fontSize: 24, color: COLORS.soft, fontFamily: FONT_MONO }}>
                            zsh — kronterm
                        </span>
                    </div>
                    <div
                        style={{
                            padding: "22px 22px",
                            fontFamily: FONT_MONO,
                            fontSize: 26,
                            lineHeight: 1.75,
                            color: COLORS.muted,
                            minHeight: 190,
                        }}
                    >
                        {TERMINAL_LINES.map((line, i) => {
                            const lineDelay = 25 + i * 32;
                            const lineOpacity = fadeIn(frame, 14, lineDelay);
                            const isPrompt = line.startsWith("❯");
                            return (
                                <div
                                    key={i}
                                    style={{
                                        opacity: lineOpacity,
                                        color: isPrompt ? COLORS.accent : line.includes("✓") ? "#6dde7a" : COLORS.muted,
                                    }}
                                >
                                    {line}
                                </div>
                            );
                        })}
                        <div
                            style={{
                                marginTop: 4,
                                opacity: Math.sin(frame * 0.09) > -0.2 ? 1 : 0,
                                color: COLORS.accent,
                            }}
                        >
                            ❯ _
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    position: "absolute",
                    top: 850,
                    left: 70,
                    right: 70,
                    opacity: browserOpacity,
                }}
            >
                <div
                    style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 12,
                        background: COLORS.bg2,
                        overflow: "hidden",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                        height: 420,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            height: 52,
                            padding: "0 16px",
                            gap: 12,
                            borderBottom: `1px solid ${COLORS.border}`,
                            background: COLORS.panel,
                        }}
                    >
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff6961" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffcc4d" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6dde7a" }} />
                        <div
                            style={{
                                flex: 1,
                                height: 32,
                                marginLeft: 10,
                                borderRadius: 16,
                                background: COLORS.bg,
                                border: `1px solid ${COLORS.accent}${Math.round(urlPillGlow * 255)
                                    .toString(16)
                                    .padStart(2, "0")}`,
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: 14,
                                fontFamily: FONT_MONO,
                                fontSize: 22,
                                color: COLORS.soft,
                            }}
                        >
                            kronterm.dev
                        </div>
                    </div>
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                        {[520, 380].map((width, i) => {
                            const barDelay = browserDelay + 30 + i * 22;
                            return (
                                <div
                                    key={width}
                                    style={{
                                        width: `${(width / 940) * 100}%`,
                                        height: 22,
                                        borderRadius: 8,
                                        background: COLORS.panelStrong,
                                        opacity: fadeIn(frame, 30, barDelay),
                                    }}
                                />
                            );
                        })}
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                marginTop: 10,
                                opacity: fadeIn(frame, 40, browserDelay + 80),
                            }}
                        >
                            {[0, 1].map((col) => (
                                <div
                                    key={col}
                                    style={{
                                        flex: 1,
                                        height: 170,
                                        borderRadius: 12,
                                        border: `1px solid ${COLORS.border}`,
                                        background: COLORS.panel,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    position: "absolute",
                    top: 1450,
                    left: 90,
                    right: 90,
                    textAlign: "center",
                    opacity: captionOpacity,
                    fontFamily: FONT_FAMILY,
                    fontSize: 46,
                    fontWeight: 500,
                    color: COLORS.text,
                    lineHeight: 1.35,
                }}
            >
                Real terminal. Real browser.{" "}
                <span style={{ color: COLORS.accentBlue }}>Side by side.</span>
            </div>
        </AbsoluteFill>
    );
};
