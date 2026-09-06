import React from "react";
import {
    AbsoluteFill,
    Img,
    OffthreadVideo,
    Sequence,
    interpolate,
    staticFile,
    useCurrentFrame,
    useVideoConfig,
} from "remotion";
import { COLORS, FONT_FAMILY, fadeIn, fadeOut } from "./theme";

// ── Promo Film Timing (frames at 30fps) ────────────────────
export const PROMO_SCENE = {
    HOOK: { start: 0, duration: 90 }, // 0:00-0:03
    CANVAS: { start: 90, duration: 360 }, // 0:03-0:15
    AGENT: { start: 450, duration: 360 }, // 0:15-0:27
    SURFACES: { start: 810, duration: 330 }, // 0:27-0:38
    HERMES: { start: 1140, duration: 270 }, // 0:38-0:47
    TERMINAL: { start: 1410, duration: 270 }, // 0:47-0:56
    CTA: { start: 1680, duration: 180 }, // 0:56-1:02
} as const;

export const PROMO_TOTAL_FRAMES = 1860;

// ── Ken Burns camera move ───────────────────────────────────
type Camera = { scale: number; x: number; y: number };

function kenBurns(
    frame: number,
    duration: number,
    from: { scale: number; x: number; y: number },
    to: { scale: number; x: number; y: number },
    easing: "in-out" | "linear" = "in-out"
): Camera {
    const progress = interpolate(frame, [0, duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: easing === "in-out" ? undefined : undefined,
    });
    // Manual smoothstep for a cinematic settle
    const eased = easing === "in-out" ? progress * progress * (3 - 2 * progress) : progress;
    return {
        scale: interpolate(eased, [0, 1], [from.scale, to.scale]),
        x: interpolate(eased, [0, 1], [from.x, to.x]),
        y: interpolate(eased, [0, 1], [from.y, to.y]),
    };
}

const SceneFrame: React.FC<{
    children: React.ReactNode;
    durationInFrames: number;
    camera: Camera;
}> = ({ children, durationInFrames, camera }) => {
    const frame = useCurrentFrame();
    const opacity = Math.min(fadeIn(frame, 18), fadeOut(frame, durationInFrames, 18));
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity }}>
            <AbsoluteFill style={{ overflow: "hidden" }}>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        transform: `scale(${camera.scale}) translate(${camera.x}%, ${camera.y}%)`,
                    }}
                >
                    {children}
                </div>
            </AbsoluteFill>
            {/* caption scrim keeps white text readable on light footage */}
            <AbsoluteFill
                style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 16%, rgba(0,0,0,0) 32%)",
                    pointerEvents: "none",
                }}
            />
        </AbsoluteFill>
    );
};

const CoverVideo: React.FC<{ src: string; startFrom?: number }> = ({ src, startFrom = 0 }) => (
    <AbsoluteFill>
        <OffthreadVideo
            src={staticFile(src)}
            startFrom={startFrom}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
    </AbsoluteFill>
);

const CoverImage: React.FC<{ src: string }> = ({ src }) => (
    <AbsoluteFill>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
);

const Caption: React.FC<{ text: string; sub?: string; delay?: number; align?: "left" | "center" }> = ({
    text,
    sub,
    delay = 20,
    align = "left",
}) => {
    const frame = useCurrentFrame();
    const opacity = fadeIn(frame, 25, delay);
    const rise = interpolate(frame, [delay, delay + 25], [24, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    return (
        <div
            style={{
                position: "absolute",
                left: align === "left" ? 90 : 0,
                right: align === "left" ? 90 : 0,
                bottom: 90,
                display: "flex",
                flexDirection: "column",
                alignItems: align === "left" ? "flex-start" : "center",
                opacity,
                transform: `translateY(${rise}px)`,
            }}
        >
            <div
                style={{
                    width: 56,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: COLORS.accent,
                    marginBottom: 22,
                }}
            />
            <div
                style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 58,
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    textShadow: "0 2px 24px rgba(0,0,0,0.65)",
                    textAlign: align === "left" ? "left" : "center",
                }}
            >
                {text}
            </div>
            {sub
                ? (
                    <div
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 30,
                            fontWeight: 400,
                            color: COLORS.muted,
                            marginTop: 14,
                            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
                            textAlign: align === "left" ? "left" : "center",
                        }}
                    >
                        {sub}
                    </div>
                )
                : null}
        </div>
    );
};

