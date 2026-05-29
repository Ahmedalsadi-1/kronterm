// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";

const SettingRow = memo(({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
        <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-primary">{label}</div>
            {description && <div className="text-xs text-secondary mt-0.5">{description}</div>}
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
));
SettingRow.displayName = "SettingRow";

const Section = memo(({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 px-1">
            <i className={cn("fa-solid", icon, "text-accent text-xs")} />
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">{title}</span>
        </div>
        <div className="bg-black/20 border border-border rounded-md px-3">{children}</div>
    </div>
));
Section.displayName = "Section";

type AnySettingsKey = Parameters<typeof getSettingsKeyAtom>[0];

function useSettingField(key: AnySettingsKey): [string, (v: string) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(stored != null ? String(stored) : "");
    useEffect(() => { setVal(stored != null ? String(stored) : ""); }, [stored]);
    const save = (v: string) => {
        setVal(v);
        void RpcApi.SetConfigCommand(TabRpcClient, { [key]: v || undefined });
    };
    return [val, save];
}

function useToggleField(key: AnySettingsKey): [boolean, (v: boolean) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(Boolean(stored));
    useEffect(() => { setVal(Boolean(stored)); }, [stored]);
    const save = (v: boolean) => {
        setVal(v);
        void RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
    };
    return [val, save];
}

const TextInput = memo(({ value, onChange, placeholder, type = "text" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-44 bg-black/40 border border-border rounded px-2 py-1 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
    />
));
TextInput.displayName = "TextInput";

const Toggle = memo(({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer", checked ? "bg-accent" : "bg-zinc-600")}
    >
        <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
));
Toggle.displayName = "Toggle";

export const SettingsPanel = memo(() => {
    const [defaultMode, setDefaultMode] = useSettingField("waveai:defaultmode");
    const [apiType, setApiType] = useSettingField("ai:apitype");
    const [baseUrl, setBaseUrl] = useSettingField("ai:baseurl");
    const [apiToken, setApiToken] = useSettingField("ai:apitoken");
    const [model, setModel] = useSettingField("ai:model");
    const [maxTokens, setMaxTokens] = useSettingField("ai:maxtokens");
    const [mcpEnabled, setMcpEnabled] = useToggleField("mcp:enabled");

    return (
        <div className="flex-1 overflow-y-auto p-3 text-sm">
            <h3 className="text-base font-semibold text-primary flex items-center gap-2 mb-4">
                <i className="fa-solid fa-sliders text-accent" /> Settings
            </h3>

            <Section title="KronosCode AI" icon="fa-circle-nodes">
                <SettingRow label="Default Mode" description="Active AI mode">
                    <TextInput value={defaultMode} onChange={setDefaultMode} placeholder="waveai@kronos" />
                </SettingRow>
                <SettingRow label="API Type" description="Provider type">
                    <TextInput value={apiType} onChange={setApiType} placeholder="openai" />
                </SettingRow>
                <SettingRow label="Base URL" description="Custom API endpoint">
                    <TextInput value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
                </SettingRow>
                <SettingRow label="API Token" description="Your API key">
                    <TextInput type="password" value={apiToken} onChange={setApiToken} placeholder="sk-..." />
                </SettingRow>
                <SettingRow label="Model" description="Model identifier">
                    <TextInput value={model} onChange={setModel} placeholder="gpt-4o" />
                </SettingRow>
                <SettingRow label="Max Tokens" description="Max response tokens">
                    <TextInput type="number" value={maxTokens} onChange={setMaxTokens} placeholder="4096" />
                </SettingRow>
            </Section>

            <Section title="MCP" icon="fa-server">
                <SettingRow label="Enable MCP" description="Model Context Protocol support">
                    <Toggle checked={mcpEnabled} onChange={setMcpEnabled} />
                </SettingRow>
            </Section>

            <div className="mt-2 p-3 bg-black/20 border border-border rounded-md">
                <p className="text-xs text-secondary">
                    <i className="fa-solid fa-circle-info text-accent mr-1.5" />
                    Full config: <code className="text-accent bg-black/30 px-1 rounded">~/.config/kronterm/settings.json</code>
                </p>
            </div>
        </div>
    );
});
SettingsPanel.displayName = "SettingsPanel";
