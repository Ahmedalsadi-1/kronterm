// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { InitPage, NoTelemetryStarPage } from "@/app/onboarding/onboarding";
import { AppsPage } from "@/app/onboarding/onboarding-apps";
import { CanvasPage } from "@/app/onboarding/onboarding-canvas";
import { OnboardingGradientBg } from "@/app/onboarding/onboarding-common";
import { DurableSessionPage } from "@/app/onboarding/onboarding-durable";
import { FilesPage, MagnifyBlocksPage, WaveAIPage } from "@/app/onboarding/onboarding-features";
import { SandboxPage } from "@/app/onboarding/onboarding-sandbox";
import { StarAskPage } from "@/app/onboarding/onboarding-starask";
import { UpgradeMinorWelcomePage } from "@/app/onboarding/onboarding-upgrade-minor";
import { UpgradeOnboardingFooter, UpgradeOnboardingVersions } from "@/app/onboarding/onboarding-upgrade-patch";

function OnboardingModalWrapper({ width, children }: { width: string; children: React.ReactNode }) {
    return (
        <div className={`${width} rounded-[10px] p-[30px] relative overflow-hidden bg-panel`}>
            <OnboardingGradientBg />
            <div className="relative z-10 flex flex-col w-full h-full">{children}</div>
        </div>
    );
}

function OnboardingFeaturesV() {
    const noop = () => {};
    return (
        <div className="flex flex-col w-full gap-8">
            <OnboardingModalWrapper width="w-[560px]">
                <InitPage isCompact={false} telemetryUpdateFn={async () => {}} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[560px]">
                <NoTelemetryStarPage isCompact={false} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <WaveAIPage onNext={noop} onSkip={noop} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <DurableSessionPage onNext={noop} onSkip={noop} onPrev={noop} currentStep={2} totalSteps={7} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <CanvasPage onNext={noop} onSkip={noop} onPrev={noop} currentStep={3} totalSteps={7} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <MagnifyBlocksPage onNext={noop} onSkip={noop} onPrev={noop} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <FilesPage onNext={noop} onSkip={noop} onPrev={noop} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <SandboxPage onNext={noop} onSkip={noop} onPrev={noop} currentStep={6} totalSteps={7} />
            </OnboardingModalWrapper>
            <OnboardingModalWrapper width="w-[860px]">
                <AppsPage onFinish={noop} onPrev={noop} currentStep={7} totalSteps={7} />
            </OnboardingModalWrapper>
        </div>
    );
}

function UpgradeOnboardingPatchV() {
    const noop = () => {};
    return (
        <div className="flex flex-col gap-6 w-full max-w-[900px]">
            {UpgradeOnboardingVersions.map((version, idx) => {
                const hasPrev = idx > 0;
                const hasNext = idx < UpgradeOnboardingVersions.length - 1;
                return (
                    <OnboardingModalWrapper key={version.version} width="w-[650px]">
                        <header className="flex flex-col gap-2 border-b-0 p-0 mt-1 mb-6 w-full unselectable flex-shrink-0">
                            <div className="flex justify-center">
                                <Logo />
                            </div>
                            <div className="text-center text-[25px] font-normal text-foreground">
                                KronTerm {version.version} Update
                            </div>
                        </header>
                        <div className="flex-1">{version.content()}</div>
                        <UpgradeOnboardingFooter
                            hasPrev={hasPrev}
                            hasNext={hasNext}
                            prevText={version.prevText}
                            nextText={version.nextText}
                            onPrev={noop}
                            onNext={noop}
                            onClose={noop}
                        />
                    </OnboardingModalWrapper>
                );
            })}
        </div>
    );
}

function UpgradeOnboardingMinorV() {
    const noop = () => {};
    return (
        <OnboardingModalWrapper width="w-[600px]">
            <UpgradeMinorWelcomePage onStarClick={noop} onAlreadyStarred={noop} onMaybeLater={noop} />
        </OnboardingModalWrapper>
    );
}

function StarAskV() {
    const noop = () => {};
    return (
        <OnboardingModalWrapper width="w-[500px]">
            <StarAskPage onClose={noop} />
        </OnboardingModalWrapper>
    );
}

export function OnboardingPreview() {
    return (
        <div className="w-full max-w-[1300px] py-10 px-4 flex flex-col gap-8">
            <div className="text-sm font-mono text-muted">Onboarding features</div>
            <OnboardingFeaturesV />
            <div className="text-sm font-mono text-muted mt-6">Onboarding minor upgrade</div>
            <UpgradeOnboardingMinorV />
            <div className="text-sm font-mono text-muted mt-6">Onboarding star ask</div>
            <StarAskV />
            <div className="text-sm font-mono text-muted mt-6">Onboarding patch updates</div>
            <UpgradeOnboardingPatchV />
        </div>
    );
}
