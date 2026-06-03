// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { SettingsCard, SectionHeader } from "./kronsettings-shared";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsUsageContentProps {
    model: KronSettingsViewModel;
}

const KronSettingsUsageContent = memo(({ _model }: KronSettingsUsageContentProps) => {
    return (
        <div>
            <SettingsCard>
                <SectionHeader title="Usage & Activity" icon="chart-bar" description="AI agent usage statistics and activity history." />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {[
                        { label: "Total Sessions", value: "--" },
                        { label: "Total Prompts", value: "--" },
                        { label: "Tokens Used", value: "--" },
                        { label: "Files Modified", value: "--" },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            style={{
                                background: "var(--main-bg-color)",
                                border: "1px solid var(--border-color)",
                                borderRadius: 8,
                                padding: "14px 16px",
                                textAlign: "center",
                            }}
                        >
                            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--accent-color)" }}>{stat.value}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted-color)", marginTop: 4 }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </SettingsCard>
            <SettingsCard>
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <i className="fa-solid fa-chart-simple" style={{ fontSize: 28, color: "var(--text-muted-color)", opacity: 0.4, marginBottom: 10, display: "block" }} />
                    <p style={{ fontSize: 13, color: "var(--text-secondary-color)" }}>
                        Usage statistics are available when KronosCode is running.
                    </p>
                </div>
            </SettingsCard>
        </div>
    );
});

KronSettingsUsageContent.displayName = "KronSettingsUsageContent";

export { KronSettingsUsageContent };