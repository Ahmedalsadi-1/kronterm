// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { SettingsCard, SectionHeader, InputSetting } from "./kronsettings-shared";
import { useSettingField } from "./kronsettings-hooks";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsGitContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsGitContent = memo(({ _model }: KronSettingsGitContentProps) => {
    const [userName, setUserName] = useSettingField("git:username");
    const [userEmail, setUserEmail] = useSettingField("git:useremail");

    return (
        <SettingsCard>
            <SectionHeader title="Git Configuration" icon="code-branch" description="Set your Git identity for commits." />
            <InputSetting
                title="User Name"
                description="Git commit author name."
                value={userName}
                onChange={setUserName}
                placeholder="Your Name"
            />
            <InputSetting
                title="User Email"
                description="Git commit author email."
                value={userEmail}
                onChange={setUserEmail}
                placeholder="you@example.com"
            />
        </SettingsCard>
    );
});

KronSettingsGitContent.displayName = "KronSettingsGitContent";

export { KronSettingsGitContent };