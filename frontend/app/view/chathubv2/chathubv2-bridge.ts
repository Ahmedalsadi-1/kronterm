// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { SettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import { resolveKronSettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import type { LiveAgentSurfaceActivity } from "../../../types/agent-activity";

export interface KronTermThemeSnapshot {
    background: string;
    foreground: string;
    card: string;
    muted: string;
    mutedForeground: string;
    primary: string;
    primaryForeground: string;
    border: string;
    input: string;
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

    return {
        background: read("--main-bg-color", "#171414"),
        foreground: read("--text-primary-color", "#d9d4c8"),
        card: read("--surface-raised-color", "#211e1d"),
        muted: read("--surface-active-color", "#35302d"),
        mutedForeground: read("--text-muted-color", "#aaa296"),
        primary: read("--accent-color", "#edb449"),
        primaryForeground: read("--main-bg-color", "#171414"),
        border: read("--border-color", "rgba(218, 198, 165, 0.16)"),
        input: read("--form-element-bg-color", "#1c1918"),
        fontSans: read("--font-default", '"IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace'),
        fontMono: read("--font-mono-family", '"IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace'),
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
