// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { KronSettingsViewModel, SettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import { resolveKronSettingsSection } from "@/app/view/kronsettings/kronsettings-model";
import { KronSettingsSectionPage } from "@/app/view/kronsettings/kronsettings-page";
import "@/app/view/kronsettings/kronsettings.scss";
import { memo } from "react";

interface KronTermSettingsMountProps {
    model: KronSettingsViewModel;
    sectionId: string;
}

const KronTermSettingsMount = memo(({ model, sectionId }: KronTermSettingsMountProps) => (
    <div className="kron-settings kron-settings--embedded">
        <KronSettingsSectionPage model={model} section={resolveKronSettingsSection(sectionId as SettingsSection)} />
    </div>
));

KronTermSettingsMount.displayName = "KronTermSettingsMount";

export { KronTermSettingsMount };
