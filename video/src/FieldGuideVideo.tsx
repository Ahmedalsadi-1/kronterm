import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";

const Palette = {
    navy: "#09192f",
    navySoft: "#102947",
    paper: "#fbf7e9",
    ink: "#18262c",
    cyan: "#2bd8e6",
    red: "#c84f5d",
    yellow: "#efc94f",
};

const Serif = 'Georgia, "Times New Roman", serif';
const Mono = '"Courier New", monospace';

function enter(frame: number, duration = 14): number {
    return interpolate(frame, [0, duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
}

function StoryImage({ name, style }: { name: string; style?: React.CSSProperties }) {
    return (
        <Img
            src={staticFile(`visual-stories/${name}.webp`)}
            style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                imageRendering: "auto",
                ...style,
            }}
        />
    );
}

function Folio({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                color: dark ? "rgba(251,247,233,0.72)" : "rgba(24,38,44,0.72)",
                fontFamily: Mono,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
            }}
        >
            <span style={{ width: 42, height: 3, background: Palette.cyan }} />
            {children}
        </div>
    );
}

function CoverScene() {
    const frame = useCurrentFrame();
    const opacity = enter(frame);
    const imageX = interpolate(frame, [0, 80], [70, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ background: Palette.paper, opacity, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, borderLeft: `34px solid ${Palette.red}` }} />
            <div
                style={{
                    position: "absolute",
                    inset: "70px 80px 70px 96px",
                    border: "2px solid rgba(24,38,44,0.18)",
                    boxShadow: "18px 18px 0 rgba(43,216,230,0.12)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: 130,
                    left: 150,
                    zIndex: 2,
                    width: 820,
                    opacity: enter(frame, 22),
                }}
            >
                <Folio>Field film / 01</Folio>
                <h1
                    style={{
                        margin: "54px 0 34px",
                        color: Palette.ink,
                        fontFamily: Serif,
                        fontSize: 120,
                        fontWeight: 400,
                        letterSpacing: "-0.065em",
                        lineHeight: 0.9,
                    }}
                >
                    Meet the
                    <br />
                    living canvas.
                </h1>
                <p
                    style={{
                        width: 630,
                        margin: 0,
                        color: "#53656b",
                        fontFamily: Mono,
                        fontSize: 25,
                        lineHeight: 1.55,
                    }}
                >
                    A workspace where people and agents can see the whole technical story.
                </p>
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    right: 40,
                    bottom: 20,
                    width: 770,
                    overflow: "hidden",
                    borderRadius: 10,
                    boxShadow: "-34px 0 80px rgba(9,25,47,0.18)",
                    transform: `translateX(${imageX}px) rotate(1deg)`,
                }}
            >
                <StoryImage name="15-welcome-living-canvas" />
            </div>
        </AbsoluteFill>
    );
}

function OrchestraScene() {
    const frame = useCurrentFrame();
    const opacity = enter(frame, 12);
    const scale = interpolate(frame, [0, 105], [1.08, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ background: Palette.navy, opacity, overflow: "hidden" }}>
            <StoryImage name="01-human-agent-orchestra" style={{ transform: `scale(${scale})` }} />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, rgba(5,16,31,0.78) 0%, rgba(5,16,31,0.08) 58%, transparent)",
                }}
            />
            <div style={{ position: "absolute", top: 130, left: 120, width: 690 }}>
                <Folio dark>One operating picture</Folio>
                <h2
                    style={{
                        margin: "38px 0 0",
                        color: Palette.paper,
                        fontFamily: Serif,
                        fontSize: 104,
                        fontWeight: 400,
                        letterSpacing: "-0.06em",
                        lineHeight: 0.92,
                    }}
                >
                    One canvas.
                    <br />
                    Every surface.
                </h2>
            </div>
        </AbsoluteFill>
    );
}

