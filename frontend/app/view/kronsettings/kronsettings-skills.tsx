// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { SettingsCard, SectionHeader } from "./kronsettings-shared";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsSkillsContentProps {
    model: KronSettingsViewModel;
}

type SkillEntry = {
    name: string;
    description: string;
    category: string;
    installed: boolean;
};

const BUILTIN_SKILLS: SkillEntry[] = [
    { name: "commit-work", description: "Create high-quality git commits", category: "git", installed: true },
    { name: "investigate", description: "Systematic debugging skill", category: "debug", installed: true },
    { name: "code-review", description: "Structured code review", category: "quality", installed: true },
    { name: "security-audit", description: "Security vulnerability scanning", category: "security", installed: true },
    { name: "mermaid-diagrams", description: "Create software architecture diagrams", category: "docs", installed: true },
    { name: "humanizer", description: "Remove signs of AI-generated writing", category: "writing", installed: true },
    { name: "perplexity", description: "Web search and research", category: "search", installed: true },
    { name: "session-handoff", description: "Create context handoff documents", category: "workflow", installed: true },
    { name: "ui-ux-pro-max", description: "UI/UX design intelligence", category: "design", installed: true },
    { name: "react-dev", description: "React TypeScript best practices", category: "frontend", installed: true },
];

const KronSettingsSkillsContent = memo(({ _model }: KronSettingsSkillsContentProps) => {
    return (
        <SettingsCard>
            <SectionHeader title="Installed Skills" icon="book" description="Skills extend agent capabilities with domain-specific knowledge." />
            <div>
                {BUILTIN_SKILLS.map((skill) => (
                    <div key={skill.name} className="kron-settings-shortcut-row">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-color)", flexShrink: 0 }} />
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span className="kron-settings-shortcut-label">{skill.name}</span>
                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted-color)" }}>{skill.category}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted-color)", marginTop: 1 }}>{skill.description}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
});

KronSettingsSkillsContent.displayName = "KronSettingsSkillsContent";

export { KronSettingsSkillsContent };