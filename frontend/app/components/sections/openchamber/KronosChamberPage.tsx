import React from 'react';
import { ScrollableOverlay } from '@/app/components/ui/ScrollableOverlay';
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
        <p className="text-sm text-muted-foreground">Coming soon: full keyboard shortcut customization with capture UI.</p>
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
        <p className="text-sm text-muted-foreground">Coming soon: gitmoji, commit model selection, and worktree management.</p>
    </div>
);

const GitHubSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">GitHub</h3>
            <p className="text-sm text-muted-foreground">Connect your GitHub account for PR and issue workflows.</p>
        </div>
        <p className="text-sm text-muted-foreground">Coming soon: GitHub authentication, PR management, and issue tracking.</p>
    </div>
);

const DesktopSection: React.FC = () => (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Desktop</h3>
            <p className="text-sm text-muted-foreground">Desktop control, MCP servers, and sandbox settings.</p>
        </div>
        <p className="text-sm text-muted-foreground">
            Desktop control settings coming soon. Launch sandbox sessions from chat using <span className="font-mono">/sandbox</span>.
        </p>
    </div>
);
