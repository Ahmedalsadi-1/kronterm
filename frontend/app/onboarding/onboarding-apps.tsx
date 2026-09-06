// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { EmojiButton } from "@/app/element/emojibutton";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useEffect, useState } from "react";
import { CurrentOnboardingVersion, FeatureBadge, FeatureBullet, FeaturePageLayout } from "./onboarding-common";
import { OnboardingFooter } from "./onboarding-features-footer";

const appItems = [
    { icon: "fa-solid fa-terminal", name: "Terminal", color: "text-accent", desc: "Shell sessions" },
    { icon: "fa-solid fa-globe", name: "Browser", color: "text-blue-400", desc: "Web views" },
    { icon: "fa-solid fa-sparkles", name: "KronosCode", color: "text-accent", desc: "AI assistant" },
    { icon: "fa-solid fa-code", name: "Editor", color: "text-purple-400", desc: "Code editing" },
    { icon: "fa-solid fa-file-lines", name: "Preview", color: "text-yellow-400", desc: "File viewer" },
    { icon: "fa-solid fa-desktop", name: "Sandbox", color: "text-sky-400", desc: "Linux desktop" },
];

const AppsDemo = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % appItems.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-[400px] bg-background rounded-xl border border-border/50 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface-hover/30">
                <i className="fa-solid fa-grid-2 text-[11px] text-foreground/50" />
                <span className="text-[11px] text-foreground/50">Installed Apps</span>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
                <div className="grid grid-cols-2 gap-2.5">
                    {appItems.map((app, i) => (
                        <div
                            key={app.name}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                                i === activeIndex
                                    ? "bg-accent/10 border-accent/40 ring-1 ring-accent/20"
                                    : "bg-surface-raised border-border/30"
                            }`}
                        >
                            <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                    i === activeIndex ? "bg-accent/20" : "bg-surface-hover"
                                }`}
                            >
                                <i className={`${app.icon} text-sm ${app.color}`} />
                            </div>
                            <div className="flex flex-col">
                                <span
                                    className={`text-[12px] font-medium ${
                                        i === activeIndex ? "text-accent" : "text-foreground/80"
                                    }`}
                                >
                                    {app.name}
                                </span>
                                <span className="text-[10px] text-foreground/40">{app.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const AppsPage = ({
    onFinish,
    onPrev,
    currentStep,
    totalSteps,
}: {
    onFinish: () => void;
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
                    "onboarding:feature": "apps",
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
                <div className="text-[25px] font-normal text-foreground">Apps & Widgets</div>
            </header>
            <FeaturePageLayout title="Apps & Widgets" demo={<AppsDemo />} demoWidth="w-[400px]">
                <FeatureBadge icon="fa-solid fa-grid-2" iconColor="text-saturn">
                    Your Terminal, App Store
                </FeatureBadge>

                <FeatureBullet icon="fa-solid fa-puzzle-piece">
                    Launch terminals, browsers, editors, AI panels, and sandboxes as blocks in your canvas
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-wand-magic-sparkles">
                    Widgets sidebar gives you one-click access to all installed apps and tools
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-plug">
                    Extend with MCP servers, custom widgets, and ACP-compatible external agents
                </FeatureBullet>

                <p className="text-secondary leading-relaxed italic">
                    Everything you need, one click away. No context switching.
                </p>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter currentStep={currentStep} totalSteps={totalSteps} onNext={onFinish} onPrev={onPrev} />
        </div>
    );
};
