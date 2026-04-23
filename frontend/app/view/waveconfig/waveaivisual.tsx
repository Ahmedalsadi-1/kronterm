// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Toggle } from "@/app/element/toggle";
import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import { getWebServerEndpoint } from "@/util/endpoints";
import { fetch } from "@/util/fetchutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useState } from "react";

interface WaveAIVisualContentProps {
    model: WaveConfigViewModel;
}

type TemplateKey = "ollama" | "openai" | "google" | "openrouter" | "kronos" | "custom";

type TemplateConfig = {
    label: string;
    description: string;
    create: (modeKey: string) => AIModeConfigType;
};

type KronosModelSnapshot = {
    id: string;
    name?: string;
    toolCall?: boolean;
    reasoning?: boolean;
    attachment?: boolean;
    status?: string;
    inputModalities?: string[];
    outputModalities?: string[];
};

type KronosProviderSnapshot = {
    id: string;
    name: string;
    connected?: boolean;
    defaultModelId?: string;
    models: KronosModelSnapshot[];
};

type KronosToolCapabilitySnapshot = {
    id: string;
    connector?: string;
    riskLevel?: string;
    interactive?: boolean;
    fallback?: string[];
};

type KronosToolDefinitionSnapshot = {
    id: string;
    description?: string;
    connector?: string;
    riskLevel?: string;
    interactive?: boolean;
    fallback?: string[];
    parameters?: Record<string, any>;
};

type KronosModeSnapshot = {
    mode: string;
    endpoint?: string;
    model?: string;
    agent?: string;
    toolRouting?: string;
    permissionMode?: string;
    authConfigured?: boolean;
    connected?: boolean;
    selectedProviderId?: string;
    selectedModelId?: string;
    providers?: KronosProviderSnapshot[];
    toolCapabilities?: KronosToolCapabilitySnapshot[];
    selectedTools?: KronosToolDefinitionSnapshot[];
    errors?: string[];
};

const providerTemplates: Record<TemplateKey, TemplateConfig> = {
    ollama: {
        label: "Ollama",
        description: "Local model running on your own machine.",
        create: (modeKey) => ({
            "display:name": "Ollama",
            "display:icon": "microchip",
            "display:description": "Local model via Ollama",
            "ai:apitype": "openai-chat",
            "ai:model": "llama3.3:70b",
            "ai:endpoint": "http://localhost:11434/v1/chat/completions",
            "ai:apitoken": "ollama",
            "ai:thinkinglevel": "medium",
            "ai:capabilities": ["tools"],
            "ai:switchcompat": [modeKey],
        }),
    },
    openai: {
        label: "OpenAI",
        description: "Use your own OpenAI key with a hosted model.",
        create: (modeKey) => ({
            "display:name": "OpenAI",
            "display:icon": "sparkles",
            "display:description": "Hosted OpenAI model",
            "ai:provider": "openai",
            "ai:model": "gpt-4.1",
            "ai:thinkinglevel": "medium",
            "ai:switchcompat": [modeKey],
        }),
    },
    google: {
        label: "Google Gemini",
        description: "Use your own Gemini key.",
        create: (modeKey) => ({
            "display:name": "Gemini",
            "display:icon": "stars",
            "display:description": "Hosted Gemini model",
            "ai:provider": "google",
            "ai:model": "gemini-2.5-pro",
            "ai:thinkinglevel": "medium",
            "ai:switchcompat": [modeKey],
        }),
    },
    openrouter: {
        label: "OpenRouter",
        description: "Use your own OpenRouter key for broad model choice.",
        create: (modeKey) => ({
            "display:name": "OpenRouter",
            "display:icon": "server",
            "display:description": "Hosted model via OpenRouter",
            "ai:provider": "openrouter",
            "ai:model": "openai/gpt-4.1-mini",
            "ai:thinkinglevel": "medium",
            "ai:switchcompat": [modeKey],
        }),
    },
    kronos: {
        label: "Kronos local engine",
        description: "Keep Saturn UI and route the chat session through a local KronosCode server.",
        create: (modeKey) => ({
            "display:name": "Kronos Local",
            "display:icon": "server",
            "display:description": "Saturn UI powered by a local KronosCode session engine",
            "ai:provider": "kronos",
            "ai:apitype": "kronos-session",
            "ai:model": "anthropic/claude-sonnet-4-5",
            "ai:agent": "coder",
            "ai:endpoint": "http://127.0.0.1:3001",
            "ai:apitokensecretname": "KRONOSCODE_SERVER_PASSWORD",
            "ai:thinkinglevel": "medium",
            "ai:capabilities": ["tools"],
            "ai:kronostoolrouting": "hybrid",
            "ai:kronospermissionmode": "always",
            "ai:switchcompat": [modeKey],
        }),
    },
    custom: {
        label: "Custom endpoint",
        description: "For LM Studio, vLLM, or any OpenAI-compatible endpoint.",
        create: (modeKey) => ({
            "display:name": "Custom AI",
            "display:icon": "server",
            "display:description": "Custom OpenAI-compatible endpoint",
            "ai:apitype": "openai-chat",
            "ai:model": "your-model-name",
            "ai:endpoint": "http://localhost:1234/v1/chat/completions",
            "ai:apitokensecretname": "CUSTOM_AI_KEY",
            "ai:thinkinglevel": "medium",
            "ai:capabilities": ["tools"],
            "ai:switchcompat": [modeKey],
        }),
    },
};

