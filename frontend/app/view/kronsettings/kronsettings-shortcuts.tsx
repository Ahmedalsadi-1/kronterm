// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";
import { SectionHeader, SettingsCard } from "./kronsettings-shared";

interface KronSettingsShortcutsContentProps {
    model: KronSettingsViewModel;
}

type ShortcutEntry = {
    label: string;
    keys: string;
    group: string;
};

const SHORTCUTS: ShortcutEntry[] = [
    { label: "Universal Command Launcher", keys: "Shift + Super + Space", group: "Navigation" },
    { label: "Kronarchy Shortcuts", keys: "Super + K", group: "Navigation" },
    { label: "Next Workspace", keys: "Super + Tab", group: "Navigation" },
    { label: "Previous Workspace", keys: "Super + Shift + Tab", group: "Navigation" },
    { label: "Open Workspace 1–9", keys: "Super + 1–9", group: "Navigation" },
    { label: "Kronarchy Terminal", keys: "Super + Enter", group: "Kronarchy" },
    { label: "Kronarchy Browser", keys: "Super + Shift + Enter", group: "Kronarchy" },
    { label: "Kronarchy Files", keys: "Super + Shift + F", group: "Kronarchy" },
    { label: "KronosChamber", keys: "Super + Shift + A", group: "Kronarchy" },
    { label: "Activity", keys: "Super + Ctrl + T", group: "Kronarchy" },
    { label: "Scratchpad", keys: "Super + S", group: "Kronarchy" },
    { label: "New Terminal", keys: "⌘⇧T", group: "Layout" },
    { label: "New Block", keys: "⌘⇧N", group: "Layout" },
    { label: "Close Block", keys: "⌘⇧W", group: "Layout" },
    { label: "Toggle Magnify", keys: "⌘⇧M", group: "Layout" },
    { label: "Split Horizontal", keys: "⌘⇧H", group: "Layout" },
    { label: "Split Vertical", keys: "⌘⇧V", group: "Layout" },
    { label: "Focus Next Block", keys: "⌘⇧]", group: "Navigation" },
    { label: "Focus Prev Block", keys: "⌘⇧[", group: "Navigation" },
    { label: "Cycle Tabs", keys: "⌘⇥", group: "Navigation" },
    { label: "Command Palette", keys: "⌘⇧P", group: "Navigation" },
    { label: "Search", keys: "⌘⇧F", group: "Navigation" },
    { label: "Copy", keys: "⌘C", group: "Editing" },
    { label: "Paste", keys: "⌘V", group: "Editing" },
    { label: "Zoom In", keys: "⌘+", group: "View" },
    { label: "Zoom Out", keys: "⌘-", group: "View" },
    { label: "Reset Zoom", keys: "⌘0", group: "View" },
    { label: "Open Settings", keys: "⌘,", group: "View" },
    { label: "Toggle Tab Bar", keys: "⌘⇧B", group: "View" },
    { label: "Toggle AI Panel", keys: "⌘⇧A", group: "View" },
    { label: "Sandbox: Refresh Status", keys: "⌃⇧I", group: "Sandbox" },
    { label: "Sandbox: Take Screenshot", keys: "⌃⇧T", group: "Sandbox" },
    { label: "Sandbox: Mouse Click", keys: "Click on preview", group: "Sandbox" },
];

const KronSettingsShortcutsContent = memo(({ model: _model }: KronSettingsShortcutsContentProps) => {
    const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

    return (
        <SettingsCard>
            <SectionHeader
                title="Keyboard Shortcuts"
                icon="keyboard"
                description="Default shortcuts for beta workflows. Custom capture remains a roadmap control, not a required setup step."
            />
            {groups.map((group) => (
                <div key={group}>
                    <div className="kron-settings-shortcut-group-title">{group}</div>
                    {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => (
                        <div key={shortcut.label} className="kron-settings-shortcut-row">
                            <span className="kron-settings-shortcut-label">{shortcut.label}</span>
                            <kbd className="kron-settings-kbd">{shortcut.keys}</kbd>
                        </div>
                    ))}
                </div>
            ))}
        </SettingsCard>
    );
});

KronSettingsShortcutsContent.displayName = "KronSettingsShortcutsContent";

export { KronSettingsShortcutsContent };
