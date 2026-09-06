// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";
import { KronSettingsPage } from "./kronsettings-page";
import { KronSettingsSidebar } from "./kronsettings-sidebar";
import "./kronsettings.scss";

const KronSettingsView = memo(({ model }: ViewComponentProps<KronSettingsViewModel>) => {
    return (
        <div className="kron-settings">
            <KronSettingsSidebar model={model} />
            <KronSettingsPage model={model} />
        </div>
    );
});

KronSettingsView.displayName = "KronSettingsView";

export { KronSettingsView };