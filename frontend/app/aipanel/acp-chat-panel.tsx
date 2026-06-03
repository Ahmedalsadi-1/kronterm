import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AcpAgentMark } from "./acp-agent-mark";
import {
    AgentPicker,
    ComposerAutocomplete,
    ModelPicker,
    SessionSidebar,
    SettingsPanel,
    WorkspaceFilesPanel,
    getComposerSuggestions,
    type AcpComposerMenuMode,
    type AcpComposerSuggestion,
    type AcpMentionTab,
    type AcpModeOption,
} from "./acp-chat-controls";
import { AcpToolApproval } from "./acp-tool-approval";
import { AgentSurfaceUiActivityEvent, type LiveAgentSurfaceActivity } from "./desktop-pet-activity";
import {
    useAcpSession,
    type AcpAgentMessage,
    type AcpAgentProfile,
    type AcpBackendInfo,
    type AcpRuntimeRecord,
} from "./use-acp-session";
import { WaveAIModel } from "./waveai-model";

type AcpChatPanelProps = {
    className?: string;
};

const fallbackAgents: AcpBackendInfo[] = [
    {
        backend: "kronoscode",
        name: "KronosCode",
        cliPath: "kronoscode",
        available: false,
        avatar: "K",
        description: "KronosCode ACP agent",
        acpArgs: ["acp"],
        skillsDirs: [".kronoscode/skills"],
    },
    { backend: "opencode", name: "OpenCode", cliPath: "opencode", available: false, avatar: "O", acpArgs: ["acp"] },
    { backend: "codex", name: "Codex", cliPath: "npx @zed-industries/codex-acp@0.9.5", available: false, avatar: "C" },
    {
        backend: "gemini",
        name: "Gemini",
        cliPath: "gemini",
        available: false,
        avatar: "G",
        acpArgs: ["--experimental-acp"],
    },
    {
        backend: "claude",
        name: "Claude",
        cliPath: "claude",
        available: false,
        avatar: "A",
        acpArgs: ["--experimental-acp"],
    },
];

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEventText(message: AcpAgentMessage): string {
    const data = message.data as any;
    if (typeof data === "string") return data;
    return data?.text ?? data?.content?.text ?? "";
}

