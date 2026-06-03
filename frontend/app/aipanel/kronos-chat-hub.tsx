import { getWebServerEndpoint } from "@/util/endpoints";
import { cn, fireAndForget } from "@/util/util";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { formatFileSize, formatFileSizeError, getFileIcon, isAcceptableFile, validateFileSize } from "./ai-utils";
import { AIPanelMessages } from "./aipanelmessages";
import type { WaveUIMessage } from "./aitypes";
import type { WaveAIModel } from "./waveai-model";

type CatalogAgentStatus = "ready" | "missing" | "auth-needed" | "error";

type CatalogAgent = {
    id: string;
    name: string;
    kind: string;
    status: CatalogAgentStatus;
    available: boolean;
    icon?: string;
    cliCommand?: string;
    defaultCliPath?: string;
    acpArgs?: string[];
    skillsDirs?: string[];
    authRequired?: boolean;
    install?: {
        manager?: string;
        command?: string[];
        note?: string;
        docsUrl?: string;
    };
    description?: string;
    reason?: string;
};

type KronosProvider = {
    id: string;
    name: string;
    connected?: boolean;
    defaultModelId?: string;
    models?: Array<{
        id: string;
        name?: string;
        toolCall?: boolean;
        reasoning?: boolean;
        attachment?: boolean;
        status?: string;
    }>;
};

type KronosChatHubSnapshot = {
    mode: string;
    catalog?: { generatedAt: number; agents: CatalogAgent[] };
    kronos?: {
        connected?: boolean;
        selectedProviderId?: string;
        selectedModelId?: string;
        providers?: KronosProvider[];
        selectedTools?: unknown[];
        toolCapabilities?: unknown[];
        errors?: string[];
    };
    krontermDesktop: {
        mcpUrl: string;
        desktopUrl: string;
        mcpStatus: string;
        desktopStatus: string;
        error?: string;
    };
    errors?: string[];
};

type KronosChatHubProps = {
    model: WaveAIModel;
    messages: WaveUIMessage[];
    status: string;
    initialLoadDone: boolean;
    allowAccess: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
};

const fallbackAgents: CatalogAgent[] = [
    { id: "kronoscode", name: "KronosCode", kind: "kronoscode", status: "ready", available: true, icon: "⬡" },
    { id: "computer-use-mcp", name: "Kron Computer Use", kind: "mcp", status: "ready", available: true, icon: "▣" },
    { id: "kronterm-desktop", name: "Kronterm Desktop", kind: "desktop", status: "ready", available: true, icon: "▤" },
    { id: "codex", name: "Codex", kind: "acp", status: "missing", available: false, icon: "◈" },
    { id: "gemini", name: "Gemini", kind: "acp", status: "missing", available: false, icon: "✦" },
];

const kronosDirectEndpoint = "http://127.0.0.1:3001";
const krontermDesktopMcpUrl = "http://localhost:9990/computer-use";
const krontermDesktopDesktopUrl = "http://localhost:9990/novnc/vnc_lite.html?scale=true";

