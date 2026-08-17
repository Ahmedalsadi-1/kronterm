import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, FONT_MONO, fadeIn, slideUp } from "../theme";

const CODE_SNIPPET = `function deploy() {
  const app = new KronTerm();
  await app.terminal.run("task dev");
  app.widgets.add(browser, preview);
  return app.canvas.layout();
}`;

export const KronosCodeScene: React.FC = () => {
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
                    top: "15%",
                    right: "10%",
                    width: 400,
                    height: 400,
                    background: `radial-gradient(circle, ${COLORS.accent}18, transparent 70%)`,
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
                    marginBottom: 32,
                    textAlign: "center",
                }}
            >
                AI That <span style={{ color: COLORS.accent }}>Codes</span> With You
            </div>

            {/* Code editor panel */}
            <div
                style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    background: COLORS.bg2,
                    overflow: "hidden",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
                }}
            >
                {/* Toolbar */}
                <div
                    style={{
                        display: "flex",
                        height: 36,
                        alignItems: "center",
                        gap: 10,
                        padding: "0 14px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: COLORS.panel,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff6961" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffcc4d" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6dde7a" }} />
                    <span style={{ marginLeft: 12, fontSize: 11, color: COLORS.soft, fontFamily: FONT_FAMILY }}>
                        KronosCode — deploy.ts
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: COLORS.accent + "22",
                            color: COLORS.accent,
                            fontFamily: FONT_FAMILY,
                            fontWeight: 600,
                        }}
                    >
                        AGENT
                    </span>
                </div>

                {/* Code */}
                <div
                    style={{
                        padding: "20px 18px",
                        fontFamily: FONT_MONO,
                        fontSize: 13,
                        lineHeight: 1.9,
                    }}
                >
                    {CODE_SNIPPET.split("\n").map((line, i) => {
                        const lineDelay = 20 + i * 12;
                        const lineOpacity = interpolate(frame, [lineDelay, lineDelay + 10], [0, 1], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        });
                        // Simple syntax coloring
                        let color: string = COLORS.muted;
                        if (line.includes("function") || line.includes("return")) color = COLORS.accentBlue;
                        else if (line.includes("const") || line.includes("new")) color = "#c792ea";
                        else if (line.includes("await")) color = COLORS.accent;
                        else if (line.includes(".")) color = "#ffcb6b";

                        return (
                            <div
                                key={i}
                                style={{
                                    opacity: lineOpacity,
                                    color,
                                    whiteSpace: "pre",
                                    transform: `translateX(${interpolate(frame, [lineDelay, lineDelay + 10], [-8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                                }}
                            >
                                {line}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom caption */}
            <div
                style={{
                    marginTop: 28,
                    fontFamily: FONT_FAMILY,
                    fontSize: 16,
                    color: COLORS.soft,
                    textAlign: "center",
                    opacity: fadeIn(frame, 20, 60),
                }}
            >
                KronosCode — your AI engineering agent
            </div>
        </AbsoluteFill>
    );
};
