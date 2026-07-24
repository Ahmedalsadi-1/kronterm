import React from 'react';
import { ScrollableOverlay } from '@/app/components/ui/ScrollableOverlay';
import { ComputerUseStatusCard } from '@/app/components/computer-use-status-card';
import { KronosChamberVisualSettings } from './KronosChamberVisualSettings';
import { NotificationSettings } from './NotificationSettings';
import { VoiceSettings } from './VoiceSettings';
import { KronosCodeCliSettings } from './KronosCodeCliSettings';
import type { KronosChamberSection } from './KronosChamberSidebar';

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
        case 'visual':
            return <KronosChamberVisualSettings visibleSettings={['theme', 'fontSize', 'terminalFontSize', 'spacing', 'cornerRadius', 'inputBarOffset', 'terminalQuickKeys']} />;
        case 'chat':
            return <KronosChamberVisualSettings visibleSettings={['toolOutput', 'diffLayout', 'dotfiles', 'reasoning', 'textJustificationActivity', 'queueMode', 'persistDraft']} />;
        case 'shortcuts':
            return <ShortcutsSection />;
        case 'sessions':
            return <SessionsSection />;
        case 'git':
            return <GitSection />;
        case 'github':
            return <GitHubSection />;
        case 'notifications':
            return <NotificationSettings />;
        case 'voice':
            return <VoiceSettings />;
        case 'desktop':
            return <DesktopSection />;
        default:
            return null;
    }
};

const ShortcutsSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h3>
            <p className="text-sm text-muted-foreground">Configure keyboard shortcuts and key overrides.</p>
        </div>
        <BetaStatusPanel
            title="Shortcut capture is limited in this beta"
            body="Core KronTerm and KronosChamber shortcuts are active. Full capture-based remapping stays out of the primary path until it passes the screenshot and keyboard regression matrix."
            action="Use system keybindings for now"
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
            <p className="text-sm text-muted-foreground">Configure commit messages, identities, and worktree settings.</p>
        </div>
        <BetaStatusPanel
            title="Git controls are runtime-led"
            body="KronosCode owns commit, branch, and worktree actions during private beta. This panel stays focused on identities and defaults until those controls have parity with the in-chat evidence flow."
            action="Run Git actions from KronosChamber"
        />
    </div>
);

const GitHubSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">GitHub</h3>
            <p className="text-sm text-muted-foreground">Connect your GitHub account for PR and issue workflows.</p>
        </div>
        <BetaStatusPanel
            title="GitHub workflows run through KronosCode"
            body="PR and issue actions remain available through the KronosCode runtime path. Native account management will return here after auth, recovery, and session restore states are fully covered."
            action="Use chat-driven GitHub actions"
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
        <BetaStatusPanel
            title="KronosCode is the active desktop runtime"
            body="Sandbox, browser, and desktop control are routed through KronosChamber so approvals, takeover, cancellation, and evidence stay in one loop."
            action="Launch from chat with /sandbox or the runtime controls"
        />
    </div>
);

const BetaStatusPanel: React.FC<{ title: string; body: string; action: string }> = ({ title, body, action }) => (
    <div className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
        <div className="mt-3 inline-flex rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
            {action}
        </div>
    </div>
);
