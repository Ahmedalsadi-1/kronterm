// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { VoiceModel } from "@/app/aipanel/voice-model";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsVoiceContentProps {
    model: KronSettingsViewModel;
}

const sectionClassName = "rounded-xl border border-border bg-panel px-5 py-4 mb-6";

function useToggleField(key: string): [boolean, (v: boolean) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key as any));
    const [val, setVal] = useState(Boolean(stored));
    useEffect(() => { setVal(Boolean(stored)); }, [stored]);
    const save = (v: boolean) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
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

const KronSettingsVoiceContent = memo((_props: KronSettingsVoiceContentProps) => {
    const [voiceEnabled, setVoiceEnabled] = useToggleField("voice:enabled");
    const [autoDetect, setAutoDetect] = useToggleField("voice:autodetect");
    const [readAloud, setReadAloud] = useToggleField("voice:readaloud");

    const voiceModel = VoiceModel.getInstance();

    useEffect(() => {
        if (voiceEnabled) {
            voiceModel.startEngine();
        } else {
            voiceModel.disableEngine();
        }
    }, [voiceEnabled, voiceModel]);

    useEffect(() => {
        voiceModel.setWakeWord(autoDetect);
    }, [autoDetect, voiceModel]);

    return (
        <div className="space-y-6">
            <div className={sectionClassName}>
                <h2 className="text-base font-semibold text-primary mb-4">Voice Settings</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Voice Input</div>
                            <div className="text-xs text-muted mt-0.5">Enable speech-to-text for AI chat</div>
                        </div>
                        <ToggleBtn checked={voiceEnabled} onChange={setVoiceEnabled} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                        <div>
                            <div className="text-sm font-semibold text-primary">Auto-detect Speech</div>
                            <div className="text-xs text-muted mt-0.5">Automatically detect when you start speaking</div>
                        </div>
                        <ToggleBtn checked={autoDetect} onChange={setAutoDetect} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="text-sm font-semibold text-primary">Read Aloud</div>
                            <div className="text-xs text-muted mt-0.5">Have AI responses read aloud</div>
                        </div>
                        <ToggleBtn checked={readAloud} onChange={setReadAloud} />
                    </div>
                </div>
            </div>
            <div className="rounded-xl border border-border bg-panel px-5 py-4">
                <p className="text-xs text-secondary">
                    <i className="fa-solid fa-circle-info text-accent mr-1.5" />
                    Voice features require microphone permission. Configure in your system settings.
                </p>
            </div>
        </div>
    );
});

KronSettingsVoiceContent.displayName = "KronSettingsVoiceContent";

export { KronSettingsVoiceContent };
