import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CanvasScene } from "./scenes/CanvasScene";
import { CTAScene } from "./scenes/CTAScene";
import { HookScene } from "./scenes/HookScene";
import { KronosCodeScene } from "./scenes/KronosCodeScene";
import { TerminalScene } from "./scenes/TerminalScene";
import { WidgetsScene } from "./scenes/WidgetsScene";
import { COLORS, SCENE } from "./theme";

export const KronTermOnboarding: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <Sequence from={SCENE.HOOK.start} durationInFrames={SCENE.HOOK.duration}>
                <HookScene />
            </Sequence>
            <Sequence from={SCENE.TERMINAL.start} durationInFrames={SCENE.TERMINAL.duration}>
                <TerminalScene />
            </Sequence>
            <Sequence from={SCENE.KRONOSCODE.start} durationInFrames={SCENE.KRONOSCODE.duration}>
                <KronosCodeScene />
            </Sequence>
            <Sequence from={SCENE.WIDGETS.start} durationInFrames={SCENE.WIDGETS.duration}>
                <WidgetsScene />
            </Sequence>
            <Sequence from={SCENE.CANVAS.start} durationInFrames={SCENE.CANVAS.duration}>
                <CanvasScene />
            </Sequence>
            <Sequence from={SCENE.CTA.start} durationInFrames={SCENE.CTA.duration}>
                <CTAScene />
            </Sequence>
        </AbsoluteFill>
    );
};
