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

// ── KronTerm OS Demo — BRAND NEW COMPOSITION (60s, 1920x1080) ───────────
// Brand new assets: video/public/os-demo/* (future-os jpegs + Sep 1 screen recordings)
// Brand new start: not a cut of Promo — fresh narrative for KronTerm OS spatial desktop
export const OS_SCENE = {
    HOOK: { start: 0, duration: 120 }, // 0:00-0:04  Hook — the OS reveal
    DESKTOP: { start: 120, duration: 300 }, // 0:04-0:14  Calm desktop shell
    APPSTREAM: { start: 420, duration: 300 }, // 0:14-0:24  App Stream rails
    HERMES: { start: 720, duration: 300 }, // 0:24-0:34  Hermes + Command Center
    CANVAS: { start: 1020, duration: 360 }, // 0:34-0:46  Spatial canvas
    TERMINAL: { start: 1380, duration: 270 }, // 0:46-0:55  Connected shell
    CTA: { start: 1650, duration: 150 }, // 0:55-1:00  One workspace
} as const;

export const OS_TOTAL_FRAMES = 1800; // 60s @30fps

function kenBurns(
    frame: number,
    duration: number,
    from: { scale: number; x: number; y: number },
    to: { scale: number; x: number; y: number }
) {
    const p = interpolate(frame, [0, duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const e = p * p * (3 - 2 * p);
    return {
        scale: interpolate(e, [0, 1], [from.scale, to.scale]),
        x: interpolate(e, [0, 1], [from.x, to.x]),
        y: interpolate(e, [0, 1], [from.y, to.y]),
    };
}

const Scrim: React.FC = () => (
    <AbsoluteFill
        style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 18%, rgba(0,0,0,0) 36%)",
            pointerEvents: "none",
        }}
    />
);

const CoverImg: React.FC<{ src: string }> = ({ src }) => (
    <AbsoluteFill>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
);

const CoverVid: React.FC<{ src: string; startFrom?: number }> = ({ src, startFrom = 0 }) => (
    <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} startFrom={startFrom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
);

const Caption: React.FC<{ title: string; sub?: string; delay?: number }> = ({ title, sub, delay = 18 }) => {
    const f = useCurrentFrame();
    const o = fadeIn(f, 24, delay);
    const y = interpolate(f, [delay, delay + 24], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
        <div
            style={{
                position: "absolute",
                left: 84,
                right: 84,
                bottom: 88,
                opacity: o,
                transform: `translateY(${y}px)`,
            }}
        >
            <div style={{ width: 52, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginBottom: 18 }} />
            <div
                style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 56,
                    fontWeight: 740,
                    color: COLORS.text,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    textShadow: "0 2px 26px rgba(0,0,0,0.72)",
                }}
            >
                {title}
            </div>
            {sub ? (
                <div
                    style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 28,
                        color: COLORS.muted,
                        marginTop: 10,
                        textShadow: "0 2px 14px rgba(0,0,0,0.6)",
                    }}
                >
                    {sub}
                </div>
            ) : null}
        </div>
    );
};

const SceneShell: React.FC<{ duration: number; cam: { scale: number; x: number; y: number }; children: React.ReactNode }> = ({
    duration,
    cam,
    children,
}) => {
    const f = useCurrentFrame();
    const o = Math.min(fadeIn(f, 20), fadeOut(f, duration, 20));
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: o }}>
            <AbsoluteFill style={{ overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, transform: `scale(${cam.scale}) translate(${cam.x}%, ${cam.y}%)` }}>
                    {children}
                </div>
            </AbsoluteFill>
            <Scrim />
        </AbsoluteFill>
    );
};