function EvidenceScene() {
    const frame = useCurrentFrame();
    const leftX = interpolate(frame, [0, 28], [-90, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const rightX = interpolate(frame, [0, 28], [90, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ background: Palette.navy, opacity: enter(frame, 12), padding: 42 }}>
            <div
                style={{
                    display: "grid",
                    height: "100%",
                    gridTemplateColumns: "1.1fr 0.9fr",
                    gap: 26,
                }}
            >
                <div style={{ overflow: "hidden", borderRadius: 8, transform: `translateX(${leftX}px)` }}>
                    <StoryImage name="03-browser-evidence-trail" />
                </div>
                <div style={{ overflow: "hidden", borderRadius: 8, transform: `translateX(${rightX}px)` }}>
                    <StoryImage name="04-sandbox-launch" />
                </div>
            </div>
            <div
                style={{
                    position: "absolute",
                    right: 90,
                    bottom: 78,
                    width: 650,
                    borderLeft: `8px solid ${Palette.red}`,
                    background: "rgba(251,247,233,0.96)",
                    boxShadow: "14px 14px 0 rgba(43,216,230,0.2)",
                    color: Palette.ink,
                    padding: "34px 42px",
                }}
            >
                <Folio>See / act / verify</Folio>
                <div style={{ marginTop: 14, fontFamily: Serif, fontSize: 58, letterSpacing: "-0.045em" }}>
                    Evidence stays beside the work.
                </div>
            </div>
        </AbsoluteFill>
    );
}

const CapabilityImages = ["06-code-review-detective", "08-desktop-app-pilot", "09-agent-command-center", "10-test-lab"];

function CapabilityScene() {
    const frame = useCurrentFrame();

    return (
        <AbsoluteFill style={{ background: Palette.paper, opacity: enter(frame, 12), padding: "72px 96px" }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 38 }}>
                <div>
                    <Folio>Built across the loop</Folio>
                    <h2
                        style={{
                            margin: "18px 0 0",
                            color: Palette.ink,
                            fontFamily: Serif,
                            fontSize: 76,
                            fontWeight: 400,
                            letterSpacing: "-0.055em",
                        }}
                    >
                        Agents work where the evidence lives.
                    </h2>
                </div>
                <div style={{ color: Palette.red, fontFamily: Mono, fontSize: 20 }}>04 / 05</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22 }}>
                {CapabilityImages.map((name, index) => {
                    const delay = index * 8;
                    const y = interpolate(frame, [delay, delay + 22], [70, 0], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                    });
                    return (
                        <div
                            key={name}
                            style={{
                                height: 670,
                                overflow: "hidden",
                                border: "2px solid rgba(24,38,44,0.18)",
                                borderRadius: 6,
                                boxShadow: `${8 + index * 2}px 12px 0 rgba(9,25,47,0.1)`,
                                opacity: enter(frame - delay, 18),
                                transform: `translateY(${y}px) rotate(${index % 2 === 0 ? -0.5 : 0.5}deg)`,
                            }}
                        >
                            <StoryImage name={name} />
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
}

function ClosingScene() {
    const frame = useCurrentFrame();
    const cardY = interpolate(frame, [0, 24], [70, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ background: Palette.navy, opacity: enter(frame, 10), overflow: "hidden" }}>
            <StoryImage name="05-living-workspace" />
            <div style={{ position: "absolute", inset: 0, background: "rgba(4,14,28,0.22)" }} />
            <div
                style={{
                    position: "absolute",
                    top: 100,
                    right: 100,
                    width: 770,
                    borderTop: `10px solid ${Palette.yellow}`,
                    borderLeft: `14px solid ${Palette.red}`,
                    background: "rgba(251,247,233,0.96)",
                    boxShadow: "18px 20px 0 rgba(43,216,230,0.18)",
                    color: Palette.ink,
                    padding: "52px 58px 46px",
                    transform: `translateY(${cardY}px)`,
                }}
            >
                <Folio>KronTerm / private beta</Folio>
                <h2
                    style={{
                        margin: "30px 0 26px",
                        fontFamily: Serif,
                        fontSize: 88,
                        fontWeight: 400,
                        letterSpacing: "-0.06em",
                        lineHeight: 0.92,
                    }}
                >
                    Put the whole canvas behind the next prompt.
                </h2>
                <div style={{ color: Palette.navySoft, fontFamily: Mono, fontSize: 24 }}>kronterm.dev</div>
            </div>
        </AbsoluteFill>
    );
}

export const KronTermFieldGuide: React.FC = () => {
    return (
        <AbsoluteFill style={{ background: Palette.navy }}>
            <Sequence from={0} durationInFrames={100}>
                <CoverScene />
            </Sequence>
            <Sequence from={90} durationInFrames={110}>
                <OrchestraScene />
            </Sequence>
            <Sequence from={190} durationInFrames={110}>
                <EvidenceScene />
            </Sequence>
            <Sequence from={290} durationInFrames={110}>
                <CapabilityScene />
            </Sequence>
            <Sequence from={390} durationInFrames={60}>
                <ClosingScene />
            </Sequence>
        </AbsoluteFill>
    );
};
