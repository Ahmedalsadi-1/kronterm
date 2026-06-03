// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { Toggle } from "@/app/element/toggle";
import { SettingsCard, SectionHeader, SettingRow, InfoCallout, NumberInput } from "./kronsettings-shared";
import { useToggleField, useNumberField } from "./kronsettings-hooks";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsSessionsContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsSessionsContent = memo(({ _model }: KronSettingsSessionsContentProps) => {
    const [durableSessions, setDurableSessions] = useToggleField("term:durable");
    const [autoDeleteEnabled, setAutoDeleteEnabled] = useToggleField("term:autodelete");
    const [autoDeleteDays, setAutoDeleteDays] = useNumberField("term:autodeletedays", 30);

    return (
        <div>
            <SettingsCard>
                <SectionHeader title="Session Retention" icon="clock-rotate-left" description="Control how terminal sessions persist and expire." />
                <SettingRow title="Durable Sessions" description="Keep terminal sessions alive across restarts.">
                    <Toggle checked={durableSessions} onChange={setDurableSessions} />
                </SettingRow>
                <SettingRow title="Auto-delete Old Sessions" description="Automatically clean up inactive sessions.">
                    <Toggle checked={autoDeleteEnabled} onChange={setAutoDeleteEnabled} />
                </SettingRow>
                <SettingRow title="Delete After (days)" description="Days before inactive sessions are removed.">
                    <NumberInput value={autoDeleteDays} onChange={setAutoDeleteDays} min={1} max={365} />
                </SettingRow>
            </SettingsCard>
            <InfoCallout>
                <i className="fa-solid fa-circle-info" />
                Durable sessions use SSH multiplexing to survive network interruptions and app restarts.
            </InfoCallout>
        </div>
    );
});

KronSettingsSessionsContent.displayName = "KronSettingsSessionsContent";

export { KronSettingsSessionsContent };