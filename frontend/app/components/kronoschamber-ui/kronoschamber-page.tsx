import { ScrollableOverlay } from "@/app/components/ui/ScrollableOverlay";
import { ComputerUseStatusCard } from "@/app/components/computer-use-status-card";
import React from "react";
import type { KronosChamberSection } from "./KronosChamberSidebar";
import { KronosChamberVisualSettings } from "./KronosChamberVisualSettings";
import { KronosCodeCliSettings } from "./KronosCodeCliSettings";
import { NotificationSettings } from "./NotificationSettings";
import { VoiceSettings } from "./VoiceSettings";

interface KronosChamberPageProps {
    section?: KronosChamberSection;
}

export const KronosChamberPage: React.FC<KronosChamberPageProps> = ({ section }) => {
    if (!section) {
        return (
            <ScrollableOverlay keyboardAvoid outerClassName="h-full" className="w-full">
                <div className="mx-auto max-w-3xl space-y-3 p-3 sm:space-y-6 sm:p-6">
                    <KronosChamberVisualSettings />
                    <div className="border-t border-border/40 pt-6">
                        <KronosCodeCliSettings />
                    </div>
                </div>
            </ScrollableOverlay>
        );
    }

    return (
        <ScrollableOverlay keyboardAvoid outerClassName="h-full" className="w-full">
            <div className="mx-auto max-w-3xl space-y-6 p-3 sm:p-6">
                <SectionContent section={section} />
            </div>
        </ScrollableOverlay>
    );
};

const SectionContent: React.FC<{ section: KronosChamberSection }> = ({ section }) => {
    switch (section) {
        case "visual":
            return (
                <KronosChamberVisualSettings
                    visibleSettings={[
                        "theme",
                        "fontSize",
                        "terminalFontSize",
                        "spacing",
                        "cornerRadius",
                        "inputBarOffset",
                        "terminalQuickKeys",
                    ]}
                />
            );
        case "chat":
            return (
                <KronosChamberVisualSettings
                    visibleSettings={[
                        "toolOutput",
                        "diffLayout",
                        "dotfiles",
                        "reasoning",
                        "textJustificationActivity",
                        "queueMode",
                        "persistDraft",
                    ]}
                />
            );
        case "shortcuts":
            return <ShortcutsSection />;
        case "sessions":
            return <SessionsSection />;
        case "git":
            return <GitSection />;
        case "github":
            return <GitHubSection />;
        case "notifications":
            return <NotificationSettings />;
        case "voice":
            return <VoiceSettings />;
        case "desktop":
            return <DesktopSection />;
        default:
            return null;
    }
};

const ShortcutsSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h3>
            <p className="text-sm text-muted-foreground">
                Review the shortcuts that keep agent work, panes, and runtime surfaces fast.
            </p>
        </div>
        <StatusList
            items={[
                ["Layout control", "Split, focus, close, and magnify blocks from the global shortcut map."],
                [
                    "Agent workflow",
                    "Open KronosCode, approve tools, cancel turns, and move through active work without leaving the keyboard.",
                ],
                [
                    "Customization",
                    "Custom capture UI is tracked as a beta roadmap item; defaults remain stable for this release.",
                ],
            ]}
        />
    </div>
);

const SessionsSection: React.FC = () => (
    <div className="space-y-6">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Sessions</h3>
            <p className="text-sm text-muted-foreground">Default model, agent, and session retention settings.</p>
        </div>
        <div className="border-t border-border/40 pt-6">
            <KronosCodeCliSettings />
        </div>
    </div>
);

const GitSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Git</h3>
            <p className="text-sm text-muted-foreground">
                Configure identity and keep agent-authored changes tied to the right workspace.
            </p>
        </div>
        <StatusList
            items={[
                ["Identity", "Commit author name and email are managed from KronTerm settings."],
                [
                    "Review loop",
                    "KronosCode sessions can surface changed files, diffs, and validation evidence before handoff.",
                ],
                [
                    "Worktrees",
                    "Parallel worktree orchestration stays behind the agent runtime until the controls are release-ready.",
                ],
            ]}
        />
    </div>
);

const GitHubSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">GitHub</h3>
            <p className="text-sm text-muted-foreground">Connect your GitHub account for PR and issue workflows.</p>
        </div>
        <StatusList
            items={[
                ["Credentials", "Use the GitHub settings panel to save a personal access token and default owner."],
                [
                    "Agent context",
                    "Issues, PRs, and repository context are routed through the active KronosCode session when available.",
                ],
                [
                    "Recovery",
                    "Unavailable or missing credentials should keep the workspace usable and show a direct fix path.",
                ],
            ]}
        />
    </div>
);

const DesktopSection: React.FC = () => (
    <div className="space-y-4">
        <ComputerUseStatusCard />
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Desktop</h3>
            <p className="text-sm text-muted-foreground">Desktop control, MCP servers, and sandbox settings.</p>
        </div>
        <StatusList
            items={[
                ["Sandbox launch", "Start supervised browser, terminal, and desktop surfaces from chat with /sandbox."],
                [
                    "Permission boundary",
                    "Desktop control and screen capture stay explicit so agent actions remain inspectable.",
                ],
                [
                    "Evidence",
                    "Screenshots and activity previews should appear in the run timeline before follow-up decisions.",
                ],
            ]}
        />
    </div>
);

const StatusList: React.FC<{ items: [string, string][] }> = ({ items }) => (
    <div className="grid gap-3">
        {items.map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border/70 bg-card/40 px-4 py-3">
                <div className="text-sm font-medium text-foreground">{title}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{body}</div>
            </div>
        ))}
    </div>
);
