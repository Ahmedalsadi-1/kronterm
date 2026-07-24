// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useAtom } from "jotai";
import { memo, useCallback } from "react";
import type { KronSettingsViewModel, SettingsSection } from "./kronsettings-model";
import { SECTION_GROUP_LABELS, SETTINGS_SECTIONS } from "./kronsettings-model";
import { cn } from "@/util/util";
import {
    RiPaletteLine,
    RiChat3Line,
    RiKeyboardLine,
    RiHistoryLine,
    RiGitBranchLine,
    RiGithubFill,
    RiNotification3Line,
    RiMicLine,
    RiComputerLine,
    RiBrainLine,
    RiTerminalBoxLine,
    RiBookOpenLine,
    RiPlugLine,
    RiCloudLine,
    RiBarChartLine,
    RiInformationLine,
    RiContrastDropLine,
} from "@remixicon/react";

const ICON_MAP: Record<string, React.ElementType> = {
    theme: RiContrastDropLine,
    visual: RiPaletteLine,
    chat: RiChat3Line,
    shortcuts: RiKeyboardLine,
    sessions: RiHistoryLine,
    git: RiGitBranchLine,
    github: RiGithubFill,
    notifications: RiNotification3Line,
    voice: RiMicLine,
    desktop: RiComputerLine,
    agents: RiBrainLine,
    commands: RiTerminalBoxLine,
    skills: RiBookOpenLine,
    mcp: RiPlugLine,
    providers: RiCloudLine,
    usage: RiBarChartLine,
    about: RiInformationLine,
};

interface KronSettingsSidebarProps {
    model: KronSettingsViewModel;
}

const groupOrder = ["appearance", "features", "integrations", "kronoscode", "other"];

const KronSettingsSidebar = memo(({ model }: KronSettingsSidebarProps) => {
    const [selectedSection, setSelectedSection] = useAtom(model.selectedSectionAtom);

    const handleSelect = useCallback(
        (id: SettingsSection) => {
            setSelectedSection(id);
        },
        [setSelectedSection]
    );

    const groupedSections = groupOrder
        .map((group) => ({
            group,
            sections: SETTINGS_SECTIONS.filter((s) => s.group === group),
        }))
        .filter((g) => g.sections.length > 0);

    return (
        <nav className="kron-settings-sidebar" role="navigation" aria-label="Settings sections">
            <div className="kron-settings-sidebar-inner">
                {groupedSections.map(({ group, sections }) => (
                    <div key={group} className="mb-6">
                        <div className="kron-settings-sidebar-group-label">
                            {SECTION_GROUP_LABELS[group] ?? group}
                        </div>
                        <div className="space-y-0.5">
                            {sections.map((section) => {
                                const Icon = ICON_MAP[section.id];
                                return (
                                    <div
                                        key={section.id}
                                        onClick={() => handleSelect(section.id)}
                                        className={cn(
                                            "kron-settings-sidebar-item",
                                            selectedSection === section.id && "kron-settings-sidebar-item--active"
                                        )}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === "Enter" && handleSelect(section.id)}
                                    >
                                        {Icon && <Icon className="w-4 h-4" />}
                                        <span>{section.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </nav>
    );
});

KronSettingsSidebar.displayName = "KronSettingsSidebar";

export { KronSettingsSidebar };