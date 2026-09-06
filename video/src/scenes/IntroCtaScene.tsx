import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn } from "../theme";

export const IntroCtaScene: React.FC = () => {
    const frame = useCurrentFrame();
    const logoOpacity = fadeIn(frame, 60);
    const glow = interpolate(frame, [0, 80, 200], [0, 0.5, 0.35], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const captionOpacity = fadeIn(frame, 45, 70);
    const urlOpacity = fadeIn(frame, 45, 120);
    const fadeToBlack = interpolate(frame, [330, 375], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    width: 600,
                    height: 600,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${COLORS.accent}20, transparent 70%)`,
                    filter: "blur(70px)",
                    opacity: glow,
                    top: "24%",
                }}
            />
            <div
                style={{
                    opacity: logoOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: 44,
                }}
            >
                <Img
                    src={staticFile("kronterm-icon.svg")}
                    style={{
                        width: 170,
                        height: 170,
                        marginBottom: 28,
                        filter: `drop-shadow(0 0 ${glow * 40}px ${COLORS.accent})`,
                    }}
                />
                <div
                    style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 88,
                        fontWeight: 600,
                        color: COLORS.text,
                        letterSpacing: "-0.02em",
                        textShadow: `0 0 ${glow * 30}px ${COLORS.accent}66`,
                    }}
                >
                    KronTerm
                </div>
            </div>
            <div
                style={{
                    opacity: captionOpacity,
                    fontFamily: FONT_FAMILY,
                    fontSize: 48,
                    fontWeight: 500,
                    color: COLORS.text,
                    textAlign: "center",
                    marginBottom: 30,
                }}
            >
                One workspace. Every surface.
            </div>
            <div
                style={{
                    opacity: urlOpacity,
                    fontFamily: FONT_FAMILY,
                    fontSize: 38,
                    fontWeight: 430,
                    color: COLORS.accent,
                    letterSpacing: "0.05em",
                }}
            >
                kronterm.dev
            </div>
            <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeToBlack }} />
        </AbsoluteFill>
    );
};
