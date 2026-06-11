// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { EmojiButton } from "@/app/element/emojibutton";
import { MagnifyIcon } from "@/app/element/magnify";
import { ClientModel } from "@/app/store/client-model";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { isMacOS } from "@/util/platformutil";
import { useEffect, useState } from "react";
import { FakeChat } from "./fakechat";
import { AppsPage } from "./onboarding-apps";
import { CanvasPage } from "./onboarding-canvas";
import { EditBashrcCommand, ViewLogoCommand, ViewShortcutsCommand } from "./onboarding-command";
import { CurrentOnboardingVersion, FeatureBadge, FeatureBullet, FeaturePageLayout } from "./onboarding-common";
import { DurableSessionPage } from "./onboarding-durable";
import { OnboardingFooter } from "./onboarding-features-footer";
import { FakeLayout } from "./onboarding-layout";
import { SandboxPage } from "./onboarding-sandbox";

type FeaturePageName = "waveai" | "durable" | "canvas" | "magnify" | "files" | "sandbox" | "apps";

const TOTAL_STEPS = 7;

const PAGE_ORDER: FeaturePageName[] = ["waveai", "durable", "canvas", "magnify", "files", "sandbox", "apps"];

function getPageStep(page: FeaturePageName): number {
    return PAGE_ORDER.indexOf(page) + 1;
}

