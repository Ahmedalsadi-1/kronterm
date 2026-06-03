// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsDesktopContentProps {
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

function useSettingField(key: Parameters<typeof getSettingsKeyAtom>[0]): [string, (v: string) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(stored != null ? String(stored) : "");
    useEffect(() => { setVal(stored != null ? String(stored) : ""); }, [stored]);
    const save = (v: string) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v || undefined });
    };
    return [val, save];
}

const ToggleBtn = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${checked ? "bg-accent" : "bg-zinc-600"}`}
    >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
);

const KronSettingsDesktopContent = memo(({ _model }: KronSettingsDesktopContentProps) => {
    const [desktopControl, setDesktopControl] = useToggleField("desktop:control");
    const [screenShare, setScreenShare] = useToggleField("desktop:screenshare");
    const [autoMinimize, setAutoMinimize] = useToggleField("desktop:autominimize");
    const [defaultEditor, setDefaultEditor] = useSettingField("app:defaulteditor");

    return (
        <div className="space-y-6">
            <div className={sectionClassName}>
                <h2 className="text-base font-semibold text-primary mb-4">Desktop Control</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Desktop Control</div>
                            <div className="text-xs text-muted mt-0.5">Allow AI agents to control desktop</div>
                        </div>
                        <ToggleBtn checked={desktopControl} onChange={setDesktopControl} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Screen Sharing</div>
                            <div className="text-xs text-muted mt-0.5">Allow screen capture for AI context</div>
                        </div>
                        <ToggleBtn checked={screenShare} onChange={setScreenShare} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Auto-minimize on Launch</div>
                            <div className="text-xs text-muted mt-0.5">Minimize terminal when launching apps</div>
                        </div>
                        <ToggleBtn checked={autoMinimize} onChange={setAutoMinimize} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="text-sm font-semibold text-primary">Default Editor</div>
                            <div className="text-xs text-muted mt-0.5">Editor to open files with</div>
                        </div>
                        <input
                            value={defaultEditor}
                            onChange={(e) => setDefaultEditor(e.target.value)}
                            placeholder="code"
                            className="w-32 bg-input border border-border rounded px-2 py-1 text-xs text-primary placeholder:text-muted"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

KronSettingsDesktopContent.displayName = "KronSettingsDesktopContent";

export { KronSettingsDesktopContent };
