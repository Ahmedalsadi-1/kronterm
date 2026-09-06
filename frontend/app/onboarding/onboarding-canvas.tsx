// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { EmojiButton } from "@/app/element/emojibutton";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useState } from "react";
import { CurrentOnboardingVersion, FeatureBadge, FeatureBullet, FeaturePageLayout } from "./onboarding-common";
import { OnboardingFooter } from "./onboarding-features-footer";

const CanvasDemo = () => {
    return (
        <div className="w-full h-[400px] bg-background rounded-xl border border-border/50 overflow-hidden p-3">
            <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-2">
                <div className="col-span-2 row-span-1 bg-surface-raised rounded-lg border border-border/40 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30 bg-surface-hover/50">
                        <i className="fa-solid fa-terminal text-[10px] text-foreground/60" />
                        <span className="text-[10px] text-foreground/60">Terminal</span>
                    </div>
                    <div className="flex-1 p-2 font-mono text-[10px] text-foreground/70 leading-relaxed">
                        <div>
                            <span className="text-accent">$</span> npm run dev
                        </div>
                        <div className="text-foreground/50">Starting dev server...</div>
                        <div className="text-success">Ready on localhost:3000</div>
                    </div>
                </div>
                <div className="col-span-1 row-span-1 bg-surface-raised rounded-lg border border-border/40 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30 bg-surface-hover/50">
                        <i className="fa-solid fa-globe text-[10px] text-foreground/60" />
                        <span className="text-[10px] text-foreground/60">Browser</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <i className="fa-solid fa-globe text-2xl text-foreground/20" />
                    </div>
                </div>
                <div className="col-span-1 row-span-1 bg-surface-raised rounded-lg border border-accent/40 flex flex-col overflow-hidden ring-1 ring-accent/20">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30 bg-accent/5">
                        <i className="fa-solid fa-code text-[10px] text-accent" />
                        <span className="text-[10px] text-accent">Editor</span>
                    </div>
                    <div className="flex-1 p-2 font-mono text-[10px] text-foreground/70 leading-relaxed">
                        <div className="text-accent/70">
                            {"import"} <span className="text-foreground/80">{"{ useState }"}</span>
                        </div>
                        <div className="text-foreground/50">{"// component..."}</div>
                    </div>
                </div>
                <div className="col-span-1 row-span-1 bg-surface-raised rounded-lg border border-border/40 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30 bg-surface-hover/50">
                        <i className="fa-solid fa-sparkles text-[10px] text-accent" />
                        <span className="text-[10px] text-foreground/60">AI</span>
                    </div>
                    <div className="flex-1 p-2 text-[10px] text-foreground/50 leading-relaxed">
                        <div className="bg-surface-hover/50 rounded px-1.5 py-1 mb-1">Analyzing code...</div>
                        <div className="text-accent/70">Found 3 suggestions</div>
                    </div>
                </div>
                <div className="col-span-1 row-span-1 bg-surface-raised rounded-lg border border-border/40 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30 bg-surface-hover/50">
                        <i className="fa-solid fa-file-lines text-[10px] text-foreground/60" />
                        <span className="text-[10px] text-foreground/60">Preview</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <i className="fa-solid fa-image text-2xl text-foreground/20" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CanvasPage = ({
    onNext,
    onSkip,
    onPrev,
    currentStep,
    totalSteps,
}: {
    onNext: () => void;
    onSkip: () => void;
    onPrev?: () => void;
    currentStep: number;
    totalSteps: number;
}) => {
    const [fireClicked, setFireClicked] = useState(false);

    const handleFireClick = () => {
        setFireClicked(!fireClicked);
        if (!fireClicked) {
            RpcApi.RecordTEventCommand(TabRpcClient, {
                event: "onboarding:fire",
                props: {
                    "onboarding:feature": "canvas",
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
                <div className="text-[25px] font-normal text-foreground">The Canvas</div>
            </header>
            <FeaturePageLayout title="The Canvas" demo={<CanvasDemo />} demoWidth="w-[420px]">
                <FeatureBadge icon="fa-solid fa-table-cells-large">Multi-Block Workspace</FeatureBadge>

                <FeatureBullet icon="fa-solid fa-up-down-left-right">
                    Arrange terminals, editors, browsers, and AI panels in a resizable tile grid
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-expand">
                    Drag blocks to rearrange, pull edges to resize, and magnify any block to fullscreen
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-layer-group">
                    Each tab is its own canvas — switch between workspaces instantly
                </FeatureBullet>

                <p className="text-secondary leading-relaxed italic">
                    Your entire dev environment, visible at a glance. No more Alt-Tab hunting.
                </p>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter
                currentStep={currentStep}
                totalSteps={totalSteps}
                onNext={onNext}
                onPrev={onPrev}
                onSkip={onSkip}
            />
        </div>
    );
};
