// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ProvidersPanel } from "@/app/aipanel/providers-panel";
import { memo } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsProvidersContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsProvidersContent = memo(({ _model }: KronSettingsProvidersContentProps) => {
    return (
        <div className="kron-settings-card" style={{ overflow: "hidden" }}>
            <ProvidersPanel />
        </div>
    );
});

KronSettingsProvidersContent.displayName = "KronSettingsProvidersContent";

export { KronSettingsProvidersContent };
