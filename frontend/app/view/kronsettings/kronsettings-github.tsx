// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { SettingsCard, SectionHeader, InputSetting, InfoCallout } from "./kronsettings-shared";
import { useSettingField } from "./kronsettings-hooks";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsGitHubContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsGitHubContent = memo(({ model: _model }: KronSettingsGitHubContentProps) => {
    const [token, setToken] = useSettingField("github:token");
    const [owner, setOwner] = useSettingField("github:owner");

    return (
        <div>
            <SettingsCard>
                <SectionHeader title="GitHub Integration" icon="github" description="Connect your GitHub account for issue and PR workflows." />
                <InputSetting
                    title="Personal Access Token"
                    description="GitHub PAT for API access."
                    value={token}
                    onChange={setToken}
                    placeholder="ghp_..."
                    type="password"
                    monospace
                />
                <InputSetting
                    title="Default Owner"
                    description="Default GitHub owner/org for operations."
                    value={owner}
                    onChange={setOwner}
                    placeholder="your-org"
                    monospace
                />
            </SettingsCard>
            <InfoCallout>
                <i className="fa-solid fa-circle-info" />
                Requires a GitHub Personal Access Token with appropriate scopes (repo, read:org).
            </InfoCallout>
        </div>
    );
});

KronSettingsGitHubContent.displayName = "KronSettingsGitHubContent";

export { KronSettingsGitHubContent };