// ── Scenes ──────────────────────────────────────────────────
const HookScene: React.FC = () => {
    const frame = useCurrentFrame();
    const zoom = interpolate(frame, [0, PROMO_SCENE.HOOK.duration], [0.86, 1.04], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const iconOpacity = fadeIn(frame, 22);
    const wordOpacity = fadeIn(frame, 26, 12);
    const tagOpacity = fadeIn(frame, 26, 30);
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <AbsoluteFill
                style={{
                    justifyContent: "center",
                    alignItems: "center",
                    transform: `scale(${zoom})`,
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <img
                        src={staticFile("promo/kronterm-icon.svg")}
                        style={{ width: 170, height: 170, opacity: iconOpacity }}
                    />
                    <div
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 116,
                            fontWeight: 800,
                            color: COLORS.text,
                            letterSpacing: "0.04em",
                            marginTop: 36,
                            opacity: wordOpacity,
                        }}
                    >
                        KRONTERM
                    </div>
                    <div
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 34,
                            fontWeight: 400,
                            color: COLORS.muted,
                            marginTop: 20,
                            opacity: tagOpacity,
                        }}
                    >
                        The agent-aware developer workspace
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

export const KronTermPromo: React.FC = () => {
    const { durationInFrames: total } = useVideoConfig();
    const frame = useCurrentFrame();
    const globalFade = interpolate(frame, [PROMO_TOTAL_FRAMES - 30, PROMO_TOTAL_FRAMES], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: globalFade }}>
            <Sequence from={PROMO_SCENE.HOOK.start} durationInFrames={PROMO_SCENE.HOOK.duration}>
                <HookScene />
            </Sequence>

            <Sequence from={PROMO_SCENE.CANVAS.start} durationInFrames={PROMO_SCENE.CANVAS.duration}>
                <SceneFrame
                    durationInFrames={PROMO_SCENE.CANVAS.duration}
                    camera={kenBurns(frame - PROMO_SCENE.CANVAS.start, PROMO_SCENE.CANVAS.duration, { scale: 1.06, x: 1.5, y: 1 }, { scale: 1.2, x: -2, y: -1.5 })}
                >
                    <CoverVideo src="promo/canvas-widgets.mp4" startFrom={30} />
                </SceneFrame>
                <Caption text="One canvas. Every surface." sub="Live widgets on a spatial workspace" />
            </Sequence>

            <Sequence from={PROMO_SCENE.AGENT.start} durationInFrames={PROMO_SCENE.AGENT.duration}>
                <SceneFrame
                    durationInFrames={PROMO_SCENE.AGENT.duration}
                    camera={kenBurns(frame - PROMO_SCENE.AGENT.start, PROMO_SCENE.AGENT.duration, { scale: 1.26, x: -3, y: 0 }, { scale: 1.1, x: 2, y: 1 })}
                >
                    <CoverVideo src="promo/agent-chat.mp4" startFrom={30} />
                </SceneFrame>
                <Caption text="KronosCode works from real evidence" sub="The agent sees what you see" />
            </Sequence>

            <Sequence from={PROMO_SCENE.SURFACES.start} durationInFrames={PROMO_SCENE.SURFACES.duration}>
                <SceneFrame
                    durationInFrames={PROMO_SCENE.SURFACES.duration}
                    camera={kenBurns(frame - PROMO_SCENE.SURFACES.start, PROMO_SCENE.SURFACES.duration, { scale: 1.04, x: 0, y: 2 }, { scale: 1.18, x: -2.5, y: -1 })}
                >
                    <CoverVideo src="promo/surfaces.mp4" />
                </SceneFrame>
                <Caption text="Terminal · Browser · Files · Sandboxes" sub="Everything stays in view" />
            </Sequence>

            <Sequence from={PROMO_SCENE.HERMES.start} durationInFrames={PROMO_SCENE.HERMES.duration}>
                <HermesScene />
            </Sequence>

            <Sequence from={PROMO_SCENE.TERMINAL.start} durationInFrames={PROMO_SCENE.TERMINAL.duration}>
                <SceneFrame
                    durationInFrames={PROMO_SCENE.TERMINAL.duration}
                    camera={kenBurns(frame - PROMO_SCENE.TERMINAL.start, PROMO_SCENE.TERMINAL.duration, { scale: 1.22, x: 4, y: 0 }, { scale: 1.02, x: 0, y: 0 })}
                >
                    <CoverVideo src="promo/terminal.mp4" />
                </SceneFrame>
                <Caption text="Keyboard-first. Local-first." sub="Built for deep work" />
            </Sequence>

            <Sequence from={PROMO_SCENE.CTA.start} durationInFrames={PROMO_SCENE.CTA.duration}>
                <CtaScene />
            </Sequence>

            {/* film grain vignette for cohesion */}
            <AbsoluteFill
                style={{
                    background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)",
                    pointerEvents: "none",
                }}
            />
            {total > 0 ? null : null}
        </AbsoluteFill>
    );
};

