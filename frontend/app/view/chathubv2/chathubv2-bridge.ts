// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { SettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import { resolveKronSettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import type { LiveAgentSurfaceActivity } from "../../../types/agent-activity";

export interface KronTermThemeSnapshot {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
    midground: string;
    composerRing: string;
    destructive: string;
    destructiveForeground: string;
    sidebarBackground: string;
    sidebarBorder: string;
    userBubble: string;
    userBubbleBorder: string;
    fontSans: string;
    fontMono: string;
}

export function makeEmbeddedChatUrl(url: string, surfaceId?: string): string {
    try {
        const chatUrl = new URL(url);
        chatUrl.searchParams.set("apiBaseUrl", new URL("/api", chatUrl.origin).toString());
        chatUrl.searchParams.set("embeddedHost", "kronterm");
        chatUrl.searchParams.set("tab", "canvas");
        if (surfaceId) {
            chatUrl.searchParams.set("surfaceId", surfaceId);
        }
        return chatUrl.toString();
    } catch {
        return url;
    }
}

export function makeKronSettingsBlockDef(section: unknown): BlockDef {
    return {
        meta: {
            view: "kronsettings",
            "kronsettings:section": resolveKronSettingsSection(section),
            "kronsettings:source": "kronoschamber",
        } as MetaType,
    };
}

export function readKronTermThemeSnapshot(
    styles: Pick<CSSStyleDeclaration, "getPropertyValue">
): KronTermThemeSnapshot {
    const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const readSemantic = (name: string, legacyName: string, fallback: string) => read(name, read(legacyName, fallback));

    const background = readSemantic("--hermes-background", "--main-bg-color", "#09090b");
    const foreground = readSemantic("--hermes-foreground", "--text-primary-color", "#f4f4f5");
    const card = readSemantic("--hermes-card", "--surface-raised-color", "#111113");
    const muted = readSemantic("--hermes-muted", "--surface-active-color", "#19191c");
    const popover = readSemantic("--hermes-popover", "--surface-overlay-color", "#151518");
    const primary = readSemantic("--hermes-primary", "--accent-color", "#f4f4f5");
    const midground = readSemantic("--hermes-midground", "--accent-color", "#7c9cff");
    const border = readSemantic("--hermes-border", "--border-color", "rgb(255 255 255 / 0.12)");

    return {
        background,
        foreground,
        card,
        cardForeground: read("--hermes-card-foreground", foreground),
        muted,
        mutedForeground: readSemantic("--hermes-muted-foreground", "--text-muted-color", "#a1a1aa"),
        popover,
        popoverForeground: read("--hermes-popover-foreground", foreground),
        primary,
        primaryForeground: read("--hermes-primary-foreground", background),
        secondary: readSemantic("--hermes-secondary", "--surface-active-color", muted),
        secondaryForeground: readSemantic("--hermes-secondary-foreground", "--text-secondary-color", foreground),
        accent: readSemantic("--hermes-accent", "--surface-selected-color", muted),
        accentForeground: read("--hermes-accent-foreground", foreground),
        border,
        input: readSemantic("--hermes-input", "--form-element-border-color", border),
        ring: readSemantic("--hermes-ring", "--focus-ring-color", midground),
        midground,
        composerRing: read("--hermes-composer-ring", midground),
        destructive: readSemantic("--hermes-destructive", "--error-color", "#e5484d"),
        destructiveForeground: read("--hermes-destructive-foreground", "#fff7f7"),
        sidebarBackground: readSemantic("--hermes-sidebar", "--panel-bg-color", background),
        sidebarBorder: read("--hermes-sidebar-border", border),
        userBubble: readSemantic("--hermes-user-bubble", "--surface-raised-color", card),
        userBubbleBorder: read("--hermes-user-bubble-border", border),
        fontSans: readSemantic(
            "--hermes-font-sans",
            "--font-default",
            '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
        ),
        fontMono: readSemantic(
            "--hermes-font-mono",
            "--font-mono-family",
            '"JetBrains Mono", "SFMono-Regular", Menlo, monospace'
        ),
    };
}

export function makeKronTermThemeMessage(theme: KronTermThemeSnapshot) {
    return {
        type: "kronterm:theme-sync" as const,
        theme,
    };
}

export function makeKronTermPowerResumeMessage() {
    return {
        type: "kronterm:power-resume" as const,
    };
}

export function makeKronTermSurfaceActivityMessage(activity: LiveAgentSurfaceActivity) {
    return {
        type: "kronterm:surface-activity" as const,
        activity,
    };
}

export function resolveRequestedSettingsSection(value: unknown): SettingsSection {
    return resolveKronSettingsSection(value);
}
