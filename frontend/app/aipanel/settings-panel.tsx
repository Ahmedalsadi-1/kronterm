// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ListRow, SectionHeading, SegmentedControl, SettingsContent } from "@/app/components/ui/settings-primitives";
import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { Bot, KeyRound, Server, SlidersHorizontal } from "lucide-react";
import { memo, useEffect, useState } from "react";

type AnySettingsKey = Parameters<typeof getSettingsKeyAtom>[0];

function useSettingField(key: AnySettingsKey): [string, (v: string) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(stored != null ? String(stored) : "");
    useEffect(() => {
        setVal(stored != null ? String(stored) : "");
    }, [stored]);
    const save = (v: string) => {
        setVal(v);
        void RpcApi.SetConfigCommand(TabRpcClient, { [key]: v || undefined });
    };
    return [val, save];
}

function useToggleField(key: AnySettingsKey): [boolean, (v: boolean) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(Boolean(stored));
    useEffect(() => {
        setVal(Boolean(stored));
    }, [stored]);
    const save = (v: boolean) => {
        setVal(v);
        void RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
    };
    return [val, save];
}

const TextInput = memo(
    ({
        value,
        onChange,
        placeholder,
        type = "text",
    }: {
        value: string;
        onChange: (v: string) => void;
        placeholder?: string;
        type?: string;
    }) => (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-44 bg-black/40 border border-border rounded px-2 py-1 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
        />
    )
);
TextInput.displayName = "TextInput";

const Toggle = memo(({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer",
            checked ? "bg-accent" : "bg-zinc-600"
        )}
    >
        <span
            className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                checked ? "translate-x-[18px]" : "translate-x-0.5"
            )}
        />
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
        <SettingsContent>
            <div className="mb-5 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-accent" />
                <h3 className="text-base font-semibold text-foreground">Settings</h3>
            </div>

            <div className="mb-5 rounded-md border border-border bg-black/20 px-3">
                <SectionHeading icon={Bot} title="KronosCode AI" />
                <ListRow
                    title="Default Mode"
                    description="Active AI mode"
                    action={<TextInput value={defaultMode} onChange={setDefaultMode} placeholder="waveai@kronos" />}
                />
                <ListRow
                    title="API Type"
                    description="Provider type"
                    action={
                        <SegmentedControl
                            options={[
                                { id: "openai", label: "OpenAI" },
                                { id: "anthropic", label: "Anthropic" },
                                { id: "custom", label: "Custom" },
                            ]}
                            value={(apiType || "openai") as "openai" | "anthropic" | "custom"}
                            onChange={setApiType}
                        />
                    }
                />
                <ListRow
                    title="Base URL"
                    description="Custom API endpoint"
                    action={<TextInput value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />}
                />
                <ListRow
                    title="API Token"
                    description="Your API key"
                    action={<TextInput type="password" value={apiToken} onChange={setApiToken} placeholder="sk-..." />}
                />
                <ListRow
                    title="Model"
                    description="Model identifier"
                    action={<TextInput value={model} onChange={setModel} placeholder="gpt-4o" />}
                />
                <ListRow
                    title="Max Tokens"
                    description="Max response tokens"
                    action={<TextInput type="number" value={maxTokens} onChange={setMaxTokens} placeholder="4096" />}
                />
            </div>

            <div className="mb-5 rounded-md border border-border bg-black/20 px-3">
                <SectionHeading icon={Server} title="MCP" />
                <ListRow
                    title="Enable MCP"
                    description="Model Context Protocol support"
                    action={<Toggle checked={mcpEnabled} onChange={setMcpEnabled} />}
                />
            </div>

            <div className="mt-2 rounded-md border border-border bg-black/20 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5 text-accent" />
                    Full config:{" "}
                    <code className="text-accent bg-black/30 px-1 rounded">~/.config/kronterm/settings.json</code>
                </p>
            </div>
        </SettingsContent>
    );
});
SettingsPanel.displayName = "SettingsPanel";
