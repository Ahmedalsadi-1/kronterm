// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import type { KronSettingsEnv } from "@/app/view/kronsettings/kronsettings-env";
import { KronSettingsView } from "@/app/view/kronsettings/kronsettings";
import { atom, type PrimitiveAtom } from "jotai";

export type SettingsSection =
    | "theme"
    | "visual"
    | "chat"
    | "shortcuts"
    | "sessions"
    | "git"
    | "github"
    | "notifications"
    | "voice"
    | "desktop"
    | "about"
    | "agents"
    | "commands"
    | "skills"
    | "mcp"
    | "providers"
    | "usage";

export interface SettingsSectionConfig {
    id: SettingsSection;
    label: string;
    group: "appearance" | "features" | "integrations" | "kronoscode" | "other";
    icon: string; // FontAwesome icon name (without "fa-" prefix)
}

export const SETTINGS_SECTIONS: SettingsSectionConfig[] = [
    // Appearance
    { id: "theme", label: "Theme", group: "appearance", icon: "swatchbook" },
    { id: "visual", label: "Visual", group: "appearance", icon: "palette" },
    { id: "chat", label: "Chat", group: "appearance", icon: "comment" },

    // Features
    { id: "shortcuts", label: "Shortcuts", group: "features", icon: "keyboard" },
    { id: "sessions", label: "Sessions", group: "features", icon: "clock-rotate-left" },
    { id: "git", label: "Git", group: "features", icon: "code-branch" },
    { id: "github", label: "GitHub", group: "features", icon: "github" },

    // Integrations
    { id: "notifications", label: "Notifications", group: "integrations", icon: "bell" },
    { id: "voice", label: "Voice", group: "integrations", icon: "microphone" },
    { id: "desktop", label: "Desktop Control", group: "integrations", icon: "desktop" },

    // KronosCode
    { id: "agents", label: "Agents", group: "kronoscode", icon: "brain" },
    { id: "commands", label: "Commands", group: "kronoscode", icon: "terminal" },
    { id: "skills", label: "Skills", group: "kronoscode", icon: "book" },
    { id: "mcp", label: "MCP", group: "kronoscode", icon: "plug" },
    { id: "providers", label: "Providers", group: "kronoscode", icon: "cloud" },
    { id: "usage", label: "Usage", group: "kronoscode", icon: "chart-bar" },

    // Other
    { id: "about", label: "About", group: "other", icon: "circle-info" },
];

export const SECTION_GROUP_LABELS: Record<string, string> = {
    appearance: "Appearance",
    features: "Features",
    integrations: "Integrations",
    kronoscode: "KronosCode",
    other: "Other",
};

export class KronSettingsViewModel implements ViewModel {
    blockId: string;
    viewType = "kronsettings";
    viewIcon = atom("sliders");
    viewName = atom("Settings");
    viewComponent = KronSettingsView;
    noPadding = atom(true);
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    env: KronSettingsEnv;

    selectedSectionAtom: PrimitiveAtom<SettingsSection>;

    constructor({ blockId, nodeModel, tabModel, waveEnv }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.env = waveEnv as KronSettingsEnv;

        this.selectedSectionAtom = atom<SettingsSection>("visual");
    }

    giveFocus(): boolean {
        return true;
    }

    getSectionConfig(id: SettingsSection): SettingsSectionConfig | undefined {
        return SETTINGS_SECTIONS.find((s) => s.id === id);
    }
}
