import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, INTRO_SCENE } from "./theme";
import { IntroCanvasAiScene } from "./scenes/IntroCanvasAiScene";
import { IntroCtaScene } from "./scenes/IntroCtaScene";
import { IntroProblemScene } from "./scenes/IntroProblemScene";
import { IntroSolutionScene } from "./scenes/IntroSolutionScene";
import { IntroSurfacesScene } from "./scenes/IntroSurfacesScene";
import { IntroTitleScene } from "./scenes/IntroTitleScene";
import { IntroValuesScene } from "./scenes/IntroValuesScene";

export const KronTermIntro: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
            <Sequence from={INTRO_SCENE.TITLE.start} durationInFrames={INTRO_SCENE.TITLE.duration}>
                <IntroTitleScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.PROBLEM.start} durationInFrames={INTRO_SCENE.PROBLEM.duration}>
                <IntroProblemScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.SOLUTION.start} durationInFrames={INTRO_SCENE.SOLUTION.duration}>
                <IntroSolutionScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.SURFACES.start} durationInFrames={INTRO_SCENE.SURFACES.duration}>
                <IntroSurfacesScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.CANVAS_AI.start} durationInFrames={INTRO_SCENE.CANVAS_AI.duration}>
                <IntroCanvasAiScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.VALUES.start} durationInFrames={INTRO_SCENE.VALUES.duration}>
                <IntroValuesScene />
            </Sequence>
            <Sequence from={INTRO_SCENE.CTA.start} durationInFrames={INTRO_SCENE.CTA.duration}>
                <IntroCtaScene />
            </Sequence>
        </AbsoluteFill>
    );
};
