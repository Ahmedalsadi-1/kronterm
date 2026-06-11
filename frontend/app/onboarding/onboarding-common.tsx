// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { type ReactNode } from "react";

export const CurrentOnboardingVersion = "v0.14.3";

export function OnboardingGradientBg() {
    return (
        <>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.18] via-transparent to-accent/[0.04] pointer-events-none rounded-[10px]" />
            <div className="absolute inset-0 pointer-events-none rounded-[10px] overflow-hidden opacity-30">
                <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-accent/20 blur-[80px]" />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-accent/10 blur-[60px]" />
            </div>
        </>
    );
}

export function FeatureBadge({ icon, iconColor, children }: { icon: string; iconColor?: string; children: ReactNode }) {
    return (
        <div className="flex h-[48px] px-4 items-center gap-2.5 rounded-xl bg-surface-hover border border-border/60">
            <i className={cn(icon, "text-lg", iconColor ?? "text-accent")} />
            <span className="font-semibold text-[15px] text-primary">{children}</span>
        </div>
    );
}

export function FeatureBullet({ icon, children }: { icon: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 w-full">
            <i className={cn(icon, "text-accent text-base mt-0.5 flex-shrink-0")} />
            <p className="text-secondary leading-relaxed">{children}</p>
        </div>
    );
}

export function FeaturePageLayout({
    title,
    children,
    demo,
    demoWidth = "w-[400px]",
}: {
    title: string;
    children: ReactNode;
    demo: ReactNode;
    demoWidth?: string;
}) {
    return (
        <div className="flex-1 flex flex-row gap-0 min-h-0">
            <div className="flex-1 flex flex-col items-center justify-center gap-6 pr-6 unselectable">
                <div className="flex flex-col items-start gap-5 max-w-md">{children}</div>
            </div>
            <div className="w-px bg-border/60 flex-shrink-0" />
            <div className={cn("flex items-center justify-center pl-6 flex-shrink-0", demoWidth)}>{demo}</div>
        </div>
    );
}

export function PageTransitionWrapper({ children, active }: { children: ReactNode; active: boolean }) {
    return (
        <div
            className={cn(
                "flex flex-col w-full h-full transition-all duration-300 ease-out",
                active ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none absolute inset-0"
            )}
        >
            {children}
        </div>
    );
}
