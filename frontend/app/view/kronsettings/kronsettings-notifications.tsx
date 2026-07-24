// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsNotificationsContentProps {
    model: KronSettingsViewModel;
}

const sectionClassName = "rounded-xl border border-border bg-panel px-5 py-4 mb-6";

function useToggleField(key: Parameters<typeof getSettingsKeyAtom>[0]): [boolean, (v: boolean) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(Boolean(stored));
    useEffect(() => { setVal(Boolean(stored)); }, [stored]);
    const save = (v: boolean) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
    };
    return [val, save];
}

const KronSettingsNotificationsContent = memo(({ model: _model }: KronSettingsNotificationsContentProps) => {
    const [desktopNotif, setDesktopNotif] = useToggleField("notify:desktop");
    const [soundEnabled, setSoundEnabled] = useToggleField("notify:sound");
    const [taskComplete, setTaskComplete] = useToggleField("notify:taskcomplete");
    const [errorAlerts, setErrorAlerts] = useToggleField("notify:error");

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${checked ? "bg-accent" : "bg-zinc-600"}`}
        >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
    );

    return (
        <div className="space-y-6">
            <div className={sectionClassName}>
                <h2 className="text-base font-semibold text-primary mb-4">Notification Preferences</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Desktop Notifications</div>
                            <div className="text-xs text-muted mt-0.5">Show system notifications</div>
                        </div>
                        <Toggle checked={desktopNotif} onChange={setDesktopNotif} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Sound Effects</div>
                            <div className="text-xs text-muted mt-0.5">Play notification sounds</div>
                        </div>
                        <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Task Completion</div>
                            <div className="text-xs text-muted mt-0.5">Notify when long-running tasks complete</div>
                        </div>
                        <Toggle checked={taskComplete} onChange={setTaskComplete} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="text-sm font-semibold text-primary">Error Alerts</div>
                            <div className="text-xs text-muted mt-0.5">Notify on command failures and errors</div>
                        </div>
                        <Toggle checked={errorAlerts} onChange={setErrorAlerts} />
                    </div>
                </div>
            </div>
        </div>
    );
});

KronSettingsNotificationsContent.displayName = "KronSettingsNotificationsContent";

export { KronSettingsNotificationsContent };
