import React from "react";
import { Composition } from "remotion";
import { KronTermFieldGuide } from "./FieldGuideVideo";
import { KronTermIntro } from "./IntroVideo";
import { KronTermOnboarding } from "./Video";
import { HEIGHT, INTRO_TOTAL_FRAMES, TOTAL_FRAMES, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="KronTermIntro"
                component={KronTermIntro}
                durationInFrames={INTRO_TOTAL_FRAMES}
                fps={30}
                width={WIDTH}
                height={HEIGHT}
            />
            <Composition
                id="KronTermOnboarding"
                component={KronTermOnboarding}
                durationInFrames={TOTAL_FRAMES}
                fps={30}
                width={WIDTH}
                height={HEIGHT}
            />
            <Composition
                id="KronTermFieldGuide"
                component={KronTermFieldGuide}
                durationInFrames={450}
                fps={30}
                width={1920}
                height={1080}
            />
        </>
    );
};
