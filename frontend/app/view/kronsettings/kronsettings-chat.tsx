// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useState } from "react";
import { useSettingField, useToggleField } from "./kronsettings-hooks";
import type { KronSettingsViewModel } from "./kronsettings-model";
import {
    InfoCallout,
    InputSetting,
    SectionHeader,
    SelectSetting,
    SettingsCard,
    ToggleSetting,
} from "./kronsettings-shared";

interface KronSettingsChatContentProps {
    model: KronSettingsViewModel;
}

const LayoutModeStorageKey = "kronterm:layoutmode";
const LayoutModeChangedEvent = "kronterm:layoutmode-changed";

function publishLayoutMode(mode: string) {
    try {
        window.localStorage.setItem(LayoutModeStorageKey, mode);
        window.dispatchEvent(new CustomEvent(LayoutModeChangedEvent, { detail: { mode } }));
    } catch {}
}

function getStoredLayoutMode() {
    try {
        const mode = window.localStorage.getItem(LayoutModeStorageKey);
        return mode === "canvas" || mode === "tabs" || mode === "web" ? mode : "widgets";
    } catch {
        return "widgets";
    }
}

const KronSettingsChatContent = memo(({ model }: KronSettingsChatContentProps) => {
    const fullConfig = useAtomValue(model.env.atoms.fullConfigAtom);
    const settings = fullConfig?.settings ?? {};
    const [defaultMode, setDefaultMode] = useSettingField("waveai:defaultmode");
    const [baseUrl, setBaseUrl] = useSettingField("ai:baseurl");
    const [apiToken, setApiToken] = useSettingField("ai:apitoken");
    const [aiModel, setAiModel] = useSettingField("ai:model");
    const [maxTokens, setMaxTokens] = useSettingField("ai:maxtokens");
    const [autoNameChats, setAutoNameChats] = useToggleField("waveai:autoname" as keyof SettingsType);
    const quickComposer = settings["app:quickcomposer"] ?? false;
    const settingsLayoutMode =
        settings["app:layoutmode"] === "canvas" ||
        settings["app:layoutmode"] === "tabs" ||
        settings["app:layoutmode"] === "web"
            ? settings["app:layoutmode"]
            : "widgets";
    const [layoutMode, setLayoutMode] = useState(() => getStoredLayoutMode());

    const setValues = useCallback((values: Record<string, any>) => {
        void RpcApi.SetConfigCommand(TabRpcClient, values).catch((error) => {
            console.warn("[KronTerm settings] config update failed", error);
        });
    }, []);

    const applyPreset = useCallback(
        (preset: "kronos" | "openai" | "ollama") => {
            if (preset === "kronos") {
                setValues({
                    "waveai:defaultmode": "waveai@kronos",
                    "app:quickcomposer": false,
                    "app:layoutmode": "widgets",
                });
                publishLayoutMode("widgets");
                setLayoutMode("widgets");
                return;
            }
            if (preset === "openai") {
                setValues({
                    "ai:provider": "openai",
                    "ai:model": "gpt-4.1",
                    "waveai:defaultmode": "waveai@openai",
                });
                return;
            }
            setValues({
                "ai:provider": "ollama",
                "ai:baseurl": "http://localhost:11434/v1",
                "ai:model": "llama3.3",
                "waveai:defaultmode": "waveai@ollama",
            });
        },
        [setValues]
    );

    useEffect(() => {
        setLayoutMode(settingsLayoutMode);
    }, [settingsLayoutMode]);

    return (
        <div>
            <SettingsCard>
                <SectionHeader
                    title="Quick Setup"
                    icon="bolt"
                    description="Choose a simple starting point. You can fine-tune advanced fields below later."
                />
                <div className="grid gap-3 @lg:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => applyPreset("kronos")}
                        className="cursor-pointer rounded-xl border border-border bg-black/20 p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
                    >
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                            <i className="fa-solid fa-wand-magic-sparkles text-accent" />
                            Recommended
                        </div>
                        <p className="text-xs leading-relaxed text-secondary">
                            Use KronosCode defaults, keep the dock as the main chat, and leave the floating composer
                            off.
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPreset("openai")}
                        className="cursor-pointer rounded-xl border border-border bg-black/20 p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
                    >
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                            <i className="fa-solid fa-cloud text-accent" />
                            Hosted Model
                        </div>
                        <p className="text-xs leading-relaxed text-secondary">
                            Start with a hosted OpenAI-style setup. Add your key in the secure credential section.
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPreset("ollama")}
                        className="cursor-pointer rounded-xl border border-border bg-black/20 p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
                    >
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                            <i className="fa-solid fa-house-laptop text-accent" />
                            Local Model
                        </div>
                        <p className="text-xs leading-relaxed text-secondary">
                            Use a local Ollama server. Best for users who already run local models.
                        </p>
                    </button>
                </div>
            </SettingsCard>
            <SettingsCard>
                <SectionHeader
                    title="Chat Configuration"
                    icon="comment"
                    description="Plain-language chat behavior and provider settings."
                />
                <InputSetting
                    title="Default Assistant"
                    description="Which assistant setup KronTerm should use when a new chat starts."
                    value={defaultMode}
                    onChange={setDefaultMode}
                    placeholder="waveai@kronos"
                />
                <InputSetting
                    title="Server URL"
                    description="Only change this if your model provider gave you a custom server URL."
                    value={baseUrl}
                    onChange={setBaseUrl}
                    placeholder="https://api.openai.com/v1"
                    monospace
                />
                <InputSetting
                    title="API Key"
                    description="Paste your provider key here if you use a hosted model. Keep this private."
                    value={apiToken}
                    onChange={setApiToken}
                    placeholder="sk-..."
                    type="password"
                    monospace
                />
                <InputSetting
                    title="Model Name"
                    description="The model KronTerm should ask, for example gpt-4.1 or a local Ollama model."
                    value={aiModel}
                    onChange={setAiModel}
                    placeholder="gpt-4o"
                    monospace
                />
                <InputSetting
                    title="Response Length Limit"
                    description="Higher values allow longer answers but may cost more or run slower."
                    value={maxTokens}
                    onChange={setMaxTokens}
                    placeholder="4096"
                />
                <ToggleSetting
                    title="Automatically Name Chats"
                    description="Let KronTerm create readable conversation titles for you."
                    checked={autoNameChats}
                    onChange={setAutoNameChats}
                />
            </SettingsCard>
            <SettingsCard>
                <SectionHeader
                    title="KronTerm Chat UI"
                    icon="wand-magic-sparkles"
                    description="Control the side dock, floating composer, and workspace layout."
                />
                <ToggleSetting
                    title="Floating Chat Composer"
                    description="Show the bottom quick composer. Disable this if you only want the side dock."
                    checked={quickComposer}
                    onChange={(v) => setValues({ "app:quickcomposer": v })}
                />
                <SelectSetting
                    title="Workspace Layout"
                    description="Choose tiled widgets, browser-style widget tabs, or canvas mode."
                    value={layoutMode}
                    onChange={(v) => {
                        publishLayoutMode(v);
                        setLayoutMode(v === "canvas" || v === "tabs" || v === "web" ? v : "widgets");
                        setValues({ "app:layoutmode": v });
                    }}
                    options={[
                        { value: "widgets", label: "Widgets" },
                        { value: "tabs", label: "Widget tabs" },
                        { value: "canvas", label: "Canvas" },
                        { value: "web", label: "Web" },
                    ]}
                />
            </SettingsCard>
            <InfoCallout>
                <i className="fa-solid fa-circle-info" />
                API keys are stored locally and never sent to KronTerm servers.
            </InfoCallout>
        </div>
    );
});

KronSettingsChatContent.displayName = "KronSettingsChatContent";

export { KronSettingsChatContent };
