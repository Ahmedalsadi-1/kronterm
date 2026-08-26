import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, slideUp } from "../theme";
import { WindowCard } from "./IntroParts";

const GRID = [
    { label: "Terminal", col: 0, row: 0 },
    { label: "Browser", col: 1, row: 0 },
    { label: "Files", col: 0, row: 1 },
    { label: "AI Chat", col: 1, row: 1 },
];

const SCATTER = [
    { dx: -330, dy: -190, rot: -5 },
    { dx: 340, dy: -40, rot: 4 },
    { dx: -120, dy: 260, rot: -3 },
    { dx: 300, dy: 240, rot: 5 },
];

const CARD_W = 440;
const CARD_H = 270;
const GAP = 24;
const GRID_W = CARD_W * 2 + GAP;
const GRID_LEFT = (1080 - GRID_W) / 2;
const GRID_TOP = 760;

export const IntroSolutionScene: React.FC = () => {
    const frame = useCurrentFrame();
    const captionOpacity = fadeIn(frame, 50, 230);
    const captionY = slideUp(frame, 230, 50);
    const frameOpacity = fadeIn(frame, 60, 210);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <div
                style={{
                    position: "absolute",
                    top: 320,
                    left: 90,
                    right: 90,
                    fontFamily: FONT_FAMILY,
                    fontSize: 44,
                    fontWeight: 500,
                    color: COLORS.muted,
                    textAlign: "center",
                    lineHeight: 1.35,
                }}
            >
                One persistent workspace.
            </div>

            <div
                style={{
                    position: "absolute",
                    top: GRID_TOP - 18,
                    left: GRID_LEFT - 18,
                    width: GRID_W + 36,
                    height: CARD_H * 2 + GAP + 36,
                    border: `1px solid ${COLORS.accent}55`,
                    borderRadius: 20,
                    background: `radial-gradient(circle at 50% 30%, ${COLORS.accentBlue}0d, transparent 70%)`,
                    opacity: frameOpacity,
                }}
            />

            {GRID.map((card, i) => {
                const delay = 35 + i * 15;
                const progress = Math.min(1, Math.max(0, (frame - delay) / 150));
                const eased = 1 - Math.pow(1 - progress, 3);
                const scatter = SCATTER[i];
                return (
                    <div
                        key={card.label}
                        style={{
                            position: "absolute",
                            top: GRID_TOP + card.row * (CARD_H + GAP),
                            left: GRID_LEFT + card.col * (CARD_W + GAP),
                        }}
                    >
                        <div
                            style={{
                                transform: `translate(${scatter.dx * (1 - eased)}px, ${scatter.dy * (1 - eased)}px) rotate(${scatter.rot * (1 - eased)}deg)`,
                            }}
                        >
                            <WindowCard label={card.label} width={CARD_W} height={CARD_H} />
                        </div>
                    </div>
                );
            })}

            <div
                style={{
                    position: "absolute",
                    top: 1420,
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
                KronTerm brings them{" "}
                <span style={{ color: COLORS.accent }}>together.</span>
            </div>
        </AbsoluteFill>
    );
};
