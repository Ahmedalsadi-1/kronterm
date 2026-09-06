// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import {
    RiBarChartLine,
    RiBookOpenLine,
    RiBrainLine,
    RiChat3Line,
    RiCloudLine,
    RiComputerLine,
    RiContrastDropLine,
    RiGitBranchLine,
    RiGithubFill,
    RiHistoryLine,
    RiInformationLine,
    RiKeyboardLine,
    RiMicLine,
    RiNotification3Line,
    RiPaletteLine,
    RiPlugLine,
    RiSettings3Line,
    RiTerminalBoxLine,
} from "@remixicon/react";
import { useAtom } from "jotai";
import { memo, useCallback } from "react";
import type { KronSettingsViewModel, SettingsSection } from "./kronsettings-model";
import { SECTION_GROUP_LABELS, SETTINGS_SECTIONS } from "./kronsettings-model";

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
                <div className="kron-settings-brand">
                    <span className="kron-settings-brand-mark">
                        <RiSettings3Line aria-hidden="true" />
                    </span>
                    <strong>Settings</strong>
                </div>
                {groupedSections.map(({ group, sections }) => (
                    <div key={group} className="mb-6">
                        <div className="kron-settings-sidebar-group-label">{SECTION_GROUP_LABELS[group] ?? group}</div>
                        <div className="space-y-0.5">
                            {sections.map((section) => {
                                const Icon = ICON_MAP[section.id];
                                return (
                                    <button
                                        type="button"
                                        key={section.id}
                                        onClick={() => handleSelect(section.id)}
                                        className={cn(
                                            "kron-settings-sidebar-item",
                                            selectedSection === section.id && "kron-settings-sidebar-item--active"
                                        )}
                                        aria-current={selectedSection === section.id ? "page" : undefined}
                                    >
                                        {Icon && <Icon className="w-4 h-4" />}
                                        <span>{section.label}</span>
                                    </button>
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