export const WaveAIPage = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
    const isMac = isMacOS();
    const shortcutKey = isMac ? "⌘-Shift-A" : "Alt-Shift-A";
    const [fireClicked, setFireClicked] = useState(false);

    const handleFireClick = () => {
        setFireClicked(!fireClicked);
        if (!fireClicked) {
            RpcApi.RecordTEventCommand(TabRpcClient, {
                event: "onboarding:fire",
                props: {
                    "onboarding:feature": "waveai",
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
                <div className="text-[25px] font-normal text-foreground">KronosCode</div>
            </header>
            <FeaturePageLayout
                title="KronosCode"
                demo={
                    <div className="w-full h-[400px] bg-background rounded-xl border border-border/50 overflow-hidden">
                        <FakeChat />
                    </div>
                }
            >
                <FeatureBadge icon="fa fa-sparkles">
                    <span className="font-mono">AI Assistant</span>
                </FeatureBadge>

                <div className="flex flex-col items-start gap-4 text-secondary">
                    <p>
                        KronosCode is your terminal assistant with context. I can read your terminal output, analyze
                        widgets, read/write files, and help you solve problems faster.
                    </p>
                </div>

                <FeatureBullet icon="fa fa-sparkles">
                    Toggle the KronosCode panel with the{" "}
                    <span className="inline-flex h-[22px] px-1.5 items-center rounded-md box-border bg-surface-hover text-accent text-[11px] align-middle">
                        <i className="fa fa-sparkles" />
                        <span className="font-bold ml-1 font-mono">AI</span>
                    </span>{" "}
                    button in the header (top left)
                </FeatureBullet>

                <FeatureBullet icon="fa fa-keyboard">
                    Or use{" "}
                    <span className="font-mono font-semibold text-foreground whitespace-nowrap">{shortcutKey}</span> to
                    quickly toggle
                </FeatureBullet>

                <FeatureBullet icon="fa fa-key">
                    Bring your own API keys or run local models with Ollama, LM Studio, and other OpenAI-compatible
                    providers
                </FeatureBullet>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter
                currentStep={getPageStep("waveai")}
                totalSteps={TOTAL_STEPS}
                onNext={onNext}
                onSkip={onSkip}
            />
        </div>
    );
};

export const MagnifyBlocksPage = ({
    onNext,
    onSkip,
    onPrev,
}: {
    onNext: () => void;
    onSkip: () => void;
    onPrev?: () => void;
}) => {
    const isMac = isMacOS();
    const shortcutKey = isMac ? "⌘" : "Alt";
    const [fireClicked, setFireClicked] = useState(false);

    const handleFireClick = () => {
        setFireClicked(!fireClicked);
        if (!fireClicked) {
            RpcApi.RecordTEventCommand(TabRpcClient, {
                event: "onboarding:fire",
                props: {
                    "onboarding:feature": "magnify",
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
                <div className="text-[25px] font-normal text-foreground">Magnify Blocks</div>
            </header>
            <FeaturePageLayout title="Magnify Blocks" demo={<FakeLayout />}>
                <div className="text-5xl font-semibold text-foreground tracking-tight">{shortcutKey}-M</div>

                <FeatureBadge icon="fa-solid fa-up-right-and-down-left-from-center">Focus on What Matters</FeatureBadge>

                <div className="flex flex-col items-start gap-4 text-secondary">
                    <p>
                        Magnify any block to focus on what matters. Expand terminals, editors, and previews for a better
                        view.
                    </p>
                </div>

                <FeatureBullet icon="fa-solid fa-maximize">
                    Click the{" "}
                    <span className="inline-block align-middle [&_svg_path]:!fill-foreground">
                        <MagnifyIcon enabled={false} />
                    </span>{" "}
                    icon in the block header, or press {shortcutKey}-M to toggle
                </FeatureBullet>

                <FeatureBullet icon="fa-solid fa-arrows-to-dot">
                    Works with terminals, editors, previews, and any other block type
                </FeatureBullet>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter
                currentStep={getPageStep("magnify")}
                totalSteps={TOTAL_STEPS}
                onNext={onNext}
                onPrev={onPrev}
                onSkip={onSkip}
            />
        </div>
    );
};

export const FilesPage = ({
    onNext,
    onSkip,
    onPrev,
}: {
    onNext: () => void;
    onSkip: () => void;
    onPrev?: () => void;
}) => {
    const [fireClicked, setFireClicked] = useState(false);
    const isMac = isMacOS();
    const [commandIndex, setCommandIndex] = useState(0);

    const handleFireClick = () => {
        setFireClicked(!fireClicked);
        if (!fireClicked) {
            RpcApi.RecordTEventCommand(TabRpcClient, {
                event: "onboarding:fire",
                props: {
                    "onboarding:feature": "wsh",
                    "onboarding:version": CurrentOnboardingVersion,
                },
            });
        }
    };

    const commands = [
        (onComplete: () => void) => <EditBashrcCommand onComplete={onComplete} />,
        (onComplete: () => void) => <ViewShortcutsCommand isMac={isMac} onComplete={onComplete} />,
        (onComplete: () => void) => <ViewLogoCommand onComplete={onComplete} />,
    ];

    const handleCommandComplete = () => {
        setTimeout(() => {
            setCommandIndex((prev) => (prev + 1) % commands.length);
        }, 2500);
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center gap-4 mb-6 w-full unselectable flex-shrink-0">
                <div>
                    <Logo />
                </div>
                <div className="text-[25px] font-normal text-foreground">Viewing & Editing Files</div>
            </header>
            <FeaturePageLayout
                title="Viewing & Editing Files"
                demo={<div className="w-full">{commands[commandIndex](handleCommandComplete)}</div>}
            >
                <FeatureBadge icon="fa-solid fa-file-pen" iconColor="text-purple-400">
                    Built-in Viewer & Editor
                </FeatureBadge>

                <div className="flex flex-col items-start gap-4 text-secondary">
                    <p>
                        KronTerm can preview markdown, images, and video files on both local <i>and remote</i> machines.
                    </p>
                </div>

                <FeatureBullet icon="fa fa-eye">
                    <span className="font-mono font-semibold text-foreground">wsh view [filename]</span> — preview files
                    in KronTerm's graphical viewer
                </FeatureBullet>

                <FeatureBullet icon="fa fa-pen-to-square">
                    <span className="font-mono font-semibold text-foreground">wsh edit [filename]</span> — open config
                    files or code in KronTerm's graphical editor
                </FeatureBullet>

                <p className="text-secondary leading-relaxed italic">
                    Works seamlessly on both local and remote machines.
                </p>

                <EmojiButton emoji="🔥" isClicked={fireClicked} onClick={handleFireClick} />
            </FeaturePageLayout>
            <OnboardingFooter
                currentStep={getPageStep("files")}
                totalSteps={TOTAL_STEPS}
                onNext={onNext}
                onPrev={onPrev}
                onSkip={onSkip}
            />
        </div>
    );
};

export const OnboardingFeatures = ({ onComplete }: { onComplete: () => void }) => {
    const [currentPage, setCurrentPage] = useState<FeaturePageName>("waveai");

    useEffect(() => {
        const clientId = ClientModel.getInstance().clientId;
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("client", clientId),
            meta: { "onboarding:lastversion": CurrentOnboardingVersion },
        });
        RpcApi.RecordTEventCommand(TabRpcClient, {
            event: "onboarding:start",
            props: {
                "onboarding:version": CurrentOnboardingVersion,
            },
        });
    }, []);

    const currentIndex = PAGE_ORDER.indexOf(currentPage);

    const handleNext = () => {
        if (currentIndex < PAGE_ORDER.length - 1) {
            setCurrentPage(PAGE_ORDER[currentIndex + 1]);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentPage(PAGE_ORDER[currentIndex - 1]);
        }
    };

    const handleSkip = () => {
        RpcApi.RecordTEventCommand(TabRpcClient, {
            event: "onboarding:skip",
            props: {},
        });
        onComplete();
    };

    const handleFinish = () => {
        onComplete();
    };

    let pageComp: React.JSX.Element = null;
    switch (currentPage) {
        case "waveai":
            pageComp = <WaveAIPage onNext={handleNext} onSkip={handleSkip} />;
            break;
        case "durable":
            pageComp = (
                <DurableSessionPage
                    onNext={handleNext}
                    onSkip={handleSkip}
                    onPrev={handlePrev}
                    currentStep={getPageStep("durable")}
                    totalSteps={TOTAL_STEPS}
                />
            );
            break;
        case "canvas":
            pageComp = (
                <CanvasPage
                    onNext={handleNext}
                    onSkip={handleSkip}
                    onPrev={handlePrev}
                    currentStep={getPageStep("canvas")}
                    totalSteps={TOTAL_STEPS}
                />
            );
            break;
        case "magnify":
            pageComp = <MagnifyBlocksPage onNext={handleNext} onSkip={handleSkip} onPrev={handlePrev} />;
            break;
        case "files":
            pageComp = <FilesPage onNext={handleNext} onSkip={handleSkip} onPrev={handlePrev} />;
            break;
        case "sandbox":
            pageComp = (
                <SandboxPage
                    onNext={handleNext}
                    onSkip={handleSkip}
                    onPrev={handlePrev}
                    currentStep={getPageStep("sandbox")}
                    totalSteps={TOTAL_STEPS}
                />
            );
            break;
        case "apps":
            pageComp = (
                <AppsPage
                    onFinish={handleFinish}
                    onPrev={handlePrev}
                    currentStep={getPageStep("apps")}
                    totalSteps={TOTAL_STEPS}
                />
            );
            break;
    }

    return <div className="flex flex-col w-full h-full">{pageComp}</div>;
};
