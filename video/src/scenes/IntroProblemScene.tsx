import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, slideUp } from "../theme";
import { WindowCard } from "./IntroParts";

const CARDS = [
    { label: "Terminal", dx: -235, dy: -185, rot: -4 },
    { label: "Browser", dx: 245, dy: -45, rot: 3.5 },
    { label: "AI Chat", dx: -95, dy: 265, rot: -2.5 },
];

export const IntroProblemScene: React.FC = () => {
    const frame = useCurrentFrame();
    const captionOpacity = fadeIn(frame, 45, 15);
    const captionY = slideUp(frame, 15, 45);

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                alignItems: "center",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 320,
                    left: 90,
                    right: 90,
                    opacity: captionOpacity,
                    transform: `translateY(${captionY}px)`,
                    fontFamily: FONT_FAMILY,
                    fontSize: 46,
                    fontWeight: 500,
                    color: COLORS.text,
                    textAlign: "center",
                    lineHeight: 1.35,
                }}
            >
                Your tools live in{" "}
                <span style={{ color: COLORS.danger }}>five different places.</span>
            </div>

            {CARDS.map((card, i) => {
                const delay = 55 + i * 25;
                const progress = Math.min(1, Math.max(0, (frame - delay) / 160));
                const eased = 1 - Math.pow(1 - progress, 3);
                return (
                    <div
                        key={card.label}
                        style={{
                            position: "absolute",
                            top: 820,
                            left: (1080 - 420) / 2,
                            transform: `translate(${card.dx * eased}px, ${card.dy * eased}px) rotate(${card.rot * eased}deg)`,
                        }}
                    >
                        <WindowCard label={card.label} width={420} height={260} />
                        <div
                            style={{
                                marginTop: 14,
                                display: "flex",
                                gap: 10,
                                padding: "12px 16px",
                            }}
                        >
                            {[0, 1, 2].map((bar) => (
                                <div
                                    key={bar}
                                    style={{
                                        width: bar === 0 ? 120 : 80,
                                        height: 10,
                                        borderRadius: 5,
                                        background: COLORS.panelStrong,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};
