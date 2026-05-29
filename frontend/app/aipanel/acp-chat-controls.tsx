import { cn } from "@/util/util";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AcpAgentMark } from "./acp-agent-mark";
import type { AcpAgentProfile, AcpBackendInfo, AcpConfigOption, AcpModelInfo, AcpRuntimeRecord } from "./use-acp-session";

export type AcpModeOption = {
    value: string;
    label: string;
};

function getConfigValue(option: AcpConfigOption): string {
    return option.currentValue ?? option.selectedValue ?? option.options?.[0]?.value ?? "";
}

function getModelProvider(modelId: string): string {
    const provider = modelId.split("/")[0];
    if (!provider || provider === modelId) {
        return "Models";
    }
    return provider;
}

function formatProvider(provider: string): string {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

type AgentPickerProps = {
    agents: AcpBackendInfo[];
    selectedAgent: AcpBackendInfo | null;
    onSelect: (agent: AcpBackendInfo) => void | Promise<void>;
    onConfigure: () => void;
};

export const AgentPicker = memo(({ agents, selectedAgent, onSelect, onConfigure }: AgentPickerProps) => {
    const stripRef = useRef<HTMLDivElement>(null);
    const alternatives = agents.filter((agent) => agent.backend !== selectedAgent?.backend);

    useEffect(() => {
        stripRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    }, [selectedAgent?.backend]);

    return (
        <div
            ref={stripRef}
            className="mt-8 flex max-w-full items-center overflow-x-auto rounded-full border border-[#292827] bg-[#171717] p-1.5 shadow-lg shadow-black/20"
        >
            {selectedAgent ? (
                <button
                    type="button"
                    onClick={() => void onSelect(selectedAgent)}
                    className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#302f2d] bg-[#201f1d] px-3.5 text-sm font-semibold lowercase text-[#ebe7e0]"
                    aria-label={`Selected agent: ${selectedAgent.name}`}
                >
                    <AcpAgentMark backend={selectedAgent.backend} className="h-7 w-7" />
                    {selectedAgent.name}
                </button>
            ) : null}
            {alternatives.map((agent) => (
                <div key={agent.backend} className="flex shrink-0 items-center">
                    <span className="mx-2 h-6 w-px bg-[#34322f]" />
                    <button
                        type="button"
                        onClick={() => void onSelect(agent)}
                        className={cn(
                            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[#262522]",
                            !agent.available && "opacity-40"
                        )}
                        title={`${agent.name}${agent.available ? "" : " (not installed)"}`}
                        aria-label={`Choose ${agent.name}`}
                    >
                        <AcpAgentMark backend={agent.backend} />
                    </button>
                </div>
            ))}
            <span className="mx-2 h-6 w-px shrink-0 bg-[#34322f]" />
            <button
                type="button"
                onClick={onConfigure}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#8e8a84] transition-colors hover:bg-[#262522] hover:text-[#ebe7e0]"
                title="Configure agents"
                aria-label="Configure agents"
            >
                <i className="fa fa-plus" />
            </button>
        </div>
    );
});

AgentPicker.displayName = "AgentPicker";

type ModelPickerProps = {
    modelInfo: AcpModelInfo | null;
    onSelect: (modelId: string) => void | Promise<void>;
};

export const ModelPicker = memo(({ modelInfo, onSelect }: ModelPickerProps) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const models = modelInfo?.availableModels ?? [];
    const currentModel = models.find((model) => model.id === modelInfo?.currentModelId);
    const normalizedQuery = query.trim().toLowerCase();
    const groupedModels = useMemo(() => {
        const visible = models.filter((model) => {
            if (!normalizedQuery) {
                return true;
            }
            return `${model.label ?? ""} ${model.id}`.toLowerCase().includes(normalizedQuery);
        });
        const groups = new Map<string, typeof visible>();
        visible.forEach((model) => {
            const provider = getModelProvider(model.id);
            groups.set(provider, [...(groups.get(provider) ?? []), model]);
        });
        return Array.from(groups.entries());
    }, [models, normalizedQuery]);
    const canSelect = Boolean(modelInfo?.canSwitch && models.length);

    const selectModel = async (modelId: string) => {
        await onSelect(modelId);
        setOpen(false);
        setQuery("");
    };

    return (
        <div className="relative">
            <button
                type="button"
                disabled={!canSelect}
                onClick={() => setOpen((visible) => !visible)}
                className="flex h-8 max-w-48 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#d4d0c9] transition-colors hover:bg-[#252421] disabled:text-[#645f59]"
                aria-label="Model selector"
                aria-expanded={open}
            >
                <i className="fa fa-cube text-[10px] text-[#87847f]" />
                <span className="truncate">
                    {currentModel?.label ?? modelInfo?.currentModelLabel ?? "Select model"}
                </span>
                <i className="fa fa-chevron-down text-[9px] text-[#827f79]" />
            </button>
            {open ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setOpen(false)}
                        aria-label="Close model selector"
                    />
                    <div className="absolute bottom-10 left-0 z-30 flex max-h-[340px] w-[min(335px,calc(100vw-36px))] flex-col overflow-hidden rounded-xl border border-[#302f2d] bg-[#171717] p-2 shadow-2xl shadow-black/60">
                        <label className="relative mb-2 block">
                            <i className="fa fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#827f79]" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search providers or models"
                                className="h-9 w-full rounded-lg border border-[#302f2d] bg-[#101010] pl-8 pr-3 text-xs text-[#dedad4] outline-none placeholder:text-[#706b64] focus:border-[#5b4c3c]"
                            />
                        </label>
                        <div className="min-h-0 overflow-y-auto">
                            {groupedModels.length ? (
                                groupedModels.map(([provider, providerModels]) => (
                                    <div key={provider} className="mb-2 last:mb-0">
                                        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#706b64]">
                                            {formatProvider(provider)}
                                        </div>
                                        {providerModels.map((model) => {
                                            const selected = model.id === modelInfo?.currentModelId;
                                            return (
                                                <button
                                                    type="button"
                                                    key={model.id}
                                                    onClick={() => void selectModel(model.id)}
                                                    className={cn(
                                                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                                                        selected
                                                            ? "bg-[#29271f] text-[#ebe7e0]"
                                                            : "text-[#b8b3ac] hover:bg-[#22211f] hover:text-[#ebe7e0]"
                                                    )}
                                                >
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {model.label ?? model.id}
                                                    </span>
                                                    {selected ? (
                                                        <i className="fa fa-check text-[10px] text-[#b1b955]" />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            ) : (
                                <div className="px-3 py-8 text-center text-xs text-[#827f79]">No matching models.</div>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
});

ModelPicker.displayName = "ModelPicker";

export type AcpComposerMenuMode = "commands" | "skills" | "mentions";
export type AcpMentionTab = "agents" | "files";

export type AcpComposerSuggestion = {
    kind: "command" | "skill" | "agent" | "file";
    id: string;
    label: string;
    description?: string;
    badge?: string;
    available?: boolean;
};

export function getComposerSuggestions(
    mode: AcpComposerMenuMode,
    query: string,
    commands: Record<string, ACPCommandDefinition>,
    skills: Record<string, ACPSkillDefinition>,
    agents: AcpBackendInfo[],
    files: string[],
    mentionTab: AcpMentionTab
): AcpComposerSuggestion[] {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = (text: string) => !normalizedQuery || text.toLowerCase().includes(normalizedQuery);

    if (mode === "commands") {
        return Object.entries(commands)
            .map(([id, command]) => ({
                kind: "command" as const,
                id,
                label: command.name || id,
                description: command.description,
                badge: command.scope || "user",
            }))
            .filter((item) => matchesQuery(`${item.label} ${item.description ?? ""}`))
            .sort((a, b) => a.label.localeCompare(b.label));
    }
    if (mode === "skills") {
        return Object.entries(skills)
            .map(([id, skill]) => ({
                kind: "skill" as const,
                id,
                label: skill.name || id,
                description: skill.description,
                badge: skill.scope || "user",
            }))
            .filter((item) => matchesQuery(`${item.label} ${item.description ?? ""}`))
            .sort((a, b) => a.label.localeCompare(b.label));
    }
    if (mentionTab === "files") {
        return files
            .map((filePath) => ({
                kind: "file" as const,
                id: filePath,
                label: filePath.split("/").pop() || filePath,
                description: filePath,
                badge: "context",
            }))
            .filter((item) => matchesQuery(`${item.label} ${item.description}`))
            .sort((a, b) => a.label.localeCompare(b.label));
    }
    return agents
        .map((agent) => ({
            kind: "agent" as const,
            id: agent.backend,
            label: agent.name,
            description: agent.description,
            badge: agent.available ? "runtime" : "setup",
            available: agent.available,
        }))
        .filter((item) => matchesQuery(`${item.label} ${item.description ?? ""}`))
        .sort((a, b) => Number(Boolean(b.available)) - Number(Boolean(a.available)) || a.label.localeCompare(b.label));
}

type ComposerAutocompleteProps = {
    mode: AcpComposerMenuMode;
    mentionTab: AcpMentionTab;
    suggestions: AcpComposerSuggestion[];
    selectedIndex: number;
    onSelect: (suggestion: AcpComposerSuggestion) => void;
    onSelectedIndexChange: (index: number) => void;
    onMentionTabChange: (tab: AcpMentionTab) => void;
};

export const ComposerAutocomplete = memo(
    ({
        mode,
        mentionTab,
        suggestions,
        selectedIndex,
        onSelect,
        onSelectedIndexChange,
        onMentionTabChange,
    }: ComposerAutocompleteProps) => (
        <div
            className="absolute bottom-full left-0 z-40 mb-2 flex max-h-64 w-full max-w-[450px] flex-col overflow-hidden rounded-xl border border-[#302f2d] bg-[#171717] shadow-2xl shadow-black/60"
            role="listbox"
            aria-label={mode === "mentions" ? "Agent and file suggestions" : `${mode} suggestions`}
        >
            {mode === "mentions" ? (
                <div className="flex gap-1 border-b border-[#302f2d] p-2">
                    {(["agents", "files"] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                onMentionTabChange(tab);
                            }}
                            onClick={() => onMentionTabChange(tab)}
                            className={cn(
                                "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                                mentionTab === tab
                                    ? "bg-[#302e28] text-[#ebe7e0]"
                                    : "text-[#8f8a83] hover:bg-[#22211f] hover:text-[#ddd9d2]"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            ) : null}
            <div className="min-h-0 overflow-y-auto p-1.5">
                {suggestions.length ? (
                    suggestions.map((suggestion, index) => (
                        <button
                            key={`${suggestion.kind}-${suggestion.id}`}
                            type="button"
                            disabled={suggestion.available === false}
                            onMouseEnter={() => onSelectedIndexChange(index)}
                            onClick={() => onSelect(suggestion)}
                            className={cn(
                                "flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-45",
                                index === selectedIndex
                                    ? "bg-[#29271f] text-[#ebe7e0]"
                                    : "text-[#c6c1ba] hover:bg-[#211f1d]"
                            )}
                            role="option"
                            aria-selected={index === selectedIndex}
                        >
                            <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold text-[#a6ad55]">
                                {suggestion.kind === "file" ? "@" : suggestion.kind === "agent" ? "@" : "/"}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 text-xs font-semibold">
                                    <span className="truncate">{suggestion.label}</span>
                                    {suggestion.badge ? (
                                        <span className="shrink-0 rounded border border-[#36332f] bg-[#201f1d] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#827f79]">
                                            {suggestion.badge}
                                        </span>
                                    ) : null}
                                </span>
                                {suggestion.description ? (
                                    <span className="mt-0.5 block truncate text-[11px] text-[#827f79]">
                                        {suggestion.description}
                                    </span>
                                ) : null}
                            </span>
                        </button>
                    ))
                ) : (
                    <div className="px-3 py-5 text-center text-xs text-[#827f79]">
                        No {mode === "mentions" ? mentionTab : mode} found
                    </div>
                )}
            </div>
            <div className="border-t border-[#302f2d] px-3 py-1.5 text-[10px] text-[#706b64]">
                Arrow keys navigate - Enter select - Esc close
            </div>
        </div>
    )
);

ComposerAutocomplete.displayName = "ComposerAutocomplete";

type WorkspaceFilesPanelProps = {
    activeWorkspace: string;
    workspaceDraft: string;
    files: string[];
    onClose: () => void;
    onWorkspaceChange: (workspace: string) => void;
    onPickWorkspace: () => void | Promise<void>;
    onApplyWorkspace: () => void | Promise<void>;
    onUseFocusedWorkspace: () => void | Promise<void>;
    onPickFiles: () => void | Promise<void>;
    onOpenGitTree: () => void | Promise<void>;
    onRemoveFile: (filePath: string) => void;
};

export const WorkspaceFilesPanel = memo(
    ({
        activeWorkspace,
        workspaceDraft,
        files,
        onClose,
        onWorkspaceChange,
        onPickWorkspace,
        onApplyWorkspace,
        onUseFocusedWorkspace,
        onPickFiles,
        onOpenGitTree,
        onRemoveFile,
    }: WorkspaceFilesPanelProps) => (
        <div className="absolute inset-y-12 left-0 z-30 flex w-[min(360px,100%)] flex-col border-r border-[#292827] bg-[#151515] shadow-2xl shadow-black/60">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#292827] px-4">
                <div className="text-sm font-semibold text-[#dedad4]">Workspace</div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#827f79] hover:bg-[#232220] hover:text-[#dedad4]"
                    aria-label="Close workspace and files"
                >
                    <i className="fa fa-xmark" />
                </button>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 text-xs">
                <section>
                    <h3 className="mb-1 font-semibold text-[#dedad4]">Session root</h3>
                    <p className="mb-3 leading-relaxed text-[#827f79]">
                        ACP tools run within this directory for new messages and sessions.
                    </p>
                    <input
                        value={workspaceDraft}
                        onChange={(event) => onWorkspaceChange(event.target.value)}
                        placeholder="Focused terminal directory"
                        className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 font-mono text-[11px] text-[#d8d4ce] outline-none placeholder:text-[#706b64] focus:border-[#5b4c3c]"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void onPickWorkspace()}
                            className="cursor-pointer rounded-md border border-[#302f2d] px-3 py-2 text-[#b8b3ac] hover:bg-[#22211f]"
                        >
                            Choose folder
                        </button>
                        <button
                            type="button"
                            onClick={() => void onApplyWorkspace()}
                            className="cursor-pointer rounded-md border border-[#444527] bg-[#242619] px-3 py-2 font-medium text-[#b1b955] hover:bg-[#2d301e]"
                        >
                            Apply
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => void onUseFocusedWorkspace()}
                        className="mt-3 cursor-pointer text-[#a29d95] hover:text-[#dedad4]"
                    >
                        Use focused terminal directory
                    </button>
                    <div className="mt-3 truncate rounded-md border border-[#292827] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#8f8a83]">
                        {activeWorkspace || "Focused terminal directory"}
                    </div>
                </section>
                <section className="border-t border-[#292827] pt-5">
                    <div className="mb-4 rounded-lg border border-[#302f2d] bg-[#101010] p-3">
                        <div className="mb-1 font-semibold text-[#dedad4]">Project widgets</div>
                        <p className="mb-3 leading-relaxed text-[#827f79]">
                            Open the selected session root as a live file and Git tree block.
                        </p>
                        <button
                            type="button"
                            onClick={() => void onOpenGitTree()}
                            className="flex w-full cursor-pointer items-center justify-between rounded-md border border-[#444527] bg-[#242619] px-3 py-2.5 font-medium text-[#b1b955] hover:bg-[#2d301e]"
                        >
                            <span className="flex items-center gap-2">
                                <i className="fa fa-code-branch" />
                                Open Git Tree widget
                            </span>
                            <i className="fa fa-arrow-up-right-from-square text-[10px]" />
                        </button>
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-[#dedad4]">Files</h3>
                            <p className="mt-1 text-[#827f79]">Reference files in your next message.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void onPickFiles()}
                            className="cursor-pointer rounded-md border border-[#302f2d] px-3 py-2 text-[#b8b3ac] hover:bg-[#22211f]"
                        >
                            Add
                        </button>
                    </div>
                    {files.length ? (
                        <div className="space-y-2">
                            {files.map((filePath) => (
                                <div
                                    key={filePath}
                                    className="flex items-center gap-2 rounded-md border border-[#292827] bg-[#101010] px-2.5 py-2"
                                >
                                    <i className="fa fa-file text-[#827f79]" />
                                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#b8b3ac]">
                                        {filePath}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveFile(filePath)}
                                        className="cursor-pointer text-[#827f79] hover:text-[#dedad4]"
                                        aria-label={`Remove ${filePath}`}
                                    >
                                        <i className="fa fa-xmark" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-[#302f2d] px-3 py-5 text-center text-[#706b64]">
                            No files referenced.
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
);

WorkspaceFilesPanel.displayName = "WorkspaceFilesPanel";

type SessionSidebarProps = {
    sessions: AcpRuntimeRecord[];
    activeConversationId: string;
    onSelectSession: (conversationId: string) => void;
    onCloseSession: (conversationId: string) => void | Promise<void>;
    onNewChat: (workspace?: string) => void | Promise<void>;
    onOpenSettings: () => void;
};

function formatWorkspaceName(workspace: string): string {
    if (!workspace) {
        return "Focused workspace";
    }
    return workspace.split("/").filter(Boolean).pop() ?? workspace;
}

function getRuntimeTone(status: string): string {
    if (status === "running") {
        return "bg-[#b4bd54]";
    }
    if (status === "error") {
        return "bg-[#db6c60]";
    }
    return "bg-[#77736d]";
}

export const SessionSidebar = memo(
    ({
        sessions,
        activeConversationId,
        onSelectSession,
        onCloseSession,
        onNewChat,
        onOpenSettings,
    }: SessionSidebarProps) => {
        const grouped = useMemo(() => {
            const groups = new Map<string, AcpRuntimeRecord[]>();
            sessions
                .filter((session) => session.resumeState !== "archived")
                .forEach((session) => {
                    const key = session.workspace || "Focused workspace";
                    groups.set(key, [...(groups.get(key) ?? []), session]);
                });
            return Array.from(groups.entries());
        }, [sessions]);

        return (
            <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-[#292827] bg-[#151515]">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#292827] px-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#dedad4]">
                        <AcpAgentMark backend="kronoscode" className="h-6 w-6" />
                        Kronterm
                    </div>
                    <button
                        type="button"
                        onClick={() => void onNewChat()}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9a968f] hover:bg-[#22211f] hover:text-[#e4e0da]"
                        aria-label="New session"
                    >
                        <i className="fa fa-plus" />
                    </button>
                </div>
                <div className="flex items-center gap-4 border-b border-[#292827] px-4 py-3 text-[#817d76]">
                    <i className="fa fa-diagram-project" />
                    <i className="fa fa-code-branch" />
                    <i className="fa fa-file-code" />
                    <i className="fa fa-folder-tree" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-4">
                    {grouped.length ? (
                        grouped.map(([workspace, runtimeSessions]) => (
                            <section key={workspace} className="mb-5">
                                <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold text-[#b8b3ac]">
                                    <span className="min-w-0 truncate">
                                        <i className="fa fa-code-branch mr-2 text-[10px] text-[#827f79]" />
                                        {formatWorkspaceName(workspace)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void onNewChat(workspace === "Focused workspace" ? "" : workspace)}
                                        className="cursor-pointer px-1 text-[#827f79] hover:text-[#dedad4]"
                                        aria-label={`New session in ${formatWorkspaceName(workspace)}`}
                                    >
                                        <i className="fa fa-plus" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {runtimeSessions.map((session) => (
                                        <div
                                            key={session.conversationId}
                                            className={cn(
                                                "group flex items-center gap-1 rounded-md px-1 py-1",
                                                session.conversationId === activeConversationId
                                                    ? "bg-[#3a3937]"
                                                    : "hover:bg-[#232220]"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => onSelectSession(session.conversationId)}
                                                className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left"
                                            >
                                                <AcpAgentMark backend={session.backend ?? "custom"} className="mt-0.5 h-5 w-5" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs font-medium text-[#ddd9d2]">
                                                        {session.title}
                                                    </span>
                                                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#827f79]">
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", getRuntimeTone(session.status))} />
                                                        {session.agentName}
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void onCloseSession(session.conversationId)}
                                                className="cursor-pointer rounded p-1 text-[#706b64] opacity-0 hover:text-[#dc7668] group-hover:opacity-100"
                                                aria-label={`Close ${session.title}`}
                                            >
                                                <i className="fa fa-xmark text-[10px]" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))
                    ) : (
                        <div className="rounded-lg border border-dashed border-[#302f2d] p-4 text-center text-xs text-[#827f79]">
                            No ACP sessions yet.
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex h-12 shrink-0 cursor-pointer items-center gap-3 border-t border-[#292827] px-4 text-sm font-medium text-[#9b968e] hover:bg-[#201f1d] hover:text-[#dedad4]"
                >
                    <i className="fa fa-gear" />
                    Settings
                </button>
            </aside>
        );
    }
);

SessionSidebar.displayName = "SessionSidebar";

type SettingsPanelProps = {
    agents: AcpBackendInfo[];
    selectedAgent: AcpBackendInfo | null;
    sessions: AcpRuntimeRecord[];
    activeConversationId: string;
    profiles: Record<string, AcpAgentProfile>;
    agentDefinitions: Record<string, ACPAgentDefinition>;
    commands: Record<string, ACPCommandDefinition>;
    skills: Record<string, ACPSkillDefinition>;
    gitIdentities: Record<string, ACPGitIdentity>;
    mcpEnabled: boolean;
    mcpServers: Record<string, unknown>;
    onClose: () => void;
    onSelectAgent: (agent: AcpBackendInfo) => void | Promise<void>;
    onSetMode: (backend: string, mode: string) => void | Promise<void>;
    onSetConfigOption: (backend: string, id: string, value: string) => void | Promise<void>;
    onSetModel: (backend: string, modelId: string) => void | Promise<void>;
    onSelectSession: (conversationId: string) => void;
    onCloseSession: (conversationId: string) => void | Promise<void>;
    onUpdateProfile: (backend: string, patch: Partial<AcpAgentProfile>) => void;
    onSaveAgentDefinition: (id: string, definition: ACPAgentDefinition) => void;
    onSaveCommand: (id: string, command: ACPCommandDefinition) => void;
    onSaveSkill: (id: string, skill: ACPSkillDefinition) => void;
    onSaveGitIdentity: (id: string, identity: ACPGitIdentity) => void;
    onApplyGitIdentity: (identity: ACPGitIdentity) => void | Promise<void>;
    onSetMcpEnabled: (enabled: boolean) => void;
    onOpenWorkspace: () => void;
    onOpenGitTree: () => void | Promise<void>;
    onOpenNativeConfig: () => void;
    onApplyProfileToLiveSessions: (backend: string) => void | Promise<void>;
    onRestartBackendSessions: (backend: string) => void | Promise<void>;
    restartRequiredBackends: Set<string>;
};

type SettingsSection = "defaults" | "runtimes" | "agents" | "commands" | "models" | "mcp" | "skills" | "usage" | "gitidentities" | "workspace";

type SettingsTab = "kronterm" | "agents" | "commands" | "skills" | "mcp" | "providers" | "usage" | "gitidentities";

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: string; sections: SettingsSection[] }> = [
    { id: "kronterm", label: "Kronterm", icon: "fa-gear", sections: ["defaults", "runtimes", "workspace"] },
    { id: "agents", label: "Agents", icon: "fa-robot", sections: ["agents"] },
    { id: "commands", label: "Commands", icon: "fa-terminal", sections: ["commands"] },
    { id: "skills", label: "Skills", icon: "fa-book", sections: ["skills"] },
    { id: "mcp", label: "MCP", icon: "fa-plug", sections: ["mcp"] },
    { id: "providers", label: "Providers", icon: "fa-layer-group", sections: ["models"] },
    { id: "usage", label: "Usage", icon: "fa-chart-line", sections: ["usage"] },
    { id: "gitidentities", label: "Git Identities", icon: "fa-code-branch", sections: ["gitidentities"] },
];

const settingsSections: Record<SettingsSection, { label: string; icon: string; description: string }> = {
    defaults: { label: "Chat Defaults", icon: "fa-message", description: "Agent, model, workspace" },
    runtimes: { label: "Sessions", icon: "fa-layer-group", description: "Open and saved runtimes" },
    agents: { label: "Agent Profiles", icon: "fa-robot", description: "Defaults and capabilities" },
    commands: { label: "Commands", icon: "fa-terminal", description: "Prompt templates" },
    models: { label: "Models", icon: "fa-cubes", description: "Providers and catalogs" },
    mcp: { label: "MCP Servers", icon: "fa-plug", description: "Runtime integrations" },
    skills: { label: "Skills", icon: "fa-book", description: "Instruction locations" },
    usage: { label: "Usage", icon: "fa-chart-line", description: "Runtime-reported usage" },
    gitidentities: { label: "Git Identities", icon: "fa-code-branch", description: "Project author profile" },
    workspace: { label: "Workspace & Files", icon: "fa-folder-open", description: "Context and attachments" },
};

export const SettingsPanel = memo(
    ({
        agents,
        selectedAgent,
        sessions,
        activeConversationId,
        profiles,
        agentDefinitions,
        commands,
        skills,
        gitIdentities,
        mcpEnabled,
        mcpServers,
        onClose,
        onSelectAgent,
        onSetMode,
        onSetConfigOption,
        onSetModel,
        onSelectSession,
        onCloseSession,
        onUpdateProfile,
        onSaveAgentDefinition,
        onSaveCommand,
        onSaveSkill,
        onSaveGitIdentity,
        onApplyGitIdentity,
        onSetMcpEnabled,
        onOpenWorkspace,
        onOpenGitTree,
        onOpenNativeConfig,
        onApplyProfileToLiveSessions,
        onRestartBackendSessions,
        restartRequiredBackends,
    }: SettingsPanelProps) => {
        const [activeTab, setActiveTab] = useState<SettingsTab>("kronterm");
        const [section, setSection] = useState<SettingsSection>("defaults");
        const profile = profiles[selectedAgent?.backend ?? "kronoscode"] ?? {};
        const activeSession = sessions.find((session) => session.conversationId === activeConversationId);
        const liveSessions = sessions.filter((session) => session.resumeState !== "archived");
        const backend = selectedAgent?.backend ?? "kronoscode";
        const backendLiveSessions = liveSessions.filter((session) => session.backend === backend);
        const targetRuntime =
            (activeSession?.backend === backend && activeSession.isLive ? activeSession : null) ??
            backendLiveSessions.find((session) => session.isLive) ??
            backendLiveSessions[0];
        const modeOptions = targetRuntime?.modes?.availableModes?.length
            ? targetRuntime.modes.availableModes.map((mode) => ({ value: mode.id, label: mode.name ?? mode.id }))
            : [{ value: "default", label: "Auto" }];
        const selectedMode = modeOptions.some((mode) => mode.value === targetRuntime?.currentMode)
            ? targetRuntime?.currentMode ?? modeOptions[0].value
            : profile.mode ?? modeOptions[0].value;
        const configOptions = (targetRuntime?.configOptions ?? []).filter(
            (option) => option.type === "select" && option.options?.length && option.category !== "mode"
        );
        const activeTabConfig = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];
        const [skillDirDraft, setSkillDirDraft] = useState("");
        const [agentDraft, setAgentDraft] = useState<ACPAgentDefinition>({});
        const [commandDraft, setCommandDraft] = useState<ACPCommandDefinition>({});
        const [skillDraft, setSkillDraft] = useState<ACPSkillDefinition>({});
        const [gitIdentityDraft, setGitIdentityDraft] = useState<ACPGitIdentity>({});
        const fieldSuffix = backend.replace(/[^a-z0-9_-]/gi, "-");

        useEffect(() => {
            setSkillDirDraft("");
            setAgentDraft(
                agentDefinitions[backend] ?? {
                    name: selectedAgent?.name ?? backend,
                    backend,
                    scope: "project",
                    mode: "primary",
                    model: profile.model ?? "",
                }
            );
        }, [backend]);

        useEffect(() => {
            const firstCommand = Object.values(commands)[0];
            setCommandDraft(firstCommand ?? { name: "new-command", scope: "project", agent: backend });
        }, [backend, commands]);

        useEffect(() => {
            const firstSkill = Object.values(skills)[0];
            setSkillDraft(firstSkill ?? { name: "new-skill", scope: "project", backend });
        }, [backend, skills]);

        useEffect(() => {
            const firstIdentity = Object.values(gitIdentities)[0];
            setGitIdentityDraft(firstIdentity ?? { id: "new-profile", authtype: "ssh", color: "keyword", icon: "branch" });
        }, [gitIdentities]);

        const selectTab = (tab: (typeof settingsTabs)[number]) => {
            setActiveTab(tab.id);
            setSection(tab.sections[0]);
        };

        return (
        <div className="absolute inset-3 z-30 flex flex-col overflow-hidden rounded-xl border border-[#302f2d] bg-[#111111] shadow-2xl shadow-black/70">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#292827] px-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#dedad4]">
                    <i className="fa fa-sliders text-xs text-[#827f79]" />
                    Kronterm Settings
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#827f79] hover:bg-[#232220] hover:text-[#dedad4]"
                    aria-label="Close settings"
                >
                    <i className="fa fa-xmark" />
                </button>
            </div>
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#292827] px-3 py-2">
                {settingsTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectTab(tab)}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold",
                            tab.id === activeTab
                                ? "bg-[#302f2d] text-[#dedad4]"
                                : "text-[#8f8a83] hover:bg-[#201f1d] hover:text-[#dedad4]"
                        )}
                    >
                        <i className={cn("fa", tab.icon)} />
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="flex min-h-0 flex-1">
                <nav className="w-52 shrink-0 space-y-1 border-r border-[#292827] bg-[#171717] p-3">
                    {activeTabConfig.sections.map((sectionId) => {
                        const item = settingsSections[sectionId];
                        return (
                        <button
                            key={sectionId}
                            type="button"
                            onClick={() => setSection(sectionId)}
                            className={cn(
                                "flex w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2.5 text-left text-xs",
                                sectionId === section
                                    ? "bg-[#302f2d] text-[#ebe7e0]"
                                    : "text-[#8e8a84] hover:bg-[#201f1d] hover:text-[#d4d0c9]"
                            )}
                        >
                            <i className={cn("fa mt-0.5 w-4", item.icon)} />
                            <span>
                                <span className="block font-medium">{item.label}</span>
                                <span className="mt-0.5 block text-[10px] text-[#706b64]">{item.description}</span>
                            </span>
                        </button>
                        );
                    })}
                </nav>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-xs @lg:p-6">
                {section === "defaults" ? (
                    <section>
                        <div className="mb-2 text-sm font-semibold text-[#dedad4]">New chat defaults</div>
                        <p className="mb-4 leading-relaxed text-[#827f79]">
                            KronosCode is the primary agent. External agent values are applied only when their active
                            ACP runtime advertises matching controls.
                        </p>
                        <label htmlFor={`acp-default-model-${fieldSuffix}`} className="mb-3 block">
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">Default model for {selectedAgent?.name}</span>
                            <input
                                id={`acp-default-model-${fieldSuffix}`}
                                value={profile.model ?? ""}
                                onChange={(event) => onUpdateProfile(selectedAgent?.backend ?? "kronoscode", { model: event.target.value })}
                                placeholder="Runtime default"
                                className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            />
                        </label>
                        <label htmlFor={`acp-default-mode-${fieldSuffix}`} className="mb-3 block">
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">Default mode</span>
                            <select
                                id={`acp-default-mode-${fieldSuffix}`}
                                aria-label="Default mode"
                                value={profile.mode ?? selectedMode}
                                onChange={(event) => onUpdateProfile(selectedAgent?.backend ?? "kronoscode", { mode: event.target.value })}
                                className="h-9 w-full cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            >
                                {modeOptions.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                            </select>
                        </label>
                        <label htmlFor={`acp-default-workspace-${fieldSuffix}`} className="block">
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">Default workspace</span>
                            <input
                                id={`acp-default-workspace-${fieldSuffix}`}
                                value={profile.workspace ?? ""}
                                onChange={(event) => onUpdateProfile(selectedAgent?.backend ?? "kronoscode", { workspace: event.target.value })}
                                placeholder="Focused terminal directory"
                                className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 font-mono text-[11px] text-[#dedad4] outline-none"
                            />
                        </label>
                        <div className="mt-5 rounded-lg border border-[#292827] bg-[#171717] p-3">
                            <div className="font-medium text-[#dedad4]">Apply to open {selectedAgent?.name ?? "agent"} sessions</div>
                            <p className="mt-1 leading-relaxed text-[#827f79]">
                                Model, mode, and advertised controls update immediately across {backendLiveSessions.length} compatible runtime{backendLiveSessions.length === 1 ? "" : "s"}.
                            </p>
                            <button
                                type="button"
                                onClick={() => void onApplyProfileToLiveSessions(backend)}
                                disabled={!backendLiveSessions.length}
                                className="mt-3 cursor-pointer rounded-md border border-[#444527] bg-[#242619] px-3 py-2 font-medium text-[#b1b955] hover:bg-[#2d301e] disabled:opacity-40"
                            >
                                Apply live-compatible defaults
                            </button>
                        </div>
                    </section>
                ) : null}
                {section === "runtimes" ? (
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-semibold text-[#dedad4]">Sessions</span>
                            <span className="text-[#827f79]">{liveSessions.length} open</span>
                        </div>
                        <div className="space-y-2">
                            {sessions.length ? sessions.map((session) => (
                                <div key={session.conversationId} className="flex items-center gap-2 rounded-lg border border-[#292827] bg-[#101010] p-2">
                                    <button
                                        type="button"
                                        onClick={() => onSelectSession(session.conversationId)}
                                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                                    >
                                        <AcpAgentMark backend={session.backend ?? "custom"} className="h-7 w-7" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium text-[#dedad4]">{session.title}</span>
                                            <span className="block truncate text-[#827f79]">{session.agentName} / {session.status}</span>
                                        </span>
                                    </button>
                                    {session.resumeState !== "archived" ? (
                                        <button type="button" onClick={() => void onCloseSession(session.conversationId)} className="cursor-pointer rounded p-2 text-[#827f79] hover:bg-[#231d19] hover:text-[#dc7668]" aria-label="Close runtime">
                                            <i className="fa fa-xmark" />
                                        </button>
                                    ) : null}
                                </div>
                            )) : <p className="text-[#827f79]">No stored ACP sessions.</p>}
                        </div>
                        {restartRequiredBackends.has(backend) && backendLiveSessions.length ? (
                            <div className="mt-4 rounded-lg border border-[#554425] bg-[#221c14] p-3 text-[#cdb57b]">
                                <div className="font-medium">Restart required for {selectedAgent?.name}</div>
                                <p className="mt-1 text-[#a99062]">
                                    Workspace, executable, or MCP configuration changed. ACP accepts these settings at session start.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void onRestartBackendSessions(backend)}
                                    className="mt-3 cursor-pointer rounded-md border border-[#665333] px-3 py-2 font-medium hover:bg-[#2c251a]"
                                >
                                    Restart {backendLiveSessions.length} open runtime{backendLiveSessions.length === 1 ? "" : "s"} with saved context
                                </button>
                            </div>
                        ) : null}
                    </section>
                ) : null}
                {section === "agents" ? (
                <section>
                    <div className="mb-3 text-sm font-semibold text-[#dedad4]">
                        Installed agents
                    </div>
                    <div className="space-y-2">
                        {agents.map((agent) => (
                            <button
                                key={agent.backend}
                                type="button"
                                onClick={() => void onSelectAgent(agent)}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                    agent.backend === selectedAgent?.backend
                                        ? "border-[#444527] bg-[#222419]"
                                        : "border-[#292827] bg-[#101010] hover:bg-[#1f1e1c]"
                                )}
                            >
                                <AcpAgentMark backend={agent.backend} className="h-7 w-7" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium text-[#dedad4]">{agent.name}</span>
                                    <span className="block truncate text-[#827f79]">
                                        {agent.description ?? agent.cliPath}
                                    </span>
                                </span>
                                <span
                                    className={cn(
                                        "rounded-full px-2 py-1 text-[10px]",
                                        agent.available ? "bg-[#242619] text-[#b1b955]" : "bg-[#221b19] text-[#b67c70]"
                                    )}
                                >
                                    {agent.available ? "Ready" : "Missing"}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-5 border-t border-[#292827] pt-5">
                        <div className="mb-1 text-sm font-semibold text-[#dedad4]">{selectedAgent?.name ?? "Agent"} profile</div>
                        <p className="mb-4 text-[#827f79]">
                            Saved defaults are scoped to this runtime backend and applied only where ACP exposes compatible controls.
                        </p>
                        <label htmlFor={`acp-executable-${fieldSuffix}`} className="mb-3 block">
                            <span className="mb-1.5 block text-[#b8b3ac]">Executable override</span>
                            <input
                                id={`acp-executable-${fieldSuffix}`}
                                value={profile.executable ?? ""}
                                onChange={(event) => onUpdateProfile(backend, { executable: event.target.value })}
                                placeholder={selectedAgent?.cliPath || "Use detected executable"}
                                className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 font-mono text-[11px] text-[#dedad4] outline-none"
                            />
                        </label>
                        <div className="flex items-center justify-between rounded-lg border border-[#292827] bg-[#101010] p-3">
                            <span className="text-[#827f79]">{backendLiveSessions.length} open runtime{backendLiveSessions.length === 1 ? "" : "s"}</span>
                            <button
                                type="button"
                                onClick={() => void onApplyProfileToLiveSessions(backend)}
                                disabled={!backendLiveSessions.length}
                                className="cursor-pointer rounded-md border border-[#444527] bg-[#242619] px-3 py-2 font-medium text-[#b1b955] hover:bg-[#2d301e] disabled:opacity-40"
                            >
                                Apply controls
                            </button>
                        </div>
                    </div>
                    <div className="mt-5 border-t border-[#292827] pt-5">
                        <div className="mb-1 text-sm font-semibold text-[#dedad4]">Agent configuration</div>
                        <p className="mb-4 text-[#827f79]">
                            Save a Kronterm agent definition and publish its model default to compatible ACP runtimes. Runtime modes remain configured under Providers.
                        </p>
                        <label className="mb-3 block">
                            <span className="mb-1.5 block text-[#b8b3ac]">Description</span>
                            <textarea
                                value={agentDraft.description ?? ""}
                                onChange={(event) => setAgentDraft((draft) => ({ ...draft, description: event.target.value }))}
                                placeholder="What does this agent do?"
                                rows={3}
                                className="w-full resize-none rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 text-[#dedad4] outline-none"
                            />
                        </label>
                        <div className="mb-3 flex flex-wrap gap-2">
                            {["primary", "subagent", "all"].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setAgentDraft((draft) => ({ ...draft, mode }))}
                                    className={cn(
                                        "cursor-pointer rounded-md border px-3 py-2 capitalize",
                                        agentDraft.mode === mode
                                            ? "border-[#67509d] bg-[#302447] text-[#c7a9ff]"
                                            : "border-[#302f2d] text-[#b8b3ac] hover:bg-[#22211f]"
                                    )}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-3">
                            <label>
                                <span className="mb-1.5 block text-[#b8b3ac]">Model</span>
                                <input
                                    value={agentDraft.model ?? ""}
                                    onChange={(event) => setAgentDraft((draft) => ({ ...draft, model: event.target.value }))}
                                    placeholder="Runtime default"
                                    className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-[#b8b3ac]">Scope</span>
                                <select
                                    value={agentDraft.scope ?? "project"}
                                    onChange={(event) => setAgentDraft((draft) => ({ ...draft, scope: event.target.value }))}
                                    className="h-9 w-full cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                                >
                                    <option value="user">User</option>
                                    <option value="project">Project</option>
                                </select>
                            </label>
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-3">
                            <label>
                                <span className="mb-1.5 block text-[#b8b3ac]">Temperature</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={agentDraft.temperature ?? ""}
                                    onChange={(event) =>
                                        setAgentDraft((draft) => ({
                                            ...draft,
                                            temperature: event.target.value ? Number(event.target.value) : undefined,
                                        }))
                                    }
                                    placeholder="Runtime managed"
                                    className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-[#b8b3ac]">Top P</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={agentDraft.topp ?? ""}
                                    onChange={(event) =>
                                        setAgentDraft((draft) => ({
                                            ...draft,
                                            topp: event.target.value ? Number(event.target.value) : undefined,
                                        }))
                                    }
                                    placeholder="Runtime managed"
                                    className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                                />
                            </label>
                        </div>
                        <p className="mb-3 leading-relaxed text-[#827f79]">
                            System prompts apply to submitted tasks. Generation parameters remain saved metadata unless the runtime provides matching ACP controls.
                        </p>
                        <label className="mb-3 block">
                            <span className="mb-1.5 block text-[#b8b3ac]">System prompt</span>
                            <textarea
                                value={agentDraft.systemprompt ?? ""}
                                onChange={(event) => setAgentDraft((draft) => ({ ...draft, systemprompt: event.target.value }))}
                                placeholder="Custom system prompt for this agent..."
                                rows={5}
                                className="w-full resize-y rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#dedad4] outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                onSaveAgentDefinition(backend, { ...agentDraft, backend, name: agentDraft.name || selectedAgent?.name || backend });
                                onUpdateProfile(backend, { model: agentDraft.model });
                                void onApplyProfileToLiveSessions(backend);
                            }}
                            className="cursor-pointer rounded-md border border-[#67509d] bg-[#302447] px-4 py-2 font-medium text-[#d3b9ff] hover:bg-[#3b2b55]"
                        >
                            Save agent configuration
                        </button>
                    </div>
                </section>) : null}
                {section === "commands" ? (
                <section>
                    <div className="mb-1 text-sm font-semibold text-[#dedad4]">New Command</div>
                    <p className="mb-5 text-[#827f79]">Create reusable slash-command templates available in the chat composer.</p>
                    <label className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Command Name & Scope</span>
                        <div className="flex gap-2">
                            <div className="flex min-w-0 flex-1 items-center rounded-md border border-[#302f2d] bg-[#101010] px-3">
                                <span className="mr-1 text-[#827f79]">/</span>
                                <input
                                    value={commandDraft.name ?? ""}
                                    onChange={(event) => setCommandDraft((draft) => ({ ...draft, name: event.target.value }))}
                                    placeholder="new-command"
                                    className="h-9 min-w-0 flex-1 bg-transparent text-[#dedad4] outline-none"
                                />
                            </div>
                            <select
                                value={commandDraft.scope ?? "project"}
                                onChange={(event) => setCommandDraft((draft) => ({ ...draft, scope: event.target.value }))}
                                className="h-9 cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            >
                                <option value="user">User</option>
                                <option value="project">Project</option>
                            </select>
                        </div>
                    </label>
                    <label className="mb-4 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Description</span>
                        <textarea
                            value={commandDraft.description ?? ""}
                            onChange={(event) => setCommandDraft((draft) => ({ ...draft, description: event.target.value }))}
                            placeholder="What does this command do?"
                            rows={3}
                            className="w-full resize-none rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 text-[#dedad4] outline-none"
                        />
                    </label>
                    <div className="mb-4 grid grid-cols-2 gap-3">
                        <label>
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">Agent</span>
                            <select
                                value={commandDraft.agent ?? backend}
                                onChange={(event) => setCommandDraft((draft) => ({ ...draft, agent: event.target.value }))}
                                className="h-9 w-full cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            >
                                {agents.map((agent) => <option key={agent.backend} value={agent.backend}>{agent.name}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">Model</span>
                            <input
                                value={commandDraft.model ?? ""}
                                onChange={(event) => setCommandDraft((draft) => ({ ...draft, model: event.target.value }))}
                                placeholder="Runtime default"
                                className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            />
                        </label>
                    </div>
                    <label className="mb-4 flex cursor-pointer items-center gap-2 text-[#b8b3ac]">
                        <input
                            type="checkbox"
                            checked={Boolean(commandDraft.subtask)}
                            onChange={(event) => setCommandDraft((draft) => ({ ...draft, subtask: event.target.checked }))}
                            className="cursor-pointer"
                        />
                        Force subagent invocation
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Command Template</span>
                        <textarea
                            value={commandDraft.template ?? ""}
                            onChange={(event) => setCommandDraft((draft) => ({ ...draft, template: event.target.value }))}
                            placeholder={"Your command template here...\n\nUse $ARGUMENTS to reference user input."}
                            rows={8}
                            className="w-full resize-y rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#dedad4] outline-none"
                        />
                    </label>
                    <button
                        type="button"
                        disabled={!commandDraft.name?.trim() || !commandDraft.template?.trim()}
                        onClick={() => {
                            const id = commandDraft.name?.trim().replace(/\s+/g, "-") ?? "";
                            onSaveCommand(id, { ...commandDraft, name: id });
                        }}
                        className="mt-4 cursor-pointer rounded-md border border-[#67509d] bg-[#302447] px-4 py-2 font-medium text-[#d3b9ff] hover:bg-[#3b2b55] disabled:opacity-40"
                    >
                        Save command
                    </button>
                </section>) : null}
                {section === "models" ? (
                <section>
                    <div className="mb-2 text-sm font-semibold text-[#dedad4]">Providers & Models</div>
                    <p className="mb-4 text-[#827f79]">
                        {selectedAgent?.backend === "kronoscode"
                            ? "The runtime catalog is shown below. Persistent KronosCode provider settings are edited in its native configuration."
                            : "This catalog is supplied by the active ACP runtime and does not modify the external CLI configuration."}
                    </p>
                    {selectedAgent?.backend === "kronoscode" ? (
                        <button
                            type="button"
                            onClick={onOpenNativeConfig}
                            className="mb-4 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#444527] bg-[#242619] px-3 py-3 font-medium text-[#b1b955] hover:bg-[#2d301e]"
                        >
                            <span>Open KronosCode native configuration</span>
                            <i className="fa fa-arrow-up-right-from-square text-[10px]" />
                        </button>
                    ) : null}
                    <div className="mb-4 rounded-md border border-[#292827] bg-[#101010] p-3">
                        <span className="text-[#827f79]">Current model</span>
                        <div className="mt-2">
                            <ModelPicker
                                modelInfo={targetRuntime?.modelInfo ?? null}
                                onSelect={(modelId) => onSetModel(backend, modelId)}
                            />
                        </div>
                        <div className="mt-2 text-[#827f79]">
                            {targetRuntime?.modelInfo?.availableModels?.length ?? 0} runtime-advertised models
                        </div>
                    </div>
                    <label htmlFor={`acp-runtime-mode-${fieldSuffix}`} className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Mode</span>
                        <select
                            id={`acp-runtime-mode-${fieldSuffix}`}
                            aria-label={`Runtime mode for ${selectedAgent?.name ?? "agent"}`}
                            value={selectedMode}
                            onChange={(event) => void onSetMode(backend, event.target.value)}
                            className="h-9 w-full cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                        >
                            {modeOptions.map((mode) => (
                                <option key={mode.value} value={mode.value}>
                                    {mode.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {configOptions.map((option) => (
                        <label
                            key={option.id}
                            htmlFor={`acp-option-${fieldSuffix}-${option.id.replace(/[^a-z0-9_-]/gi, "-")}`}
                            className="mb-3 block"
                        >
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">
                                {option.name ?? option.label ?? option.id}
                            </span>
                            <select
                                id={`acp-option-${fieldSuffix}-${option.id.replace(/[^a-z0-9_-]/gi, "-")}`}
                                value={getConfigValue(option)}
                                onChange={(event) => void onSetConfigOption(backend, option.id, event.target.value)}
                                className="h-9 w-full cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            >
                                {option.options?.map((choice) => (
                                    <option key={choice.value} value={choice.value}>
                                        {choice.name ?? choice.label ?? choice.value}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ))}
                </section>) : null}
                {section === "mcp" ? (
                <section>
                    <div className="mb-2 text-sm font-semibold text-[#dedad4]">MCP servers</div>
                    <label className="mb-4 flex items-center justify-between rounded-md border border-[#292827] bg-[#101010] p-3">
                        <span>Enable Wave MCP configuration</span>
                        <input type="checkbox" checked={mcpEnabled} onChange={(event) => onSetMcpEnabled(event.target.checked)} className="cursor-pointer" />
                    </label>
                    <p className="mb-3 text-[#827f79]">
                        This runtime {targetRuntime?.capabilities?.mcpCapabilities?.stdio ? "accepts" : "does not advertise"} stdio MCP servers.
                    </p>
                    {Object.keys(mcpServers).length ? Object.keys(mcpServers).map((serverId) => (
                        <label key={serverId} className="mb-2 flex items-center justify-between rounded-md border border-[#292827] bg-[#101010] px-3 py-2 text-[#b8b3ac]">
                            <span>{serverId}</span>
                            <input
                                type="checkbox"
                                checked={(profile.mcpserverids ?? []).includes(serverId)}
                                disabled={Boolean(targetRuntime && !targetRuntime.capabilities?.mcpCapabilities?.stdio)}
                                onChange={(event) => {
                                    const nextServerIds = event.target.checked
                                        ? Array.from(new Set([...(profile.mcpserverids ?? []), serverId]))
                                        : (profile.mcpserverids ?? []).filter((id) => id !== serverId);
                                    onUpdateProfile(selectedAgent?.backend ?? "kronoscode", { mcpserverids: nextServerIds });
                                }}
                                className="cursor-pointer disabled:opacity-40"
                            />
                        </label>
                    )) : <p className="text-[#706b64]">No Wave MCP servers configured.</p>}
                    <div className="mt-5 rounded-lg border border-[#292827] bg-[#171717] p-3">
                        <div className="font-medium text-[#dedad4]">Runtime application</div>
                        <p className="mt-1 leading-relaxed text-[#827f79]">
                            Enabled servers are passed into new sessions only when {selectedAgent?.name ?? "this agent"} advertises stdio MCP support.
                        </p>
                        {restartRequiredBackends.has(backend) && backendLiveSessions.length ? (
                            <button
                                type="button"
                                onClick={() => void onRestartBackendSessions(backend)}
                                className="mt-3 cursor-pointer rounded-md border border-[#665333] bg-[#221c14] px-3 py-2 font-medium text-[#cdb57b] hover:bg-[#2c251a]"
                            >
                                Restart open runtimes with MCP selection
                            </button>
                        ) : null}
                    </div>
                </section>) : null}
                {section === "workspace" ? (
                <section>
                    <button
                        type="button"
                        onClick={onOpenWorkspace}
                        className="mt-1 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#302f2d] bg-[#101010] px-3 py-3 text-[#b8b3ac] hover:bg-[#1f1e1c]"
                    >
                        <span className="flex items-center gap-2">
                            <i className="fa fa-folder-open text-[#827f79]" />
                            Workspace and files
                        </span>
                        <i className="fa fa-chevron-right text-[10px] text-[#706b64]" />
                    </button>
                    <div className="mt-3 truncate rounded-md border border-[#292827] bg-[#101010] px-3 py-2 font-mono text-[#98938c]">
                        {activeSession?.workspace || "Focused terminal directory"}
                    </div>
                    <div className="mt-3 text-[#827f79]">{activeSession?.referencedFiles.length ?? 0} referenced files</div>
                    <button
                        type="button"
                        onClick={() => void onOpenGitTree()}
                        className="mt-5 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#444527] bg-[#242619] px-3 py-3 font-medium text-[#b1b955] hover:bg-[#2d301e]"
                    >
                        <span className="flex items-center gap-2">
                            <i className="fa fa-code-branch" />
                            Open Git Tree widget for this project
                        </span>
                        <i className="fa fa-arrow-up-right-from-square text-[10px]" />
                    </button>
                </section>) : null}
                {section === "skills" ? (
                <section>
                    <div className="mb-4 flex rounded-md border border-[#292827] bg-[#171717] p-1">
                        <span className="flex-1 rounded bg-[#272431] px-3 py-2 text-center font-medium text-[#dedad4]">Manual</span>
                        <span className="flex-1 px-3 py-2 text-center text-[#827f79]">External</span>
                    </div>
                    <div className="mb-2 text-sm font-semibold text-[#dedad4]">New Skill</div>
                    <label className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Skill Name & Location</span>
                        <div className="flex gap-2">
                            <input
                                value={skillDraft.name ?? ""}
                                onChange={(event) => setSkillDraft((draft) => ({ ...draft, name: event.target.value }))}
                                placeholder="new-skill"
                                className="h-9 min-w-0 flex-1 rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            />
                            <select
                                value={skillDraft.scope ?? "project"}
                                onChange={(event) => setSkillDraft((draft) => ({ ...draft, scope: event.target.value }))}
                                className="h-9 cursor-pointer rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                            >
                                <option value="user">User / KronosCode</option>
                                <option value="project">Project / KronosCode</option>
                            </select>
                        </div>
                    </label>
                    <label className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Description</span>
                        <textarea
                            value={skillDraft.description ?? ""}
                            onChange={(event) => setSkillDraft((draft) => ({ ...draft, description: event.target.value }))}
                            placeholder="Brief description of what this skill does..."
                            rows={2}
                            className="w-full resize-none rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 text-[#dedad4] outline-none"
                        />
                    </label>
                    <label className="mb-5 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Instructions</span>
                        <textarea
                            value={skillDraft.instructions ?? ""}
                            onChange={(event) => setSkillDraft((draft) => ({ ...draft, instructions: event.target.value }))}
                            rows={8}
                            className="w-full resize-y rounded-md border border-[#302f2d] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#dedad4] outline-none"
                        />
                        <button
                            type="button"
                            disabled={!skillDraft.name?.trim() || !skillDraft.instructions?.trim()}
                            onClick={() => {
                                const id = skillDraft.name?.trim().replace(/\s+/g, "-") ?? "";
                                onSaveSkill(id, { ...skillDraft, name: id, backend });
                            }}
                            className="mt-3 cursor-pointer rounded-md border border-[#67509d] bg-[#302447] px-4 py-2 font-medium text-[#d3b9ff] hover:bg-[#3b2b55] disabled:opacity-40"
                        >
                            Save skill
                        </button>
                    </label>
                    <div className="mb-2 border-t border-[#292827] pt-5 text-sm font-semibold text-[#dedad4]">{selectedAgent?.name ?? "Agent"} skill locations</div>
                    <p className="mb-4 text-[#827f79]">
                        These are the known native skill locations for this agent. ACP does not expose a portable live skill-directory control, so external runtimes use their CLI-managed skills.
                    </p>
                    {(profile.skillsdirs?.length ? profile.skillsdirs : selectedAgent?.skillsDirs?.length ? selectedAgent.skillsDirs : [".kronoscode/skills"]).map(
                        (directory) => (
                            <div
                                key={directory}
                                className="mb-2 flex items-center gap-2 rounded-md border border-[#292827] bg-[#101010] px-3 py-2.5 font-mono text-[#98938c]"
                            >
                                <i className="fa fa-book text-[#827f79]" />
                                <span className="min-w-0 flex-1 truncate">{directory}</span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onUpdateProfile(backend, {
                                            skillsdirs: (profile.skillsdirs ?? selectedAgent?.skillsDirs ?? []).filter(
                                                (current) => current !== directory
                                            ),
                                        })
                                    }
                                    className="cursor-pointer text-[#827f79] hover:text-[#dc7668]"
                                    aria-label={`Remove skill directory ${directory}`}
                                >
                                    <i className="fa fa-xmark" />
                                </button>
                            </div>
                        )
                    )}
                    <div className="mt-3 flex gap-2">
                        <input
                            aria-label={`Add skill directory for ${selectedAgent?.name ?? "agent"}`}
                            value={skillDirDraft}
                            onChange={(event) => setSkillDirDraft(event.target.value)}
                            placeholder=".kronterm/skills"
                            className="h-9 min-w-0 flex-1 rounded-md border border-[#302f2d] bg-[#101010] px-3 font-mono text-[11px] text-[#dedad4] outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const directory = skillDirDraft.trim();
                                if (!directory) {
                                    return;
                                }
                                onUpdateProfile(backend, {
                                    skillsdirs: Array.from(new Set([...(profile.skillsdirs ?? selectedAgent?.skillsDirs ?? []), directory])),
                                });
                                setSkillDirDraft("");
                            }}
                            className="cursor-pointer rounded-md border border-[#302f2d] px-3 py-2 text-[#b8b3ac] hover:bg-[#22211f]"
                        >
                            Add location
                        </button>
                    </div>
                </section>) : null}
                {section === "usage" ? (
                <section>
                    <div className="mb-2 text-sm font-semibold text-[#dedad4]">ACP Usage</div>
                    <p className="mb-4 text-[#827f79]">
                        Usage data is reported by live runtimes. Provider quota credentials remain managed by the provider, not stored in ACP profiles.
                    </p>
                    <div className="grid gap-2">
                        {agents.map((agent) => {
                            const runtime = sessions.find((session) => session.backend === agent.backend && session.isLive);
                            return (
                                <div key={agent.backend} className="rounded-md border border-[#292827] bg-[#101010] p-3">
                                    <div className="flex items-center gap-2">
                                        <AcpAgentMark backend={agent.backend} className="h-6 w-6" />
                                        <span className="font-medium text-[#dedad4]">{agent.name}</span>
                                        <span className="ml-auto text-[10px] uppercase text-[#827f79]">
                                            {runtime?.usage ? "Reporting" : "Not set"}
                                        </span>
                                    </div>
                                    <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-md border border-[#292827] bg-[#151515] p-2 font-mono text-[10px] text-[#98938c]">
                                        {runtime?.usage ? JSON.stringify(runtime.usage, null, 2) : "Start this runtime to receive advertised usage updates."}
                                    </pre>
                                </div>
                            );
                        })}
                    </div>
                </section>) : null}
                {section === "gitidentities" ? (
                <section>
                    <div className="mb-2 text-sm font-semibold text-[#dedad4]">New Git Profile</div>
                    <p className="mb-5 text-[#827f79]">Create an author identity and apply it to the active project repository.</p>
                    <label className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Display Name</span>
                        <input
                            value={gitIdentityDraft.name ?? ""}
                            onChange={(event) => setGitIdentityDraft((draft) => ({ ...draft, name: event.target.value }))}
                            placeholder="Work Profile, Personal, etc."
                            className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                        />
                    </label>
                    <div className="mb-4 flex gap-2">
                        {["keyword", "error", "string", "function", "type"].map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setGitIdentityDraft((draft) => ({ ...draft, color }))}
                                className={cn(
                                    "h-8 w-8 cursor-pointer rounded-md border",
                                    gitIdentityDraft.color === color ? "border-[#dedad4]" : "border-transparent",
                                    color === "keyword" && "bg-[#8b6cf0]",
                                    color === "error" && "bg-[#ed7272]",
                                    color === "string" && "bg-[#79e5c1]",
                                    color === "function" && "bg-[#a071ea]",
                                    color === "type" && "bg-[#edc383]"
                                )}
                                aria-label={`Use ${color} profile color`}
                            />
                        ))}
                    </div>
                    <label className="mb-3 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">User Name</span>
                        <input
                            value={gitIdentityDraft.username ?? ""}
                            onChange={(event) => setGitIdentityDraft((draft) => ({ ...draft, username: event.target.value }))}
                            placeholder="John Doe"
                            className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                        />
                    </label>
                    <label className="mb-4 block">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">User Email</span>
                        <input
                            value={gitIdentityDraft.useremail ?? ""}
                            onChange={(event) => setGitIdentityDraft((draft) => ({ ...draft, useremail: event.target.value }))}
                            placeholder="john@example.com"
                            className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 text-[#dedad4] outline-none"
                        />
                    </label>
                    <div className="mb-4">
                        <span className="mb-1.5 block font-medium text-[#b8b3ac]">Authentication Type</span>
                        <div className="flex gap-2">
                            {["ssh", "token"].map((authType) => (
                                <button
                                    key={authType}
                                    type="button"
                                    onClick={() => setGitIdentityDraft((draft) => ({ ...draft, authtype: authType }))}
                                    className={cn(
                                        "cursor-pointer rounded-md border px-3 py-2 capitalize",
                                        gitIdentityDraft.authtype === authType
                                            ? "border-[#67509d] bg-[#302447] text-[#d3b9ff]"
                                            : "border-[#302f2d] text-[#b8b3ac]"
                                    )}
                                >
                                    {authType === "ssh" ? "SSH Key" : "Token (HTTPS)"}
                                </button>
                            ))}
                        </div>
                    </div>
                    {gitIdentityDraft.authtype === "ssh" ? (
                        <label className="mb-4 block">
                            <span className="mb-1.5 block font-medium text-[#b8b3ac]">SSH Key Path</span>
                            <input
                                value={gitIdentityDraft.sshkey ?? ""}
                                onChange={(event) => setGitIdentityDraft((draft) => ({ ...draft, sshkey: event.target.value }))}
                                placeholder="~/.ssh/id_ed25519"
                                className="h-9 w-full rounded-md border border-[#302f2d] bg-[#101010] px-3 font-mono text-[11px] text-[#dedad4] outline-none"
                            />
                        </label>
                    ) : (
                        <div className="mb-4 rounded-md border border-[#554425] bg-[#221c14] p-3 text-[#cdb57b]">
                            HTTPS tokens are not stored in ACP profiles. Configure credentials through the system credential manager.
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={!gitIdentityDraft.username?.trim() || !gitIdentityDraft.useremail?.trim()}
                            onClick={() => {
                                const id = gitIdentityDraft.id || gitIdentityDraft.name?.trim().replace(/\s+/g, "-") || "git-profile";
                                onSaveGitIdentity(id, { ...gitIdentityDraft, id });
                            }}
                            className="cursor-pointer rounded-md border border-[#67509d] bg-[#302447] px-4 py-2 font-medium text-[#d3b9ff] hover:bg-[#3b2b55] disabled:opacity-40"
                        >
                            Save profile
                        </button>
                        <button
                            type="button"
                            disabled={!activeSession?.workspace || !gitIdentityDraft.username?.trim() || !gitIdentityDraft.useremail?.trim()}
                            onClick={() => void onApplyGitIdentity(gitIdentityDraft)}
                            className="cursor-pointer rounded-md border border-[#444527] bg-[#242619] px-4 py-2 font-medium text-[#b1b955] hover:bg-[#2d301e] disabled:opacity-40"
                        >
                            Apply to active project
                        </button>
                    </div>
                    <div className="mt-4 font-mono text-[11px] text-[#827f79]">
                        {activeSession?.workspace || "Select a session with a project workspace to apply this identity."}
                    </div>
                </section>) : null}
                </div>
            </div>
        </div>
        );
    }
);

SettingsPanel.displayName = "SettingsPanel";
