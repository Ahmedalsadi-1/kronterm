import React from 'react';
import { KronosChamberSidebar, type KronosChamberSection } from './KronosChamberSidebar';
import { KronosChamberPage } from './KronosChamberPage';
import { ScrollableOverlay } from '@/app/components/ui/ScrollableOverlay';

export const KronosChamberSettingsView: React.FC = () => {
    const [selectedSection, setSelectedSection] = React.useState<KronosChamberSection>('visual');

    return (
        <div className="flex h-full w-full bg-background">
            {/* Sidebar */}
            <div className="hidden sm:flex sm:w-52 lg:w-60 flex-shrink-0 border-r border-border/80">
                <KronosChamberSidebar
                    selectedSection={selectedSection}
                    onSelectSection={setSelectedSection}
                />
            </div>

            {/* Mobile section picker */}
            <div className="sm:hidden flex overflow-x-auto border-b border-border/80 py-1 px-3 gap-1">
                {(['visual', 'chat', 'shortcuts', 'sessions', 'git', 'github', 'notifications', 'voice', 'desktop'] as KronosChamberSection[]).map((section) => (
                    <button
                        key={section}
                        type="button"
                        onClick={() => setSelectedSection(section)}
                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            selectedSection === section
                                ? 'bg-accent/20 text-accent-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {section.charAt(0).toUpperCase() + section.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <KronosChamberPage section={selectedSection} />
            </div>
        </div>
    );
};
