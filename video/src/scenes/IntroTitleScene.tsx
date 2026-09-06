import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn } from "../theme";
import { easeOutClamped } from "./IntroParts";

export const IntroTitleScene: React.FC = () => {
    const frame = useCurrentFrame();
    const logoOpacity = fadeIn(frame, 70);
    const logoScale = easeOutClamped(frame, [0, 80], [0.94, 1]);
    const glow = interpolate(frame, [0, 60, 150, 240], [0, 0.35, 0.55, 0.4], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const taglineOpacity = fadeIn(frame, 50, 65);
    const taglineY = easeOutClamped(frame, [65, 115], [24, 0]);
    const lineScale = easeOutClamped(frame, [100, 170], [0, 1]);

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
                    width: 620,
                    height: 620,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${COLORS.accent}22, transparent 70%)`,
                    filter: "blur(70px)",
                    opacity: glow,
                    top: "22%",
                }}
            />
            <div
                style={{
                    opacity: logoOpacity,
                    transform: `scale(${logoScale})`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: 36,
                }}
            >
                <Img
                    src={staticFile("kronterm-icon.svg")}
                    style={{
                        width: 190,
                        height: 190,
                        marginBottom: 30,
                        filter: `drop-shadow(0 0 ${glow * 44}px ${COLORS.accent})`,
                    }}
                />
                <div
                    style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 96,
                        fontWeight: 600,
                        color: COLORS.text,
                        letterSpacing: "-0.02em",
                        textShadow: `0 0 ${glow * 34}px ${COLORS.accent}66`,
                    }}
                >
                    KronTerm
                </div>
            </div>
            <div
                style={{
                    width: 300,
                    height: 2,
                    borderRadius: 1,
                    background: COLORS.accent,
                    transform: `scaleX(${lineScale})`,
                    marginBottom: 34,
                }}
            />
            <div
                style={{
                    opacity: taglineOpacity,
                    transform: `translateY(${taglineY}px)`,
                    fontFamily: FONT_FAMILY,
                    fontSize: 40,
                    fontWeight: 430,
                    color: COLORS.muted,
                    letterSpacing: "0.03em",
                    textAlign: "center",
                    maxWidth: 780,
                    lineHeight: 1.35,
                }}
            >
                The developer workspace, unified.
            </div>
        </AbsoluteFill>
    );
};
