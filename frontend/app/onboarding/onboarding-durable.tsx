// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { EmojiButton } from "@/app/element/emojibutton";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useState } from "react";
import { CurrentOnboardingVersion, FeatureBadge, FeatureBullet, FeaturePageLayout } from "./onboarding-common";
import { OnboardingFooter } from "./onboarding-features-footer";
import { TailDeployLogCommand } from "./onboarding-layout-term";

export const DurableSessionPage = ({
    onNext,
    onSkip,
    onPrev,
    currentStep,
    totalSteps,
}: {
    onNext: () => void;
    onSkip: () => void;
    onPrev?: () => void;
    currentStep?: number;
    totalSteps?: number;
}) => {
    const [fireClicked, setFireClicked] = useState(false);

    const handleFireClick = () => {
        setFireClicked(!fireClicked);
        if (!fireClicked) {
            RpcApi.RecordTEventCommand(TabRpcClient, {
                event: "onboarding:fire",
                props: {
                    "onboarding:feature": "durable",
                    "onboarding:version": CurrentOnboardingVersion,
                },
            });
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center gap-4 mb-6 w-full unselectable flex-shrink-0">
                <div>
                    <Logo />
                </div>
                <div className="text-[25px] font-normal text-foreground">Durable SSH Sessions</div>
            </header>
            <FeaturePageLayout title="Durable SSH Sessions" demo={<TailDeployLogCommand />} demoWidth="w-[500px]">
                <FeatureBadge icon="fa-sharp fa-solid fa-shield" iconColor="text-sky-500">
                    SSH Sessions, Protected
                </FeatureBadge>

                <div className="flex flex-col items-start gap-4 text-secondary">
                    <p>Close your laptop, switch networks, restart KronTerm — your remote sessions keep running.</p>
                </div>

                <FeatureBullet icon="fa-sharp fa-solid fa-link">
                    Shell state, running programs, and terminal history are all preserved
                </FeatureBullet>

                <FeatureBullet icon="fa-sharp fa-solid fa-rotate">
                    Sessions automatically reconnect when your connection is restored
                </FeatureBullet>

                <FeatureBullet icon="fa-sharp fa-solid fa-box">
                    Buffered output streams back in, never miss a line
                </FeatureBullet>

                <p className="text-secondary leading-relaxed italic">
                    All the persistence of tmux, built into your terminal. Look for the shield icon to enable durability
                    on any SSH session.
                </p>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter
                currentStep={currentStep ?? 2}
                totalSteps={totalSteps ?? 4}
                onNext={onNext}
                onPrev={onPrev}
                onSkip={onSkip}
            />
        </div>
    );
};
