// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValue } from "jotai";
import { memo } from "react";
import type { KronSettingsViewModel, SettingsSection } from "./kronsettings-model";
import { SETTINGS_SECTIONS } from "./kronsettings-model";
import { KronSettingsThemeContent } from "./kronsettings-theme";
import { KronSettingsVisualContent } from "./kronsettings-visual";
import { KronSettingsAboutContent } from "./kronsettings-about";
import { KronSettingsChatContent } from "./kronsettings-chat";
import { KronSettingsShortcutsContent } from "./kronsettings-shortcuts";
import { KronSettingsSessionsContent } from "./kronsettings-sessions";
import { KronSettingsGitContent } from "./kronsettings-git";
import { KronSettingsGitHubContent } from "./kronsettings-github";
import { KronSettingsNotificationsContent } from "./kronsettings-notifications";
import { KronSettingsVoiceContent } from "./kronsettings-voice";
import { KronSettingsDesktopContent } from "./kronsettings-desktop";
import { KronSettingsAgentsContent } from "./kronsettings-agents-panel";
import { KronSettingsCommandsContent } from "./kronsettings-commands";
import { KronSettingsSkillsContent } from "./kronsettings-skills";
import { KronSettingsMcpContent } from "./kronsettings-mcp-panel";
import { KronSettingsProvidersContent } from "./kronsettings-providers-panel";
import { KronSettingsUsageContent } from "./kronsettings-usage";

const SECTION_DESCRIPTIONS: Record<string, string> = {
    theme: "Choose a theme preset or define your own accent color.",
    visual: "Customize the appearance and behavior of your terminal.",
    chat: "Configure AI chat providers and conversation settings.",
    shortcuts: "View and learn keyboard shortcuts for KronTerm.",
    sessions: "Manage terminal session persistence and auto-cleanup.",
    git: "Set your Git identity for commits.",
    github: "Connect your GitHub account for issue and PR workflows.",
    notifications: "Control when and how KronTerm notifies you.",
    voice: "Configure voice input and AI response read-aloud.",
    desktop: "Allow AI agents to control your desktop environment.",
    about: "Version, platform info, and useful links.",
    agents: "Manage your AI agent configurations.",
    commands: "Agent Control Protocol commands reference.",
    skills: "Built-in agent skills and capabilities.",
    mcp: "Model Context Protocol server management.",
    providers: "AI provider configuration and API keys.",
    usage: "View your KronTerm usage statistics.",
};

const PageRenderer = memo(({ model, section }: { model: KronSettingsViewModel; section: SettingsSection }) => {
    switch (section) {
        case "theme":
            return <KronSettingsThemeContent model={model} />;
        case "visual":
            return <KronSettingsVisualContent model={model} />;
        case "chat":
            return <KronSettingsChatContent model={model} />;
        case "shortcuts":
            return <KronSettingsShortcutsContent model={model} />;
        case "sessions":
            return <KronSettingsSessionsContent model={model} />;
        case "git":
            return <KronSettingsGitContent model={model} />;
        case "github":
            return <KronSettingsGitHubContent model={model} />;
        case "notifications":
            return <KronSettingsNotificationsContent model={model} />;
        case "voice":
            return <KronSettingsVoiceContent model={model} />;
        case "desktop":
            return <KronSettingsDesktopContent model={model} />;
        case "about":
            return <KronSettingsAboutContent model={model} />;
        case "agents":
            return <KronSettingsAgentsContent model={model} />;
        case "commands":
            return <KronSettingsCommandsContent model={model} />;
        case "skills":
            return <KronSettingsSkillsContent model={model} />;
        case "mcp":
            return <KronSettingsMcpContent model={model} />;
        case "providers":
            return <KronSettingsProvidersContent model={model} />;
        case "usage":
            return <KronSettingsUsageContent model={model} />;
        default:
            return <div className="kron-settings-empty"><i className="fa fa-solid fa-wrench" /><p>Coming soon.</p></div>;
    }
});

PageRenderer.displayName = "PageRenderer";

interface KronSettingsPageProps {
    model: KronSettingsViewModel;
}

const KronSettingsPage = memo(({ model }: KronSettingsPageProps) => {
    const selectedSection = useAtomValue(model.selectedSectionAtom);
    const config = SETTINGS_SECTIONS.find((s) => s.id === selectedSection);
    const title = config?.label ?? selectedSection;
    const description = SECTION_DESCRIPTIONS[selectedSection] ?? "";

    return (
        <div className="kron-settings-content" key={selectedSection}>
            <div className="kron-settings-content-inner">
                <h1 className="kron-settings-content-title">{title}</h1>
                {description && <p className="kron-settings-content-subtitle">{description}</p>}
                <PageRenderer model={model} section={selectedSection} />
            </div>
        </div>
    );
});

KronSettingsPage.displayName = "KronSettingsPage";

export { KronSettingsPage };