const sectionClassName = "rounded-xl border border-border bg-panel px-5 py-4";

function parseKronosModelValue(model: string | undefined | null): { providerId: string; modelId: string } | null {
    if (!model) {
        return null;
    }
    const [providerId, modelId] = model.split("/", 2);
    if (!providerId || !modelId) {
        return null;
    }
    return { providerId, modelId };
}

function inferPrivacyLabel(modeKey: string, config: AIModeConfigType): string {
    if (modeKey.startsWith("waveai@") || config["waveai:cloud"]) return "Wave cloud";
    const provider = config["ai:provider"];
    const endpoint = config["ai:endpoint"] ?? "";
    if (provider === "openai" || provider === "google" || provider === "openrouter" || provider === "azure") {
        return "Your cloud account";
    }
    if (provider === "kronos") {
        return "Local Kronos server";
    }
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1") || config["ai:apitoken"] === "ollama") {
        return "Local only";
    }
    return "Custom provider";
}

const ModeCard = memo(
    ({
        modeKey,
        config,
        isSelected,
        onSelect,
    }: {
        modeKey: string;
        config: AIModeConfigType;
        isSelected: boolean;
        onSelect: () => void;
    }) => {
        return (
            <button
                onClick={onSelect}
                className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer",
                    isSelected ? "border-accent bg-accent/10" : "border-border hover:bg-hover"
                )}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary truncate">
                            {config["display:name"] || modeKey}
                        </div>
                        <div className="text-xs text-muted mt-1 truncate">{modeKey}</div>
                    </div>
                    <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground shrink-0">
                        {inferPrivacyLabel(modeKey, config)}
                    </div>
                </div>
                <div className="text-sm text-muted mt-2 line-clamp-2">
                    {config["display:description"] || "No description yet."}
                </div>
            </button>
        );
    }
);

ModeCard.displayName = "ModeCard";

