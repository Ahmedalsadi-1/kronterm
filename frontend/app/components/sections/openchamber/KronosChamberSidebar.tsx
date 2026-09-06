import React from 'react';
import { ScrollableOverlay } from '@/app/components/ui/ScrollableOverlay';
import { cn } from '@/app/lib/utils';

export type KronosChamberSection = 'visual' | 'chat' | 'shortcuts' | 'sessions' | 'git' | 'github' | 'notifications' | 'voice' | 'desktop';

interface KronosChamberSidebarProps {
    selectedSection: KronosChamberSection;
    onSelectSection: (section: KronosChamberSection) => void;
}

interface SectionGroup {
    id: KronosChamberSection;
    label: string;
    items: string[];
    badge?: string;
}

const KRONOSCHAMBER_SECTION_GROUPS: SectionGroup[] = [
    { id: 'visual', label: 'Visual', items: ['Theme', 'Font', 'Spacing'] },
    { id: 'chat', label: 'Chat', items: ['Tools', 'Diff', 'Reasoning'] },
    { id: 'shortcuts', label: 'Shortcuts', items: ['Keyboard', 'Overrides'] },
    { id: 'sessions', label: 'Sessions', items: ['Defaults', 'Model', 'Retention'] },
    { id: 'git', label: 'Git', items: ['Commit Messages', 'Worktree'] },
    { id: 'github', label: 'GitHub', items: ['Connect', 'PRs', 'Issues'] },
    { id: 'notifications', label: 'Notifications', items: ['Native'] },
    { id: 'voice', label: 'Voice', items: ['Language', 'Continuous Mode'], badge: 'experimental' },
    { id: 'desktop', label: 'Desktop', items: ['Desktop Control', 'Sandbox'], badge: 'new' },
];

export const KronosChamberSidebar: React.FC<KronosChamberSidebarProps> = ({
    selectedSection,
    onSelectSection,
}) => {
    return (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-sidebar">
            <div className="min-h-0">
                <ScrollableOverlay outerClassName="h-full" className="space-y-1 px-3 py-2 overflow-x-hidden">
                    {KRONOSCHAMBER_SECTION_GROUPS.map((group) => {
                        const isSelected = selectedSection === group.id;
                        return (
                            <div
                                key={group.id}
                                className={cn(
                                    'group relative rounded-md px-1.5 py-1 transition-all duration-200',
                                    isSelected ? 'bg-interactive-selection' : 'hover:bg-interactive-hover'
                                )}
                            >
                                <button
                                    onClick={() => onSelectSection(group.id)}
                                    className="w-full text-left flex flex-col gap-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-normal text-foreground">
                                            {group.label}
                                        </span>
                                        {group.badge && (
                                            <span className="text-[10px] leading-none uppercase font-bold tracking-tight bg-[var(--status-warning-background)] text-[var(--status-warning)] border border-[var(--status-warning-border)] px-1.5 py-0.5 rounded">
                                                {group.badge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground/60 leading-tight">
                                        {group.items.join(' \u00B7 ')}
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </ScrollableOverlay>
            </div>
        </div>
    );
};
