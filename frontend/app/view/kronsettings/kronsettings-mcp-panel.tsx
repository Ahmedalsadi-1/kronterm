// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { McpPanel } from "@/app/aipanel/mcp-panel";
import { memo } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsMcpContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsMcpContent = memo(({ _model }: KronSettingsMcpContentProps) => {
    return (
        <div className="kron-settings-card" style={{ overflow: "hidden" }}>
            <McpPanel />
        </div>
    );
});

KronSettingsMcpContent.displayName = "KronSettingsMcpContent";

export { KronSettingsMcpContent };
