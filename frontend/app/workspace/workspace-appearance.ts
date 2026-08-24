// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const WorkspaceAppearanceStorageKey = "kronterm:workspace-appearance";
const WorkspaceAppearanceChangedEvent = "kronterm:workspace-appearance-changed";

type WorkspaceFontStyle = "hermes" | "mono" | "system";
type WorkspaceDensity = "compact" | "comfortable";
type WorkspaceIconStyle = "minimal" | "soft";

type WorkspaceAppearance = {
    font: WorkspaceFontStyle;
    density: WorkspaceDensity;
    icons: WorkspaceIconStyle;
};

const DefaultWorkspaceAppearance: WorkspaceAppearance = {
    font: "hermes",
    density: "comfortable",
    icons: "soft",
};

const FontFamilies: Record<WorkspaceFontStyle, string> = {
    hermes: '"IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace',
    mono: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

function readWorkspaceAppearance(): WorkspaceAppearance {
    try {
        const stored = JSON.parse(
            window.localStorage.getItem(WorkspaceAppearanceStorageKey) ?? "{}"
        ) as Partial<WorkspaceAppearance>;
        return {
            font: stored.font === "mono" || stored.font === "system" ? stored.font : "hermes",
            density: stored.density === "compact" ? "compact" : "comfortable",
            icons: stored.icons === "minimal" ? "minimal" : "soft",
        };
    } catch {
        return DefaultWorkspaceAppearance;
    }
}

function applyWorkspaceAppearance(appearance: WorkspaceAppearance): void {
    const root = document.documentElement;
    root.style.setProperty("--font-default", FontFamilies[appearance.font]);
    root.style.setProperty("--markdown-font-family", FontFamilies[appearance.font]);
    root.dataset.krontermDensity = appearance.density;
    root.dataset.krontermIcons = appearance.icons;
}

function publishWorkspaceAppearance(appearance: WorkspaceAppearance): void {
    applyWorkspaceAppearance(appearance);
    try {
        window.localStorage.setItem(WorkspaceAppearanceStorageKey, JSON.stringify(appearance));
        window.dispatchEvent(new CustomEvent(WorkspaceAppearanceChangedEvent, { detail: appearance }));
    } catch (error) {
        console.warn("[KronTerm] workspace appearance update failed", error);
    }
}

export {
    WorkspaceAppearanceChangedEvent,
    applyWorkspaceAppearance,
    publishWorkspaceAppearance,
    readWorkspaceAppearance,
    type WorkspaceAppearance,
};
