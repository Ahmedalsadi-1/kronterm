import React from 'react';
import { RiMicLine } from '@remixicon/react';
import { Button } from '@/app/components/ui/button';

const LANGUAGE_OPTIONS = [
    { value: 'en-US', label: 'English' },
    { value: 'es-ES', label: 'Espa\u00F1ol' },
    { value: 'fr-FR', label: 'Fran\u00E7ais' },
    { value: 'de-DE', label: 'Deutsch' },
    { value: 'ja-JP', label: '\u65E5\u672C\u8A9E' },
    { value: 'zh-CN', label: '\u4E2D\u6587' },
];

export const VoiceSettings: React.FC = () => {
    const [language, setLanguage] = React.useState('en-US');
    const [continuousMode, setContinuousMode] = React.useState(false);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <RiMicLine className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-base font-semibold text-foreground">Voice</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Voice input and read-aloud settings for hands-free workflows.
                </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Language</p>
                    <p className="text-xs text-muted-foreground">Voice recognition language</p>
                </div>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="rounded-lg border border-border/80 bg-transparent px-3 py-1.5 text-sm text-foreground"
                >
                    {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Continuous Mode</p>
                    <p className="text-xs text-muted-foreground">Keep microphone active for hands-free interaction</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={continuousMode ? 'default' : 'outline'}
                        onClick={() => setContinuousMode(true)}
                        className="text-xs"
                    >
                        On
                    </Button>
                    <Button
                        type="button"
                        variant={!continuousMode ? 'default' : 'outline'}
                        onClick={() => setContinuousMode(false)}
                        className="text-xs"
                    >
                        Off
                    </Button>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Voice features require browser microphone access. Full voice control with speech-to-text
                and read-aloud responses is available when connected to a supported AI provider.
            </p>
        </div>
    );
};
