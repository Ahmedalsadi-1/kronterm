// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { cn } from "@/util/util";

export const OnboardingFooter = ({
    currentStep,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
}: {
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrev?: () => void;
    onSkip?: () => void;
}) => {
    const isLastStep = currentStep === totalSteps;
    const buttonText = isLastStep ? "Get Started" : "Next";

    return (
        <footer className="unselectable flex-shrink-0 mt-5 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
                {currentStep > 1 && onPrev && (
                    <button
                        className="text-muted cursor-pointer hover:text-foreground text-[13px] transition-colors"
                        onClick={onPrev}
                    >
                        &lt; Prev
                    </button>
                )}
            </div>
            <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                        <div
                            key={step}
                            className={cn(
                                "rounded-full transition-all duration-300",
                                step === currentStep
                                    ? "w-6 h-2 bg-accent"
                                    : step < currentStep
                                      ? "w-2 h-2 bg-accent/50"
                                      : "w-2 h-2 bg-border"
                            )}
                        />
                    ))}
                </div>
                <Button className="font-[600] !px-6 !py-2 text-sm" onClick={onNext}>
                    {buttonText}
                </Button>
            </div>
            {!isLastStep && onSkip && (
                <button
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-muted cursor-pointer hover:text-muted-hover text-[13px] transition-colors"
                    onClick={onSkip}
                >
                    Skip Tour &gt;
                </button>
            )}
        </footer>
    );
};
