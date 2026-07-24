// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AgentsPanel } from "@/app/aipanel/agents-panel";
import { memo } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsAgentsContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsAgentsContent = memo(({ model: _model }: KronSettingsAgentsContentProps) => {
    return (
        <div className="kron-settings-card" style={{ overflow: "hidden" }}>
            <AgentsPanel />
        </div>
    );
});

KronSettingsAgentsContent.displayName = "KronSettingsAgentsContent";

export { KronSettingsAgentsContent };