// ── Scenes (brand new) ──────────────────────────────────────────────
const HookOS: React.FC = () => {
    const f = useCurrentFrame();
    const zoom = interpolate(f, [0, OS_SCENE.HOOK.duration], [1.06, 0.98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const iconO = fadeIn(f, 20);
    const t1 = fadeIn(f, 24, 18);
    const t2 = fadeIn(f, 24, 42);
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", transform: `scale(${zoom})` }}>
            <AbsoluteFill style={{ overflow: "hidden", opacity: 0.22 }}>
                <Img src={staticFile("os-demo/0BCF5ACA-FEE5-48D1-882D-78C86202809C.jpeg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </AbsoluteFill>
            <AbsoluteFill
                style={{
                    background: "radial-gradient(ellipse at center, rgba(184,255,108,0.18) 0%, rgba(0,0,0,0) 62%)",
                    pointerEvents: "none",
                }}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
                <Img src={staticFile("promo/kronterm-icon.svg")} style={{ width: 148, height: 148, opacity: iconO }} />
                <div style={{ fontFamily: FONT_FAMILY, fontSize: 64, fontWeight: 840, color: COLORS.text, letterSpacing: "0.04em", marginTop: 28, opacity: t1 }}>
                    KRONTERM OS
                </div>
                <div style={{ fontFamily: FONT_FAMILY, fontSize: 30, color: COLORS.muted, marginTop: 14, opacity: t2, letterSpacing: "0.02em" }}>
                    A terminal that became a desktop
                </div>
                <div style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 26, opacity: t2 }} />
            </div>
        </AbsoluteFill>
    );
};

export const KronTermOSDemo: React.FC = () => {
    const f = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const exit = interpolate(f, [OS_TOTAL_FRAMES - 24, OS_TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: exit }}>
            <Sequence from={OS_SCENE.HOOK.start} durationInFrames={OS_SCENE.HOOK.duration}>
                <HookOS />
            </Sequence>

            <Sequence from={OS_SCENE.DESKTOP.start} durationInFrames={OS_SCENE.DESKTOP.duration}>
                <SceneShell
                    duration={OS_SCENE.DESKTOP.duration}
                    cam={kenBurns(f - OS_SCENE.DESKTOP.start, OS_SCENE.DESKTOP.duration, { scale: 1.08, x: 1.2, y: 0.6 }, { scale: 1.22, x: -1.8, y: -0.4 })}
                >
                    <CoverImg src="os-demo/6B53F80F-B197-43D3-9607-E8328F9ACDD2.jpeg" />
                </SceneShell>
                <Caption title="Calm desktop shell" sub="Flat grid overview · Cover Flow · no-overshoot springs · connected dock" />
            </Sequence>

            <Sequence from={OS_SCENE.APPSTREAM.start} durationInFrames={OS_SCENE.APPSTREAM.duration}>
                <SceneShell
                    duration={OS_SCENE.APPSTREAM.duration}
                    cam={kenBurns(f - OS_SCENE.APPSTREAM.start, OS_SCENE.APPSTREAM.duration, { scale: 1.18, x: -2, y: 1 }, { scale: 1.04, x: 1.2, y: -0.6 })}
                >
                    <CoverImg src="os-demo/7FDCAAA3-1626-4D65-8B01-05046A9401A8.jpeg" />
                </SceneShell>
                <Caption title="App Stream rails & native apps" sub="AppIcon registry · drag-to-canvas · live rails" />
            </Sequence>

            <Sequence from={OS_SCENE.HERMES.start} durationInFrames={OS_SCENE.HERMES.duration}>
                <SceneShell
                    duration={OS_SCENE.HERMES.duration}
                    cam={kenBurns(f - OS_SCENE.HERMES.start, OS_SCENE.HERMES.duration, { scale: 1.06, x: 0, y: 1.2 }, { scale: 1.16, x: 0, y: -1 })}
                >
                    <CoverImg src="os-demo/315D426A-9994-4EC3-9591-FDA75120899A.jpeg" />
                </SceneShell>
                <Caption title="Hermes · Command Center" sub="/files · /terminal · /preview · Cmd+Shift+Space · working badges" />
            </Sequence>

            <Sequence from={OS_SCENE.CANVAS.start} durationInFrames={OS_SCENE.CANVAS.duration}>
                <SceneShell
                    duration={OS_SCENE.CANVAS.duration}
                    cam={kenBurns(f - OS_SCENE.CANVAS.start, OS_SCENE.CANVAS.duration, { scale: 1.09, x: 1, y: 1 }, { scale: 1.24, x: -1.4, y: -0.8 })}
                >
                    <CoverImg src="os-demo/54182989-4CD7-4099-8996-39C61F29E8E9.jpeg" />
                </SceneShell>
                <Caption title="Spatial canvas with live widgets" sub="Notes · connectors · task cards · selection → agent context" />
            </Sequence>

            <Sequence from={OS_SCENE.TERMINAL.start} durationInFrames={OS_SCENE.TERMINAL.duration}>
                <SceneShell
                    duration={OS_SCENE.TERMINAL.duration}
                    cam={kenBurns(f - OS_SCENE.TERMINAL.start, OS_SCENE.TERMINAL.duration, { scale: 1.2, x: 2, y: 0 }, { scale: 1.04, x: -0.8, y: 0.6 })}
                >
                    {/* brand new capture: Sep 1 screen recording of OS overview */}
                    <CoverVid src="os-demo/os-overview.mov" startFrom={15} />
                </SceneShell>
                <Caption title="Connected shell + grouped files" sub="Terminal dock · file browser · drag-to-canvas" />
            </Sequence>

            <Sequence from={OS_SCENE.CTA.start} durationInFrames={OS_SCENE.CTA.duration}>
                <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
                    {(() => {
                        const lf = f - OS_SCENE.CTA.start;
                        const zoom = interpolate(lf, [0, OS_SCENE.CTA.duration], [1.06, 0.98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                        const o1 = fadeIn(lf, 26);
                        const o2 = fadeIn(lf, 26, 20);
                        const o3 = fadeIn(lf, 26, 42);
                        return (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${zoom})` }}>
                                <Img src={staticFile("promo/kronterm-icon.svg")} style={{ width: 118, height: 118, opacity: o1 }} />
                                <div style={{ fontFamily: FONT_FAMILY, fontSize: 72, fontWeight: 820, color: COLORS.text, marginTop: 26, opacity: o2, textAlign: "center" }}>
                                    One workspace. Every surface.
                                </div>
                                <div style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 560, color: COLORS.accent, marginTop: 18, opacity: o3, letterSpacing: "0.06em" }}>
                                    kronterm.dev — private beta
                                </div>
                                <div style={{ fontFamily: FONT_FAMILY, fontSize: 22, color: COLORS.soft, marginTop: 14, opacity: o3 }}>
                                    Terminal · Browser · Files · Sandboxes · OS desktop · AI
                                </div>
                            </div>
                        );
                    })()}
                </AbsoluteFill>
            </Sequence>

            <AbsoluteFill
                style={{
                    background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.42) 100%)",
                    pointerEvents: "none",
                }}
            />
            {durationInFrames > 0 ? null : null}
        </AbsoluteFill>
    );
};