const ToolCallCard = memo(({ message }: { message: AcpAgentMessage }) => {
    const data = message.data as any;
    const content = Array.isArray(data?.content) ? data.content : [];
    const state = data?.status ?? "pending";

    return (
        <div className="relative ml-3 border-l border-[#292827] py-2 pl-5 text-xs">
            <div className="absolute -left-[7px] top-4 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#101010]">
                <i className="fa fa-wrench text-[9px] text-[#87847f]" />
            </div>
            <div className="flex items-center gap-2 text-[#87847f]">
                <span className="min-w-0 flex-1 truncate font-medium text-[#d8d4ce]">
                    {data?.title ?? data?.kind ?? "Tool call"}
                </span>
                <span
                    className={cn(
                        "h-2 w-2 rounded-full",
                        state === "completed" ? "bg-[#9fa952]" : state === "failed" ? "bg-[#dc6554]" : "bg-[#b39355]"
                    )}
                />
                <span>{state}</span>
            </div>
            {data?.rawInput ? (
                <pre className="mt-2 max-h-28 overflow-auto rounded-md border border-[#292827] bg-[#161616] p-2 font-mono text-[10px] text-[#98938c]">
                    {JSON.stringify(data.rawInput, null, 2)}
                </pre>
            ) : null}
            {content.length > 0 ? (
                <div className="mt-2 space-y-2">
                    {content.map((item: any, index: number) => {
                        const text = item?.type === "diff" ? (item.newText ?? item.oldText) : item?.content?.text;
                        if (!text) return null;
                        return (
                            <pre
                                key={index}
                                className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[#292827] bg-[#161616] p-2 font-mono text-[10px] text-[#b8b3ac]"
                            >
                                {text}
                            </pre>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
});
ToolCallCard.displayName = "ToolCallCard";

const MessageStream = memo(
    ({ messages, assistantLabel, mode }: { messages: AcpAgentMessage[]; assistantLabel: string; mode: string }) => {
        const visibleMessages = useMemo(() => {
            const visible = messages.filter(
                (message) =>
                    !["status", "session_id", "config_option", "usage", "agent_info", "finish"].includes(message.type)
            );
            return visible.reduce<AcpAgentMessage[]>((combined, message) => {
                const prior = combined[combined.length - 1];
                const streamsText = message.type === "agent_message_chunk" || message.type === "agent_thought_chunk";
                if (prior?.type === message.type && streamsText) {
                    const text = `${getEventText(prior)}${getEventText(message)}`;
                    combined[combined.length - 1] = { ...prior, data: { text } };
                    return combined;
                }
                combined.push(message);
                return combined;
            }, []);
        }, [messages]);

        if (visibleMessages.length === 0) {
            return null;
        }

        return (
            <div className="mx-auto w-full max-w-3xl space-y-5">
                {visibleMessages.map((message) => {
                    if (message.type === "tool_call" || message.type === "tool_call_update") {
                        return <ToolCallCard key={message.msgId} message={message} />;
                    }
                    const isUser = message.type === "user_message";
                    const isThought = message.type === "agent_thought_chunk";
                    const text = getEventText(message);
                    if (!text) return null;
                    if (isThought) {
                        return (
                            <div
                                key={message.msgId}
                                className="ml-3 border-l border-[#292827] py-1 pl-5 text-sm text-[#7f7b75]"
                            >
                                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[#908d87]">
                                    <i className="fa fa-layer-group" />
                                    Activity
                                </div>
                                <div className="whitespace-pre-wrap italic">{text}</div>
                            </div>
                        );
                    }
                    return (
                        <div key={message.msgId} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                            {isUser ? (
                                <div className="max-w-[92%] rounded-xl border border-[#362b20] bg-[#231d19] px-4 py-3 text-sm leading-relaxed text-[#ddd7d0]">
                                    <div className="whitespace-pre-wrap">{text}</div>
                                </div>
                            ) : (
                                <div className="w-full text-sm leading-relaxed text-[#dedad4]">
                                    <div className="mb-3 flex items-center gap-2 font-semibold">
                                        <i className="fa fa-cube text-[#b9b5ae]" />
                                        <span>{assistantLabel}</span>
                                        <span className="rounded-md border border-[#3c3b22] bg-[#232419] px-2 py-0.5 text-xs font-medium lowercase text-[#b1b955]">
                                            {mode}
                                        </span>
                                    </div>
                                    <div className="whitespace-pre-wrap text-[#d4d0c9]">{text}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }
);
MessageStream.displayName = "MessageStream";

const AgentStatus = memo(({ agent, status }: { agent: AcpBackendInfo | null; status: string }) => {
    return (
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#b8b3ac]">
            <span className="truncate">{agent?.name ?? "ACP Agent"}</span>
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "running" ? "bg-[#b1b955]" : status === "error" ? "bg-[#dc7668]" : "bg-[#6d6963]"
                )}
            />
        </div>
    );
});
AgentStatus.displayName = "AgentStatus";

const LiveSurfaceStrip = memo(({ activity }: { activity: LiveAgentSurfaceActivity | null }) => {
    if (activity == null) {
        return null;
    }
    const isActive = activity.phase === "queued" || activity.phase === "running" || activity.phase === "verifying";
    const needsApproval = activity.phase === "awaiting-approval";
    const hasFailed = activity.phase === "failed" || activity.phase === "degraded";
    const surfaceIcon: Record<LiveAgentSurfaceActivity["surface"], string> = {
        browser: "fa-globe",
        sandbox: "fa-cube",
        desktop: "fa-display",
        terminal: "fa-terminal",
        file: "fa-file-lines",
        panel: "fa-layer-group",
    };
    return (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#2d3024] bg-[#161812] px-4 py-2 text-[11px] text-[#a9a69d]">
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isActive && "animate-pulse bg-[#b1b955]",
                    needsApproval && "animate-pulse bg-[#d7a85d]",
                    hasFailed && "bg-[#dc7668]",
                    !isActive && !needsApproval && !hasFailed && "bg-[#696c57]"
                )}
            />
            <i className={cn("fa", surfaceIcon[activity.surface], "text-[#b1b955]")} />
            <span className="font-semibold uppercase tracking-[0.14em] text-[#c5c9a2]">{activity.surface}</span>
            <span className="truncate text-[#938f88]">{activity.detail ?? activity.action}</span>
            <span className="ml-auto rounded-md border border-[#383b28] bg-[#202217] px-1.5 py-0.5 font-medium text-[#b8bd82]">
                {needsApproval ? "review" : activity.phase}
            </span>
        </div>
    );
});
LiveSurfaceStrip.displayName = "LiveSurfaceStrip";

const RuntimeStrip = memo(
    ({
        sessions,
        activeConversationId,
        onSelect,
        onClose,
    }: {
        sessions: AcpRuntimeRecord[];
        activeConversationId: string;
        onSelect: (conversationId: string) => void;
        onClose: (conversationId: string) => void | Promise<void>;
    }) => {
        const openSessions = sessions.filter((session) => session.resumeState !== "archived");
        if (!openSessions.length) {
            return null;
        }
        return (
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[#292827] bg-[#121212] px-3 py-2">
                {openSessions.map((session) => (
                    <div
                        key={session.conversationId}
                        className={cn(
                            "group flex h-10 shrink-0 items-center gap-2 rounded-lg border pl-2 pr-1",
                            session.conversationId === activeConversationId
                                ? "border-[#444527] bg-[#222419]"
                                : "border-[#292827] bg-[#161616]"
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(session.conversationId)}
                            className="flex min-w-0 cursor-pointer items-center gap-2"
                        >
                            <AcpAgentMark backend={session.backend ?? "custom"} className="h-6 w-6" />
                            <span className="max-w-32 truncate text-xs text-[#d4d0c9]">{session.title}</span>
                            <span
                                className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    session.status === "running"
                                        ? "bg-[#b1b955]"
                                        : session.status === "error"
                                          ? "bg-[#dc7668]"
                                          : "bg-[#706b64]"
                                )}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => void onClose(session.conversationId)}
                            className="cursor-pointer rounded p-1 text-[#706b64] hover:bg-[#30201d] hover:text-[#dc7668]"
                            aria-label={`Close ${session.title}`}
                        >
                            <i className="fa fa-xmark text-[10px]" />
                        </button>
                    </div>
                ))}
            </div>
        );
    }
);
RuntimeStrip.displayName = "RuntimeStrip";

type AssistantEmptyStateProps = {
    agent: AcpBackendInfo | null;
    agents: AcpBackendInfo[];
    onSelectAgent: (agent: AcpBackendInfo) => void | Promise<void>;
    onConfigureAgents: () => void;
    onPrompt: (prompt: string) => void;
};

const AssistantEmptyState = memo(
    ({ agent, agents, onSelectAgent, onConfigureAgents, onPrompt }: AssistantEmptyStateProps) => (
        <div className="flex h-full flex-col items-center justify-center px-5 pb-8 text-center">
            <AcpAgentMark backend={agent?.backend ?? "kronoscode"} className="mb-5 h-12 w-12" />
            <h2 className="text-xl font-semibold tracking-tight text-[#ebe7e0]">How can I help?</h2>
            <p className="mt-2 max-w-[310px] text-sm leading-relaxed text-[#827f79]">
                Pick an ACP agent, then start a task in your workspace.
            </p>
            <AgentPicker
                agents={agents}
                selectedAgent={agent}
                onSelect={onSelectAgent}
                onConfigure={onConfigureAgents}
            />
            <div className="mt-7 grid w-full max-w-md grid-cols-1 gap-2 @lg:grid-cols-2">
                {["Explain this codebase", "Fix a failing workflow", "Review these changes", "Implement a feature"].map(
                    (prompt) => (
                        <button
                            type="button"
                            onClick={() => onPrompt(prompt)}
                            key={prompt}
                            className="cursor-pointer rounded-lg border border-[#292827] bg-[#151515] px-3 py-2.5 text-left text-xs text-[#aaa59d] transition-colors hover:bg-[#1e1d1b] hover:text-[#dedad4]"
                        >
                            {prompt}
                        </button>
                    )
                )}
            </div>
        </div>
    )
);
AssistantEmptyState.displayName = "AssistantEmptyState";

export const AcpChatPanel = memo(({ className }: AcpChatPanelProps) => {
    const { electron, getSettingsKeyAtom, rpc, createBlock } = useWaveEnv();
    const {
        state,
        activeRuntime,
        sessions,
        hydrated,
        detectAgents,
        initialize,
        selectSession,
        updateSessionContext,
        sendMessage,
        confirmTool,
        closeSession,
        stop,
        setMode,
        setConfigOption,
        setModel,
        applyProfileToLiveSessions,
    } = useAcpSession();
    const storedProfiles = useAtomValue(getSettingsKeyAtom("acp:profiles")) ?? {};
    const storedAgentDefinitions = useAtomValue(getSettingsKeyAtom("acp:agents")) ?? {};
    const storedCommands = useAtomValue(getSettingsKeyAtom("acp:commands")) ?? {};
    const storedSkills = useAtomValue(getSettingsKeyAtom("acp:skills")) ?? {};
    const storedGitIdentities = useAtomValue(getSettingsKeyAtom("acp:gitidentities")) ?? {};
    const defaultBackend = useAtomValue(getSettingsKeyAtom("acp:defaultbackend")) ?? "kronoscode";
    const mcpEnabled = useAtomValue(getSettingsKeyAtom("mcp:enabled")) ?? false;
    const mcpServers = useAtomValue(getSettingsKeyAtom("mcp:servers")) ?? {};
    const [profileOverrides, setProfileOverrides] = useState<Record<string, AcpAgentProfile>>({});
    const [agentDefinitions, setAgentDefinitions] = useState<Record<string, ACPAgentDefinition> | null>(null);
    const [commands, setCommands] = useState<Record<string, ACPCommandDefinition> | null>(null);
    const [skills, setSkills] = useState<Record<string, ACPSkillDefinition> | null>(null);
    const [gitIdentities, setGitIdentities] = useState<Record<string, ACPGitIdentity> | null>(null);
    const profiles = useMemo(() => {
        const persisted = storedProfiles as Record<string, AcpAgentProfile>;
        const merged: Record<string, AcpAgentProfile> = { ...persisted };
        Object.entries(profileOverrides).forEach(([backend, profile]) => {
            merged[backend] = { ...(persisted[backend] ?? {}), ...profile };
        });
        return merged;
    }, [profileOverrides, storedProfiles]);
    const configuredAgentDefinitions = agentDefinitions ?? storedAgentDefinitions;
    const configuredCommands = commands ?? storedCommands;
    const configuredSkills = skills ?? storedSkills;
    const configuredGitIdentities = gitIdentities ?? storedGitIdentities;
    const [agents, setAgents] = useState<AcpBackendInfo[]>(fallbackAgents);
    const [selectedAgent, setSelectedAgent] = useState<AcpBackendInfo | null>(fallbackAgents[0]);
    const [agentsLoaded, setAgentsLoaded] = useState(false);
    const [input, setInput] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsBackend, setSettingsBackend] = useState<string | null>(null);
    const [resourcesOpen, setResourcesOpen] = useState(false);
    const [sessionSidebarOpen, setSessionSidebarOpen] = useState(true);
    const [restartRequiredBackends, setRestartRequiredBackends] = useState<Set<string>>(new Set());
    const [workspaceDraft, setWorkspaceDraft] = useState("");
    const [liveSurfaceActivity, setLiveSurfaceActivity] = useState<LiveAgentSurfaceActivity | null>(null);
    const [composerMenu, setComposerMenu] = useState<{
        mode: AcpComposerMenuMode;
        query: string;
        mentionTab: AcpMentionTab;
    } | null>(null);
    const [composerSuggestionIndex, setComposerSuggestionIndex] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const didCreateInitialRuntime = useRef(false);
    const activeWorkspace = activeRuntime?.workspace ?? "";
    const referencedFiles = activeRuntime?.referencedFiles ?? [];
    const composerSuggestions = useMemo(
        () =>
            composerMenu
                ? getComposerSuggestions(
                      composerMenu.mode,
                      composerMenu.query,
                      configuredCommands,
                      configuredSkills,
                      agents,
                      referencedFiles,
                      composerMenu.mentionTab
                  )
                : [],
        [agents, composerMenu, configuredCommands, configuredSkills, referencedFiles]
    );

    useEffect(() => {
        setComposerSuggestionIndex(0);
    }, [composerMenu?.mode, composerMenu?.query, composerMenu?.mentionTab]);

    useEffect(() => {
        const handleActivity = (event: Event) => {
            setLiveSurfaceActivity((event as CustomEvent<LiveAgentSurfaceActivity>).detail);
        };
        window.addEventListener(AgentSurfaceUiActivityEvent, handleActivity);
        return () => window.removeEventListener(AgentSurfaceUiActivityEvent, handleActivity);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const detected = await detectAgents();
                if (cancelled) return;
                const nextAgents = detected.length ? detected : fallbackAgents;
                setAgents(nextAgents);
                const preferred =
                    nextAgents.find((agent) => agent.backend === defaultBackend && agent.available) ??
                    nextAgents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
                    nextAgents.find((agent) => agent.available) ??
                    nextAgents[0] ??
                    null;
                setSelectedAgent(preferred);
                setAgentsLoaded(true);
            } catch (err) {
                console.error("ACP detect failed:", err);
                setAgents(fallbackAgents);
                setSelectedAgent(fallbackAgents[0]);
                setAgentsLoaded(true);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [defaultBackend, detectAgents]);

    useEffect(() => {
        if (state.backend) {
            const runtimeAgent = agents.find((agent) => agent.backend === state.backend);
            if (runtimeAgent) {
                setSelectedAgent(runtimeAgent);
            }
        }
    }, [agents, state.backend]);

    useEffect(() => {
        setWorkspaceDraft(activeWorkspace);
    }, [activeWorkspace, state.conversationId]);

    useEffect(() => {
        if (!hydrated || !agentsLoaded || activeRuntime || didCreateInitialRuntime.current) {
            return;
        }
        const preferred =
            agents.find((agent) => agent.backend === defaultBackend && agent.available) ??
            agents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
            agents.find((agent) => agent.available);
        if (!preferred) {
            return;
        }
        didCreateInitialRuntime.current = true;
        setSelectedAgent(preferred);
        void initialize({
            backend: preferred.backend,
            agentName: preferred.name,
            cliPath: preferred.cliPath,
            profile: profiles[preferred.backend],
        }).catch((err) => console.error("ACP initialize failed:", err));
    }, [activeRuntime, agents, agentsLoaded, defaultBackend, hydrated, initialize, profiles]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
    }, [state.messages.length, state.pendingConfirmations.length]);

    const modeOptions = useMemo<AcpModeOption[]>(() => {
        const dynamic = state.modes?.availableModes?.map((mode) => ({ value: mode.id, label: mode.name ?? mode.id }));
        return dynamic?.length
            ? dynamic
            : [
                  { value: "default", label: "Auto" },
                  { value: "plan", label: "Plan" },
                  { value: "build", label: "Build" },
              ];
    }, [state.modes]);
    const selectedMode = modeOptions.some((mode) => mode.value === state.currentMode)
        ? state.currentMode
        : modeOptions[0]?.value || "default";
    const hasMessages = state.messages.some(
        (message) => !["status", "session_id", "config_option", "usage", "agent_info", "finish"].includes(message.type)
    );
    const pickerAgents = agents;
    const settingsAgent =
        agents.find((agent) => agent.backend === settingsBackend) ??
        selectedAgent ??
        agents.find((agent) => agent.backend === defaultBackend) ??
        null;

    const updateProfile = (backend: string, patch: Partial<AcpAgentProfile>) => {
        setProfileOverrides((current) => ({
            ...current,
            [backend]: { ...(current[backend] ?? profiles[backend] ?? {}), ...patch },
        }));
        const nextProfiles = {
            ...profiles,
            [backend]: { ...(profiles[backend] ?? {}), ...patch },
        };
        void rpc.SetConfigCommand(TabRpcClient, { "acp:profiles": nextProfiles });
        if (patch.workspace != null || patch.executable != null || patch.mcpserverids != null) {
            setRestartRequiredBackends((current) => new Set([...current, backend]));
        }
    };

    const saveAgentDefinition = (id: string, definition: ACPAgentDefinition) => {
        const next = { ...configuredAgentDefinitions, [id]: definition };
        setAgentDefinitions(next);
        void rpc.SetConfigCommand(TabRpcClient, { "acp:agents": next });
    };

    const saveCommand = (id: string, command: ACPCommandDefinition) => {
        const next = { ...configuredCommands, [id]: command };
        setCommands(next);
        void rpc.SetConfigCommand(TabRpcClient, { "acp:commands": next });
    };

    const saveSkill = (id: string, skill: ACPSkillDefinition) => {
        const next = { ...configuredSkills, [id]: skill };
        setSkills(next);
        void rpc.SetConfigCommand(TabRpcClient, { "acp:skills": next });
    };

    const saveGitIdentity = (id: string, identity: ACPGitIdentity) => {
        const next = { ...configuredGitIdentities, [id]: identity };
        setGitIdentities(next);
        void rpc.SetConfigCommand(TabRpcClient, { "acp:gitidentities": next });
    };

    const getLiveBackendConversationId = (backend: string) => {
        return sessions.find((session) => session.backend === backend && session.isLive)?.conversationId;
    };

    const setProfileMode = async (backend: string, mode: string) => {
        updateProfile(backend, { mode });
        const conversationId = getLiveBackendConversationId(backend);
        if (conversationId) {
            await setMode(mode, conversationId);
        }
    };

    const setProfileModel = async (backend: string, modelId: string) => {
        updateProfile(backend, { model: modelId });
        const conversationId = getLiveBackendConversationId(backend);
        if (conversationId) {
            await setModel(modelId, conversationId);
        }
    };

    const setProfileConfigOption = async (backend: string, id: string, value: string) => {
        updateProfile(backend, {
            configoptions: { ...(profiles[backend]?.configoptions ?? {}), [id]: value },
        });
        const conversationId = getLiveBackendConversationId(backend);
        if (conversationId) {
            await setConfigOption(id, value, conversationId);
        }
    };

    const startRuntime = async (
        agent: AcpBackendInfo,
        opts?: {
            workspace?: string;
            messages?: AcpAgentMessage[];
            title?: string;
            referencedFiles?: string[];
            resumeSessionId?: string;
        }
    ) => {
        const profile = profiles[agent.backend];
        const runtimeMcpServers = mcpEnabled
            ? (profile?.mcpserverids ?? []).flatMap((serverId) => {
                  const server = (mcpServers as Record<string, MCPConfig>)[serverId];
                  if (!server?.command?.length) {
                      return [];
                  }
                  return [
                      {
                          name: serverId,
                          command: server.command[0],
                          args: server.command.slice(1),
                          env: Object.entries(server.env ?? {}).map(([name, value]) => ({ name, value })),
                      },
                  ];
              })
            : [];
        return initialize({
            backend: agent.backend,
            agentName: agent.name,
            cliPath: profile?.executable || agent.cliPath,
            workspace: opts?.workspace,
            messages: opts?.messages,
            title: opts?.title,
            referencedFiles: opts?.referencedFiles,
            resumeSessionId: opts?.resumeSessionId,
            profile,
            mcpServers: runtimeMcpServers,
        });
    };

    const handleAgentSelect = async (agent: AcpBackendInfo) => {
        setSelectedAgent(agent);
        if (!agent.available) return;
        await startRuntime(agent, {
            workspace: activeWorkspace || undefined,
            referencedFiles,
        }).catch((err) => console.error("ACP initialize failed:", err));
    };

    const handleConfigureAgent = (agent: AcpBackendInfo) => {
        setSettingsBackend(agent.backend);
    };

    const applyBackendProfile = async (backend: string) => {
        await applyProfileToLiveSessions(backend, profiles[backend] ?? {});
    };

    const handleSetMcpEnabled = (enabled: boolean) => {
        void rpc.SetConfigCommand(TabRpcClient, { "mcp:enabled": enabled });
        const affectedBackends = sessions
            .filter((session) => session.isLive && (profiles[session.backend]?.mcpserverids?.length ?? 0) > 0)
            .map((session) => session.backend);
        if (!affectedBackends.length) {
            return;
        }
        setRestartRequiredBackends((current) => new Set([...current, ...affectedBackends]));
    };

    const restartBackendSessions = async (backend: string) => {
        const agent = agents.find((candidate) => candidate.backend === backend);
        if (!agent?.available) {
            return;
        }
        const targets = sessions.filter((session) => session.backend === backend && session.isLive);
        for (const runtime of targets) {
            await closeSession(runtime.conversationId);
            await startRuntime(agent, {
                workspace: profiles[backend]?.workspace || runtime.workspace || undefined,
                messages: runtime.messages,
                referencedFiles: runtime.referencedFiles,
                title: runtime.title,
                resumeSessionId: runtime.capabilities?.loadSession ? (runtime.sessionId ?? undefined) : undefined,
            });
        }
        setRestartRequiredBackends((current) => {
            const next = new Set(current);
            next.delete(backend);
            return next;
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!input.trim() || state.status === "running" || !selectedAgent?.available) return;
        const enteredText = input.trim();
        const commandMatch = enteredText.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
        const command = commandMatch
            ? Object.values(configuredCommands).find(
                  (definition) => (definition.name || "").toLowerCase() === commandMatch[1].toLowerCase()
              )
            : undefined;
        const text = command?.template
            ? command.template.replace("$ARGUMENTS", commandMatch?.[2] ?? "").trim()
            : enteredText;
        const appliedSkills = Object.values(configuredSkills).filter((skill) => {
            const name = skill.name?.trim();
            return Boolean(name && new RegExp(`(?:^|\\s)/${escapeRegExp(name)}(?=\\s|$)`, "i").test(text));
        });
        const skillInstructions = appliedSkills
            .filter((skill) => skill.instructions?.trim())
            .map((skill) => `${skill.name}:\n${skill.instructions?.trim()}`)
            .join("\n\n");
        const agentInstructions = configuredAgentDefinitions[selectedAgent.backend]?.systemprompt?.trim();
        const instructionSections = [
            agentInstructions ? `Agent instructions:\n${agentInstructions}` : "",
            skillInstructions ? `Loaded skills:\n${skillInstructions}` : "",
        ].filter(Boolean);
        const configuredPrompt = instructionSections.length
            ? `${instructionSections.join("\n\n")}\n\nTask:\n${text}`
            : text;
        const prompt = referencedFiles.length
            ? `${configuredPrompt}\n\nReferenced files:\n${referencedFiles.map((filePath) => `- ${filePath}`).join("\n")}`
            : configuredPrompt;
        setInput("");
        setComposerMenu(null);
        let targetConversationId = activeRuntime?.conversationId;
        if (!activeRuntime?.isLive) {
            const result = await startRuntime(selectedAgent, {
                workspace: activeWorkspace || undefined,
                messages: state.messages,
                referencedFiles,
                title: state.conversationId ? `${activeRuntime?.title ?? "Saved chat"} continued` : undefined,
                resumeSessionId:
                    activeRuntime?.resumeState === "resumable" ? (activeRuntime.sessionId ?? undefined) : undefined,
            });
            if (!result.success) {
                return;
            }
            targetConversationId = result.conversationId;
        }
        await sendMessage(prompt, targetConversationId).catch((err) => console.error("ACP send failed:", err));
    };

    const handleNewChat = async (workspace?: string) => {
        const defaultAgent =
            agents.find((agent) => agent.backend === defaultBackend && agent.available) ??
            agents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
            agents.find((agent) => agent.available);
        if (!defaultAgent) return;
        setSelectedAgent(defaultAgent);
        setInput("");
        await startRuntime(defaultAgent, {
            workspace: workspace ?? profiles[defaultAgent.backend]?.workspace,
        }).catch((err) => console.error("ACP initialize failed:", err));
    };

    const handlePickWorkspace = async () => {
        const workspace = await electron.selectDirectory();
        if (workspace) {
            setWorkspaceDraft(workspace);
        }
    };

    const handleApplyWorkspace = async () => {
        const workspace = workspaceDraft.trim();
        if (!selectedAgent?.available) return;
        await startRuntime(selectedAgent, { workspace: workspace || undefined, referencedFiles }).catch((err) =>
            console.error("ACP initialize failed:", err)
        );
    };

    const handleUseFocusedWorkspace = async () => {
        setWorkspaceDraft("");
        if (!selectedAgent?.available) return;
        await startRuntime(selectedAgent, { referencedFiles }).catch((err) =>
            console.error("ACP initialize failed:", err)
        );
    };

    const handlePickFiles = async () => {
        const files = await electron.selectFiles();
        updateSessionContext(activeWorkspace, Array.from(new Set([...referencedFiles, ...files])));
    };

    const handleOpenGitTree = async () => {
        await createBlock({
            meta: {
                view: "preview",
                file: activeWorkspace || workspaceDraft.trim() || ".",
            },
        });
    };

    const handleApplyGitIdentity = async (identity: ACPGitIdentity) => {
        if (!activeWorkspace || !identity.username || !identity.useremail) {
            return;
        }
        const result = await electron.acpApplyGitIdentity({
            workspace: activeWorkspace,
            userName: identity.username,
            userEmail: identity.useremail,
        });
        if (!result.success) {
            console.error("Unable to apply Git identity:", result.error);
        }
    };

    useEffect(() => {
        let model: WaveAIModel;
        try {
            model = WaveAIModel.getInstance();
        } catch {
            return;
        }
        const bridge = {
            focusInput: () => textareaRef.current?.focus(),
            appendText: (text: string, newLine?: boolean) => {
                setInput((current) => {
                    const separator = current && newLine ? "\n" : current && !current.endsWith(" ") ? " " : "";
                    return `${current}${separator}${text}`;
                });
            },
            clearChat: () => {
                void handleNewChat();
            },
            sendMessage: async (text: string) => {
                if (state.status === "running" || !selectedAgent?.available) return;
                await sendMessage(text);
            },
        };
        model.registerAcpPanelBridge(bridge);
        return () => model.unregisterAcpPanelBridge(bridge);
    }, [selectedAgent, sendMessage, state.status]);

    const updateComposerMenu = (value: string, cursorPosition: number) => {
        if (value.startsWith("/")) {
            const firstSeparator = value.search(/[\s\n]/);
            const commandEnd = firstSeparator === -1 ? value.length : firstSeparator;
            if (firstSeparator === -1 && cursorPosition <= commandEnd) {
                setComposerMenu({ mode: "commands", query: value.slice(1), mentionTab: "agents" });
                return;
            }
        }
        const textBeforeCursor = value.slice(0, cursorPosition);
        const slashIndex = textBeforeCursor.lastIndexOf("/");
        if (slashIndex >= 0) {
            const previous = slashIndex > 0 ? textBeforeCursor[slashIndex - 1] : "";
            const query = textBeforeCursor.slice(slashIndex + 1);
            if ((!previous || /\s/.test(previous)) && !/[\s\n]/.test(query)) {
                setComposerMenu({ mode: "skills", query, mentionTab: "agents" });
                return;
            }
        }
        const mentionIndex = textBeforeCursor.lastIndexOf("@");
        if (mentionIndex >= 0) {
            const previous = mentionIndex > 0 ? textBeforeCursor[mentionIndex - 1] : "";
            const query = textBeforeCursor.slice(mentionIndex + 1);
            if ((!previous || /\s/.test(previous)) && !/[\s\n]/.test(query)) {
                setComposerMenu((current) => ({
                    mode: "mentions",
                    query,
                    mentionTab: current?.mode === "mentions" ? current.mentionTab : "agents",
                }));
                return;
            }
        }
        setComposerMenu(null);
    };

    const replaceActiveToken = (replacement: string, trigger: "/" | "@") => {
        const cursorPosition = textareaRef.current?.selectionStart ?? input.length;
        const textBeforeCursor = input.slice(0, cursorPosition);
        const triggerIndex = textBeforeCursor.lastIndexOf(trigger);
        const nextInput =
            triggerIndex >= 0
                ? `${input.slice(0, triggerIndex)}${replacement}${input.slice(cursorPosition)}`
                : `${input}${input ? " " : ""}${replacement}`;
        setInput(nextInput);
        setComposerMenu(null);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextInput.length, nextInput.length);
        });
    };

    const handleComposerSuggestion = (suggestion: AcpComposerSuggestion) => {
        if (suggestion.kind === "command") {
            replaceActiveToken(`/${suggestion.label} `, "/");
            return;
        }
        if (suggestion.kind === "skill") {
            replaceActiveToken(`/${suggestion.label} `, "/");
            return;
        }
        if (suggestion.kind === "agent") {
            replaceActiveToken(`@${suggestion.label} `, "@");
            return;
        }
        replaceActiveToken(`@${suggestion.label} `, "@");
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (composerMenu) {
            if (event.key === "Escape") {
                event.preventDefault();
                setComposerMenu(null);
                return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!composerSuggestions.length) {
                    return;
                }
                const offset = event.key === "ArrowDown" ? 1 : -1;
                setComposerSuggestionIndex(
                    (current) => (current + offset + composerSuggestions.length) % composerSuggestions.length
                );
                return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && composerSuggestions.length) {
                event.preventDefault();
                const suggestion = composerSuggestions[composerSuggestionIndex];
                if (suggestion?.available !== false) {
                    handleComposerSuggestion(suggestion);
                }
                return;
            }
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        }
    };

    return (
        <div
            className={cn(
                "@container relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(177,185,85,0.12),transparent_34%),linear-gradient(180deg,#111315,#0b0c0e)] text-[#e6e2dc]",
                className
            )}
        >
            {!settingsOpen && sessionSidebarOpen ? (
                <SessionSidebar
                    sessions={sessions}
                    activeConversationId={state.conversationId}
                    onSelectSession={selectSession}
                    onCloseSession={closeSession}
                    onNewChat={handleNewChat}
                    onOpenSettings={() => {
                        setResourcesOpen(false);
                        setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                        setSettingsOpen(true);
                    }}
                />
            ) : null}
            <div className="relative flex min-w-0 flex-1 flex-col">
                <div className="flex min-h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#101216]/92 px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSessionSidebarOpen((open) => !open)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-[#9a958e] transition-colors hover:bg-white/[0.08] hover:text-[#f1ede6]"
                            aria-label={sessionSidebarOpen ? "Hide sessions" : "Show sessions"}
                        >
                            <i className="fa fa-columns text-xs" />
                        </button>
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold tracking-tight text-[#f2eee7]">
                                    KronosCode
                                </span>
                                <span className="rounded-md border border-[#3c3b22] bg-[#232419] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1b955]">
                                    {selectedMode}
                                </span>
                            </div>
                            <AgentStatus agent={selectedAgent} status={state.status} />
                        </div>
                    </div>
                    <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-3 @lg:flex">
                        <span className="max-w-36 truncate rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-[#b8b3ac]">
                            {state.modelInfo?.currentModelLabel ?? "Model auto"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-[#8f8982]">
                            {referencedFiles.length} files
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-[#8f8982]">
                            {state.pendingConfirmations.length} approvals
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setSettingsOpen(false);
                                setResourcesOpen((open) => !open);
                            }}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#9a958e] transition-colors hover:bg-white/[0.08] hover:text-[#f1ede6]"
                            title="Workspace and files"
                            aria-label="Workspace and files"
                        >
                            <i className="fa fa-folder-open text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleNewChat()}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#9a958e] transition-colors hover:bg-white/[0.08] hover:text-[#f1ede6]"
                            title="Start new chat"
                            aria-label="Start new chat"
                        >
                            <i className="fa fa-pen-to-square text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setResourcesOpen(false);
                                setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                                setSettingsOpen((open) => !open);
                            }}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#9a958e] transition-colors hover:bg-white/[0.08] hover:text-[#f1ede6]"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <i className="fa fa-sliders text-xs" />
                        </button>
                    </div>
                </div>
                <LiveSurfaceStrip activity={liveSurfaceActivity} />

                {settingsOpen ? (
                    <SettingsPanel
                        agents={agents}
                        selectedAgent={settingsAgent}
                        sessions={sessions}
                        activeConversationId={state.conversationId}
                        profiles={profiles}
                        agentDefinitions={configuredAgentDefinitions}
                        commands={configuredCommands}
                        skills={configuredSkills}
                        gitIdentities={configuredGitIdentities}
                        mcpEnabled={mcpEnabled}
                        mcpServers={mcpServers}
                        onClose={() => setSettingsOpen(false)}
                        onSelectAgent={handleConfigureAgent}
                        onSetMode={setProfileMode}
                        onSetConfigOption={setProfileConfigOption}
                        onSetModel={setProfileModel}
                        onSelectSession={selectSession}
                        onCloseSession={closeSession}
                        onUpdateProfile={updateProfile}
                        onSaveAgentDefinition={saveAgentDefinition}
                        onSaveCommand={saveCommand}
                        onSaveSkill={saveSkill}
                        onSaveGitIdentity={saveGitIdentity}
                        onApplyGitIdentity={handleApplyGitIdentity}
                        onSetMcpEnabled={handleSetMcpEnabled}
                        onOpenNativeConfig={() => {
                            setSettingsOpen(false);
                            try {
                                WaveAIModel.getInstance().openWaveAIConfig();
                            } catch (err) {
                                console.error("Unable to open KronosCode native configuration:", err);
                            }
                        }}
                        onOpenWorkspace={() => {
                            setSettingsOpen(false);
                            setResourcesOpen(true);
                        }}
                        onOpenGitTree={handleOpenGitTree}
                        onApplyProfileToLiveSessions={applyBackendProfile}
                        onRestartBackendSessions={restartBackendSessions}
                        restartRequiredBackends={restartRequiredBackends}
                    />
                ) : null}

                {resourcesOpen ? (
                    <WorkspaceFilesPanel
                        activeWorkspace={activeWorkspace}
                        workspaceDraft={workspaceDraft}
                        files={referencedFiles}
                        onClose={() => setResourcesOpen(false)}
                        onWorkspaceChange={setWorkspaceDraft}
                        onPickWorkspace={handlePickWorkspace}
                        onApplyWorkspace={handleApplyWorkspace}
                        onUseFocusedWorkspace={handleUseFocusedWorkspace}
                        onPickFiles={handlePickFiles}
                        onOpenGitTree={handleOpenGitTree}
                        onRemoveFile={(filePath) =>
                            updateSessionContext(
                                activeWorkspace,
                                referencedFiles.filter((currentPath) => currentPath !== filePath)
                            )
                        }
                    />
                ) : null}

                {state.error ? (
                    <div className="mx-auto mt-3 w-[calc(100%-32px)] max-w-3xl rounded-lg border border-[#522c29] bg-[#211716] px-4 py-2 text-xs text-[#dc7668]">
                        {state.error}
                    </div>
                ) : null}
                {activeRuntime && !activeRuntime.isLive && activeRuntime.resumeState !== "archived" ? (
                    <div className="mx-auto mt-3 flex w-[calc(100%-32px)] max-w-3xl items-center justify-between gap-3 rounded-lg border border-[#3a3829] bg-[#1d1d18] px-4 py-2 text-xs text-[#b8b3ac]">
                        <span>
                            Saved transcript. Sending continues in a{" "}
                            {activeRuntime.resumeState === "resumable" ? "resumed" : "new"} runtime.
                        </span>
                        <button
                            type="button"
                            onClick={() => textareaRef.current?.focus()}
                            className="cursor-pointer font-medium text-[#b1b955]"
                        >
                            Continue
                        </button>
                    </div>
                ) : null}

                <AcpToolApproval confirmations={state.pendingConfirmations} onConfirm={confirmTool} />

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 @lg:px-6">
                    {hasMessages ? (
                        <MessageStream
                            messages={state.messages}
                            assistantLabel={state.modelInfo?.currentModelLabel ?? "Assistant"}
                            mode={selectedMode}
                        />
                    ) : (
                        <AssistantEmptyState
                            agent={selectedAgent}
                            agents={pickerAgents}
                            onSelectAgent={handleAgentSelect}
                            onConfigureAgents={() => {
                                setResourcesOpen(false);
                                setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                                setSettingsOpen(true);
                            }}
                            onPrompt={(prompt) => {
                                setInput(prompt);
                                textareaRef.current?.focus();
                            }}
                        />
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="shrink-0 border-t border-white/10 bg-[#0b0c0e]/95 px-3 pb-3 pt-2 backdrop-blur-xl @lg:px-5 @lg:pb-5">
                    <form
                        onSubmit={handleSubmit}
                        className="relative mx-auto w-full max-w-3xl rounded-2xl border border-[#4a3f2d] bg-[linear-gradient(180deg,#1b1c1b,#141414)] p-3 shadow-2xl shadow-black/35 focus-within:border-[#82724b] focus-within:shadow-[0_0_0_1px_rgba(177,185,85,0.18),0_18px_50px_rgba(0,0,0,0.35)]"
                    >
                        {composerMenu ? (
                            <ComposerAutocomplete
                                mode={composerMenu.mode}
                                mentionTab={composerMenu.mentionTab}
                                suggestions={composerSuggestions}
                                selectedIndex={composerSuggestionIndex}
                                onSelect={handleComposerSuggestion}
                                onSelectedIndexChange={setComposerSuggestionIndex}
                                onMentionTabChange={(mentionTab) =>
                                    setComposerMenu((current) => (current ? { ...current, mentionTab } : current))
                                }
                            />
                        ) : null}
                        {referencedFiles.length ? (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                                {referencedFiles.map((filePath) => (
                                    <span
                                        key={filePath}
                                        className="flex max-w-full items-center gap-1.5 rounded-md border border-[#302f2d] bg-[#23211f] px-2 py-1 text-[11px] text-[#aaa59d]"
                                    >
                                        <i className="fa fa-file text-[#827f79]" />
                                        <span className="max-w-44 truncate">
                                            {filePath.split("/").pop() || filePath}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateSessionContext(
                                                    activeWorkspace,
                                                    referencedFiles.filter((currentPath) => currentPath !== filePath)
                                                )
                                            }
                                            className="cursor-pointer text-[#827f79] hover:text-[#dedad4]"
                                            aria-label={`Remove ${filePath}`}
                                        >
                                            <i className="fa fa-xmark" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => {
                                const value = event.target.value;
                                setInput(value);
                                updateComposerMenu(value, event.target.selectionStart ?? value.length);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                state.status === "running"
                                    ? "Agent is working..."
                                    : selectedAgent?.available
                                      ? "@ for files/agents; / for commands and skills"
                                      : "Select an available agent..."
                            }
                            rows={3}
                            disabled={state.status === "running" || !selectedAgent?.available}
                            data-chat-input="true"
                            className="max-h-44 min-h-20 w-full resize-none bg-transparent px-1 pb-3 pt-1 text-sm leading-relaxed text-[#eee9e1] outline-none placeholder:text-[#77716a] disabled:opacity-50"
                        />
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsOpen(false);
                                    setResourcesOpen(true);
                                }}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#aaa59d] transition-colors hover:bg-white/[0.07] hover:text-[#f1ede6]"
                                title="Attach files from workspace"
                                aria-label="Attach files from workspace"
                            >
                                <i className="fa fa-plus-circle" />
                            </button>
                            <select
                                value={selectedMode}
                                onChange={(event) => setMode(event.target.value)}
                                className="max-w-28 cursor-pointer appearance-none rounded-lg border border-[#343521] bg-[#222419] px-2 py-1.5 text-xs font-medium capitalize text-[#b1b955] outline-none hover:bg-[#292b1d]"
                                aria-label="Mode"
                            >
                                {modeOptions.map((mode) => (
                                    <option key={mode.value} value={mode.value}>
                                        {mode.label}
                                    </option>
                                ))}
                            </select>
                            <ModelPicker modelInfo={state.modelInfo} onSelect={setModel} />
                            <div className="flex-1" />
                            {state.status === "running" ? (
                                <button
                                    type="button"
                                    onClick={() => stop()}
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#522c29] bg-[#211716] text-[#dc7668] hover:bg-[#30201d]"
                                    title="Stop"
                                    aria-label="Stop"
                                >
                                    <i className="fa fa-square text-xs" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim() || !selectedAgent?.available}
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#4d512d] bg-[#252719] text-[#c4cc68] transition-colors hover:bg-[#30331f] disabled:border-transparent disabled:bg-transparent disabled:text-[#57534e]"
                                    title="Send"
                                    aria-label="Send"
                                >
                                    <i className="fa fa-arrow-up" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
});

AcpChatPanel.displayName = "AcpChatPanel";
