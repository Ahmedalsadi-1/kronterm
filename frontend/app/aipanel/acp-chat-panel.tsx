import { WOS, atoms, globalStore } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { AppStreamCreatedEvent } from "@/app/view/appstream/computer-use-stream-manager";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { getWebServerEndpoint } from "@/util/endpoints";
import { cn, makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactDOM from "react-dom";
import {
    subscribeAgentActivityStream,
    type LiveAgentSurfaceActivity,
    type TimedAgentActivityEvent,
} from "../../types/agent-activity";
import { AcpAgentMark } from "./acp-agent-mark";
import {
    CompactSessionRail,
    SessionSidebar,
    SettingsPanel,
    WorkspaceFilesPanel,
    getComposerSuggestions,
    type AcpComposerMenuMode,
    type AcpComposerSuggestion,
    type AcpMentionTab,
    type AcpModeOption,
    type AcpOpenWidgetMention,
} from "./acp-chat-controls";
import { AcpToolApproval } from "./acp-tool-approval";
import {
    ImprovedChatInput,
    type CommandDeckSuggestion,
    type FileWithPreview,
    type KronAgentOption,
    type ModelOption,
    type PastedContent,
} from "./improved-chat-input";
import {
    KronchatOpenProjectEvent,
    formatKronchatProjectName,
    writeKronchatProjects,
    type KronchatProject,
} from "./kronchat-projects";
import { ChatEmptyState, TypingIndicator } from "./kronos-chat-components";
import { ChatMessageListV2 } from "./ChatMessageListV2";
import { useAcpSession, type AcpAgentMessage, type AcpAgentProfile, type AcpBackendInfo } from "./use-acp-session";
import { WaveAIModel } from "./waveai-model";

type AcpChatPanelProps = {
    className?: string;
};

type ChatWaveAppInfo = {
    appid: string;
    manifest?: {
        appmeta?: {
            displayname?: string;
            icon?: string;
            iconcolor?: string;
        };
    };
};

type ChatLaunchableApp =
    | {
          kind: "desktop";
          id: string;
          label: string;
          icon?: string;
          description?: string;
          app: InstalledAppInfo;
      }
    | {
          kind: "wave";
          id: string;
          label: string;
          icon?: string;
          iconColor?: string;
          description?: string;
          app: ChatWaveAppInfo;
      };

type AcpMcpNameValue = {
    name: string;
    value: string;
};

type AcpMcpSessionServer =
    | {
          type?: "stdio";
          name: string;
          command: string;
          args: string[];
          env: AcpMcpNameValue[];
      }
    | {
          type: "http" | "sse";
          name: string;
          url: string;
          headers?: AcpMcpNameValue[];
      };

function toAcpNameValueEntries(source?: Record<string, string>): AcpMcpNameValue[] | undefined {
    if (!source) {
        return undefined;
    }
    const entries = Object.entries(source)
        .filter(([name, value]) => typeof name === "string" && typeof value === "string")
        .map(([name, value]) => ({ name, value }));
    return entries.length ? entries : undefined;
}

function buildAcpMcpSessionServer(serverId: string, server: MCPConfig | undefined): AcpMcpSessionServer | null {
    if (!server || server.enabled === false) {
        return null;
    }
    if (server.type === "http" || server.type === "streamable_http") {
        if (!server.url) {
            return null;
        }
        return {
            type: "http",
            name: serverId,
            url: server.url,
            headers: toAcpNameValueEntries(server.headers),
        };
    }
    if (server.type === "sse") {
        if (!server.url) {
            return null;
        }
        return {
            type: "sse",
            name: serverId,
            url: server.url,
            headers: toAcpNameValueEntries(server.headers),
        };
    }
    if (!server.command?.length) {
        return null;
    }
    return {
        type: "stdio",
        name: serverId,
        command: server.command[0],
        args: server.command.slice(1),
        env: toAcpNameValueEntries(server.env) ?? [],
    };
}

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

const DefaultEnabledAgentBackends = ["kronoscode"];
const EnabledAgentBackendsSettingsKey = "acp:enabledagentbackends" as keyof SettingsType;
const KronosDirectEndpoint = "http://127.0.0.1:4096";
const DefaultKronosCodeAgents: KronAgentOption[] = [
    {
        id: "kronoscode",
        label: "KronosCode",
        description: "Default KronosCode agent",
        icon: "⬡",
        available: true,
        kind: "kronoscode",
    },
];
const DefaultKronosCodeCommands: Record<string, ACPCommandDefinition> = {
    explain: {
        name: "explain",
        scope: "project",
        agent: "kronoscode",
        description: "Map the project and explain how the relevant code works.",
        template:
            "Explain this codebase or the requested area. Focus on structure, data flow, and entry points.\n\n$ARGUMENTS",
    },
    fix: {
        name: "fix",
        scope: "project",
        agent: "kronoscode",
        description: "Diagnose and fix a bug or failing workflow.",
        template: "Diagnose and fix this issue. Make focused changes and validate them where possible.\n\n$ARGUMENTS",
    },
    review: {
        name: "review",
        scope: "project",
        agent: "kronoscode",
        description: "Review code for regressions, risks, and missing tests.",
        template:
            "Review this code or change. Prioritize bugs, regressions, risks, and missing validation.\n\n$ARGUMENTS",
    },
    implement: {
        name: "implement",
        scope: "project",
        agent: "kronoscode",
        description: "Plan and implement a feature in the active workspace.",
        template:
            "Implement this feature in the active workspace. Keep changes scoped and verify the result.\n\n$ARGUMENTS",
    },
    sandbox: {
        name: "sandbox",
        scope: "project",
        agent: "kronoscode",
        description: "Use sandbox, browser, terminal, or computer-use runtime surfaces.",
        template:
            "Use the available sandbox, browser, terminal, or computer-use runtime surfaces for this task. Show relevant runtime activity and hand off takeover when useful.\n\n$ARGUMENTS",
    },
};

const AgentPickerPopup = memo(
    ({
        agents,
        selectedBackend,
        onClose,
        onSelect,
        onConfigure,
    }: {
        agents: AcpBackendInfo[];
        selectedBackend: string | null;
        onClose: () => void;
        onSelect: (agent: AcpBackendInfo) => void | Promise<void>;
        onConfigure: () => void;
    }) => {
        return (
            <>
                <div
                    className="fixed inset-0 z-40 bg-black/40"
                    onClick={onClose}
                    onKeyDown={(e) => e.key === "Escape" && onClose()}
                />
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="flex max-h-[75vh] w-[min(480px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] p-3 shadow-2xl shadow-black/70">
                        <div className="mb-3 flex items-center justify-between gap-3 px-1">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">
                                    CLI agent
                                </div>
                                <div className="mt-1 max-w-[300px] truncate text-xs text-[#d4d4d4]">
                                    {agents.find((a) => a.backend === selectedBackend)?.name ??
                                        "Select an agent runtime"}
                                </div>
                            </div>
                            <div className="shrink-0 rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#8a8580]">
                                {agents.filter((agent) => agent.available).length}/{agents.length} installed
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            {agents.map((agent) => {
                                const active = agent.backend === selectedBackend;
                                return (
                                    <button
                                        key={agent.backend}
                                        type="button"
                                        disabled={!agent.available}
                                        onClick={() => {
                                            void onSelect(agent);
                                            onClose();
                                        }}
                                        className={cn(
                                            "mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors last:mb-0 disabled:opacity-45",
                                            active
                                                ? "bg-[#1e2a3a] text-[#eeeeee]"
                                                : "text-[#c6c1ba] hover:bg-[#1f1f1d] hover:text-[#eeeeee]"
                                        )}
                                    >
                                        <AcpAgentMark backend={agent.backend} className="h-9 w-9" />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                <span className="truncate">{agent.name}</span>
                                                {!agent.available ? (
                                                    <span className="shrink-0 rounded border border-[#3a2b1e] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#d7a85d]">
                                                        not installed
                                                    </span>
                                                ) : null}
                                            </span>
                                            {agent.description ? (
                                                <span className="mt-1 block truncate text-xs text-[#8a8580]">
                                                    {agent.description}
                                                </span>
                                            ) : null}
                                            <span className="mt-1 block truncate font-mono text-[10px] text-[#6b6863]">
                                                {agent.cliPath}
                                            </span>
                                        </span>
                                        {active ? <i className="fa fa-check text-sm text-[#5b9ef5]" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                onConfigure();
                            }}
                            className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs text-[#d4d4d4] transition-colors hover:bg-[#22211f]"
                        >
                            <i className="fa fa-sliders text-[10px]" />
                            Configure agents
                        </button>
                    </div>
                </div>
            </>
        );
    }
);
AgentPickerPopup.displayName = "AgentPickerPopup";

const RuntimeAgentPicker = memo(
    ({
        agents,
        selectedAgent,
        onSelect,
        onConfigure,
    }: {
        agents: AcpBackendInfo[];
        selectedAgent: AcpBackendInfo | null;
        onSelect: (agent: AcpBackendInfo) => void | Promise<void>;
        onConfigure: () => void;
    }) => {
        const [open, setOpen] = useState(false);
        const selected = selectedAgent ?? agents.find((agent) => agent.backend === "kronoscode") ?? agents[0] ?? null;

        return (
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex h-8 max-w-44 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 text-xs font-semibold text-[#eeeeee] transition-colors hover:bg-[#22211f]"
                    aria-label="Agent selector"
                    aria-expanded={open}
                    title="Agent selector"
                >
                    {selected ? <AcpAgentMark backend={selected.backend} className="h-5 w-5" /> : null}
                    <span className="truncate">{selected?.name ?? "Select agent"}</span>
                    <i className="fa fa-chevron-down text-[9px] text-[#8a8580]" />
                </button>
                {open
                    ? ReactDOM.createPortal(
                          <AgentPickerPopup
                              agents={agents}
                              selectedBackend={selected?.backend ?? null}
                              onClose={() => setOpen(false)}
                              onSelect={onSelect}
                              onConfigure={onConfigure}
                          />,
                          document.body
                      )
                    : null}
            </div>
        );
    }
);
RuntimeAgentPicker.displayName = "RuntimeAgentPicker";

type KronosCatalogAgent = {
    id: string;
    name?: string;
    kind?: string;
    status?: string;
    available?: boolean;
    icon?: string;
    description?: string;
    reason?: string;
};

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

function normalizeKronosCatalogAgents(agents: KronosCatalogAgent[]): KronAgentOption[] {
    return agents
        .filter((agent) => agent.id)
        .map((agent) => ({
            id: agent.id,
            label: agent.name || agent.id,
            description: agent.description || agent.reason,
            icon: agent.icon,
            available: agent.available ?? agent.status === "ready",
            status: agent.status,
            kind: agent.kind,
        }))
        .sort((left, right) => {
            if (left.id === "kronoscode") {
                return -1;
            }
            if (right.id === "kronoscode") {
                return 1;
            }
            if (left.available !== right.available) {
                return left.available === false ? 1 : -1;
            }
            return left.label.localeCompare(right.label);
        });
}

function getPreferredKronosCodeAgent(agents: KronAgentOption[]): string {
    return (
        agents.find((agent) => agent.id === "kronoscode" && agent.available !== false)?.id ??
        agents.find((agent) => agent.id === "kronoscode")?.id ??
        agents.find((agent) => agent.available !== false)?.id ??
        agents[0]?.id ??
        DefaultKronosCodeAgents[0].id
    );
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LiveSurfaceStrip = memo(
    ({ activity, onTakeOver }: { activity: LiveAgentSurfaceActivity | null; onTakeOver?: () => void }) => {
        if (activity == null) {
            return null;
        }
        const isActive = activity.phase === "queued" || activity.phase === "running" || activity.phase === "verifying";
        const needsApproval = activity.phase === "awaiting-approval";
        const hasFailed = activity.phase === "failed" || activity.phase === "degraded";
        const isDesktop = activity.surface === "sandbox" || activity.surface === "desktop";
        const surfaceIcon: Record<LiveAgentSurfaceActivity["surface"], string> = {
            browser: "fa-globe",
            sandbox: "fa-cube",
            desktop: "fa-display",
            terminal: "fa-terminal",
            file: "fa-file-lines",
            panel: "fa-layer-group",
        };
        const showPreview = isDesktop && isActive && activity.previewimageurl;
        if (showPreview) {
            return (
                <div className="flex shrink-0 flex-col border-b border-[#2a2a2a] bg-[#111111] px-3 pb-3 pt-2">
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-[#9e9a93]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b9ef5]" />
                        <i className={cn("fa", surfaceIcon[activity.surface], "text-[#5b9ef5]")} />
                        <span className="font-semibold uppercase tracking-[0.14em] text-[#8ab4f5]">
                            {activity.surface}
                        </span>
                        <span className="flex-1 truncate text-[#8a8580]">{activity.detail ?? activity.action}</span>
                        <button
                            type="button"
                            onClick={onTakeOver}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1 text-[11px] text-[#eeeeee] transition-colors hover:bg-[#2a2a2a]"
                        >
                            <i className="fa fa-expand text-[10px]" />
                            Take Over
                        </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#000000]">
                        <img
                            src={activity.previewimageurl}
                            alt={`${activity.surface} preview`}
                            className="w-full"
                            style={{ maxHeight: 200, objectFit: "contain", objectPosition: "top" }}
                        />
                    </div>
                </div>
            );
        }
        return (
            <div className="flex shrink-0 items-center gap-2 border-b border-[#2a2a2a] bg-[#161616] px-4 py-2 text-[11px] text-[#9e9a93]">
                <span
                    className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isActive && "animate-pulse bg-[#5b9ef5]",
                        needsApproval && "animate-pulse bg-[#d7a85d]",
                        hasFailed && "bg-[#dc7668]",
                        !isActive && !needsApproval && !hasFailed && "bg-[#6b6863]"
                    )}
                />
                <i className={cn("fa", surfaceIcon[activity.surface], "text-[#5b9ef5]")} />
                <span className="font-semibold uppercase tracking-[0.14em] text-[#8ab4f5]">{activity.surface}</span>
                <span className="truncate text-[#8a8580]">{activity.detail ?? activity.action}</span>
                {isDesktop && isActive && (
                    <button
                        type="button"
                        onClick={onTakeOver}
                        className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1 text-[11px] text-[#eeeeee] transition-colors hover:bg-[#2a2a2a]"
                    >
                        <i className="fa fa-expand text-[10px]" />
                        Take Over
                    </button>
                )}
                <span className="ml-auto rounded-md border border-[#1e2a3a] bg-[#161c28] px-1.5 py-0.5 font-medium text-[#8ab4f5]">
                    {needsApproval ? "review" : activity.phase}
                </span>
            </div>
        );
    }
);
LiveSurfaceStrip.displayName = "LiveSurfaceStrip";

const SandboxRunDisplay = memo(
    ({
        activity,
        timeline,
        onTakeOver,
        onDirectTerminal,
    }: {
        activity: LiveAgentSurfaceActivity | null;
        timeline: TimedAgentActivityEvent[];
        onTakeOver: () => void;
        onDirectTerminal: () => void;
    }) => {
        const sandboxActive = activity?.surface === "sandbox" || timeline.some((item) => item.surface === "sandbox");
        if (!sandboxActive) {
            return null;
        }
        const latest = timeline[0] ?? activity;
        return (
            <div className="shrink-0 border-b border-[#2a2a2a] bg-[#101010] px-4 py-3">
                <div className="mx-auto grid max-w-5xl gap-3 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.8fr)]">
                    <section className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#050505]">
                        <div className="flex h-9 items-center gap-2 border-b border-[#242424] px-3 text-[11px] text-[#9e9a93]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b9ef5]" />
                            <i className="fa fa-cube text-[#5b9ef5]" />
                            <span className="font-semibold uppercase tracking-[0.14em] text-[#8ab4f5]">Sandbox</span>
                            <span className="min-w-0 flex-1 truncate">
                                {latest?.detail ?? latest?.action ?? "Working"}
                            </span>
                            <button
                                type="button"
                                onClick={onDirectTerminal}
                                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#171717] px-2 py-1 text-[#d4d4d4] hover:bg-[#242424]"
                            >
                                <i className="fa fa-terminal text-[10px]" />
                                Terminal
                            </button>
                            <button
                                type="button"
                                onClick={onTakeOver}
                                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#1e2a3a] bg-[#161c28] px-2 py-1 text-[#8ab4f5] hover:bg-[#1e2a3a]"
                            >
                                <i className="fa fa-hand text-[10px]" />
                                Take over
                            </button>
                        </div>
                        <div className="flex aspect-video items-center justify-center bg-black">
                            {activity?.previewimageurl ? (
                                <img
                                    src={activity.previewimageurl}
                                    alt="Sandbox preview"
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="text-xs text-[#6b6863]">Waiting for sandbox preview</div>
                            )}
                        </div>
                    </section>
                    <section className="min-h-0 rounded-lg border border-[#2a2a2a] bg-[#151515] p-3">
                        <div className="mb-2 flex items-center justify-between text-[11px]">
                            <span className="font-semibold uppercase tracking-[0.14em] text-[#8ab4f5]">Timeline</span>
                            <span className="text-[#6b6863]">{timeline.length} events</span>
                        </div>
                        <div className="max-h-[220px] space-y-2 overflow-y-auto">
                            {timeline.length ? (
                                timeline.map((item) => (
                                    <div
                                        key={`${item.timestamp}-${item.action}-${item.detail ?? ""}`}
                                        className="flex gap-2 text-xs"
                                    >
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b9ef5]" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[#d4d4d4]">
                                                <span className="uppercase text-[10px] tracking-[0.1em] text-[#8a8580]">
                                                    {item.phase}
                                                </span>
                                                <span className="truncate">{item.detail ?? item.action}</span>
                                            </div>
                                            {item.thought ? (
                                                <div className="mt-0.5 truncate text-[11px] text-[#77736d]">
                                                    {item.thought}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-md border border-dashed border-[#2a2a2a] px-3 py-6 text-center text-xs text-[#6b6863]">
                                    Sandbox events will appear here.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        );
    }
);
SandboxRunDisplay.displayName = "SandboxRunDisplay";

const AgentLibraryPopup = memo(
    ({
        agents,
        enabledBackends,
        onToggleAgent,
        onClose,
    }: {
        agents: AcpBackendInfo[];
        enabledBackends: string[];
        onToggleAgent: (backend: string) => void;
        onClose: () => void;
    }) => (
        <>
            <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                onClick={onClose}
                aria-label="Close agents"
            />
            <div className="absolute right-3 top-12 z-40 flex max-h-[420px] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#151515] shadow-2xl shadow-black/60">
                <div className="flex h-12 items-center justify-between border-b border-[#2a2a2a] px-4">
                    <div>
                        <div className="text-sm font-semibold text-[#eeeeee]">Agents</div>
                        <div className="text-[11px] text-[#77736d]">KronosCode is always available by default.</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                        aria-label="Close agents"
                    >
                        <i className="fa fa-xmark" />
                    </button>
                </div>
                <div className="min-h-0 overflow-y-auto p-2">
                    {agents.map((agent) => {
                        const enabled = enabledBackends.includes(agent.backend);
                        const locked = agent.backend === "kronoscode";
                        return (
                            <button
                                type="button"
                                key={agent.backend}
                                disabled={locked}
                                onClick={() => onToggleAgent(agent.backend)}
                                className={cn(
                                    "mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors last:mb-0",
                                    enabled ? "bg-[#1e2a3a] text-[#eeeeee]" : "text-[#b8b2aa] hover:bg-[#1a1a1a]",
                                    locked && "cursor-default"
                                )}
                            >
                                <AcpAgentMark backend={agent.backend} className="h-7 w-7" />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                        <span className="truncate">{agent.name}</span>
                                        {!agent.available ? (
                                            <span className="rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#77736d]">
                                                missing
                                            </span>
                                        ) : null}
                                    </span>
                                    {agent.description ? (
                                        <span className="mt-0.5 block truncate text-[11px] text-[#77736d]">
                                            {agent.description}
                                        </span>
                                    ) : null}
                                </span>
                                <span
                                    className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]",
                                        enabled
                                            ? "border-[#5b9ef5] bg-[#162638] text-[#8ab4f5]"
                                            : "border-[#3a3834] text-[#6b6863]"
                                    )}
                                >
                                    {enabled ? <i className="fa fa-check" /> : <i className="fa fa-plus" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    )
);
AgentLibraryPopup.displayName = "AgentLibraryPopup";

const ChatWidgetAppsStrip = memo(({ compact = false }: { compact?: boolean }) => {
    const { rpc, createBlock } = useWaveEnv();
    const [apps, setApps] = useState<ChatLaunchableApp[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const loadApps = async () => {
            setLoading(true);
            try {
                const rpcWithApps = rpc as typeof rpc & {
                    ListAllAppsCommand?: (client: typeof TabRpcClient) => Promise<ChatWaveAppInfo[]>;
                };
                const [desktopResult, waveResult] = await Promise.allSettled([
                    rpc.ListInstalledAppsCommand(TabRpcClient),
                    typeof rpcWithApps.ListAllAppsCommand === "function"
                        ? rpcWithApps.ListAllAppsCommand(TabRpcClient)
                        : Promise.resolve([]),
                ]);
                if (cancelled) {
                    return;
                }
                const desktopApps =
                    desktopResult.status === "fulfilled"
                        ? desktopResult.value
                              .sort((left, right) => left.name.localeCompare(right.name))
                              .slice(0, 10)
                              .map(
                                  (app): ChatLaunchableApp => ({
                                      kind: "desktop",
                                      id: `desktop:${app.bundleid || app.appid}`,
                                      label: app.name,
                                      icon: app.icon,
                                      description: app.description || app.category,
                                      app,
                                  })
                              )
                        : [];
                const waveApps =
                    waveResult.status === "fulfilled"
                        ? waveResult.value
                              .filter((app) => !app.appid.startsWith("draft/"))
                              .sort((left, right) => left.appid.localeCompare(right.appid))
                              .slice(0, 8)
                              .map((app): ChatLaunchableApp => {
                                  const meta = app.manifest?.appmeta;
                                  return {
                                      kind: "wave",
                                      id: `wave:${app.appid}`,
                                      label: meta?.displayname || app.appid.replace(/^local\//, ""),
                                      icon: meta?.icon,
                                      iconColor: meta?.iconcolor,
                                      description: "WaveApp widget",
                                      app,
                                  };
                              })
                        : [];
                setApps([...desktopApps, ...waveApps]);
            } catch (err) {
                console.error("Failed to load chat widget apps:", err);
                if (!cancelled) {
                    setApps([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void loadApps();
        return () => {
            cancelled = true;
        };
    }, [rpc]);

    const launchApp = (item: ChatLaunchableApp) => {
        if (item.kind === "desktop") {
            const blockDef: BlockDef = {
                meta: {
                    view: "appstream",
                    "appstream:appid": item.app.bundleid || item.app.appid,
                    "appstream:appname": item.app.name,
                } as unknown as MetaType,
            };
            Promise.resolve(createBlock(blockDef)).then((blockId) => {
                if (blockId) {
                    window.dispatchEvent(
                        new CustomEvent(AppStreamCreatedEvent, {
                            detail: { appName: item.app.name, blockId },
                        })
                    );
                }
            });
            return;
        }
        createBlock({
            meta: {
                view: "tsunami",
                controller: "tsunami",
                "tsunami:appid": item.app.appid,
            },
        });
    };

    const visibleApps = expanded ? apps : apps.slice(0, 8);
    if (!loading && !apps.length) {
        return null;
    }

    const renderIcon = (item: ChatLaunchableApp) => {
        if (item.icon?.startsWith("data:") || item.icon?.startsWith("file:") || item.icon?.startsWith("http")) {
            return <img src={item.icon} alt="" className="h-4 w-4 rounded object-contain" />;
        }
        return (
            <i
                className={makeIconClass(item.icon || (item.kind === "desktop" ? "desktop" : "cube"), false)}
                style={{ color: item.kind === "wave" ? item.iconColor : undefined }}
            />
        );
    };

    if (compact) {
        return (
            <div className="hidden min-w-0 items-center gap-1 @lg:flex">
                {loading ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a8580]">
                        <i className="fa fa-spinner fa-spin text-xs" />
                    </span>
                ) : (
                    visibleApps.slice(0, 5).map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => launchApp(item)}
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#9e9a93] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                            title={item.description ? `${item.label} - ${item.description}` : item.label}
                        >
                            {renderIcon(item)}
                        </button>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] px-2 py-1.5">
            <div className="flex shrink-0 items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#77736d]">
                <i className="fa fa-layer-group text-[#8ab4f5]" />
                Apps
            </div>
            <div className="min-w-0 flex flex-1 items-center gap-1 overflow-x-auto">
                {loading ? (
                    <div className="flex h-8 items-center gap-2 px-2 text-xs text-[#77736d]">
                        <i className="fa fa-spinner fa-spin" />
                        Loading apps
                    </div>
                ) : (
                    visibleApps.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => launchApp(item)}
                            className="flex h-8 max-w-[140px] shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-[#bdb7af] transition-colors hover:bg-[#242424] hover:text-[#eeeeee]"
                            title={item.description ? `${item.label} - ${item.description}` : item.label}
                        >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm text-[#8ab4f5]">
                                {renderIcon(item)}
                            </span>
                            <span className="truncate">{item.label}</span>
                        </button>
                    ))
                )}
            </div>
            {apps.length > 8 ? (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs text-[#8a8580] hover:bg-[#242424] hover:text-[#eeeeee]"
                    aria-label={expanded ? "Show fewer apps" : "Show more apps"}
                >
                    {expanded ? "Less" : `+${apps.length - 8}`}
                </button>
            ) : null}
        </div>
    );
});
ChatWidgetAppsStrip.displayName = "ChatWidgetAppsStrip";

const WidgetTypeToolbar = memo(
    ({
        onOpenWorkspace,
        onOpenGitTree,
        onOpenSettings,
    }: {
        onOpenWorkspace: () => void;
        onOpenGitTree: () => void | Promise<void>;
        onOpenSettings: () => void;
    }) => {
        const { createBlock } = useWaveEnv();
        const widgets = [
            {
                id: "terminal",
                label: "Terminal",
                icon: "fa-terminal",
                open: () => createBlock({ meta: { view: "term" } }),
            },
            {
                id: "browser",
                label: "Browser",
                icon: "fa-globe",
                open: () => createBlock({ meta: { view: "web" } }),
            },
            {
                id: "sandbox",
                label: "Sandbox",
                icon: "fa-cube",
                open: () => createBlock({ meta: { view: "sandbox", "sandbox:mode": "desktop" } }),
            },
            {
                id: "git",
                label: "Git tree",
                icon: "fa-code-branch",
                open: onOpenGitTree,
            },
            {
                id: "files",
                label: "Workspace files",
                icon: "fa-folder-open",
                open: onOpenWorkspace,
            },
            {
                id: "settings",
                label: "Widget settings",
                icon: "fa-sliders",
                open: onOpenSettings,
            },
        ];
        return (
            <div className="flex items-center gap-1">
                {widgets.map((widget) => (
                    <button
                        type="button"
                        key={widget.id}
                        onClick={() => void widget.open()}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9e9a93] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                        title={widget.label}
                        aria-label={widget.label}
                    >
                        <i className={cn("fa", widget.icon, "text-xs")} />
                    </button>
                ))}
            </div>
        );
    }
);

WidgetTypeToolbar.displayName = "WidgetTypeToolbar";

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
    const storedEnabledAgentBackends =
        useAtomValue(getSettingsKeyAtom(EnabledAgentBackendsSettingsKey)) ?? DefaultEnabledAgentBackends;
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
    const availableCommands = useMemo(() => {
        const runtimeCommands = Object.fromEntries(
            Object.entries(activeRuntime?.slashCommands ?? {}).map(([id, command]) => [
                id,
                {
                    name: command.name ?? id,
                    description: command.description,
                    template: command.template,
                },
            ])
        ) as Record<string, ACPCommandDefinition>;
        return { ...DefaultKronosCodeCommands, ...configuredCommands, ...runtimeCommands };
    }, [activeRuntime?.slashCommands, configuredCommands]);
    const configuredSkills = skills ?? storedSkills;
    const configuredGitIdentities = gitIdentities ?? storedGitIdentities;
    const [agents, setAgents] = useState<AcpBackendInfo[]>(fallbackAgents);
    const [selectedAgent, setSelectedAgent] = useState<AcpBackendInfo | null>(fallbackAgents[0]);
    const [agentsLoaded, setAgentsLoaded] = useState(false);
    const [input, setInput] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsBackend, setSettingsBackend] = useState<string | null>(null);
    const [agentLibraryOpen, setAgentLibraryOpen] = useState(false);
    const [resourcesOpen, setResourcesOpen] = useState(false);
    const [sessionSidebarMode, setSessionSidebarMode] = useState<"open" | "compact" | "hidden">("open");
    const [restartRequiredBackends, setRestartRequiredBackends] = useState<Set<string>>(new Set());
    const [workspaceDraft, setWorkspaceDraft] = useState("");
    const [liveSurfaceActivity, setLiveSurfaceActivity] = useState<LiveAgentSurfaceActivity | null>(null);
    const [surfaceTimeline, setSurfaceTimeline] = useState<TimedAgentActivityEvent[]>([]);
    const [takeoverActive, setTakeoverActive] = useState(false);
    const handleTakeOver = useCallback(() => {
        stop();
        setTakeoverActive(true);
    }, [stop]);
    const handleDirectSandboxTerminal = useCallback(() => {
        void createBlock({ meta: { view: "sandbox", "sandbox:mode": "desktop" } });
        setTakeoverActive(true);
    }, [createBlock]);
    const [composerMenu, setComposerMenu] = useState<{
        mode: AcpComposerMenuMode;
        query: string;
        mentionTab: AcpMentionTab;
    } | null>(null);
    const [composerSuggestionIndex, setComposerSuggestionIndex] = useState(0);
    const [kronosCodeAgents, setKronosCodeAgents] = useState<KronAgentOption[]>(DefaultKronosCodeAgents);
    const [selectedKronosCodeAgent, setSelectedKronosCodeAgent] = useState(DefaultKronosCodeAgents[0].id);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const didCreateInitialRuntime = useRef(false);
    const workspaceId = useAtomValue(atoms.workspaceId);
    const activeWorkspace = activeRuntime?.workspace ?? "";
    const referencedFiles = activeRuntime?.referencedFiles ?? [];
    const openWidgetMentions = useMemo<AcpOpenWidgetMention[]>(() => {
        const layoutModel = getLayoutModelForStaticTab();
        if (!layoutModel) {
            return [];
        }
        const leafOrder = globalStore.get(layoutModel.leafOrder) ?? [];
        return leafOrder.flatMap((leaf): AcpOpenWidgetMention[] => {
            const blockId = leaf.blockid;
            if (!blockId) {
                return [];
            }
            const block = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)));
            const viewType = String(block?.meta?.view ?? "widget");
            const title = String(block?.meta?.["frame:title"] ?? "");
            const shortId = blockId.slice(0, 8);
            return [
                {
                    id: blockId,
                    label: `${viewType}:${shortId}`,
                    viewType,
                    title,
                    description: title ? `${title} - ${blockId}` : blockId,
                },
            ];
        });
    }, [activeRuntime?.conversationId, composerMenu?.mode, composerMenu?.query, composerMenu?.mentionTab]);
    const enabledAgentBackends = useMemo(() => {
        const configured = Array.isArray(storedEnabledAgentBackends)
            ? (storedEnabledAgentBackends as string[]).filter(Boolean)
            : DefaultEnabledAgentBackends;
        return Array.from(new Set(["kronoscode", ...configured]));
    }, [storedEnabledAgentBackends]);
    const pickerAgents = useMemo(() => {
        const enabled = agents.filter((agent) => enabledAgentBackends.includes(agent.backend));
        return enabled.length ? enabled : agents.filter((agent) => agent.backend === "kronoscode");
    }, [agents, enabledAgentBackends]);
    const composerSuggestions = useMemo(
        () =>
            composerMenu
                ? getComposerSuggestions(
                      composerMenu.mode,
                      composerMenu.query,
                      availableCommands,
                      configuredSkills,
                      agents,
                      referencedFiles,
                      composerMenu.mentionTab,
                      openWidgetMentions
                  )
                : [],
        [agents, composerMenu, availableCommands, configuredSkills, referencedFiles, openWidgetMentions]
    );
    const commandDeckCommands = useMemo<CommandDeckSuggestion[]>(
        () =>
            Object.values(availableCommands)
                .filter((command) => command.name?.trim())
                .map((command) => ({
                    id: command.name?.trim() ?? "",
                    label: command.name?.trim() ?? "",
                    description: command.description ?? command.template,
                    badge: command.agent ?? "ACP",
                    available: true,
                })),
        [availableCommands]
    );
    const withCanvasContext = useCallback(
        async (prompt: string): Promise<string> => {
            if (!/@canvas\b/i.test(prompt)) {
                return prompt;
            }
            const canvasBlock = openWidgetMentions.find((widget) => widget.viewType === "kronoscanvas");
            if (!canvasBlock) {
                return `${prompt}\n\nCanvas context:\nNo open Kronos canvas block was found.`;
            }
            try {
                const snapshot = await RpcApi.CanvasSnapshotCommand(TabRpcClient, {
                    workspaceid: workspaceId,
                    blockid: canvasBlock.id,
                    includecontent: true,
                });
                return `${prompt}\n\nCanvas context (${canvasBlock.description || canvasBlock.id}):\n${snapshot.summary}`;
            } catch (e) {
                return `${prompt}\n\nCanvas context:\nUnable to read canvas ${canvasBlock.id}: ${String(e)}`;
            }
        },
        [openWidgetMentions, workspaceId]
    );

    useEffect(() => {
        setComposerSuggestionIndex(0);
    }, [composerMenu?.mode, composerMenu?.query, composerMenu?.mentionTab]);

    useEffect(() => {
        return subscribeAgentActivityStream((activity) => {
            setLiveSurfaceActivity(activity);
            setSurfaceTimeline((current) => [activity, ...current].slice(0, 20));
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadKronosCodeAgents = async () => {
            try {
                const endpoint = getWebServerEndpoint();
                const snapshot = await fetchJson<{ catalog?: { agents?: KronosCatalogAgent[] } }>(
                    `${endpoint}/api/kronoscode/catalog?mode=agent`
                );
                const nextAgents = normalizeKronosCatalogAgents(snapshot.catalog?.agents ?? []);
                if (!cancelled && nextAgents.length) {
                    setKronosCodeAgents(nextAgents);
                    setSelectedKronosCodeAgent(getPreferredKronosCodeAgent(nextAgents));
                }
            } catch {
                try {
                    const catalog = await fetchJson<{ agents?: KronosCatalogAgent[] }>(
                        `${KronosDirectEndpoint}/agent/catalog`
                    );
                    const nextAgents = normalizeKronosCatalogAgents(catalog.agents ?? []);
                    if (!cancelled && nextAgents.length) {
                        setKronosCodeAgents(nextAgents);
                        setSelectedKronosCodeAgent(getPreferredKronosCodeAgent(nextAgents));
                    }
                } catch {
                    if (!cancelled) {
                        setKronosCodeAgents(DefaultKronosCodeAgents);
                        setSelectedKronosCodeAgent(DefaultKronosCodeAgents[0].id);
                    }
                }
            }
        };
        void loadKronosCodeAgents();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const detected = await detectAgents();
                if (cancelled) return;
                const nextAgents = detected.length ? detected : fallbackAgents;
                setAgents(nextAgents);
                const visibleNextAgents = nextAgents.filter((agent) => enabledAgentBackends.includes(agent.backend));
                const preferred =
                    visibleNextAgents.find((agent) => agent.backend === defaultBackend && agent.available) ??
                    visibleNextAgents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
                    visibleNextAgents.find((agent) => agent.available) ??
                    visibleNextAgents[0] ??
                    nextAgents.find((agent) => agent.backend === "kronoscode") ??
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
    }, [defaultBackend, detectAgents, enabledAgentBackends]);

    useEffect(() => {
        const projectsByWorkspace = new Map<string, KronchatProject>();
        sessions
            .filter((session) => session.resumeState !== "archived")
            .forEach((session) => {
                const workspace = session.workspace || "";
                const existing = projectsByWorkspace.get(workspace);
                projectsByWorkspace.set(workspace, {
                    workspace,
                    name: formatKronchatProjectName(workspace),
                    sessionCount: (existing?.sessionCount ?? 0) + 1,
                    liveCount: (existing?.liveCount ?? 0) + (session.isLive ? 1 : 0),
                    activeConversationId:
                        session.conversationId === state.conversationId
                            ? session.conversationId
                            : existing?.activeConversationId,
                    updatedTs: Math.max(existing?.updatedTs ?? 0, session.updatedTs),
                });
            });
        writeKronchatProjects(
            Array.from(projectsByWorkspace.values()).sort((left, right) => right.updatedTs - left.updatedTs)
        );
    }, [sessions, state.conversationId]);

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
        if (!hydrated || !agentsLoaded || didCreateInitialRuntime.current) {
            return;
        }
        if (activeRuntime || sessions.length > 0) {
            return;
        }
        const preferred =
            pickerAgents.find((agent) => agent.backend === defaultBackend && agent.available) ??
            pickerAgents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
            pickerAgents.find((agent) => agent.available);
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
    }, [activeRuntime, agentsLoaded, defaultBackend, hydrated, initialize, pickerAgents, profiles, sessions.length]);

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

    const buildPrompt = useCallback(
        (rawMessage: string, files: FileWithPreview[] = [], pastedContent: PastedContent[] = []) => {
            const enteredText = rawMessage.trim();
            const commandMatch = enteredText.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
            const command = commandMatch
                ? Object.values(availableCommands).find(
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
            const agentInstructions = selectedAgent
                ? configuredAgentDefinitions[selectedAgent.backend]?.systemprompt?.trim()
                : "";
            const kronosCodeAgent = kronosCodeAgents.find((agent) => agent.id === selectedKronosCodeAgent);
            const kronosCodeAgentInstructions = kronosCodeAgent
                ? `Use the KronosCode catalog agent "${kronosCodeAgent.label}" (id: ${kronosCodeAgent.id}) for this request.`
                : "";
            const instructionSections = [
                kronosCodeAgentInstructions ? `KronosCode agent:\n${kronosCodeAgentInstructions}` : "",
                agentInstructions ? `Agent instructions:\n${agentInstructions}` : "",
                skillInstructions ? `Loaded skills:\n${skillInstructions}` : "",
            ].filter(Boolean);
            const configuredPrompt = instructionSections.length
                ? `${instructionSections.join("\n\n")}\n\nTask:\n${text}`
                : text;
            const attachmentSections = [
                referencedFiles.length
                    ? `Referenced files:\n${referencedFiles.map((filePath) => `- ${filePath}`).join("\n")}`
                    : "",
                pastedContent.length
                    ? `Pasted content:\n${pastedContent
                          .map((item, index) => `--- paste ${index + 1} (${item.wordCount} words) ---\n${item.content}`)
                          .join("\n\n")}`
                    : "",
                files.length
                    ? `Attached files:\n${files
                          .map((file) =>
                              file.textContent
                                  ? `--- ${file.file.name} ---\n${file.textContent}`
                                  : `- ${file.file.name} (${(file.file.size / 1024).toFixed(1)}KB)`
                          )
                          .join("\n\n")}`
                    : "",
            ].filter(Boolean);
            return attachmentSections.length
                ? `${configuredPrompt}\n\n${attachmentSections.join("\n\n")}`
                : configuredPrompt;
        },
        [
            configuredAgentDefinitions,
            availableCommands,
            configuredSkills,
            kronosCodeAgents,
            referencedFiles,
            selectedAgent,
            selectedKronosCodeAgent,
        ]
    );

    const startRuntime = async (
        agent: AcpBackendInfo,
        opts?: {
            conversationId?: string;
            workspace?: string;
            messages?: AcpAgentMessage[];
            title?: string;
            referencedFiles?: string[];
            resumeSessionId?: string;
            resumeSessionConversationId?: string;
        }
    ) => {
        const profile = profiles[agent.backend];
        const runtimeMcpServers = mcpEnabled
            ? (profile?.mcpserverids ?? []).flatMap((serverId) => {
                  const server = (mcpServers as Record<string, MCPConfig>)[serverId];
                  const sessionServer = buildAcpMcpSessionServer(serverId, server);
                  return sessionServer ? [sessionServer] : [];
              })
            : [];
        return initialize({
            conversationId: opts?.conversationId,
            backend: agent.backend,
            agentName: agent.name,
            cliPath: profile?.executable || agent.cliPath,
            workspace: opts?.workspace,
            messages: opts?.messages,
            title: opts?.title,
            referencedFiles: opts?.referencedFiles,
            resumeSessionId: opts?.resumeSessionId,
            resumeSessionConversationId: opts?.resumeSessionConversationId,
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

    const handleToggleAgentEnabled = (backend: string) => {
        if (backend === "kronoscode") {
            return;
        }
        const next = enabledAgentBackends.includes(backend)
            ? enabledAgentBackends.filter((candidate) => candidate !== backend)
            : [...enabledAgentBackends, backend];
        const normalized = Array.from(new Set(["kronoscode", ...next]));
        void rpc.SetConfigCommand(TabRpcClient, {
            [EnabledAgentBackendsSettingsKey]: normalized,
        } as Partial<SettingsType>);
        if (selectedAgent?.backend === backend && !normalized.includes(backend)) {
            const kronoscodeAgent = agents.find((agent) => agent.backend === "kronoscode") ?? null;
            setSelectedAgent(kronoscodeAgent);
        }
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
                conversationId: runtime.conversationId,
                resumeSessionConversationId: runtime.conversationId,
            });
        }
        setRestartRequiredBackends((current) => {
            const next = new Set(current);
            next.delete(backend);
            return next;
        });
    };

    const _handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!input.trim() || state.status === "running" || !selectedAgent?.available) return;
        const prompt = await withCanvasContext(buildPrompt(input));
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
                conversationId: activeRuntime?.conversationId,
                resumeSessionConversationId: activeRuntime?.conversationId,
            });
            if (!result.success) {
                return;
            }
            targetConversationId = result.conversationId;
        }
        await sendMessage(prompt, targetConversationId).catch((err) => console.error("ACP send failed:", err));
    };

    const handleNewChat = useCallback(
        async (workspace?: string) => {
            const defaultAgent =
                pickerAgents.find((agent) => agent.backend === defaultBackend && agent.available) ??
                pickerAgents.find((agent) => agent.backend === "kronoscode" && agent.available) ??
                pickerAgents.find((agent) => agent.available);
            if (!defaultAgent) return;
            setSelectedAgent(defaultAgent);
            setInput("");
            await startRuntime(defaultAgent, {
                workspace: workspace ?? profiles[defaultAgent.backend]?.workspace,
            }).catch((err) => console.error("ACP initialize failed:", err));
        },
        [defaultBackend, pickerAgents, profiles, startRuntime]
    );

    useEffect(() => {
        const handleOpenProject = (event: Event) => {
            const project = (event as CustomEvent<KronchatProject>).detail;
            if (!project) {
                return;
            }
            const targetSession =
                sessions.find(
                    (session) =>
                        session.resumeState !== "archived" &&
                        (session.workspace || "") === project.workspace &&
                        session.conversationId === project.activeConversationId
                ) ??
                sessions.find(
                    (session) => session.resumeState !== "archived" && (session.workspace || "") === project.workspace
                );
            if (targetSession) {
                selectSession(targetSession.conversationId);
                return;
            }
            void handleNewChat(project.workspace || undefined);
        };
        window.addEventListener(KronchatOpenProjectEvent, handleOpenProject);
        return () => window.removeEventListener(KronchatOpenProjectEvent, handleOpenProject);
    }, [handleNewChat, selectSession, sessions]);

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

    const _updateComposerMenu = (value: string, cursorPosition: number) => {
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
        if (suggestion.kind === "canvas") {
            replaceActiveToken("@canvas ", "@");
            return;
        }
        replaceActiveToken(`@${suggestion.label} `, "@");
    };

    const _handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
                "@container relative flex min-h-0 flex-1 overflow-hidden bg-panel text-primary",
                className
            )}
        >
            {!settingsOpen && sessionSidebarMode === "open" ? (
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
                    onSetSidebarMode={setSessionSidebarMode}
                />
            ) : null}
            {!settingsOpen && sessionSidebarMode === "compact" ? (
                <CompactSessionRail
                    sessions={sessions}
                    activeConversationId={state.conversationId}
                    onSelectSession={selectSession}
                    onOpen={() => setSessionSidebarMode("open")}
                    onHide={() => setSessionSidebarMode("hidden")}
                    onNewChat={handleNewChat}
                    onOpenSettings={() => {
                        setResourcesOpen(false);
                        setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                        setSettingsOpen(true);
                    }}
                />
            ) : null}
            <div className="relative flex min-w-0 flex-1 flex-col">
                <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        {sessionSidebarMode === "hidden" ? (
                            <button
                                type="button"
                                onClick={() => setSessionSidebarMode("compact")}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] transition-colors hover:bg-[#22211f]"
                                aria-label="Show project rail"
                            >
                                <AcpAgentMark backend="kronoscode" className="h-5 w-5" />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                setSettingsOpen(false);
                                setAgentLibraryOpen(false);
                                setResourcesOpen((open) => !open);
                            }}
                            className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#171717] px-2.5 py-1.5 text-left text-xs text-[#d4d4d4] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                            title={activeWorkspace || "Focused workspace"}
                        >
                            <i className="fa fa-folder-open text-[11px] text-[#8ab4f5]" />
                            <span className="min-w-0 truncate">
                                {activeWorkspace ? formatKronchatProjectName(activeWorkspace) : "Focused workspace"}
                            </span>
                        </button>
                        <div className="hidden min-w-0 items-center gap-1 text-[11px] text-[#6b6863] @lg:flex">
                            <span>
                                {sessions.length} session{sessions.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <WidgetTypeToolbar
                            onOpenWorkspace={() => {
                                setSettingsOpen(false);
                                setAgentLibraryOpen(false);
                                setResourcesOpen((open) => !open);
                            }}
                            onOpenGitTree={handleOpenGitTree}
                            onOpenSettings={() => {
                                setAgentLibraryOpen(false);
                                setResourcesOpen(false);
                                setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                                setSettingsOpen((open) => !open);
                            }}
                        />
                        {state.pendingConfirmations.length > 0 ? (
                            <span className="mr-2 hidden rounded-full border border-[#522c29] bg-[#211716] px-2.5 py-1 text-[11px] text-[#dc7668] @lg:inline">
                                {state.pendingConfirmations.length} approvals
                            </span>
                        ) : null}
                    </div>
                    {agentLibraryOpen ? (
                        <AgentLibraryPopup
                            agents={agents}
                            enabledBackends={enabledAgentBackends}
                            onToggleAgent={handleToggleAgentEnabled}
                            onClose={() => setAgentLibraryOpen(false)}
                        />
                    ) : null}
                </div>
                <LiveSurfaceStrip activity={liveSurfaceActivity} onTakeOver={handleTakeOver} />
                <SandboxRunDisplay
                    activity={liveSurfaceActivity}
                    timeline={surfaceTimeline.filter(
                        (item) =>
                            item.surface === "sandbox" || item.surface === "desktop" || item.surface === "terminal"
                    )}
                    onTakeOver={handleTakeOver}
                    onDirectTerminal={handleDirectSandboxTerminal}
                />

                {takeoverActive && (
                    <div className="flex shrink-0 items-center gap-2 border-b border-[#2a2a2a] bg-[#141c2a] px-4 py-2 text-[11px] text-[#8ab4f5]">
                        <i className="fa fa-hand text-xs" />
                        <span className="flex-1">Agent paused. Sandbox is ready for direct interaction.</span>
                        <button
                            type="button"
                            onClick={() => setTakeoverActive(false)}
                            className="cursor-pointer rounded-md border border-[#2a4a6a] bg-[#1a2a3a] px-2.5 py-1 text-[11px] text-[#eeeeee] transition-colors hover:bg-[#2a4a6a]"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

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
                    <div className="mx-auto mt-3 flex w-[calc(100%-32px)] max-w-3xl items-center justify-between gap-3 rounded-lg border border-[#1e2a3a] bg-[#161c28] px-4 py-2 text-xs text-[#9e9a93]">
                        <span>
                            Saved transcript. Sending continues in a{" "}
                            {activeRuntime.resumeState === "resumable" ? "resumed" : "new"} runtime.
                        </span>
                        <button
                            type="button"
                            onClick={() => textareaRef.current?.focus()}
                            className="cursor-pointer font-medium text-[#5b9ef5]"
                        >
                            Continue
                        </button>
                    </div>
                ) : null}

                <AcpToolApproval confirmations={state.pendingConfirmations} onConfirm={confirmTool} />

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 @lg:px-6">
                    {hasMessages ? (
                        <>
                            <ChatMessageListV2
                                messages={state.messages}
                                isStreaming={state.status === "running"}
                                canvasBlockId={
                                    openWidgetMentions.find((widget) => widget.viewType === "kronoscanvas")?.id
                                }
                            />
                            {state.status === "running" ? (
                                <TypingIndicator
                                    agentBackend={selectedAgent?.backend ?? state.backend ?? "kronoscode"}
                                    detail={
                                        liveSurfaceActivity?.detail ??
                                        (liveSurfaceActivity?.action ? `${liveSurfaceActivity.action}` : "Working")
                                    }
                                />
                            ) : null}
                        </>
                    ) : (
                        <ChatEmptyState
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

                <div className="shrink-0 border-t border-border bg-panel px-3 pb-3 pt-2 @lg:px-5 @lg:pb-5">
                    <ChatWidgetAppsStrip />
                    <div className="relative mx-auto w-full max-w-3xl">
                        <ImprovedChatInput
                            onSendMessage={async (message, files, pastedContent) => {
                                try {
                                    if (!selectedAgent?.available) {
                                        console.warn("No available agent selected");
                                        return;
                                    }

                                    const fullMessage = await withCanvasContext(
                                        buildPrompt(message, files, pastedContent)
                                    );

                                    if (!fullMessage.trim()) {
                                        console.warn("Empty message");
                                        return;
                                    }

                                    setInput("");
                                    setComposerMenu(null);
                                    let targetConversationId = activeRuntime?.conversationId;

                                    if (!activeRuntime?.isLive) {
                                        if (!selectedAgent || !selectedAgent.backend) {
                                            console.error("Invalid agent for runtime initialization");
                                            return;
                                        }

                                        const result = await startRuntime(selectedAgent, {
                                            workspace: activeWorkspace || undefined,
                                            messages: state?.messages ?? [],
                                            referencedFiles: referencedFiles ?? [],
                                            title: state?.conversationId
                                                ? `${activeRuntime?.title ?? "Saved chat"} continued`
                                                : undefined,
                                            resumeSessionId:
                                                activeRuntime?.resumeState === "resumable"
                                                    ? (activeRuntime.sessionId ?? undefined)
                                                    : undefined,
                                            conversationId: activeRuntime?.conversationId,
                                            resumeSessionConversationId: activeRuntime?.conversationId,
                                        });

                                        if (!result || !result.success) {
                                            console.error("Failed to initialize runtime:", result?.error);
                                            return;
                                        }
                                        targetConversationId = result.conversationId;
                                    }

                                    if (!targetConversationId) {
                                        console.error("No target conversation ID");
                                        return;
                                    }

                                    await sendMessage(fullMessage, targetConversationId).catch((err) => {
                                        console.error("ACP send failed:", err);
                                    });
                                } catch (error) {
                                    console.error("Error in improved chat input callback:", error);
                                }
                            }}
                            disabled={state.status === "running" || !selectedAgent?.available}
                            placeholder={
                                state.status === "running"
                                    ? "Agent is working..."
                                    : selectedAgent?.available
                                      ? "@ for files/agents; / for commands; ! for shell"
                                      : "Select an available agent..."
                            }
                            slashCommands={commandDeckCommands}
                            referencedFiles={referencedFiles}
                            openWidgets={openWidgetMentions}
                            maxFiles={10}
                            maxFileSize={50 * 1024 * 1024}
                            acceptedFileTypes={[
                                "image/*",
                                ".pdf",
                                ".txt",
                                ".md",
                                ".js",
                                ".jsx",
                                ".ts",
                                ".tsx",
                                ".go",
                                ".py",
                                ".java",
                                ".c",
                                ".cpp",
                                ".h",
                                ".html",
                                ".css",
                                ".scss",
                                ".json",
                                ".xml",
                                ".yaml",
                                ".yml",
                                ".sh",
                                ".bash",
                            ]}
                            models={useMemo<ModelOption[]>(() => {
                                if (state.modelInfo?.availableModels?.length) {
                                    return state.modelInfo.availableModels.map((model) => ({
                                        id: model.id,
                                        name: model.label || model.id,
                                        description: "AI Model",
                                    }));
                                }
                                return [{ id: "default", name: "Default Model", description: "KronosCode default" }];
                            }, [state.modelInfo?.availableModels])}
                            defaultModel={state.modelInfo?.currentModelId || "default"}
                            onModelChange={(modelId) => {
                                const backend = selectedAgent?.backend ?? defaultBackend;
                                updateProfile(backend, { model: modelId });
                                setModel(modelId);
                            }}
                            agentSelector={
                                <RuntimeAgentPicker
                                    agents={pickerAgents}
                                    selectedAgent={selectedAgent}
                                    onSelect={handleAgentSelect}
                                    onConfigure={() => {
                                        setResourcesOpen(false);
                                        setSettingsBackend(selectedAgent?.backend ?? defaultBackend);
                                        setSettingsOpen(true);
                                    }}
                                />
                            }
                            kronAgents={kronosCodeAgents}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

AcpChatPanel.displayName = "AcpChatPanel";
