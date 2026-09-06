import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, FONT_MONO, fadeIn } from "../theme";

const NOTES = [
    { x: 60, y: 430, w: 300, h: 200 },
    { x: 420, y: 560, w: 340, h: 230 },
    { x: 130, y: 830, w: 280, h: 180 },
];

export const IntroCanvasAiScene: React.FC = () => {
    const frame = useCurrentFrame();
    const pan = Math.sin((frame / 405) * Math.PI) * 46;
    const captionOpacity = fadeIn(frame, 45, 40);
    const chatDelay = 110;
    const chatOpacity = fadeIn(frame, 50, chatDelay);
    const chatY = fadeIn(frame, 50, chatDelay) * -36;
    const bubble1Opacity = fadeIn(frame, 35, chatDelay + 55);
    const replyBarOpacity = fadeIn(frame, 30, chatDelay + 115);
    const replyTextOpacity = fadeIn(frame, 35, chatDelay + 155);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
            <div
                style={{
                    position: "absolute",
                    top: "6%",
                    left: "15%",
                    width: "70%",
                    height: "45%",
                    background: `radial-gradient(ellipse, ${COLORS.accent}0d, transparent 70%)`,
                    filter: "blur(60px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    top: 330,
                    left: 90,
                    right: 90,
                    opacity: captionOpacity,
                    fontFamily: FONT_FAMILY,
                    fontSize: 44,
                    fontWeight: 500,
                    color: COLORS.text,
                    textAlign: "center",
                    lineHeight: 1.35,
                }}
            >
                A spatial canvas for{" "}
                <span style={{ color: COLORS.accent }}>everything you build.</span>
            </div>

            <div style={{ position: "absolute", inset: 0, transform: `translateX(${pan}px)` }}>
                <svg
                    width={1080}
                    height={1920}
                    style={{ position: "absolute", top: 0, left: 0 }}
                >
                    <line
                        x1={NOTES[0].x + NOTES[0].w}
                        y1={NOTES[0].y + NOTES[0].h * 0.4}
                        x2={NOTES[1].x}
                        y2={NOTES[1].y + 60}
                        stroke={`${COLORS.accentBlue}88`}
                        strokeWidth={2.5}
                        strokeDasharray="8 7"
                        opacity={fadeIn(frame, 40, 60)}
                    />
                    <line
                        x1={NOTES[2].x + NOTES[2].w * 0.5}
                        y1={NOTES[2].y}
                        x2={NOTES[1].x + 60}
                        y2={NOTES[1].y + NOTES[1].h}
                        stroke={`${COLORS.accent}66`}
                        strokeWidth={2.5}
                        strokeDasharray="8 7"
                        opacity={fadeIn(frame, 40, 80)}
                    />
                </svg>
                {NOTES.map((note, i) => (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            left: note.x,
                            top: note.y,
                            width: note.w,
                            height: note.h,
                            borderRadius: 14,
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.panelStrong,
                            transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (1.5 + i)}deg)`,
                            padding: 20,
                            opacity: fadeIn(frame, 45, 25 + i * 18),
                        }}
                    >
                        <div
                            style={{
                                width: "70%",
                                height: 12,
                                borderRadius: 6,
                                background: COLORS.border,
                                marginBottom: 14,
                            }}
                        />
                        <div
                            style={{
                                width: "85%",
                                height: 10,
                                borderRadius: 5,
                                background: COLORS.panel,
                                marginBottom: 10,
                            }}
                        />
                        <div
                            style={{
                                width: "55%",
                                height: 10,
                                borderRadius: 5,
                                background: COLORS.panel,
                            }}
                        />
                    </div>
                ))}
            </div>

            <div
                style={{
                    position: "absolute",
                    top: 1120,
                    left: 80,
                    right: 80,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.bg2,
                    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
                    opacity: chatOpacity,
                    transform: `translateY(${-chatY}px)`,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "18px 22px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: COLORS.panel,
                    }}
                >
                    <span
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: COLORS.accent,
                            boxShadow: `0 0 14px ${COLORS.accent}`,
                        }}
                    />
                    <span
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 28,
                            fontWeight: 600,
                            color: COLORS.text,
                        }}
                    >
                        KronosCode
                    </span>
                </div>
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div
                        style={{
                            alignSelf: "flex-end",
                            maxWidth: "78%",
                            padding: "14px 20px",
                            borderRadius: "18px 18px 4px 18px",
                            background: `${COLORS.accentBlue}26`,
                            fontFamily: FONT_FAMILY,
                            fontSize: 27,
                            color: COLORS.text,
                            opacity: bubble1Opacity,
                        }}
                    >
                        Summarize these logs
                    </div>
                    <div
                        style={{
                            alignSelf: "flex-start",
                            display: "flex",
                            gap: 8,
                            padding: "16px 20px",
                            borderRadius: "18px 18px 18px 4px",
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.panel,
                            opacity: replyBarOpacity,
                        }}
                    >
                        {[0, 1, 2].map((dot) => (
                            <span
                                key={dot}
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: COLORS.soft,
                                    opacity: 0.4 + 0.3 * Math.sin(frame * 0.12 - dot),
                                }}
                            />
                        ))}
                    </div>
                    <div
                        style={{
                            alignSelf: "flex-start",
                            maxWidth: "82%",
                            padding: "14px 20px",
                            borderRadius: "18px 18px 18px 4px",
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.panel,
                            fontFamily: FONT_MONO,
                            fontSize: 24,
                            color: COLORS.muted,
                            opacity: replyTextOpacity,
                        }}
                    >
                        ✓ 3 errors traced to the deploy step — evidence attached
                    </div>
                </div>
            </div>

            <div
                style={{
                    position: "absolute",
                    top: 1560,
                    left: 90,
                    right: 90,
                    textAlign: "center",
                    fontFamily: FONT_FAMILY,
                    fontSize: 40,
                    fontWeight: 500,
                    color: COLORS.muted,
                    lineHeight: 1.35,
                    opacity: fadeIn(frame, 40, 300),
                }}
            >
                An agent that works where you work.
            </div>
        </AbsoluteFill>
    );
};
