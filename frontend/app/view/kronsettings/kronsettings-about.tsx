// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValue } from "jotai";
import { memo } from "react";
import { SettingsCard, InfoCallout } from "./kronsettings-shared";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsAboutContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsAboutContent = memo(({ model }: KronSettingsAboutContentProps) => {
    const fullConfig = useAtomValue(model.env.atoms.fullConfigAtom);
    const version = fullConfig?.version ?? "unknown";

    return (
        <div>
            <SettingsCard>
                <div className="kron-settings-about-hero">
                    <i className="fa fa-solid fa-terminal" />
                    <div>
                        <div className="kron-settings-about-name">KronTerm</div>
                        <div className="kron-settings-about-tagline">The AI-native terminal</div>
                    </div>
                </div>

                <div className="kron-settings-about-row">
                    <span className="kron-settings-about-label">Version</span>
                    <span className="kron-settings-about-value">{version}</span>
                </div>
                <div className="kron-settings-about-row">
                    <span className="kron-settings-about-label">Platform</span>
                    <span className="kron-settings-about-value" style={{ fontFamily: "unset" }}>{navigator.platform}</span>
                </div>
            </SettingsCard>

            <SettingsCard>
                <div className="kron-settings-links">
                    <a href="https://kronterm.dev" target="_blank" rel="noopener noreferrer" className="kron-settings-link">
                        <i className="fa fa-solid fa-globe" />
                        Website
                    </a>
                    <a href="https://github.com/krontermdev/kronterm" target="_blank" rel="noopener noreferrer" className="kron-settings-link">
                        <i className="fa fa-brands fa-github" />
                        GitHub
                    </a>
                    <a href="https://docs.kronterm.dev" target="_blank" rel="noopener noreferrer" className="kron-settings-link">
                        <i className="fa fa-solid fa-book" />
                        Docs
                    </a>
                    <a href="https://discord.gg/XfvZ334gwU" target="_blank" rel="noopener noreferrer" className="kron-settings-link">
                        <i className="fa fa-brands fa-discord" />
                        Discord
                    </a>
                </div>
            </SettingsCard>

            <InfoCallout>
                <i className="fa-solid fa-circle-info" />
                KronTerm is open source under the Apache 2.0 license. Report issues on GitHub.
            </InfoCallout>
        </div>
    );
});

KronSettingsAboutContent.displayName = "KronSettingsAboutContent";

export { KronSettingsAboutContent };