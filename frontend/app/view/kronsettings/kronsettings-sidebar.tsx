// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useAtom } from "jotai";
import { memo, useCallback } from "react";
import type { KronSettingsViewModel, SettingsSection } from "./kronsettings-model";
import { SECTION_GROUP_LABELS, SETTINGS_SECTIONS } from "./kronsettings-model";
import clsx from "clsx";

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
            {groupedSections.map(({ group, sections }) => (
                <div key={group}>
                    <div className="kron-settings-sidebar-group-label">
                        {SECTION_GROUP_LABELS[group] ?? group}
                    </div>
                    {sections.map((section) => (
                        <div
                            key={section.id}
                            onClick={() => handleSelect(section.id)}
                            className={clsx(
                                "kron-settings-sidebar-item",
                                selectedSection === section.id && "kron-settings-sidebar-item--active"
                            )}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && handleSelect(section.id)}
                        >
                            <i className={clsx("fa", "fa-solid", `fa-${section.icon}`)} />
                            <span>{section.label}</span>
                        </div>
                    ))}
                </div>
            ))}
        </nav>
    );
});

KronSettingsSidebar.displayName = "KronSettingsSidebar";

export { KronSettingsSidebar };