const HermesScene: React.FC = () => {
    const frame = useCurrentFrame();
    const d = PROMO_SCENE.HERMES.duration;
    const third = d / 3;
    const idx = Math.min(2, Math.floor(frame / third));
    const images = ["promo/hermes-messaging.png", "promo/hermes-profiles.png", "promo/hermes-cron.png"];
    const local = frame - idx * third;
    const cams = [
        kenBurns(local, third, { scale: 1.14, x: -3, y: 1 }, { scale: 1.04, x: 2, y: -1 }),
        kenBurns(local, third, { scale: 1.06, x: 3, y: -1 }, { scale: 1.16, x: -2, y: 1 }),
        kenBurns(local, third, { scale: 1.12, x: 0, y: 2 }, { scale: 1.02, x: 0, y: 0 }),
    ];
    const opacity = idx === 0 ? fadeIn(local, 15) : Math.min(fadeIn(local, 15), fadeOut(local, third, 12));
    const capOpacity = fadeIn(frame, 25, 15);
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <AbsoluteFill style={{ overflow: "hidden" }}>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        opacity,
                        transform: `scale(${cams[idx].scale}) translate(${cams[idx].x}%, ${cams[idx].y}%)`,
                    }}
                >
                    <CoverImage src={images[idx]} />
                </div>
            </AbsoluteFill>
            <Caption text="Hermes agents, on the canvas" sub="Scheduling · Profiles · Messaging" />
            {capOpacity < 0 ? null : null}
        </AbsoluteFill>
    );
};

const CtaScene: React.FC = () => {
    const frame = useCurrentFrame();
    const d = PROMO_SCENE.CTA.duration;
    const zoom = interpolate(frame, [0, d], [1.08, 0.94], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const wordOpacity = fadeIn(frame, 30);
    const tagOpacity = fadeIn(frame, 30, 22);
    const urlOpacity = fadeIn(frame, 30, 44);
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <AbsoluteFill
                style={{ justifyContent: "center", alignItems: "center", transform: `scale(${zoom})` }}
            >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <img
                        src={staticFile("promo/kronterm-icon.svg")}
                        style={{ width: 130, height: 130, opacity: wordOpacity }}
                    />
                    <div
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 78,
                            fontWeight: 800,
                            color: COLORS.text,
                            marginTop: 34,
                            opacity: tagOpacity,
                            letterSpacing: "-0.01em",
                            textAlign: "center",
                        }}
                    >
                        One workspace. Every surface.
                    </div>
                    <div
                        style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 32,
                            fontWeight: 500,
                            color: COLORS.accent,
                            marginTop: 28,
                            opacity: urlOpacity,
                            letterSpacing: "0.06em",
                        }}
                    >
                        kronterm.dev — private beta
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
