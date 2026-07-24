// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { SettingsCard, SectionHeader } from "./kronsettings-shared";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsCommandsContentProps {
    model: KronSettingsViewModel;
}

type CommandEntry = {
    name: string;
    description: string;
    command: string;
};

const ACP_COMMANDS: CommandEntry[] = [
    { name: "help", description: "Show available commands", command: "/help" },
    { name: "undo", description: "Undo last AI action", command: "/undo" },
    { name: "redo", description: "Redo previously undone action", command: "/redo" },
    { name: "retry", description: "Retry last AI response", command: "/retry" },
    { name: "fork", description: "Fork conversation from this point", command: "/fork" },
    { name: "clear", description: "Clear current conversation", command: "/clear" },
    { name: "summarize", description: "Summarize conversation", command: "/summarize" },
    { name: "export", description: "Export conversation as markdown", command: "/export" },
];

const KronSettingsCommandsContent = memo(({ model: _model }: KronSettingsCommandsContentProps) => {
    return (
        <SettingsCard>
            <SectionHeader title="ACP Commands" icon="terminal" description="Agent Control Protocol commands for interacting with AI agents." />
            <div>
                {ACP_COMMANDS.map((cmd) => (
                    <div key={cmd.name} className="kron-settings-command-row">
                        <div>
                            <div className="kron-settings-command-name">{cmd.command}</div>
                            <div className="kron-settings-command-desc">{cmd.description}</div>
                        </div>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
});

KronSettingsCommandsContent.displayName = "KronSettingsCommandsContent";

export { KronSettingsCommandsContent };