function unwrapData<T>(payload: any): T {
    return (payload?.data ?? payload) as T;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
        throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`);
    }
    return unwrapData<T>(payload);
}

async function checkReachable(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try {
        const response = await fetch(url, { signal: controller.signal });
        return response.ok ? "connected" : "error";
    } catch {
        return "error";
    } finally {
        window.clearTimeout(timeout);
    }
}

function normalizeProviderPayload(payload: any): KronosProvider[] {
    const rawProviders = payload?.providers ?? payload?.all ?? [];
    const defaults = payload?.default ?? {};
    if (!Array.isArray(rawProviders)) {
        return [];
    }
    return rawProviders
        .map((provider: any) => {
            const modelValues = Array.isArray(provider?.models)
                ? provider.models
                : Object.values(provider?.models ?? {});
            const models = modelValues
                .map((model: any) => ({
                    id: model?.id || model?.modelID || model?.model || "",
                    name: model?.name || model?.label || model?.displayName || model?.id,
                    toolCall: Boolean(model?.toolCall ?? model?.tool_call ?? model?.tools),
                    reasoning: Boolean(model?.reasoning),
                    attachment: Boolean(model?.attachment ?? model?.attachments),
                    status: model?.status,
                }))
                .filter((model: { id: string }) => model.id)
                .slice(0, 200);
            return {
                id: provider?.id || provider?.providerID || "",
                name: provider?.name || provider?.displayName || provider?.id,
                connected: true,
                defaultModelId: defaults?.[provider?.id] || provider?.defaultModelId || models[0]?.id,
                models,
            };
        })
        .filter((provider: KronosProvider) => provider.id);
}

async function makeDirectFallbackSnapshot(mode: string, reason: string): Promise<KronosChatHubSnapshot> {
    const [mcpStatus, desktopStatus, catalogResult, providersResult] = await Promise.allSettled([
        checkReachable(krontermDesktopMcpUrl),
        checkReachable(krontermDesktopDesktopUrl),
        fetchJson<{ generatedAt: number; agents: CatalogAgent[] }>(`${kronosDirectEndpoint}/agent/catalog`),
        fetchJson<any>(`${kronosDirectEndpoint}/config/providers`),
    ]);

    const resolvedMcpStatus = mcpStatus.status === "fulfilled" ? mcpStatus.value : "error";
    const resolvedDesktopStatus = desktopStatus.status === "fulfilled" ? desktopStatus.value : "error";
    const catalog =
        catalogResult.status === "fulfilled"
            ? catalogResult.value
            : {
                  generatedAt: Date.now(),
                  agents: fallbackAgents.map((agent) => {
                      if (agent.id === "computer-use-mcp") {
                          return {
                              ...agent,
                              status: (resolvedMcpStatus === "connected" ? "ready" : "error") as CatalogAgentStatus,
                              available: resolvedMcpStatus === "connected",
                          };
                      }
                      if (agent.id === "kronterm-desktop") {
                          return {
                              ...agent,
                              status: (resolvedDesktopStatus === "connected" ? "ready" : "error") as CatalogAgentStatus,
                              available: resolvedDesktopStatus === "connected",
                          };
                      }
                      return agent;
                  }),
              };
    const providers = providersResult.status === "fulfilled" ? normalizeProviderPayload(providersResult.value) : [];
    const errors = [reason];
    if (catalogResult.status === "rejected") {
        errors.push(`Direct KronosCode catalog unavailable: ${catalogResult.reason}`);
    }
    if (providersResult.status === "rejected") {
        errors.push(`Direct KronosCode providers unavailable: ${providersResult.reason}`);
    }
    return {
        mode,
        catalog,
        kronos: {
            connected: catalogResult.status === "fulfilled" || providersResult.status === "fulfilled",
            selectedProviderId: providers[0]?.id,
            selectedModelId: providers[0]?.defaultModelId,
            providers,
            selectedTools: [],
            toolCapabilities: [],
            errors,
        },
        krontermDesktop: {
            mcpUrl: krontermDesktopMcpUrl,
            desktopUrl: krontermDesktopDesktopUrl,
            mcpStatus: resolvedMcpStatus,
            desktopStatus: resolvedDesktopStatus,
            error:
                resolvedMcpStatus === "connected" && resolvedDesktopStatus === "connected"
                    ? ""
                    : "Kronterm Desktop endpoint unavailable",
        },
        errors,
    };
}

function statusClass(status?: string): string {
    if (status === "ready" || status === "connected") return "bg-emerald-500";
    if (status === "auth-needed") return "bg-amber-400";
    if (status === "missing") return "bg-zinc-500";
    return "bg-red-500";
}

function statusLabel(status?: string): string {
    if (status === "auth-needed") return "auth";
    if (status === "connected") return "live";
    return status || "unknown";
}

const AgentRail = memo(
    ({
        agents,
        selectedAgent,
        onSelect,
    }: {
        agents: CatalogAgent[];
        selectedAgent: string;
        onSelect: (id: string) => void;
    }) => {
        return (
            <div className="flex w-[58px] shrink-0 flex-col items-center gap-2 border-r border-zinc-800 bg-zinc-950/90 px-2 py-3">
                {agents.map((agent) => {
                    const selected = selectedAgent === agent.id;
                    return (
                        <button
                            key={agent.id}
                            onClick={() => onSelect(agent.id)}
                            disabled={!agent.available}
                            className={cn(
                                "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border text-lg transition-all",
                                selected
                                    ? "border-accent bg-accent/20 text-white shadow-[0_0_18px_rgb(232_196_124_/_0.16)]"
                                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800",
                                !agent.available &&
                                    "cursor-not-allowed opacity-45 hover:border-zinc-800 hover:bg-zinc-900"
                            )}
                            title={`${agent.name}: ${statusLabel(agent.status)}`}
                        >
                            <span>{agent.icon || agent.name.slice(0, 1)}</span>
                            <span
                                className={cn(
                                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950",
                                    statusClass(agent.status)
                                )}
                            />
                        </button>
                    );
                })}
            </div>
        );
    }
);
AgentRail.displayName = "AgentRail";

const AgentSetupCard = memo(
    ({ agent, mode, onInstalled }: { agent?: CatalogAgent; mode: string; onInstalled: () => void }) => {
        const [installing, setInstalling] = useState(false);
        const [message, setMessage] = useState("");
        if (!agent || agent.status === "ready") return null;

        const installCommand = agent.install?.command?.join(" ") || "Manual install required";
        const canInstall = Boolean(agent.install?.command?.length);

        const install = async () => {
            if (!canInstall || installing) return;
            setInstalling(true);
            setMessage("");
            try {
                const endpoint = getWebServerEndpoint();
                const response = await fetch(
                    `${endpoint}/api/kronoscode/agent-install/${encodeURIComponent(agent.id)}?mode=${encodeURIComponent(mode)}`,
                    { method: "POST" }
                );
                const payload = await response.json().catch(() => null);
                if (!response.ok || payload?.error) throw new Error(payload?.error || response.statusText);
                setMessage("Install finished. Refreshing detection...");
                onInstalled();
            } catch (err) {
                setMessage(err instanceof Error ? err.message : String(err));
            } finally {
                setInstalling(false);
            }
        };

        return (
            <div className="mx-4 mt-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-lg">
                        {agent.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-zinc-100">
                            {agent.name} is {statusLabel(agent.status)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                            {agent.reason || agent.description || agent.install?.note}
                        </div>
                        <div className="mt-2 truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[11px] text-zinc-300">
                            {installCommand}
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        {agent.install?.docsUrl ? (
                            <button
                                onClick={() => window.open(agent.install?.docsUrl, "_blank")}
                                className="cursor-pointer rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                            >
                                Docs
                            </button>
                        ) : null}
                        <button
                            onClick={() => fireAndForget(install)}
                            disabled={!canInstall || installing}
                            className="cursor-pointer rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {installing ? "Installing" : canInstall ? "Install" : "Manual"}
                        </button>
                    </div>
                </div>
                {message ? <div className="mt-2 text-xs text-amber-200">{message}</div> : null}
            </div>
        );
    }
);
AgentSetupCard.displayName = "AgentSetupCard";

const FileChips = memo(({ model }: { model: WaveAIModel }) => {
    const droppedFiles = useAtomValue(model.droppedFiles);
    if (droppedFiles.length === 0) return null;
    return (
        <div className="flex gap-2 overflow-x-auto px-4 py-2">
            {droppedFiles.map((file) => (
                <div
                    key={file.id}
                    className="group flex max-w-[180px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1.5"
                >
                    {file.previewUrl ? (
                        <img src={file.previewUrl} alt={file.name} className="h-7 w-7 rounded-md object-cover" />
                    ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800">
                            <i className={cn("fa text-xs text-zinc-300", getFileIcon(file.name, file.type))}></i>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-zinc-200">{file.name}</div>
                        <div className="text-[10px] text-zinc-500">{formatFileSize(file.size)}</div>
                    </div>
                    <button
                        onClick={() => model.removeFile(file.id)}
                        className="cursor-pointer text-zinc-500 hover:text-red-300"
                    >
                        <i className="fa fa-times text-xs"></i>
                    </button>
                </div>
            ))}
        </div>
    );
});
FileChips.displayName = "FileChips";

const ModernSendBox = memo(
    ({ model, status, onSubmit }: { model: WaveAIModel; status: string; onSubmit: (e: React.FormEvent) => void }) => {
        const [input, setInput] = useAtom(model.inputAtom);
        const widgetContext = useAtomValue(model.widgetAccessAtom);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const textRef = useRef<HTMLTextAreaElement>(null);

        const addFiles = async (files: File[]) => {
            for (const file of files.filter(isAcceptableFile)) {
                const sizeError = validateFileSize(file);
                if (sizeError) {
                    model.setError(formatFileSizeError(sizeError));
                    return;
                }
                await model.addFile(file);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            const isComposing = e.nativeEvent?.isComposing || e.keyCode === 229;
            if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                e.preventDefault();
                onSubmit(e as any);
            }
        };

        useEffect(() => {
            const el = textRef.current;
            if (!el) return;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
        }, [input]);

        return (
            <div className="border-t border-zinc-800 bg-zinc-950/80 p-3">
                <FileChips model={model} />
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.go,.py,.java,.c,.cpp,.h,.hpp,.html,.css,.scss,.sass,.json,.xml,.yaml,.yml,.sh,.bat,.sql"
                    onChange={(e) => fireAndForget(async () => addFiles(Array.from(e.target.files || [])))}
                />
                <form onSubmit={onSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-2xl">
                    <textarea
                        ref={textRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => model.requestWaveAIFocus()}
                        placeholder="Send a message, upload files, or ask KronosCode to control widgets..."
                        rows={2}
                        className="max-h-[180px] min-h-[58px] w-full resize-none bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                    />
                    <div className="flex items-center gap-2 px-2 pb-1">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                            <i className="fa fa-paperclip mr-1" /> Files
                        </button>
                        <button
                            type="button"
                            onClick={() => model.setWidgetAccess(!widgetContext)}
                            className={cn(
                                "cursor-pointer rounded-full border px-3 py-1 text-xs",
                                widgetContext
                                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                                    : "border-zinc-700 text-zinc-400"
                            )}
                        >
                            Widget context {widgetContext ? "on" : "off"}
                        </button>
                        <button
                            type="button"
                            onClick={() => model.clearChat()}
                            className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                        >
                            New chat
                        </button>
                        <div className="ml-auto" />
                        {status === "streaming" || status === "submitted" ? (
                            <button
                                type="button"
                                onClick={() => model.stopResponse()}
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                            >
                                <i className="fa fa-square text-xs" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={status !== "ready" || !input.trim()}
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-accent text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <i className="fa fa-arrow-up text-sm" />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        );
    }
);
ModernSendBox.displayName = "ModernSendBox";

export const KronosChatHub = memo(
    ({ model, messages, status, initialLoadDone, allowAccess, onSubmit, onContextMenu }: KronosChatHubProps) => {
        const currentMode = useAtomValue(model.currentAIMode);
        const [selectedAgent, setSelectedAgent] = useAtom(model.selectedKronosAgentAtom);
        const [selectedProvider, setSelectedProvider] = useAtom(model.selectedKronosProviderAtom);
        const [selectedModel, setSelectedModel] = useAtom(model.selectedKronosModelAtom);
        const [selectedMode, setSelectedMode] = useAtom(model.selectedKronosModeAtom);
        const [snapshot, setSnapshot] = useState<KronosChatHubSnapshot | null>(null);
        const [loading, setLoading] = useState(false);
        const [settingsOpen, setSettingsOpen] = useState(false);
        const [refreshNonce, setRefreshNonce] = useState(0);

        const loadCatalog = useCallback(async () => {
            const endpoint = getWebServerEndpoint();
            if (!endpoint) return;
            setLoading(true);
            try {
                setSnapshot(
                    await fetchJson<KronosChatHubSnapshot>(
                        `${endpoint}/api/kronoscode/catalog?mode=${encodeURIComponent(currentMode)}`
                    )
                );
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                setSnapshot(await makeDirectFallbackSnapshot(currentMode, `KronTerm BFF unavailable: ${reason}`));
            } finally {
                setLoading(false);
            }
        }, [currentMode]);

        useEffect(() => {
            void loadCatalog();
        }, [loadCatalog, refreshNonce]);

        const agents = snapshot?.catalog?.agents?.length ? snapshot.catalog.agents : fallbackAgents;
        const rawSelectedAgentInfo = agents.find((agent) => agent.id === selectedAgent);
        const defaultAgentInfo =
            agents.find((agent) => agent.id === "kronoscode") ?? agents.find((agent) => agent.available) ?? agents[0];
        const selectedAgentInfo =
            rawSelectedAgentInfo?.available || rawSelectedAgentInfo?.id === "kronoscode"
                ? rawSelectedAgentInfo
                : defaultAgentInfo;
        const providers = snapshot?.kronos?.providers ?? [];
        const effectiveProvider = selectedProvider || snapshot?.kronos?.selectedProviderId || providers[0]?.id || "";
        const provider = providers.find((item) => item.id === effectiveProvider) ?? providers[0];
        const models = provider?.models ?? [];
        const effectiveModel =
            selectedModel || snapshot?.kronos?.selectedModelId || provider?.defaultModelId || models[0]?.id || "";
        const toolCount = snapshot?.kronos?.selectedTools?.length ?? snapshot?.kronos?.toolCapabilities?.length ?? 0;

        useEffect(() => {
            if (!selectedProvider && effectiveProvider) setSelectedProvider(effectiveProvider);
            if (!selectedModel && effectiveModel) setSelectedModel(effectiveModel);
            if ((!selectedAgent || !rawSelectedAgentInfo?.available) && defaultAgentInfo?.id) {
                setSelectedAgent(defaultAgentInfo.id);
            }
        }, [
            agents,
            defaultAgentInfo,
            effectiveModel,
            effectiveProvider,
            rawSelectedAgentInfo,
            selectedAgent,
            selectedModel,
            selectedProvider,
            setSelectedAgent,
            setSelectedModel,
            setSelectedProvider,
        ]);

        if (!allowAccess) return null;

        return (
            <div
                className="flex min-h-0 flex-1 overflow-hidden bg-[#090b10] text-zinc-100"
                onContextMenu={onContextMenu}
            >
                <AgentRail
                    agents={agents}
                    selectedAgent={selectedAgentInfo?.id ?? "kronoscode"}
                    onSelect={setSelectedAgent}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-xl text-accent">
                                {selectedAgentInfo?.icon || "⬡"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <div className="truncate text-base font-semibold">
                                        {selectedAgentInfo?.name || "KronosCode"}
                                    </div>
                                    <span
                                        className={cn("h-2 w-2 rounded-full", statusClass(selectedAgentInfo?.status))}
                                    />
                                    <span className="text-xs text-zinc-500">
                                        {statusLabel(selectedAgentInfo?.status)}
                                    </span>
                                </div>
                                <div className="truncate text-xs text-zinc-500">
                                    {snapshot?.kronos?.connected
                                        ? "KronosCode connected"
                                        : loading
                                          ? "Checking KronosCode"
                                          : "KronosCode offline"}{" "}
                                    · {toolCount} tools · Kron Computer Use {snapshot?.krontermDesktop.mcpStatus || "unknown"}
                                </div>
                            </div>
                            <select
                                value={effectiveProvider}
                                onChange={(e) => {
                                    setSelectedProvider(e.target.value);
                                    const nextProvider = providers.find((item) => item.id === e.target.value);
                                    setSelectedModel(
                                        nextProvider?.defaultModelId || nextProvider?.models?.[0]?.id || ""
                                    );
                                }}
                                className="max-w-[150px] cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none"
                            >
                                {providers.length === 0 ? <option value="">Provider</option> : null}
                                {providers.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name || item.id}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={effectiveModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="max-w-[170px] cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none"
                            >
                                {models.length === 0 ? <option value="">Model</option> : null}
                                {models.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name || item.id}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedMode}
                                onChange={(e) => setSelectedMode(e.target.value)}
                                className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none"
                            >
                                <option value="default">Default</option>
                                <option value="plan">Plan</option>
                                <option value="build">Build</option>
                                <option value="computer-use">Computer Use</option>
                            </select>
                            <button
                                onClick={() => window.open(snapshot?.krontermDesktop.desktopUrl || krontermDesktopDesktopUrl, "_blank")}
                                className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                                Open Desktop
                            </button>
                            <button
                                onClick={() => setSettingsOpen(!settingsOpen)}
                                className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                                Settings
                            </button>
                        </div>
                    </div>

                    <AgentSetupCard
                        agent={selectedAgentInfo}
                        mode={currentMode}
                        onInstalled={() => setRefreshNonce((value) => value + 1)}
                    />

                    {settingsOpen ? (
                        <div className="grid max-h-[260px] grid-cols-2 gap-3 overflow-y-auto border-b border-zinc-800 bg-zinc-950/70 p-4 text-xs xl:grid-cols-3">
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                <div className="mb-2 font-semibold text-zinc-200">Agents</div>
                                <div className="space-y-1 text-zinc-400">
                                    {agents.map((agent) => (
                                        <div key={agent.id}>
                                            {agent.icon} {agent.name} — {statusLabel(agent.status)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                <div className="mb-2 font-semibold text-zinc-200">MCP</div>
                                <div>Kronterm Desktop: {snapshot?.krontermDesktop.mcpStatus}</div>
                                <div className="truncate font-mono text-zinc-500">{snapshot?.krontermDesktop.mcpUrl}</div>
                                <div>Desktop: {snapshot?.krontermDesktop.desktopStatus}</div>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                <div className="mb-2 font-semibold text-zinc-200">Skills</div>
                                <div>{selectedAgentInfo?.skillsDirs?.join(", ") || ".kronoscode/skills"}</div>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 xl:col-span-3">
                                <div className="mb-2 flex items-center justify-between font-semibold text-zinc-200">
                                    Advanced JSON
                                    <button
                                        onClick={() => setRefreshNonce((value) => value + 1)}
                                        className="cursor-pointer text-accent"
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <pre className="max-h-[120px] overflow-auto rounded-xl bg-black/40 p-2 text-[10px] text-zinc-500">
                                    {JSON.stringify(
                                        snapshot?.errors?.length ? snapshot.errors : (snapshot?.kronos?.errors ?? []),
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        </div>
                    ) : null}

                    <div className="min-h-0 flex-1">
                        {messages.length === 0 && initialLoadDone ? (
                            <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-8 text-center">
                                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-accent/15 text-4xl text-accent">
                                    ⬡
                                </div>
                                <div className="text-2xl font-bold">KronosCode Cowork</div>
                                <div className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
                                    Multi-agent local coding, widget control, Kronterm Desktop automation, MCP tools, and
                                    KronTerm context in one chat surface.
                                </div>
                                <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-zinc-400">
                                    <span className="rounded-full border border-zinc-800 px-3 py-1">
                                        @file mentions
                                    </span>
                                    <span className="rounded-full border border-zinc-800 px-3 py-1">/commands</span>
                                    <span className="rounded-full border border-zinc-800 px-3 py-1">Kron Computer Use</span>
                                    <span className="rounded-full border border-zinc-800 px-3 py-1">Widget tools</span>
                                </div>
                            </div>
                        ) : (
                            <AIPanelMessages
                                messages={messages}
                                status={status}
                                onContextMenu={onContextMenu}
                                showModeDropdown={false}
                            />
                        )}
                    </div>
                    <ModernSendBox model={model} status={status} onSubmit={onSubmit} />
                </div>
            </div>
        );
    }
);
KronosChatHub.displayName = "KronosChatHub";
