import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn } from "../theme";

export const HookScene: React.FC = () => {
    const frame = useCurrentFrame();
    const opacity = fadeIn(frame, 40);
    const glow = interpolate(frame, [0, 30, 60, 90], [0, 0.4, 0.6, 0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const subtitleOpacity = fadeIn(frame, 30, 50);
    const subtitleY = interpolate(frame, [50, 80], [30, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                justifyContent: "center",
                alignItems: "center",
                opacity,
            }}
        >
            {/* Ambient glow */}
            <div
                style={{
                    position: "absolute",
                    width: 500,
                    height: 500,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${COLORS.accent}22, transparent 70%)`,
                    filter: "blur(60px)",
                    opacity: glow,
                    top: "25%",
                }}
            />

            {/* Logo */}
            <div style={{ marginBottom: 40 }}>
                <Img
                    src={staticFile("kronterm-logo.svg")}
                    style={{
                        width: 320,
                        height: "auto",
                        filter: `drop-shadow(0 0 ${glow * 40}px ${COLORS.accent})`,
                    }}
                />
            </div>

            {/* Tagline */}
            <div
                style={{
                    opacity: subtitleOpacity,
                    transform: `translateY(${subtitleY}px)`,
                    fontFamily: FONT_FAMILY,
                    fontSize: 28,
                    fontWeight: 430,
                    color: COLORS.muted,
                    letterSpacing: "0.04em",
                    textAlign: "center",
                    maxWidth: 600,
                    lineHeight: 1.4,
                }}
            >
                A Terminal That Can Be an OS
            </div>

            {/* Bottom indicator */}
            <div
                style={{
                    position: "absolute",
                    bottom: 80,
                    width: 40,
                    height: 3,
                    borderRadius: 2,
                    background: COLORS.accent,
                    opacity: fadeIn(frame, 20, 100),
                }}
            />
        </AbsoluteFill>
    );
};
