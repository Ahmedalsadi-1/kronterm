import React from 'react';
import { useAtom } from 'jotai';
import { RiInformationLine } from '@remixicon/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { autoDeleteEnabledAtom, autoDeleteAfterDaysAtom } from '@/stores/kronosChamberSettingsStore';

const MIN_DAYS = 1;
const MAX_DAYS = 365;

export const SessionRetentionSettings: React.FC = () => {
    const [autoDeleteEnabled, setAutoDeleteEnabled] = useAtom(autoDeleteEnabledAtom);
    const [autoDeleteAfterDays, setAutoDeleteAfterDays] = useAtom(autoDeleteAfterDaysAtom);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">Session retention</h3>
                    <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                            <RiInformationLine className="h-3.5 w-3.5 text-muted-foreground/60 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={8} className="max-w-xs">
                            Automatically delete inactive sessions based on their last activity.
                            Keeps the most recent 5 sessions.
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={autoDeleteEnabled}
                    onChange={(e) => setAutoDeleteEnabled(e.target.checked)}
                    className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">Enable auto-cleanup</span>
            </label>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        value={autoDeleteAfterDays}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val)) {
                                setAutoDeleteAfterDays(Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(val))));
                            }
                        }}
                        min={MIN_DAYS}
                        max={MAX_DAYS}
                        aria-label="Retention period in days"
                        className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-center text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    <span className="text-sm text-muted-foreground">days since last activity</span>
                </div>
            </div>
        </div>
    );
};
