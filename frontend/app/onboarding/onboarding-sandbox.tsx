// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { EmojiButton } from "@/app/element/emojibutton";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useEffect, useState } from "react";
import { CurrentOnboardingVersion, FeatureBadge, FeatureBullet, FeaturePageLayout } from "./onboarding-common";
import { OnboardingFooter } from "./onboarding-features-footer";

const SandboxDemo = () => {
    const [cursorPos, setCursorPos] = useState({ x: 120, y: 80 });
    const [showClick, setShowClick] = useState(false);

    useEffect(() => {
        const positions = [
            { x: 120, y: 80 },
            { x: 200, y: 120 },
            { x: 160, y: 160 },
            { x: 280, y: 100 },
            { x: 120, y: 80 },
        ];
        let index = 0;

        const interval = setInterval(() => {
            index = (index + 1) % positions.length;
            setCursorPos(positions[index]);
            setShowClick(true);
            setTimeout(() => setShowClick(false), 300);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-[400px] bg-background rounded-xl border border-border/50 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface-hover/30">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[11px] text-foreground/50 font-mono ml-2">Sandbox Desktop</span>
            </div>
            <div className="flex-1 relative bg-gradient-to-br from-surface-raised to-surface-base overflow-hidden">
                <div className="absolute inset-0 p-4">
                    <div className="flex gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border/40 flex items-center justify-center">
                            <i className="fa-solid fa-firefox-browser text-lg text-orange-400/70" />
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border/40 flex items-center justify-center">
                            <i className="fa-solid fa-terminal text-lg text-foreground/50" />
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border/40 flex items-center justify-center">
                            <i className="fa-solid fa-folder text-lg text-blue-400/70" />
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border/40 flex items-center justify-center">
                            <i className="fa-solid fa-code text-lg text-accent/70" />
                        </div>
                    </div>
                    <div className="w-full h-32 rounded-lg bg-surface-overlay border border-border/30 p-2">
                        <div className="font-mono text-[10px] text-foreground/60 leading-relaxed">
                            <div>
                                <span className="text-accent">user@sandbox</span>:
                                <span className="text-blue-400">~</span>$ ls
                            </div>
                            <div className="text-foreground/40">Documents Downloads projects</div>
                            <div>
                                <span className="text-accent">user@sandbox</span>:
                                <span className="text-blue-400">~</span>$ _
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    className="absolute transition-all duration-500 ease-out pointer-events-none"
                    style={{ left: cursorPos.x, top: cursorPos.y }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M1 1L6 14L8 8L14 6L1 1Z" fill="white" stroke="black" strokeWidth="1" />
                    </svg>
                    {showClick && (
                        <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full border-2 border-accent/60 animate-ping" />
                    )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-surface-overlay/80 border-t border-border/30 flex items-center px-3 gap-4">
                    <i className="fa-solid fa-bars text-[10px] text-foreground/40" />
                    <span className="text-[10px] text-foreground/40 font-mono">Linux Desktop</span>
                </div>
            </div>
        </div>
    );
};

export const SandboxPage = ({
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
                    "onboarding:feature": "sandbox",
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
                <div className="text-[25px] font-normal text-foreground">Sandbox Desktop</div>
            </header>
            <FeaturePageLayout title="Sandbox Desktop" demo={<SandboxDemo />} demoWidth="w-[420px]">
                <FeatureBadge icon="fa-solid fa-desktop" iconColor="text-sky-400">
                    Full Linux Desktop, Built In
                </FeatureBadge>

                <FeatureBullet icon="fa-solid fa-shield-halved">
                    Run GUI apps, browse the web, and test UIs in an isolated sandbox — all from your terminal
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-computer">
                    Full Linux desktop environment with Firefox, VS Code, file manager, and terminal
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-bolt">
                    Spin up and tear down in seconds — perfect for testing, demos, and safe experimentation
                </FeatureBullet>

                <p className="text-secondary leading-relaxed italic">
                    A disposable desktop that lives inside your terminal. No VM setup required.
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
