import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';

export const KronosCodeCliSettings: React.FC = () => {
    const [value, setValue] = React.useState('');
    const [aiBrowserEnabled, setAiBrowserEnabled] = React.useState(false);
    const [browserOpenAtStartup, setBrowserOpenAtStartup] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                // Attempt to load KronosCode settings from the backend
                const response = await fetch('/api/config/settings', {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) {
                    return;
                }
                const data = (await response.json().catch(() => null)) as null | {
                    kronoscodeBinary?: unknown;
                    aiBrowserEnabled?: unknown;
                    browserOpenAtStartup?: unknown;
                };
                if (cancelled || !data) {
                    return;
                }
                const next = typeof data.kronoscodeBinary === 'string' ? data.kronoscodeBinary.trim() : '';
                const nextAiBrowserEnabled =
                    typeof data.aiBrowserEnabled === 'boolean' ? data.aiBrowserEnabled : false;
                const nextBrowserOpenAtStartup =
                    typeof data.browserOpenAtStartup === 'boolean' ? data.browserOpenAtStartup : false;
                setValue(next);
                setAiBrowserEnabled(nextAiBrowserEnabled);
                setBrowserOpenAtStartup(nextBrowserOpenAtStartup);
            } catch {
                // Backend not available — settings can be configured manually
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = React.useCallback(async () => {
        setIsSaving(true);
        try {
            await fetch('/api/config/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kronoscodeBinary: value.trim(),
                    aiBrowserEnabled,
                    browserOpenAtStartup,
                }),
            });
        } catch {
            // Backend not available
        } finally {
            setIsSaving(false);
        }
    }, [aiBrowserEnabled, browserOpenAtStartup, value]);

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">KronosCode CLI</h3>
                <p className="text-sm text-muted-foreground">
                    Optional absolute path to the <code className="font-mono text-xs">kronoscode</code> binary.
                    Useful when your desktop app launch environment has a stale PATH.
                </p>
            </div>

            <div className="flex gap-2">
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="/Users/you/.bun/bin/kronoscode"
                    disabled={isLoading || isSaving}
                    className="flex-1 font-mono text-xs"
                />
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isLoading || isSaving}
                >
                    {isSaving ? 'Saving\u2026' : 'Save'}
                </Button>
            </div>

            <p className="text-xs text-muted-foreground">
                Tip: you can also use <span className="font-mono">KRONOSCODE_BINARY</span> env var.
            </p>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Enable AI Browser tools</p>
                    <p className="text-xs text-muted-foreground">
                        Sets <span className="font-mono">KRONOSCODE_ENABLE_AI_BROWSER</span> for managed KronosCode restarts.
                    </p>
                </div>
                <Switch
                    checked={aiBrowserEnabled}
                    onCheckedChange={setAiBrowserEnabled}
                    disabled={isLoading || isSaving}
                    aria-label="Enable AI Browser tools"
                />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Open Browser at startup</p>
                    <p className="text-xs text-muted-foreground">
                        When enabled, Browser tab opens automatically on app launch.
                    </p>
                </div>
                <Switch
                    checked={browserOpenAtStartup}
                    onCheckedChange={setBrowserOpenAtStartup}
                    disabled={isLoading || isSaving}
                    aria-label="Open Browser at startup"
                />
            </div>
        </div>
    );
};
