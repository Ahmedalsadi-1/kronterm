import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, slideUp } from "../theme";

const VALUES = [
    {
        text: "Keyboard-first by design",
        delay: 55,
        icon: (
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="6" y="18" width="52" height="28" rx="6" stroke={COLORS.accent} strokeWidth="3" />
                {[16, 26, 36, 46].map((x) => (
                    <rect key={x} x={x - 3} y="26" width="7" height="7" rx="1.5" fill={COLORS.accent} />
                ))}
                <rect x="24" y="37" width="16" height="4" rx="2" fill={COLORS.accent} opacity="0.6" />
            </svg>
        ),
    },
    {
        text: "Local-first & private",
        delay: 150,
        icon: (
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <path
                    d="M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z"
                    stroke={COLORS.accent}
                    strokeWidth="3"
                    fill="none"
                />
                <path d="M23 32 L29 38 L41 25" stroke="#6dde7a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </svg>
        ),
    },
    {
        text: "Built for deep work",
        delay: 245,
        icon: (
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="20" stroke={COLORS.accent} strokeWidth="3" />
                <circle cx="32" cy="32" r="11" fill={`${COLORS.accent}44`} />
                <line x1="32" y1="6" x2="32" y2="14" stroke={COLORS.accent} strokeWidth="3" strokeLinecap="round" />
                <line x1="32" y1="50" x2="32" y2="58" stroke={COLORS.accent} strokeWidth="3" strokeLinecap="round" />
                <line x1="6" y1="32" x2="14" y2="32" stroke={COLORS.accent} strokeWidth="3" strokeLinecap="round" />
                <line x1="50" y1="32" x2="58" y2="32" stroke={COLORS.accent} strokeWidth="3" strokeLinecap="round" />
            </svg>
        ),
    },
];

export const IntroValuesScene: React.FC = () => {
    const frame = useCurrentFrame();

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
                    display: "flex",
                    flexDirection: "column",
                    gap: 72,
                    alignItems: "center",
                }}
            >
                {VALUES.map((value) => {
                    const rowOpacity = fadeIn(frame, 55, value.delay);
                    const rowX = slideUp(frame, value.delay, 55);
                    return (
                        <div
                            key={value.text}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 34,
                                opacity: rowOpacity,
                                transform: `translateY(${rowX}px)`,
                            }}
                        >
                            {value.icon}
                            <span
                                style={{
                                    fontFamily: FONT_FAMILY,
                                    fontSize: 48,
                                    fontWeight: 500,
                                    color: COLORS.text,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {value.text}
                            </span>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};
