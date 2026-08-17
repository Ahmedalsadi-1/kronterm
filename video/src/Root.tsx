import React from "react";
import { Composition } from "remotion";
import { KronTermFieldGuide } from "./FieldGuideVideo";
import { KronTermOnboarding } from "./Video";
import { HEIGHT, TOTAL_FRAMES, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
    return (
        <>
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