const FieldLabel = memo(({ title, hint }: { title: string; hint?: string }) => {
    return (
        <div className="mb-1">
            <div className="text-sm font-semibold text-primary">{title}</div>
            {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
        </div>
    );
});

FieldLabel.displayName = "FieldLabel";

export const WaveAIVisualContent = memo(({ model }: WaveAIVisualContentProps) => {
    const settings = useAtomValue(model.env.atoms.fullConfigAtom)?.settings ?? {};
    const isSaving = useAtomValue(model.isSavingAtom);
    const parsedContent = model.getParsedFileContent() ?? {};
    const currentConfigs = useMemo(() => parsedContent as Record<string, AIModeConfigType>, [parsedContent]);
    const customModeEntries = Object.entries(currentConfigs);
    const [selectedModeKey, setSelectedModeKey] = useState<string>(customModeEntries[0]?.[0] ?? "");
    const [newModeKey, setNewModeKey] = useState("");
    const [kronosSnapshot, setKronosSnapshot] = useState<KronosModeSnapshot | null>(null);
    const [kronosSnapshotLoading, setKronosSnapshotLoading] = useState(false);
    const [kronosSnapshotError, setKronosSnapshotError] = useState<string>("");
    const [kronosSnapshotRefreshNonce, setKronosSnapshotRefreshNonce] = useState(0);

    useEffect(() => {
        if (selectedModeKey && currentConfigs[selectedModeKey]) {
            return;
        }
        setSelectedModeKey(customModeEntries[0]?.[0] ?? "");
    }, [customModeEntries, currentConfigs, selectedModeKey]);

    const selectedMode = selectedModeKey ? currentConfigs[selectedModeKey] : null;
    const parsedKronosModel = useMemo(
        () => parseKronosModelValue(selectedMode?.["ai:model"]),
        [selectedMode?.["ai:model"]]
    );
    const selectableDefaultModes = useMemo(() => {
        return [
            { key: "waveai@balanced", label: "Wave AI Balanced" },
            { key: "waveai@quick", label: "Wave AI Quick" },
            ...customModeEntries.map(([key, config]) => ({
                key,
                label: config["display:name"] || key,
            })),
        ];
    }, [customModeEntries]);

    useEffect(() => {
        if (!selectedModeKey || selectedMode?.["ai:provider"] !== "kronos") {
            setKronosSnapshot(null);
            setKronosSnapshotLoading(false);
            setKronosSnapshotError("");
            return;
        }

        const webEndpoint = getWebServerEndpoint();
        if (!webEndpoint) {
            setKronosSnapshot(null);
            setKronosSnapshotLoading(false);
            setKronosSnapshotError("Wave web endpoint is unavailable in this window.");
            return;
        }

        let cancelled = false;

        const loadSnapshot = async () => {
            setKronosSnapshotLoading(true);
            setKronosSnapshotError("");
            try {
                const url = `${webEndpoint}/api/waveai/kronos/snapshot?mode=${encodeURIComponent(selectedModeKey)}`;
                const response = await fetch(url, { method: "GET" });
                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    const errorText =
                        typeof payload?.error === "string" && payload.error.length > 0
                            ? payload.error
                            : response.statusText || "Failed to load Kronos snapshot.";
                    throw new Error(errorText);
                }
                const snapshot = (payload?.data ?? payload) as KronosModeSnapshot;
                if (!cancelled) {
                    setKronosSnapshot(snapshot);
                }
            } catch (err) {
                if (!cancelled) {
                    setKronosSnapshot(null);
                    setKronosSnapshotError(err instanceof Error ? err.message : "Failed to load Kronos snapshot.");
                }
            } finally {
                if (!cancelled) {
                    setKronosSnapshotLoading(false);
                }
            }
        };

        void loadSnapshot();

        return () => {
            cancelled = true;
        };
    }, [
        selectedModeKey,
        selectedMode?.["ai:provider"],
        selectedMode?.["ai:model"],
        selectedMode?.["ai:endpoint"],
        selectedMode?.["ai:apitokensecretname"],
        kronosSnapshotRefreshNonce,
    ]);

    const kronosProviders = kronosSnapshot?.providers ?? [];
    const selectedKronosProvider = useMemo(() => {
        if (kronosProviders.length === 0) {
            return null;
        }
        const targetProviderId = parsedKronosModel?.providerId ?? kronosSnapshot?.selectedProviderId;
        return kronosProviders.find((provider) => provider.id === targetProviderId) ?? kronosProviders[0];
    }, [kronosProviders, kronosSnapshot?.selectedProviderId, parsedKronosModel?.providerId]);
    const selectedKronosModel = useMemo(() => {
        if (!selectedKronosProvider) {
            return null;
        }
        const targetModelId = parsedKronosModel?.modelId ?? kronosSnapshot?.selectedModelId;
        return (
            selectedKronosProvider.models.find((model) => model.id === targetModelId) ??
            selectedKronosProvider.models.find((model) => model.id === selectedKronosProvider.defaultModelId) ??
            selectedKronosProvider.models[0] ??
            null
        );
    }, [selectedKronosProvider, kronosSnapshot?.selectedModelId, parsedKronosModel?.modelId]);

    const updateMode = async (modeKey: string, updater: (config: AIModeConfigType) => AIModeConfigType) => {
        const nextValue = {
            ...currentConfigs,
            [modeKey]: updater(currentConfigs[modeKey] ?? ({} as AIModeConfigType)),
        };
        await model.saveJsonObject(nextValue);
    };

    const selectKronosProvider = async (providerId: string) => {
        const provider = kronosProviders.find((item) => item.id === providerId);
        const nextModelId =
            provider?.models.find((item) => item.id === provider.defaultModelId)?.id ??
            provider?.defaultModelId ??
            provider?.models[0]?.id;
        if (!provider || !nextModelId) {
            return;
        }
        await updateMode(selectedModeKey, (config) => ({
            ...config,
            "ai:model": `${provider.id}/${nextModelId}`,
        }));
    };

    const selectKronosModel = async (modelId: string) => {
        if (!selectedKronosProvider || !modelId) {
            return;
        }
        await updateMode(selectedModeKey, (config) => ({
            ...config,
            "ai:model": `${selectedKronosProvider.id}/${modelId}`,
        }));
    };

    const deleteMode = async (modeKey: string) => {
        const nextValue = { ...currentConfigs };
        delete nextValue[modeKey];
        await model.saveJsonObject(nextValue);
        const nextKeys = Object.keys(nextValue);
        setSelectedModeKey(nextKeys[0] ?? "");
        if (settings["waveai:defaultmode"] === modeKey) {
            await model.setConfigValues({ "waveai:defaultmode": "waveai@balanced" });
        }
    };

    const addMode = async (templateKey: TemplateKey) => {
        const trimmed = newModeKey.trim();
        if (trimmed.length === 0) {
            model.clearValidationError();
            model.clearError();
            return;
        }
        if (currentConfigs[trimmed]) {
            model.clearError();
            model.clearValidationError();
            return;
        }
        const template = providerTemplates[templateKey];
        const nextValue = {
            ...currentConfigs,
            [trimmed]: template.create(trimmed),
        };
        await model.saveJsonObject(nextValue);
        setSelectedModeKey(trimmed);
        setNewModeKey("");
    };

    return (
        <div className="h-full overflow-y-auto bg-background">
            <div className="max-w-6xl mx-auto p-6 space-y-5">
                <div>
                    <div className="text-2xl font-semibold text-primary">Wave AI Setup</div>
                    <div className="text-sm text-muted mt-2 max-w-3xl">
                        This view is meant for normal setup, not hand-editing JSON. Choose a default mode, control
                        privacy behavior, and add common providers with one click. For advanced options, switch to{" "}
                        <span className="font-semibold text-primary">Raw JSON</span>.
                    </div>
                    {isSaving && <div className="text-xs text-accent mt-2">Saving changes...</div>}
                </div>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">Simple AI controls</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                        <div>
                            <FieldLabel
                                title="Default AI mode"
                                hint="Choose what Saturn should use first when it opens."
                            />
                            <select
                                value={settings["waveai:defaultmode"] ?? "waveai@balanced"}
                                onChange={(e) => model.setConfigValues({ "waveai:defaultmode": e.target.value })}
                                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                            >
                                {selectableDefaultModes.map((mode) => (
                                    <option key={mode.key} value={mode.key}>
                                        {mode.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <div className="rounded-lg border border-border bg-background px-4 py-3 w-full">
                                <div className="text-sm font-semibold text-primary">Privacy at a glance</div>
                                <div className="text-sm text-muted mt-2">
                                    Wave cloud modes need anonymous telemetry enabled. Your own cloud keys use your
                                    provider account. Local endpoints keep requests on your machine.
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <Toggle
                                        checked={settings["waveai:showcloudmodes"] ?? true}
                                        onChange={(checked) => model.setConfigValues({ "waveai:showcloudmodes": checked })}
                                    />
                                    <span className="text-sm text-primary">Show Wave cloud modes in picker</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">Add a new AI mode</div>
                    <div className="text-sm text-muted mt-1">
                        Start from a template instead of writing JSON from scratch.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 mt-4">
                        <input
                            value={newModeKey}
                            onChange={(e) => setNewModeKey(e.target.value)}
                            placeholder="Mode key, for example ollama-local"
                            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                        />
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(providerTemplates) as TemplateKey[]).map((templateKey) => (
                                <button
                                    key={templateKey}
                                    onClick={() => addMode(templateKey)}
                                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-hover cursor-pointer"
                                    title={providerTemplates[templateKey].description}
                                >
                                    Add {providerTemplates[templateKey].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5">
                    <section className={sectionClassName}>
                        <div className="text-base font-semibold text-primary">Your custom modes</div>
                        <div className="text-sm text-muted mt-1 mb-4">
                            Select a mode to edit its name, provider, endpoint, model, and tools support.
                        </div>
                        <div className="space-y-3">
                            {customModeEntries.length === 0 && (
                                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted text-center">
                                    No custom AI modes yet. Add one above to get started.
                                </div>
                            )}
                            {customModeEntries.map(([modeKey, config]) => (
                                <ModeCard
                                    key={modeKey}
                                    modeKey={modeKey}
                                    config={config}
                                    isSelected={selectedModeKey === modeKey}
                                    onSelect={() => setSelectedModeKey(modeKey)}
                                />
                            ))}
                        </div>
                    </section>

                    <section className={sectionClassName}>
                        <div className="text-base font-semibold text-primary">Selected mode</div>
                        {!selectedMode && (
                            <div className="text-sm text-muted mt-3">
                                Select a mode on the left, or add one from a template.
                            </div>
                        )}
                        {selectedMode && (
                            <div className="space-y-4 mt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel title="Display name" />
                                        <input
                                            key={`${selectedModeKey}-display-name`}
                                            defaultValue={selectedMode["display:name"] ?? ""}
                                            onBlur={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "display:name": e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel title="Description" />
                                        <input
                                            key={`${selectedModeKey}-display-description`}
                                            defaultValue={selectedMode["display:description"] ?? ""}
                                            onBlur={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "display:description": e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel title="Provider" hint="Leave as custom if you are using a manual endpoint." />
                                        <select
                                            value={selectedMode["ai:provider"] ?? "custom"}
                                            onChange={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:provider": e.target.value === "custom" ? undefined : e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                        >
                                            <option value="custom">Custom</option>
                                            <option value="kronos">Kronos</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="google">Google Gemini</option>
                                            <option value="openrouter">OpenRouter</option>
                                            <option value="azure">Azure OpenAI</option>
                                        </select>
                                    </div>
                                    <div>
                                        <FieldLabel
                                            title="Model"
                                            hint={
                                                selectedMode["ai:provider"] === "kronos"
                                                    ? "Kronos expects provider/model, for example anthropic/claude-sonnet-4-5."
                                                    : undefined
                                            }
                                        />
                                        <input
                                            key={`${selectedModeKey}-model`}
                                            defaultValue={selectedMode["ai:model"] ?? ""}
                                            onBlur={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:model": e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <FieldLabel
                                            title={selectedMode["ai:provider"] === "kronos" ? "Gateway / endpoint" : "Endpoint"}
                                            hint={
                                                selectedMode["ai:provider"] === "kronos"
                                                    ? "Base URL for the local KronosCode server."
                                                    : "Mostly for local servers and OpenAI-compatible APIs. Leave blank for provider-based modes like OpenAI or Gemini."
                                            }
                                        />
                                        <input
                                            key={`${selectedModeKey}-endpoint`}
                                            defaultValue={selectedMode["ai:endpoint"] ?? ""}
                                            onBlur={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:endpoint": e.target.value || undefined,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel title="Thinking level" />
                                        <select
                                            value={selectedMode["ai:thinkinglevel"] ?? "medium"}
                                            onChange={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:thinkinglevel": e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                    <div>
                                        <FieldLabel
                                            title={selectedMode["ai:provider"] === "kronos" ? "Auth secret name" : "API token secret name"}
                                            hint={
                                                selectedMode["ai:provider"] === "kronos"
                                                    ? "Secret containing KRONOSCODE_SERVER_PASSWORD for Basic auth."
                                                    : "For providers that expect a secret stored in Wave."
                                            }
                                        />
                                        <input
                                            key={`${selectedModeKey}-secret`}
                                            defaultValue={selectedMode["ai:apitokensecretname"] ?? ""}
                                            onBlur={(e) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:apitokensecretname": e.target.value || undefined,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                        />
                                    </div>
                                </div>

                                {selectedMode["ai:provider"] === "kronos" && (
                                    <div className="rounded-lg border border-border bg-background px-4 py-4 space-y-4">
                                        <div>
                                            <div className="text-sm font-semibold text-primary">Kronos session settings</div>
                                            <div className="text-sm text-muted mt-1">
                                                These settings control the local Kronos engine that sits behind Saturn.
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-border bg-panel px-4 py-4 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-primary">
                                                        Server snapshot
                                                    </div>
                                                    <div className="text-sm text-muted mt-1">
                                                        Saturn asks Wave to inspect the configured Kronos server and
                                                        list the providers, models, and native tools it can see.
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setKronosSnapshotRefreshNonce((value) => value + 1)}
                                                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-hover cursor-pointer shrink-0"
                                                >
                                                    Refresh
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <div
                                                    className={cn(
                                                        "text-[11px] rounded-full px-2 py-1",
                                                        kronosSnapshotLoading
                                                            ? "bg-secondary text-secondary-foreground"
                                                            : kronosSnapshot?.connected
                                                              ? "bg-green-500/15 text-green-700"
                                                              : "bg-secondary text-secondary-foreground"
                                                    )}
                                                >
                                                    {kronosSnapshotLoading
                                                        ? "Loading snapshot"
                                                        : kronosSnapshot?.connected
                                                          ? "Connected"
                                                          : "Waiting for server"}
                                                </div>
                                                <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                    {kronosProviders.length} providers
                                                </div>
                                                <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                    {kronosSnapshot?.toolCapabilities?.length ?? 0} native tools
                                                </div>
                                                <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                    {kronosSnapshot?.authConfigured ? "Auth configured" : "Auth missing or optional"}
                                                </div>
                                            </div>
                                            {kronosSnapshotError && (
                                                <div className="text-sm text-error">{kronosSnapshotError}</div>
                                            )}
                                            {kronosSnapshot?.errors && kronosSnapshot.errors.length > 0 && (
                                                <div className="rounded-lg border border-border bg-background px-3 py-3">
                                                    <div className="text-xs font-semibold text-primary">Snapshot notes</div>
                                                    <div className="text-xs text-muted mt-2 space-y-1">
                                                        {kronosSnapshot.errors.map((errorText, idx) => (
                                                            <div key={`${errorText}-${idx}`}>{errorText}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {kronosProviders.length > 0 && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <FieldLabel
                                                            title="Provider from server"
                                                            hint="Pick from the providers Kronos is currently exposing."
                                                        />
                                                        <select
                                                            value={selectedKronosProvider?.id ?? ""}
                                                            onChange={(e) => void selectKronosProvider(e.target.value)}
                                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                                        >
                                                            {kronosProviders.map((provider) => (
                                                                <option key={provider.id} value={provider.id}>
                                                                    {provider.name || provider.id}
                                                                    {provider.connected ? " - connected" : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <FieldLabel
                                                            title="Model from server"
                                                            hint="This writes back into ai:model using provider/model format."
                                                        />
                                                        <select
                                                            value={selectedKronosModel?.id ?? ""}
                                                            onChange={(e) => void selectKronosModel(e.target.value)}
                                                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                                            disabled={!selectedKronosProvider || selectedKronosProvider.models.length === 0}
                                                        >
                                                            {(selectedKronosProvider?.models ?? []).map((modelInfo) => (
                                                                <option key={modelInfo.id} value={modelInfo.id}>
                                                                    {modelInfo.name || modelInfo.id}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedKronosModel && (
                                                <div>
                                                    <div className="text-sm font-semibold text-primary">
                                                        Selected model capabilities
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                            Tool calling: {selectedKronosModel.toolCall ? "yes" : "no"}
                                                        </div>
                                                        <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                            Reasoning: {selectedKronosModel.reasoning ? "yes" : "no"}
                                                        </div>
                                                        <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                            Attachments: {selectedKronosModel.attachment ? "yes" : "no"}
                                                        </div>
                                                        {selectedKronosModel.status && (
                                                            <div className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground">
                                                                Status: {selectedKronosModel.status}
                                                            </div>
                                                        )}
                                                        {selectedKronosModel.inputModalities?.map((modality) => (
                                                            <div
                                                                key={`input-${modality}`}
                                                                className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground"
                                                            >
                                                                Input: {modality}
                                                            </div>
                                                        ))}
                                                        {selectedKronosModel.outputModalities?.map((modality) => (
                                                            <div
                                                                key={`output-${modality}`}
                                                                className="text-[11px] rounded-full px-2 py-1 bg-secondary text-secondary-foreground"
                                                            >
                                                                Output: {modality}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {kronosSnapshot?.selectedTools && kronosSnapshot.selectedTools.length > 0 && (
                                                <div>
                                                    <div className="text-sm font-semibold text-primary">
                                                        Native tools for this model
                                                    </div>
                                                    <div className="text-sm text-muted mt-1">
                                                        Showing the first {Math.min(12, kronosSnapshot.selectedTools.length)} of{" "}
                                                        {kronosSnapshot.selectedTools.length} tools returned by Kronos.
                                                    </div>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                                                        {kronosSnapshot.selectedTools.slice(0, 12).map((toolInfo) => (
                                                            <div
                                                                key={toolInfo.id}
                                                                className="rounded-lg border border-border bg-background px-3 py-3"
                                                            >
                                                                <div className="text-sm font-semibold text-primary">
                                                                    {toolInfo.id}
                                                                </div>
                                                                <div className="text-xs text-muted mt-1">
                                                                    {(toolInfo.connector || "core") +
                                                                        (toolInfo.riskLevel ? ` • ${toolInfo.riskLevel}` : "")}
                                                                </div>
                                                                {toolInfo.description && (
                                                                    <div className="text-xs text-muted mt-2 line-clamp-3">
                                                                        {toolInfo.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <FieldLabel title="Default agent" hint="For example coder, planner, reviewer." />
                                                <input
                                                    key={`${selectedModeKey}-agent`}
                                                    defaultValue={selectedMode["ai:agent"] ?? "coder"}
                                                    onBlur={(e) =>
                                                        updateMode(selectedModeKey, (config) => ({
                                                            ...config,
                                                            "ai:agent": e.target.value || undefined,
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel
                                                    title="Tool routing"
                                                    hint="Hybrid keeps Kronos native tools and the Wave widget bridge together."
                                                />
                                                <select
                                                    value={selectedMode["ai:kronostoolrouting"] ?? "hybrid"}
                                                    onChange={(e) =>
                                                        updateMode(selectedModeKey, (config) => ({
                                                            ...config,
                                                            "ai:kronostoolrouting": e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                                >
                                                    <option value="hybrid">Hybrid</option>
                                                    <option value="wave-only">Wave tools first</option>
                                                    <option value="kronos-only">Kronos only</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <FieldLabel
                                                    title="Permission mode"
                                                    hint="How Saturn should answer Kronos permission prompts for this mode."
                                                />
                                                <select
                                                    value={selectedMode["ai:kronospermissionmode"] ?? "always"}
                                                    onChange={(e) =>
                                                        updateMode(selectedModeKey, (config) => ({
                                                            ...config,
                                                            "ai:kronospermissionmode": e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                                                >
                                                    <option value="always">Auto approve and remember</option>
                                                    <option value="once">Auto approve once</option>
                                                    <option value="ask">Reject interactive prompts</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-lg border border-border bg-background px-4 py-4">
                                    <div className="text-sm font-semibold text-primary">Capabilities</div>
                                    <div className="text-sm text-muted mt-1 mb-3">
                                        Turn on tools if you want Saturn to expose the Wave widget bridge while this
                                        mode is active.
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Toggle
                                            checked={selectedMode["ai:capabilities"]?.includes("tools") ?? false}
                                            onChange={(checked) =>
                                                updateMode(selectedModeKey, (config) => ({
                                                    ...config,
                                                    "ai:capabilities": checked ? ["tools"] : [],
                                                }))
                                            }
                                        />
                                        <span className="text-sm text-primary">Enable widget and file tools</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <div className="text-xs text-muted">
                                        Privacy: {inferPrivacyLabel(selectedModeKey, selectedMode)}
                                    </div>
                                    <button
                                        onClick={() => deleteMode(selectedModeKey)}
                                        className="rounded-lg border border-error/40 text-error px-3 py-2 text-sm hover:bg-error/10 cursor-pointer"
                                    >
                                        Delete Mode
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
});

WaveAIVisualContent.displayName = "WaveAIVisualContent";
