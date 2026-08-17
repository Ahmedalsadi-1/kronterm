import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, FONT_MONO, fadeIn } from "../theme";

export const CTAScene: React.FC = () => {
    const frame = useCurrentFrame();
    const opacity = fadeIn(frame, 20);
    const logoGlow = interpolate(frame, [0, 20, 40], [0, 0.3, 0.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    // Install command typing
    const INSTALL_CMD = "brew install kronterm";
    const charsToShow = Math.min(Math.floor((frame - 25) / 4), INSTALL_CMD.length);
    const cmdOpacity = fadeIn(frame, 15, 25);

    const ctaOpacity = fadeIn(frame, 25, 55);
    const ctaScale = interpolate(frame, [55, 75], [0.9, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                opacity,
                justifyContent: "center",
                alignItems: "center",
                padding: 60,
            }}
        >
            {/* Background glow */}
            <div
                style={{
                    position: "absolute",
                    width: 600,
                    height: 600,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${COLORS.accent}22, transparent 70%)`,
                    filter: "blur(80px)",
                    top: "25%",
                }}
            />

            {/* Logo */}
            <Img
                src={staticFile("kronterm-logo.svg")}
                style={{
                    width: 260,
                    height: "auto",
                    marginBottom: 32,
                    filter: `drop-shadow(0 0 ${logoGlow * 50}px ${COLORS.accent})`,
                    opacity: fadeIn(frame, 20, 5),
                }}
            />

            {/* Install command */}
            <div
                style={{
                    fontFamily: FONT_MONO,
                    fontSize: 20,
                    color: COLORS.accent,
                    background: COLORS.panelStrong,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: "14px 24px",
                    marginBottom: 40,
                    opacity: cmdOpacity,
                    minWidth: 380,
                    textAlign: "center",
                }}
            >
                <span>{INSTALL_CMD.slice(0, charsToShow)}</span>
                <span
                    style={{
                        opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0,
                        color: COLORS.accent,
                    }}
                >
                    _
                </span>
            </div>

            {/* CTA Button */}
            <div
                style={{
                    opacity: ctaOpacity,
                    transform: `scale(${ctaScale})`,
                    fontFamily: FONT_FAMILY,
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#081007",
                    background: `linear-gradient(180deg, #d9ff93, #9ce750)`,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    padding: "16px 48px",
                    boxShadow: `0 0 40px ${COLORS.accent}44`,
                    cursor: "pointer",
                }}
            >
                Get KronTerm →
            </div>

            {/* Footer links */}
            <div
                style={{
                    position: "absolute",
                    bottom: 80,
                    fontFamily: FONT_FAMILY,
                    fontSize: 14,
                    color: COLORS.soft,
                    textAlign: "center",
                    opacity: fadeIn(frame, 20, 80),
                    lineHeight: 1.6,
                }}
            >
                kronterm.dev · GitHub · Discord
            </div>
        </AbsoluteFill>
    );
};
