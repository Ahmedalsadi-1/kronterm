import { Badge } from "@/app/components/hermes-ui/ui/badge";
import {
    KronosChamberSidebar,
    type KronosChamberSection,
} from "@/app/components/kronoschamber-ui/kronoschamber-sidebar";
import { cn } from "@/util/util";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactDOM from "react-dom";
import { AcpAgentMark } from "./acp-agent-mark";
import type {
    AcpAgentProfile,
    AcpBackendInfo,
    AcpConfigOption,
    AcpModelInfo,
    AcpRuntimeRecord,
} from "./use-acp-session";

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
            className="mt-8 flex max-w-full items-center overflow-x-auto rounded-full border border-[#2a2a2a] bg-[#171717] p-1.5"
        >
            {selectedAgent ? (
                <button
                    type="button"
                    onClick={() => void onSelect(selectedAgent)}
                    className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-3.5 text-sm font-semibold lowercase text-[#eeeeee]"
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
            <span className="mx-2 h-6 w-px shrink-0 bg-[#2a2a2a]" />
            <button
                type="button"
                onClick={onConfigure}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#8a8580] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
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

    const toggleOpen = () => {
        setOpen((visible) => {
            if (!visible && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setPopupStyle({
                    position: "fixed",
                    left: Math.max(16, Math.min(rect.left, window.innerWidth - 560)),
                    bottom: window.innerHeight - rect.top + 8,
                });
            }
            return !visible;
        });
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                disabled={!canSelect}
                onClick={toggleOpen}
                className="flex h-8 max-w-48 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-[#1a1a1a] disabled:text-[#6b6863]"
                aria-label="Model selector"
                aria-expanded={open}
            >
                {" "}
                <i className="fa fa-cube text-[10px] text-[#9e9a93]" />
                <span className="truncate">
                    {currentModel?.label ?? modelInfo?.currentModelLabel ?? "Select model"}
                </span>{" "}
                <i className="fa fa-chevron-down text-[9px] text-[#8a8580]" />
            </button>
            {open
                ? ReactDOM.createPortal(
                      <>
                          <button
                              type="button"
                              className="fixed inset-0 z-40 cursor-default bg-black/20"
                              onClick={() => setOpen(false)}
                              aria-label="Close model selector"
                          />
                          <div
                              className="z-50 flex max-h-[520px] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] p-3 shadow-2xl shadow-black/70"
                              style={popupStyle}
                          >
                              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                  <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">
                                          Runtime model
                                      </div>
                                      <div className="mt-1 max-w-[340px] truncate text-xs text-[#d4d4d4]">
                                          {currentModel?.label ?? modelInfo?.currentModelLabel ?? "Select model"}
                                      </div>
                                  </div>
                                  <div className="shrink-0 rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#8a8580]">
                                      {models.length} models
                                  </div>
                              </div>
                              <label className="relative mb-2 block">
                                  <i className="fa fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8a8580]" />
                                  <input
                                      autoFocus
                                      value={query}
                                      onChange={(event) => setQuery(event.target.value)}
                                      placeholder="Search providers or models"
                                      className="h-9 w-full rounded-lg border border-[#2a2a2a] bg-[#101010] pl-8 pr-3 text-xs text-[#e4e4e4] outline-none placeholder:text-[#6b6863] focus:border-[#5b9ef5]/40"
                                  />
                              </label>
                              <div className="min-h-0 overflow-y-auto">
                                  {groupedModels.length ? (
                                      groupedModels.map(([provider, providerModels]) => (
                                          <div key={provider} className="mb-2 last:mb-0">
                                              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6863]">
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
                                                                  ? "bg-[#1e2a3a] text-[#eeeeee]"
                                                                  : "text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                                                          )}
                                                      >
                                                          <span className="min-w-0 flex-1 truncate">
                                                              {model.label ?? model.id}
                                                          </span>
                                                          {selected ? (
                                                              <i className="fa fa-check text-[10px] text-[#5b9ef5]" />
                                                          ) : null}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      ))
                                  ) : (
                                      <div className="px-3 py-8 text-center text-xs text-[#8a8580]">
                                          No matching models.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </>,
                      document.body
                  )
                : null}
        </div>
    );
});

ModelPicker.displayName = "ModelPicker";

export type AcpComposerMenuMode = "commands" | "skills" | "mentions";
export type AcpMentionTab = "agents" | "files" | "widgets";

export type AcpOpenWidgetMention = {
    id: string;
    label: string;
    viewType: string;
    title?: string;
    description?: string;
};

export type AcpComposerSuggestion = {
    kind: "command" | "skill" | "agent" | "file" | "widget" | "canvas";
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
    mentionTab: AcpMentionTab,
    widgets: AcpOpenWidgetMention[] = []
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
    if (mentionTab === "widgets") {
        return widgets
            .map((widget) => ({
                kind: "widget" as const,
                id: widget.id,
                label: widget.label,
                description: widget.description ?? widget.title ?? widget.id,
                badge: widget.viewType || "widget",
            }))
            .filter((item) => matchesQuery(`${item.label} ${item.description}`))
            .sort((a, b) => a.label.localeCompare(b.label));
    }
    const canvasSuggestions = widgets
        .filter((widget) => widget.viewType === "kronoscanvas")
        .map((widget) => ({
            kind: "canvas" as const,
            id: widget.id,
            label: "canvas",
            description: widget.title ? `${widget.title} - ${widget.id}` : "Attach the active Kronos canvas snapshot",
            badge: "canvas",
        }))
        .filter((item) => matchesQuery(`${item.label} ${item.description}`));
    const agentSuggestions = agents
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
    return [...canvasSuggestions, ...agentSuggestions];
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
            className="absolute bottom-full left-0 z-40 mb-2 flex max-h-64 w-full max-w-[450px] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] shadow-2xl shadow-black/60"
            role="listbox"
            aria-label={mode === "mentions" ? "Agent and file suggestions" : `${mode} suggestions`}
        >
            {mode === "mentions" ? (
                <div className="flex gap-1 border-b border-[#2a2a2a] p-2">
                    {(["agents", "files", "widgets"] as const).map((tab) => (
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
                                    ? "bg-[#1e2a3a] text-[#eeeeee]"
                                    : "text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
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
                                    ? "bg-[#1e2a3a] text-[#eeeeee]"
                                    : "text-[#c6c1ba] hover:bg-[#1a1a1a]"
                            )}
                            role="option"
                            aria-selected={index === selectedIndex}
                        >
                            <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold text-[#5b9ef5]">
                                {suggestion.kind === "command" || suggestion.kind === "skill" ? "/" : "@"}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 text-xs font-semibold">
                                    <span className="truncate">{suggestion.label}</span>
                                    {suggestion.badge ? (
                                        <span className="shrink-0 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#8a8580]">
                                            {suggestion.badge}
                                        </span>
                                    ) : null}
                                </span>
                                {suggestion.description ? (
                                    <span className="mt-0.5 block truncate text-[11px] text-[#8a8580]">
                                        {suggestion.description}
                                    </span>
                                ) : null}
                            </span>
                        </button>
                    ))
                ) : (
                    <div className="px-3 py-5 text-center text-xs text-[#8a8580]">
                        No {mode === "mentions" ? mentionTab : mode} found
                    </div>
                )}
            </div>
            <div className="border-t border-[#2a2a2a] px-3 py-1.5 text-[10px] text-[#6b6863]">
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
        <div className="absolute inset-y-12 left-0 z-30 flex w-[min(360px,100%)] flex-col border-r border-[#2a2a2a] bg-[#111111] shadow-2xl shadow-black/60">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#2a2a2a] px-4">
                <div className="text-sm font-semibold text-[#e4e4e4]">Workspace</div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#e4e4e4]"
                    aria-label="Close workspace and files"
                >
                    <i className="fa fa-xmark" />
                </button>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 text-xs">
                <section>
                    <h3 className="mb-1 font-semibold text-[#e4e4e4]">Session root</h3>
                    <p className="mb-3 leading-relaxed text-[#8a8580]">
                        ACP tools run within this directory for new messages and sessions.
                    </p>
                    <input
                        value={workspaceDraft}
                        onChange={(event) => onWorkspaceChange(event.target.value)}
                        placeholder="Focused terminal directory"
                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 font-mono text-[11px] text-[#d4d4d4] outline-none placeholder:text-[#6b6863] focus:border-[#5b9ef5]/40"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void onPickWorkspace()}
                            className="cursor-pointer rounded-md border border-[#2a2a2a] px-3 py-2 text-[#9e9a93] hover:bg-[#1a1a1a]"
                        >
                            Choose folder
                        </button>
                        <button
                            type="button"
                            onClick={() => void onApplyWorkspace()}
                            className="cursor-pointer rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a]"
                        >
                            Apply
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => void onUseFocusedWorkspace()}
                        className="mt-3 cursor-pointer text-[#9e9a93] hover:text-[#e4e4e4]"
                    >
                        Use focused terminal directory
                    </button>
                    <div className="mt-3 truncate rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#8a8580]">
                        {activeWorkspace || "Focused terminal directory"}
                    </div>
                </section>
                <section className="border-t border-[#2a2a2a] pt-5">
                    <div className="mb-4 rounded-lg border border-[#2a2a2a] bg-[#101010] p-3">
                        <div className="mb-1 font-semibold text-[#e4e4e4]">Project widgets</div>
                        <p className="mb-3 leading-relaxed text-[#8a8580]">
                            Open the selected session root as a live file and Git tree block.
                        </p>
                        <button
                            type="button"
                            onClick={() => void onOpenGitTree()}
                            className="flex w-full cursor-pointer items-center justify-between rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-2.5 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a]"
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
                            <h3 className="font-semibold text-[#d4d4d4]">Files</h3>
                            <p className="mt-1 text-[#8a8580]">Reference files in your next message.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void onPickFiles()}
                            className="cursor-pointer rounded-md border border-[#2a2a2a] px-3 py-2 text-[#9e9a93] hover:bg-[#1a1a1a]"
                        >
                            Add
                        </button>
                    </div>
                    {files.length ? (
                        <div className="space-y-2">
                            {files.map((filePath) => (
                                <div
                                    key={filePath}
                                    className="flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#101010] px-2.5 py-2"
                                >
                                    <i className="fa fa-file text-[#8a8580]" />
                                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#9e9a93]">
                                        {filePath}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveFile(filePath)}
                                        className="cursor-pointer text-[#8a8580] hover:text-[#e4e4e4]"
                                        aria-label={`Remove ${filePath}`}
                                    >
                                        <i className="fa fa-xmark" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-[#2a2a2a] px-3 py-5 text-center text-[#6b6863]">
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
    onSetSidebarMode: (mode: "open" | "compact" | "hidden") => void;
};

function formatWorkspaceName(workspace: string): string {
    if (!workspace) {
        return "Focused workspace";
    }
    return workspace.split("/").filter(Boolean).pop() ?? workspace;
}

function formatProjectPath(workspace: string): string {
    return workspace === "Focused workspace" ? "Focused terminal directory" : workspace;
}

function getRuntimeTone(status: string, isLive: boolean): string {
    if (status === "running") {
        return "bg-[#5b9ef5] animate-pulse";
    }
    if (status === "error") {
        return "bg-[#db6c60]";
    }
    if (isLive) {
        return "bg-[#5b9ef5]";
    }
    return "bg-[#77736d]";
}

function getResumeLabel(session: AcpRuntimeRecord): string {
    if (session.isLive) {
        return "live";
    }
    if (session.resumeState === "resumable") {
        return "resumable";
    }
    if (session.resumeState === "restart-required") {
        return "saved";
    }
    return "";
}

export const SessionSidebar = memo(
    ({
        sessions,
        activeConversationId,
        onSelectSession,
        onCloseSession,
        onNewChat,
        onOpenSettings,
        onSetSidebarMode,
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
            <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#151515]">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#2a2a2a] px-3">
                    <button
                        type="button"
                        onClick={() => onSetSidebarMode("compact")}
                        className="flex min-w-0 cursor-pointer items-center gap-2 text-sm font-semibold text-[#d4d4d4] hover:text-[#eeeeee]"
                        aria-label="Compact projects"
                    >
                        <AcpAgentMark backend="kronoscode" className="h-6 w-6" />
                        <span className="truncate">Projects</span>
                    </button>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onSetSidebarMode("compact")}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                            aria-label="Compact sessions"
                        >
                            <i className="fa fa-sidebar text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetSidebarMode("hidden")}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                            aria-label="Hide sessions"
                        >
                            <i className="fa fa-eye-slash text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => void onNewChat()}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                            aria-label="New session"
                        >
                            <i className="fa fa-plus" />
                        </button>
                    </div>
                </div>
                <div className="flex shrink-0 gap-1 border-b border-[#242424] px-3 py-2">
                    {[
                        { mode: "open", label: "Full" },
                        { mode: "compact", label: "Compact" },
                        { mode: "hidden", label: "Closed" },
                    ].map((item) => (
                        <button
                            type="button"
                            key={item.mode}
                            onClick={() => onSetSidebarMode(item.mode as "open" | "compact" | "hidden")}
                            className={cn(
                                "h-7 flex-1 cursor-pointer rounded-md border px-2 text-[11px] font-medium transition-colors",
                                item.mode === "open"
                                    ? "border-[#1e3a5f] bg-[#162238] text-[#8ab4f5]"
                                    : "border-[#2a2a2a] bg-[#101010] text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-4">
                    {grouped.length ? (
                        grouped.map(([workspace, runtimeSessions]) => (
                            <section key={workspace} className="mb-5">
                                <div className="mb-2 flex items-start justify-between gap-2 px-2 text-xs">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 font-semibold text-[#d4d4d4]">
                                            <i className="fa fa-folder-tree text-[10px] text-[#8ab4f5]" />
                                            <span className="truncate">{formatWorkspaceName(workspace)}</span>
                                        </div>
                                        <div className="mt-0.5 truncate font-mono text-[10px] text-[#6b6863]">
                                            {formatProjectPath(workspace)}
                                        </div>
                                        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#77736d]">
                                            {runtimeSessions.length} session{runtimeSessions.length === 1 ? "" : "s"} /{" "}
                                            {runtimeSessions.filter((session) => session.isLive).length} live
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void onNewChat(workspace === "Focused workspace" ? "" : workspace)
                                        }
                                        className="cursor-pointer px-1 text-[#8a8580] hover:text-[#d4d4d4]"
                                        aria-label={`New session in project ${formatWorkspaceName(workspace)}`}
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
                                                    ? "bg-[#1e2a3a]"
                                                    : "hover:bg-[#1a1a1a]"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => onSelectSession(session.conversationId)}
                                                className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left"
                                            >
                                                <AcpAgentMark
                                                    backend={session.backend ?? "custom"}
                                                    className="mt-0.5 h-5 w-5"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs font-medium text-[#d4d4d4]">
                                                        {session.title}
                                                    </span>
                                                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8a8580]">
                                                        <span
                                                            className={cn(
                                                                "h-1.5 w-1.5 rounded-full",
                                                                getRuntimeTone(session.status, session.isLive)
                                                            )}
                                                        />
                                                        {session.agentName}
                                                        {getResumeLabel(session) ? (
                                                            <span className="rounded border border-[#2a2a2a] px-1 py-px text-[9px] uppercase tracking-[0.06em] text-[#6b6863]">
                                                                {getResumeLabel(session)}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void onCloseSession(session.conversationId)}
                                                className="cursor-pointer rounded p-1 text-[#6b6863] opacity-0 hover:text-[#dc7668] group-hover:opacity-100"
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
                        <div className="rounded-lg border border-dashed border-[#2a2a2a] p-4 text-center text-xs text-[#8a8580]">
                            No ACP sessions yet.
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex h-12 shrink-0 cursor-pointer items-center gap-3 border-t border-[#2a2a2a] px-4 text-sm font-medium text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                >
                    <i className="fa fa-gear" />
                    Settings
                </button>
            </aside>
        );
    }
);

SessionSidebar.displayName = "SessionSidebar";

export const CompactSessionRail = memo(
    ({
        sessions,
        activeConversationId,
        onSelectSession,
        onOpen,
        onHide,
        onNewChat,
        onOpenSettings,
    }: {
        sessions: AcpRuntimeRecord[];
        activeConversationId: string;
        onSelectSession: (conversationId: string) => void;
        onOpen: () => void;
        onHide: () => void;
        onNewChat: () => void | Promise<void>;
        onOpenSettings: () => void;
    }) => {
        const visibleSessions = sessions.filter((session) => session.resumeState !== "archived").slice(0, 8);
        return (
            <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-[#2a2a2a] bg-[#151515] py-2">
                <button
                    type="button"
                    onClick={onOpen}
                    className="mb-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#101010] hover:bg-[#1a1a1a]"
                    aria-label="Open projects"
                >
                    <AcpAgentMark backend="kronoscode" className="h-6 w-6" />
                </button>
                <button
                    type="button"
                    onClick={() => void onNewChat()}
                    className="mb-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                    aria-label="New session"
                >
                    <i className="fa fa-plus text-xs" />
                </button>
                <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
                    {visibleSessions.map((session) => (
                        <button
                            type="button"
                            key={session.conversationId}
                            onClick={() => onSelectSession(session.conversationId)}
                            className={cn(
                                "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[#1a1a1a]",
                                session.conversationId === activeConversationId && "bg-[#1e2a3a]"
                            )}
                            title={session.title}
                            aria-label={session.title}
                        >
                            <AcpAgentMark backend={session.backend ?? "kronoscode"} className="h-5 w-5" />
                            <span
                                className={cn(
                                    "absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full",
                                    getRuntimeTone(session.status, session.isLive)
                                )}
                            />
                        </button>
                    ))}
                </div>
                <div className="mt-3 flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                        aria-label="Settings"
                    >
                        <i className="fa fa-gear text-xs" />
                    </button>
                    <button
                        type="button"
                        onClick={onHide}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9e9a93] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                        aria-label="Hide projects"
                    >
                        <i className="fa fa-eye-slash text-xs" />
                    </button>
                </div>
            </aside>
        );
    }
);

CompactSessionRail.displayName = "CompactSessionRail";

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

type SettingsSection =
    | "defaults"
    | "runtimes"
    | "agents"
    | "commands"
    | "models"
    | "mcp"
    | "skills"
    | "marketplace"
    | "usage"
    | "gitidentities"
    | "workspace";

type SettingsTab =
    "kronterm" | "agents" | "commands" | "skills" | "mcp" | "marketplace" | "providers" | "usage" | "gitidentities";

function getAcpMcpTransport(server: MCPConfig | undefined): "stdio" | "http" | "sse" {
    if (server?.type === "http" || server?.type === "streamable_http") {
        return "http";
    }
    if (server?.type === "sse") {
        return "sse";
    }
    return "stdio";
}

function supportsAcpMcpServer(runtime: AcpRuntimeRecord | undefined, server: MCPConfig | undefined): boolean {
    if (!runtime) {
        return true;
    }
    const transport = getAcpMcpTransport(server);
    return Boolean(runtime.capabilities?.mcpCapabilities?.[transport]);
}

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: string; sections: SettingsSection[] }> = [
    { id: "kronterm", label: "Kronterm", icon: "fa-gear", sections: ["defaults", "runtimes", "workspace"] },
    { id: "agents", label: "Agents", icon: "fa-robot", sections: ["agents"] },
    { id: "commands", label: "Commands", icon: "fa-terminal", sections: ["commands"] },
    { id: "skills", label: "Skills", icon: "fa-book", sections: ["skills"] },
    { id: "mcp", label: "MCP", icon: "fa-plug", sections: ["mcp"] },
    { id: "marketplace", label: "Marketplace", icon: "fa-layer-group", sections: ["marketplace"] },
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
    marketplace: { label: "Marketplace", icon: "fa-layer-group", description: "Install KronosCode presets" },
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
        const [chamberPreviewSection, setChamberPreviewSection] = useState<KronosChamberSection>("chat");
        const profile = profiles[selectedAgent?.backend ?? "kronoscode"] ?? {};
        const activeSession = sessions.find((session) => session.conversationId === activeConversationId);
        const liveSessions = sessions.filter((session) => session.resumeState !== "archived");
        const backend = selectedAgent?.backend ?? "kronoscode";
        const backendLiveSessions = liveSessions.filter((session) => session.backend === backend);
        const targetRuntime =
            (activeSession?.backend === backend && activeSession.isLive ? activeSession : null) ??
            backendLiveSessions.find((session) => session.isLive) ??
            backendLiveSessions[0];
        const targetMcpCapabilities = targetRuntime?.capabilities?.mcpCapabilities;
        const acceptedMcpTransports = (["stdio", "http", "sse"] as const).filter(
            (transport) => targetMcpCapabilities?.[transport]
        );
        const modeOptions = targetRuntime?.modes?.availableModes?.length
            ? targetRuntime.modes.availableModes.map((mode) => ({ value: mode.id, label: mode.name ?? mode.id }))
            : [{ value: "default", label: "Auto" }];
        const selectedMode = modeOptions.some((mode) => mode.value === targetRuntime?.currentMode)
            ? (targetRuntime?.currentMode ?? modeOptions[0].value)
            : (profile.mode ?? modeOptions[0].value);
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
            setGitIdentityDraft(
                firstIdentity ?? { id: "new-profile", authtype: "ssh", color: "keyword", icon: "branch" }
            );
        }, [gitIdentities]);

        const selectTab = (tab: (typeof settingsTabs)[number]) => {
            setActiveTab(tab.id);
            setSection(tab.sections[0]);
        };

        return (
            <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[#111111]">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2a2a2a] px-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#161616]">
                            <i className="fa fa-gear text-xs text-[#5b9ef5]" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-[#eeeeee]">Settings</div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6b6863]">
                                <span>Configure KronTerm and agents</span>
                                <Badge variant="outline" className="border-[#34322f] text-[#8a8580]">
                                    KronosChamber
                                </Badge>
                                <Badge variant="outline" className="border-[#34322f] text-[#8a8580]">
                                    Kronos agent
                                </Badge>
                                <Badge variant="outline" className="border-[#34322f] text-[#8a8580]">
                                    Canvas cowork
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8580] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                        aria-label="Close settings"
                    >
                        <i className="fa fa-xmark" />
                    </button>
                </div>
                <div className="flex min-h-0 flex-1">
                    <nav className="w-56 shrink-0 border-r border-[#2a2a2a] bg-[#0d0d0d] p-3">
                        {settingsTabs.map((tab) => (
                            <div key={tab.id} className="mb-1">
                                <button
                                    type="button"
                                    onClick={() => selectTab(tab)}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition-colors",
                                        tab.id === activeTab
                                            ? "bg-[#1e2a3a] text-[#eeeeee]"
                                            : "text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#d4d4d4]"
                                    )}
                                >
                                    <i
                                        className={cn(
                                            "fa w-4 text-center",
                                            tab.icon,
                                            tab.id === activeTab ? "text-[#5b9ef5]" : "text-[#6b6863]"
                                        )}
                                    />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                                {tab.id === activeTab ? (
                                    <div className="ml-4 mt-1 space-y-0.5 border-l border-[#2a2a2a] pl-3">
                                        {tab.sections.map((sectionId) => {
                                            const item = settingsSections[sectionId];
                                            return (
                                                <button
                                                    key={sectionId}
                                                    type="button"
                                                    onClick={() => setSection(sectionId)}
                                                    className={cn(
                                                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                                                        sectionId === section
                                                            ? "text-[#eeeeee]"
                                                            : "text-[#6b6863] hover:text-[#9e9a93]"
                                                    )}
                                                >
                                                    <i className={cn("fa text-[10px] w-3", item.icon)} />
                                                    <span>{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </nav>
                    <div className="min-h-0 flex-1 overflow-y-auto bg-[#111111] p-6 text-xs @lg:p-8">
                        {section === "defaults" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">New chat defaults</div>
                                <p className="mb-4 leading-relaxed text-[#8a8580]">
                                    KronosCode is the primary agent. External agent values are applied only when their
                                    active ACP runtime advertises matching controls.
                                </p>
                                <div className="mb-5 grid gap-3 rounded-lg border border-[#2a2a2a] bg-[#101010] p-3 @lg:grid-cols-[230px_minmax(0,1fr)]">
                                    <div className="h-56 min-h-0 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#0d0d0d]">
                                        <KronosChamberSidebar
                                            selectedSection={chamberPreviewSection}
                                            onSelectSection={setChamberPreviewSection}
                                        />
                                    </div>
                                    <div className="min-w-0 self-center">
                                        <div className="mb-2 flex flex-wrap gap-1.5">
                                            <Badge variant="outline" className="border-[#34322f] text-[#8a8580]">
                                                Direct KronosChamber copy
                                            </Badge>
                                            <Badge variant="outline" className="border-[#34322f] text-[#8a8580]">
                                                ACP adapter
                                            </Badge>
                                        </div>
                                        <div className="text-sm font-semibold capitalize text-[#d4d4d4]">
                                            {chamberPreviewSection} settings surface
                                        </div>
                                        <p className="mt-1 leading-relaxed text-[#8a8580]">
                                            This panel uses the copied KronosChamber navigation component inside the
                                            KronosCoder settings runtime while keeping Kronterm Jotai and ACP writes.
                                        </p>
                                    </div>
                                </div>
                                <label htmlFor={`acp-default-model-${fieldSuffix}`} className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">
                                        Default model for {selectedAgent?.name}
                                    </span>
                                    <input
                                        id={`acp-default-model-${fieldSuffix}`}
                                        value={profile.model ?? ""}
                                        onChange={(event) =>
                                            onUpdateProfile(selectedAgent?.backend ?? "kronoscode", {
                                                model: event.target.value,
                                            })
                                        }
                                        placeholder="Runtime default"
                                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <label htmlFor={`acp-default-mode-${fieldSuffix}`} className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Default mode</span>
                                    <select
                                        id={`acp-default-mode-${fieldSuffix}`}
                                        aria-label="Default mode"
                                        value={profile.mode ?? selectedMode}
                                        onChange={(event) =>
                                            onUpdateProfile(selectedAgent?.backend ?? "kronoscode", {
                                                mode: event.target.value,
                                            })
                                        }
                                        className="h-9 w-full cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                    >
                                        {modeOptions.map((mode) => (
                                            <option key={mode.value} value={mode.value}>
                                                {mode.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label htmlFor={`acp-default-workspace-${fieldSuffix}`} className="block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Default workspace</span>
                                    <input
                                        id={`acp-default-workspace-${fieldSuffix}`}
                                        value={profile.workspace ?? ""}
                                        onChange={(event) =>
                                            onUpdateProfile(selectedAgent?.backend ?? "kronoscode", {
                                                workspace: event.target.value,
                                            })
                                        }
                                        placeholder="Focused terminal directory"
                                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#171717] p-3">
                                    <div className="font-medium text-[#d4d4d4]">
                                        Apply to open {selectedAgent?.name ?? "agent"} sessions
                                    </div>
                                    <p className="mt-1 leading-relaxed text-[#8a8580]">
                                        Model, mode, and advertised controls update immediately across{" "}
                                        {backendLiveSessions.length} compatible runtime
                                        {backendLiveSessions.length === 1 ? "" : "s"}.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void onApplyProfileToLiveSessions(backend)}
                                        disabled={!backendLiveSessions.length}
                                        className="mt-3 cursor-pointer rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a] disabled:opacity-40"
                                    >
                                        Apply live-compatible defaults
                                    </button>
                                </div>
                            </section>
                        ) : null}
                        {section === "runtimes" ? (
                            <section>
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-[#d4d4d4]">Sessions</span>
                                    <span className="text-[#8a8580]">{liveSessions.length} open</span>
                                </div>
                                <div className="space-y-2">
                                    {sessions.length ? (
                                        sessions.map((session) => (
                                            <div
                                                key={session.conversationId}
                                                className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#101010] p-2"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectSession(session.conversationId)}
                                                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                                                >
                                                    <AcpAgentMark
                                                        backend={session.backend ?? "custom"}
                                                        className="h-7 w-7"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-medium text-[#d4d4d4]">
                                                            {session.title}
                                                        </span>
                                                        <span className="block truncate text-[#8a8580]">
                                                            {session.agentName} / {session.status}
                                                        </span>
                                                    </span>
                                                </button>
                                                {session.resumeState !== "archived" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void onCloseSession(session.conversationId)}
                                                        className="cursor-pointer rounded p-2 text-[#8a8580] hover:bg-[#1a1a1a] hover:text-[#dc7668]"
                                                        aria-label="Close runtime"
                                                    >
                                                        <i className="fa fa-xmark" />
                                                    </button>
                                                ) : null}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[#8a8580]">No stored ACP sessions.</p>
                                    )}
                                </div>
                                {restartRequiredBackends.has(backend) && backendLiveSessions.length ? (
                                    <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#161616] p-3 text-[#8ab4f5]">
                                        <div className="font-medium">Restart required for {selectedAgent?.name}</div>
                                        <p className="mt-1 text-[#9e9a93]">
                                            Workspace, executable, or MCP configuration changed. ACP accepts these
                                            settings at session start.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void onRestartBackendSessions(backend)}
                                            className="mt-3 cursor-pointer rounded-md border border-[#2a2a2a] px-3 py-2 font-medium hover:bg-[#1a1a1a]"
                                        >
                                            Restart {backendLiveSessions.length} open runtime
                                            {backendLiveSessions.length === 1 ? "" : "s"} with saved context
                                        </button>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}
                        {section === "agents" ? (
                            <section>
                                <div className="mb-3 text-sm font-semibold text-[#d4d4d4]">Installed agents</div>
                                <div className="space-y-2">
                                    {agents.map((agent) => (
                                        <button
                                            key={agent.backend}
                                            type="button"
                                            onClick={() => void onSelectAgent(agent)}
                                            className={cn(
                                                "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                                agent.backend === selectedAgent?.backend
                                                    ? "border-[#1e2a3a] bg-[#161c28]"
                                                    : "border-[#2a2a2a] bg-[#101010] hover:bg-[#1a1a1a]"
                                            )}
                                        >
                                            <AcpAgentMark backend={agent.backend} className="h-7 w-7" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-medium text-[#d4d4d4]">{agent.name}</span>
                                                <span className="block truncate text-[#8a8580]">
                                                    {agent.harnessProfile?.summary ??
                                                        agent.description ??
                                                        agent.cliPath}
                                                </span>
                                                {agent.harnessProfile?.specialties?.length ? (
                                                    <span className="mt-1 flex flex-wrap gap-1">
                                                        {agent.harnessProfile.specialties
                                                            .slice(0, 4)
                                                            .map((specialty) => (
                                                                <span
                                                                    key={specialty}
                                                                    className="rounded border border-[#2a2a2a] bg-[#151515] px-1.5 py-0.5 text-[9px] text-[#8a8580]"
                                                                >
                                                                    {specialty}
                                                                </span>
                                                            ))}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span
                                                className={cn(
                                                    "rounded-full px-2 py-1 text-[10px]",
                                                    agent.available
                                                        ? "bg-[#161c28] text-[#5b9ef5]"
                                                        : "bg-[#221b19] text-[#b67c70]"
                                                )}
                                            >
                                                {agent.available ? "Ready" : "Missing"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-5 border-t border-[#2a2a2a] pt-5">
                                    <div className="mb-1 text-sm font-semibold text-[#d4d4d4]">
                                        {selectedAgent?.name ?? "Agent"} profile
                                    </div>
                                    <p className="mb-4 text-[#8a8580]">
                                        Saved defaults are scoped to this runtime backend and applied only where ACP
                                        exposes compatible controls.
                                    </p>
                                    <label htmlFor={`acp-executable-${fieldSuffix}`} className="mb-3 block">
                                        <span className="mb-1.5 block text-[#9e9a93]">Executable override</span>
                                        <input
                                            id={`acp-executable-${fieldSuffix}`}
                                            value={profile.executable ?? ""}
                                            onChange={(event) =>
                                                onUpdateProfile(backend, { executable: event.target.value })
                                            }
                                            placeholder={selectedAgent?.cliPath || "Use detected executable"}
                                            className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                        />
                                    </label>
                                    <div className="flex items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#101010] p-3">
                                        <span className="text-[#8a8580]">
                                            {backendLiveSessions.length} open runtime
                                            {backendLiveSessions.length === 1 ? "" : "s"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void onApplyProfileToLiveSessions(backend)}
                                            disabled={!backendLiveSessions.length}
                                            className="cursor-pointer rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a] disabled:opacity-40"
                                        >
                                            Apply controls
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-5 border-t border-[#2a2a2a] pt-5">
                                    <div className="mb-1 text-sm font-semibold text-[#d4d4d4]">Agent configuration</div>
                                    <p className="mb-4 text-[#8a8580]">
                                        Save a Kronterm agent definition and publish its model default to compatible ACP
                                        runtimes. Runtime modes remain configured under Providers.
                                    </p>
                                    <label className="mb-3 block">
                                        <span className="mb-1.5 block text-[#9e9a93]">Description</span>
                                        <textarea
                                            value={agentDraft.description ?? ""}
                                            onChange={(event) =>
                                                setAgentDraft((draft) => ({
                                                    ...draft,
                                                    description: event.target.value,
                                                }))
                                            }
                                            placeholder="What does this agent do?"
                                            rows={3}
                                            className="w-full resize-none rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-[#d4d4d4] outline-none"
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
                                                        ? "border-[#1e3a5f] bg-[#162238] text-[#8ab4f5]"
                                                        : "border-[#2a2a2a] text-[#9e9a93] hover:bg-[#1a1a1a]"
                                                )}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mb-3 grid grid-cols-2 gap-3">
                                        <label>
                                            <span className="mb-1.5 block text-[#9e9a93]">Model</span>
                                            <input
                                                value={agentDraft.model ?? ""}
                                                onChange={(event) =>
                                                    setAgentDraft((draft) => ({ ...draft, model: event.target.value }))
                                                }
                                                placeholder="Runtime default"
                                                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                            />
                                        </label>
                                        <label>
                                            <span className="mb-1.5 block text-[#9e9a93]">Scope</span>
                                            <select
                                                value={agentDraft.scope ?? "project"}
                                                onChange={(event) =>
                                                    setAgentDraft((draft) => ({ ...draft, scope: event.target.value }))
                                                }
                                                className="h-9 w-full cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                            >
                                                <option value="user">User</option>
                                                <option value="project">Project</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="mb-3 grid grid-cols-2 gap-3">
                                        <label>
                                            <span className="mb-1.5 block text-[#9e9a93]">Temperature</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={agentDraft.temperature ?? ""}
                                                onChange={(event) =>
                                                    setAgentDraft((draft) => ({
                                                        ...draft,
                                                        temperature: event.target.value
                                                            ? Number(event.target.value)
                                                            : undefined,
                                                    }))
                                                }
                                                placeholder="Runtime managed"
                                                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                            />
                                        </label>
                                        <label>
                                            <span className="mb-1.5 block text-[#9e9a93]">Top P</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={agentDraft.topp ?? ""}
                                                onChange={(event) =>
                                                    setAgentDraft((draft) => ({
                                                        ...draft,
                                                        topp: event.target.value
                                                            ? Number(event.target.value)
                                                            : undefined,
                                                    }))
                                                }
                                                placeholder="Runtime managed"
                                                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                            />
                                        </label>
                                    </div>
                                    <p className="mb-3 leading-relaxed text-[#8a8580]">
                                        System prompts apply to submitted tasks. Generation parameters remain saved
                                        metadata unless the runtime provides matching ACP controls.
                                    </p>
                                    <label className="mb-3 block">
                                        <span className="mb-1.5 block text-[#9e9a93]">System prompt</span>
                                        <textarea
                                            value={agentDraft.systemprompt ?? ""}
                                            onChange={(event) =>
                                                setAgentDraft((draft) => ({
                                                    ...draft,
                                                    systemprompt: event.target.value,
                                                }))
                                            }
                                            placeholder="Custom system prompt for this agent..."
                                            rows={5}
                                            className="w-full resize-y rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSaveAgentDefinition(backend, {
                                                ...agentDraft,
                                                backend,
                                                name: agentDraft.name || selectedAgent?.name || backend,
                                            });
                                            onUpdateProfile(backend, { model: agentDraft.model });
                                            void onApplyProfileToLiveSessions(backend);
                                        }}
                                        className="cursor-pointer rounded-md border border-[#1e3a5f] bg-[#162238] px-4 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2f4a]"
                                    >
                                        Save agent configuration
                                    </button>
                                </div>
                            </section>
                        ) : null}
                        {section === "commands" ? (
                            <section>
                                <div className="mb-1 text-sm font-semibold text-[#d4d4d4]">New Command</div>
                                <p className="mb-5 text-[#8a8580]">
                                    Create reusable slash-command templates available in the chat composer.
                                </p>
                                <label className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">
                                        Command Name & Scope
                                    </span>
                                    <div className="flex gap-2">
                                        <div className="flex min-w-0 flex-1 items-center rounded-md border border-[#2a2a2a] bg-[#101010] px-3">
                                            <span className="mr-1 text-[#8a8580]">/</span>
                                            <input
                                                value={commandDraft.name ?? ""}
                                                onChange={(event) =>
                                                    setCommandDraft((draft) => ({ ...draft, name: event.target.value }))
                                                }
                                                placeholder="new-command"
                                                className="h-9 min-w-0 flex-1 bg-transparent text-[#d4d4d4] outline-none"
                                            />
                                        </div>
                                        <select
                                            value={commandDraft.scope ?? "project"}
                                            onChange={(event) =>
                                                setCommandDraft((draft) => ({ ...draft, scope: event.target.value }))
                                            }
                                            className="h-9 cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        >
                                            <option value="user">User</option>
                                            <option value="project">Project</option>
                                        </select>
                                    </div>
                                </label>
                                <label className="mb-4 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Description</span>
                                    <textarea
                                        value={commandDraft.description ?? ""}
                                        onChange={(event) =>
                                            setCommandDraft((draft) => ({ ...draft, description: event.target.value }))
                                        }
                                        placeholder="What does this command do?"
                                        rows={3}
                                        className="w-full resize-none rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <div className="mb-4 grid grid-cols-2 gap-3">
                                    <label>
                                        <span className="mb-1.5 block font-medium text-[#9e9a93]">Agent</span>
                                        <select
                                            value={commandDraft.agent ?? backend}
                                            onChange={(event) =>
                                                setCommandDraft((draft) => ({ ...draft, agent: event.target.value }))
                                            }
                                            className="h-9 w-full cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        >
                                            {agents.map((agent) => (
                                                <option key={agent.backend} value={agent.backend}>
                                                    {agent.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span className="mb-1.5 block font-medium text-[#9e9a93]">Model</span>
                                        <input
                                            value={commandDraft.model ?? ""}
                                            onChange={(event) =>
                                                setCommandDraft((draft) => ({ ...draft, model: event.target.value }))
                                            }
                                            placeholder="Runtime default"
                                            className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        />
                                    </label>
                                </div>
                                <label className="mb-4 flex cursor-pointer items-center gap-2 text-[#9e9a93]">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(commandDraft.subtask)}
                                        onChange={(event) =>
                                            setCommandDraft((draft) => ({ ...draft, subtask: event.target.checked }))
                                        }
                                        className="cursor-pointer"
                                    />
                                    Force subagent invocation
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Command Template</span>
                                    <textarea
                                        value={commandDraft.template ?? ""}
                                        onChange={(event) =>
                                            setCommandDraft((draft) => ({ ...draft, template: event.target.value }))
                                        }
                                        placeholder={
                                            "Your command template here...\n\nUse $ARGUMENTS to reference user input."
                                        }
                                        rows={8}
                                        className="w-full resize-y rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <button
                                    type="button"
                                    disabled={!commandDraft.name?.trim() || !commandDraft.template?.trim()}
                                    onClick={() => {
                                        const id = commandDraft.name?.trim().replace(/\s+/g, "-") ?? "";
                                        onSaveCommand(id, { ...commandDraft, name: id });
                                    }}
                                    className="mt-4 cursor-pointer rounded-md border border-[#1e3a5f] bg-[#162238] px-4 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2f4a] disabled:opacity-40"
                                >
                                    Save command
                                </button>
                            </section>
                        ) : null}
                        {section === "models" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">Providers & Models</div>
                                <p className="mb-4 text-[#8a8580]">
                                    {selectedAgent?.backend === "kronoscode"
                                        ? "The runtime catalog is shown below. Persistent KronosCode provider settings are edited in its native configuration."
                                        : "This catalog is supplied by the active ACP runtime and does not modify the external CLI configuration."}
                                </p>
                                {selectedAgent?.backend === "kronoscode" ? (
                                    <button
                                        type="button"
                                        onClick={onOpenNativeConfig}
                                        className="mb-4 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-3 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a]"
                                    >
                                        <span>Open KronosCode native configuration</span>
                                        <i className="fa fa-arrow-up-right-from-square text-[10px]" />
                                    </button>
                                ) : null}
                                <div className="mb-4 rounded-md border border-[#2a2a2a] bg-[#101010] p-3">
                                    <span className="text-[#8a8580]">Current model</span>
                                    <div className="mt-2">
                                        <ModelPicker
                                            modelInfo={targetRuntime?.modelInfo ?? null}
                                            onSelect={(modelId) => onSetModel(backend, modelId)}
                                        />
                                    </div>
                                    <div className="mt-2 text-[#8a8580]">
                                        {targetRuntime?.modelInfo?.availableModels?.length ?? 0} runtime-advertised
                                        models
                                    </div>
                                </div>
                                <label htmlFor={`acp-runtime-mode-${fieldSuffix}`} className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Mode</span>
                                    <select
                                        id={`acp-runtime-mode-${fieldSuffix}`}
                                        aria-label={`Runtime mode for ${selectedAgent?.name ?? "agent"}`}
                                        value={selectedMode}
                                        onChange={(event) => void onSetMode(backend, event.target.value)}
                                        className="h-9 w-full cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
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
                                        <span className="mb-1.5 block font-medium text-[#9e9a93]">
                                            {option.name ?? option.label ?? option.id}
                                        </span>
                                        <select
                                            id={`acp-option-${fieldSuffix}-${option.id.replace(/[^a-z0-9_-]/gi, "-")}`}
                                            value={getConfigValue(option)}
                                            onChange={(event) =>
                                                void onSetConfigOption(backend, option.id, event.target.value)
                                            }
                                            className="h-9 w-full cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        >
                                            {option.options?.map((choice) => (
                                                <option key={choice.value} value={choice.value}>
                                                    {choice.name ?? choice.label ?? choice.value}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </section>
                        ) : null}
                        {section === "mcp" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">MCP servers</div>
                                <label className="mb-4 flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#101010] p-3">
                                    <span>Enable Wave MCP configuration</span>
                                    <input
                                        type="checkbox"
                                        checked={mcpEnabled}
                                        onChange={(event) => onSetMcpEnabled(event.target.checked)}
                                        className="cursor-pointer"
                                    />
                                </label>
                                <p className="mb-3 text-[#8a8580]">
                                    This runtime{" "}
                                    {acceptedMcpTransports.length
                                        ? `accepts ${acceptedMcpTransports.join(", ")} MCP servers.`
                                        : "does not advertise MCP server injection."}
                                </p>
                                {Object.keys(mcpServers).length ? (
                                    Object.keys(mcpServers).map((serverId) => {
                                        const server = (mcpServers as Record<string, MCPConfig>)[serverId];
                                        const supported = supportsAcpMcpServer(targetRuntime, server);
                                        return (
                                            <label
                                                key={serverId}
                                                className="mb-2 flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-[#9e9a93]"
                                            >
                                                <span>{serverId}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={(profile.mcpserverids ?? []).includes(serverId)}
                                                    disabled={!supported}
                                                    onChange={(event) => {
                                                        const nextServerIds = event.target.checked
                                                            ? Array.from(
                                                                  new Set([...(profile.mcpserverids ?? []), serverId])
                                                              )
                                                            : (profile.mcpserverids ?? []).filter(
                                                                  (id) => id !== serverId
                                                              );
                                                        onUpdateProfile(selectedAgent?.backend ?? "kronoscode", {
                                                            mcpserverids: nextServerIds,
                                                        });
                                                    }}
                                                    className="cursor-pointer disabled:opacity-40"
                                                />
                                            </label>
                                        );
                                    })
                                ) : (
                                    <p className="text-[#6b6863]">No Wave MCP servers configured.</p>
                                )}
                                <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#171717] p-3">
                                    <div className="font-medium text-[#d4d4d4]">Runtime application</div>
                                    <p className="mt-1 leading-relaxed text-[#8a8580]">
                                        Enabled servers are passed into new sessions only when{" "}
                                        {selectedAgent?.name ?? "this agent"} advertises stdio MCP support.
                                    </p>
                                    {restartRequiredBackends.has(backend) && backendLiveSessions.length ? (
                                        <button
                                            type="button"
                                            onClick={() => void onRestartBackendSessions(backend)}
                                            className="mt-3 cursor-pointer rounded-md border border-[#2a2a2a] bg-[#161616] px-3 py-2 font-medium text-[#8ab4f5] hover:bg-[#1a1a1a]"
                                        >
                                            Restart open runtimes with MCP selection
                                        </button>
                                    ) : null}
                                </div>
                            </section>
                        ) : null}
                        {section === "workspace" ? (
                            <section>
                                <button
                                    type="button"
                                    onClick={onOpenWorkspace}
                                    className="mt-1 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-[#9e9a93] hover:bg-[#1a1a1a]"
                                >
                                    <span className="flex items-center gap-2">
                                        <i className="fa fa-folder-open text-[#8a8580]" />
                                        Workspace and files
                                    </span>
                                    <i className="fa fa-chevron-right text-[10px] text-[#6b6863]" />
                                </button>
                                <div className="mt-3 truncate rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 font-mono text-[#98938c]">
                                    {activeSession?.workspace || "Focused terminal directory"}
                                </div>
                                <div className="mt-3 text-[#8a8580]">
                                    {activeSession?.referencedFiles.length ?? 0} referenced files
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void onOpenGitTree()}
                                    className="mt-5 flex w-full cursor-pointer items-center justify-between rounded-md border border-[#1e2a3a] bg-[#161c28] px-3 py-3 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a]"
                                >
                                    <span className="flex items-center gap-2">
                                        <i className="fa fa-code-branch" />
                                        Open Git Tree widget for this project
                                    </span>
                                    <i className="fa fa-arrow-up-right-from-square text-[10px]" />
                                </button>
                            </section>
                        ) : null}
                        {section === "skills" ? (
                            <section>
                                <div className="mb-4 flex rounded-md border border-[#2a2a2a] bg-[#171717] p-1">
                                    <span className="flex-1 rounded bg-[#272431] px-3 py-2 text-center font-medium text-[#d4d4d4]">
                                        Manual
                                    </span>
                                    <span className="flex-1 px-3 py-2 text-center text-[#8a8580]">External</span>
                                </div>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">New Skill</div>
                                <label className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">
                                        Skill Name & Location
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            value={skillDraft.name ?? ""}
                                            onChange={(event) =>
                                                setSkillDraft((draft) => ({ ...draft, name: event.target.value }))
                                            }
                                            placeholder="new-skill"
                                            className="h-9 min-w-0 flex-1 rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        />
                                        <select
                                            value={skillDraft.scope ?? "project"}
                                            onChange={(event) =>
                                                setSkillDraft((draft) => ({ ...draft, scope: event.target.value }))
                                            }
                                            className="h-9 cursor-pointer rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                        >
                                            <option value="user">User / KronosCode</option>
                                            <option value="project">Project / KronosCode</option>
                                        </select>
                                    </div>
                                </label>
                                <label className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Description</span>
                                    <textarea
                                        value={skillDraft.description ?? ""}
                                        onChange={(event) =>
                                            setSkillDraft((draft) => ({ ...draft, description: event.target.value }))
                                        }
                                        placeholder="Brief description of what this skill does..."
                                        rows={2}
                                        className="w-full resize-none rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <label className="mb-5 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Instructions</span>
                                    <textarea
                                        value={skillDraft.instructions ?? ""}
                                        onChange={(event) =>
                                            setSkillDraft((draft) => ({ ...draft, instructions: event.target.value }))
                                        }
                                        rows={8}
                                        className="w-full resize-y rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                    />
                                    <button
                                        type="button"
                                        disabled={!skillDraft.name?.trim() || !skillDraft.instructions?.trim()}
                                        onClick={() => {
                                            const id = skillDraft.name?.trim().replace(/\s+/g, "-") ?? "";
                                            onSaveSkill(id, { ...skillDraft, name: id, backend });
                                        }}
                                        className="mt-3 cursor-pointer rounded-md border border-[#1e3a5f] bg-[#162238] px-4 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2f4a] disabled:opacity-40"
                                    >
                                        Save skill
                                    </button>
                                </label>
                                <div className="mb-2 border-t border-[#2a2a2a] pt-5 text-sm font-semibold text-[#d4d4d4]">
                                    {selectedAgent?.name ?? "Agent"} skill locations
                                </div>
                                <p className="mb-4 text-[#8a8580]">
                                    These are the known native skill locations for this agent. ACP does not expose a
                                    portable live skill-directory control, so external runtimes use their CLI-managed
                                    skills.
                                </p>
                                {(profile.skillsdirs?.length
                                    ? profile.skillsdirs
                                    : selectedAgent?.skillsDirs?.length
                                      ? selectedAgent.skillsDirs
                                      : [".kronoscode/skills"]
                                ).map((directory) => (
                                    <div
                                        key={directory}
                                        className="mb-2 flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#101010] px-3 py-2.5 font-mono text-[#98938c]"
                                    >
                                        <i className="fa fa-book text-[#8a8580]" />
                                        <span className="min-w-0 flex-1 truncate">{directory}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onUpdateProfile(backend, {
                                                    skillsdirs: (
                                                        profile.skillsdirs ??
                                                        selectedAgent?.skillsDirs ??
                                                        []
                                                    ).filter((current) => current !== directory),
                                                })
                                            }
                                            className="cursor-pointer text-[#8a8580] hover:text-[#dc7668]"
                                            aria-label={`Remove skill directory ${directory}`}
                                        >
                                            <i className="fa fa-xmark" />
                                        </button>
                                    </div>
                                ))}
                                <div className="mt-3 flex gap-2">
                                    <input
                                        aria-label={`Add skill directory for ${selectedAgent?.name ?? "agent"}`}
                                        value={skillDirDraft}
                                        onChange={(event) => setSkillDirDraft(event.target.value)}
                                        placeholder=".kronterm/skills"
                                        className="h-9 min-w-0 flex-1 rounded-md border border-[#2a2a2a] bg-[#101010] px-3 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const directory = skillDirDraft.trim();
                                            if (!directory) {
                                                return;
                                            }
                                            onUpdateProfile(backend, {
                                                skillsdirs: Array.from(
                                                    new Set([
                                                        ...(profile.skillsdirs ?? selectedAgent?.skillsDirs ?? []),
                                                        directory,
                                                    ])
                                                ),
                                            });
                                            setSkillDirDraft("");
                                        }}
                                        className="cursor-pointer rounded-md border border-[#2a2a2a] px-3 py-2 text-[#9e9a93] hover:bg-[#1a1a1a]"
                                    >
                                        Add location
                                    </button>
                                </div>
                            </section>
                        ) : null}
                        {section === "marketplace" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">KronosCode Marketplace</div>
                                <p className="mb-5 leading-relaxed text-[#8a8580]">
                                    Create KronosCoder configs from curated KronosChamber sections. Installed presets
                                    are saved into the same ACP agent, command, and skill stores used by chat.
                                </p>
                                <div className="grid gap-3 @xl:grid-cols-2">
                                    {[
                                        {
                                            id: "primary-orchestrator",
                                            title: "Primary orchestrator agent",
                                            icon: "fa-robot",
                                            description:
                                                "Create a KronosCode agent profile for planning, coding, terminal work, and project orchestration.",
                                            action: () => {
                                                onSaveAgentDefinition("kronos", {
                                                    backend: "kronoscode",
                                                    name: "kronos",
                                                    scope: "project",
                                                    mode: "primary",
                                                    model: profile.model ?? "",
                                                    description: "Primary KronosCode orchestration agent.",
                                                    systemprompt:
                                                        "You are Kronos, the primary KronosCode orchestration agent. Coordinate coding, terminal, sandbox, and project management work through available ACP tools.",
                                                });
                                                onUpdateProfile("kronoscode", { model: profile.model });
                                            },
                                        },
                                        {
                                            id: "sandbox-specialist",
                                            title: "Sandbox specialist agent",
                                            icon: "fa-terminal",
                                            description:
                                                "Create a Prometheus-style subagent for terminal, browser, sandbox, and tool-heavy workflows.",
                                            action: () =>
                                                onSaveAgentDefinition("prometheus", {
                                                    backend: "kronoscode",
                                                    name: "prometheus",
                                                    scope: "project",
                                                    mode: "subagent",
                                                    model: profile.model ?? "",
                                                    description: "KronosCode sandbox and terminal specialist.",
                                                    systemprompt:
                                                        "You are Prometheus, a KronosCode subagent for sandbox execution, terminal operations, browser widgets, tool use, and implementation verification.",
                                                }),
                                        },
                                        {
                                            id: "review-command",
                                            title: "/review command",
                                            icon: "fa-code",
                                            description:
                                                "Create a slash command that routes review requests through the ACP command harness.",
                                            action: () =>
                                                onSaveCommand("review", {
                                                    name: "review",
                                                    scope: "project",
                                                    agent: "kronoscode",
                                                    description:
                                                        "Review code for bugs, regressions, and missing validation.",
                                                    template:
                                                        "Review this codebase or change. Prioritize bugs, regressions, risks, and missing tests. Context:\n\n$ARGUMENTS",
                                                }),
                                        },
                                        {
                                            id: "sandbox-command",
                                            title: "/sandbox command",
                                            icon: "fa-display",
                                            description:
                                                "Create a command for sandbox terminal/browser execution plans and direct handoff.",
                                            action: () =>
                                                onSaveCommand("sandbox", {
                                                    name: "sandbox",
                                                    scope: "project",
                                                    agent: "kronoscode",
                                                    description:
                                                        "Use sandbox tools and terminal timeline for the requested task.",
                                                    template:
                                                        "Use the sandbox and terminal tools for this task. Show the timeline-relevant actions and hand off direct terminal control when needed.\n\n$ARGUMENTS",
                                                }),
                                        },
                                        {
                                            id: "ui-skill",
                                            title: "Kronos UI skill",
                                            icon: "fa-book",
                                            description:
                                                "Create a skill with KronTerm UI conventions for composer, widgets, and dense app surfaces.",
                                            action: () =>
                                                onSaveSkill("kronos-ui", {
                                                    name: "kronos-ui",
                                                    scope: "project",
                                                    backend: "kronoscode",
                                                    description: "KronTerm and KronosCode UI implementation guidance.",
                                                    instructions:
                                                        "Build dense, usable KronTerm interfaces that match existing dark workspace patterns. Prefer direct controls, compact panels, lucide or FontAwesome icons, and ACP-backed state over static mockups.",
                                                }),
                                        },
                                        {
                                            id: "provider-config",
                                            title: "Provider configuration",
                                            icon: "fa-cloud",
                                            description:
                                                "Open KronosCode native provider config for models, credentials, and provider catalogs.",
                                            action: onOpenNativeConfig,
                                        },
                                    ].map((preset) => (
                                        <div
                                            key={preset.id}
                                            className="rounded-lg border border-[#2a2a2a] bg-[#101010] p-3"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#171717] text-[#5b9ef5]">
                                                    <i className={cn("fa", preset.icon)} />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-[#d4d4d4]">{preset.title}</div>
                                                    <p className="mt-1 leading-relaxed text-[#8a8580]">
                                                        {preset.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => preset.action()}
                                                className="mt-3 cursor-pointer rounded-md border border-[#1e3a5f] bg-[#162238] px-3 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2f4a]"
                                            >
                                                Create config
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                        {section === "usage" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">ACP Usage</div>
                                <p className="mb-4 text-[#8a8580]">
                                    Usage data is reported by live runtimes. Provider quota credentials remain managed
                                    by the provider, not stored in ACP profiles.
                                </p>
                                <div className="grid gap-2">
                                    {agents.map((agent) => {
                                        const runtime = sessions.find(
                                            (session) => session.backend === agent.backend && session.isLive
                                        );
                                        return (
                                            <div
                                                key={agent.backend}
                                                className="rounded-md border border-[#2a2a2a] bg-[#101010] p-3"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <AcpAgentMark backend={agent.backend} className="h-6 w-6" />
                                                    <span className="font-medium text-[#d4d4d4]">{agent.name}</span>
                                                    <span className="ml-auto text-[10px] uppercase text-[#8a8580]">
                                                        {runtime?.usage ? "Reporting" : "Not set"}
                                                    </span>
                                                </div>
                                                <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-md border border-[#2a2a2a] bg-[#151515] p-2 font-mono text-[10px] text-[#98938c]">
                                                    {runtime?.usage
                                                        ? JSON.stringify(runtime.usage, null, 2)
                                                        : "Start this runtime to receive advertised usage updates."}
                                                </pre>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ) : null}
                        {section === "gitidentities" ? (
                            <section>
                                <div className="mb-2 text-sm font-semibold text-[#d4d4d4]">New Git Profile</div>
                                <p className="mb-5 text-[#8a8580]">
                                    Create an author identity and apply it to the active project repository.
                                </p>
                                <label className="mb-3 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Display Name</span>
                                    <input
                                        value={gitIdentityDraft.name ?? ""}
                                        onChange={(event) =>
                                            setGitIdentityDraft((draft) => ({ ...draft, name: event.target.value }))
                                        }
                                        placeholder="Work Profile, Personal, etc."
                                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
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
                                                gitIdentityDraft.color === color
                                                    ? "border-[#dedad4]"
                                                    : "border-transparent",
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
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">User Name</span>
                                    <input
                                        value={gitIdentityDraft.username ?? ""}
                                        onChange={(event) =>
                                            setGitIdentityDraft((draft) => ({ ...draft, username: event.target.value }))
                                        }
                                        placeholder="John Doe"
                                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <label className="mb-4 block">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">User Email</span>
                                    <input
                                        value={gitIdentityDraft.useremail ?? ""}
                                        onChange={(event) =>
                                            setGitIdentityDraft((draft) => ({
                                                ...draft,
                                                useremail: event.target.value,
                                            }))
                                        }
                                        placeholder="john@example.com"
                                        className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 text-[#d4d4d4] outline-none"
                                    />
                                </label>
                                <div className="mb-4">
                                    <span className="mb-1.5 block font-medium text-[#9e9a93]">Authentication Type</span>
                                    <div className="flex gap-2">
                                        {["ssh", "token"].map((authType) => (
                                            <button
                                                key={authType}
                                                type="button"
                                                onClick={() =>
                                                    setGitIdentityDraft((draft) => ({ ...draft, authtype: authType }))
                                                }
                                                className={cn(
                                                    "cursor-pointer rounded-md border px-3 py-2 capitalize",
                                                    gitIdentityDraft.authtype === authType
                                                        ? "border-[#1e3a5f] bg-[#162238] text-[#5b9ef5]"
                                                        : "border-[#2a2a2a] text-[#9e9a93]"
                                                )}
                                            >
                                                {authType === "ssh" ? "SSH Key" : "Token (HTTPS)"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {gitIdentityDraft.authtype === "ssh" ? (
                                    <label className="mb-4 block">
                                        <span className="mb-1.5 block font-medium text-[#9e9a93]">SSH Key Path</span>
                                        <input
                                            value={gitIdentityDraft.sshkey ?? ""}
                                            onChange={(event) =>
                                                setGitIdentityDraft((draft) => ({
                                                    ...draft,
                                                    sshkey: event.target.value,
                                                }))
                                            }
                                            placeholder="~/.ssh/id_ed25519"
                                            className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#101010] px-3 font-mono text-[11px] text-[#d4d4d4] outline-none"
                                        />
                                    </label>
                                ) : (
                                    <div className="mb-4 rounded-md border border-[#2a2a2a] bg-[#161616] p-3 text-[#8ab4f5]">
                                        HTTPS tokens are not stored in ACP profiles. Configure credentials through the
                                        system credential manager.
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={
                                            !gitIdentityDraft.username?.trim() || !gitIdentityDraft.useremail?.trim()
                                        }
                                        onClick={() => {
                                            const id =
                                                gitIdentityDraft.id ||
                                                gitIdentityDraft.name?.trim().replace(/\s+/g, "-") ||
                                                "git-profile";
                                            onSaveGitIdentity(id, { ...gitIdentityDraft, id });
                                        }}
                                        className="cursor-pointer rounded-md border border-[#1e3a5f] bg-[#162238] px-4 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2f4a] disabled:opacity-40"
                                    >
                                        Save profile
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            !activeSession?.workspace ||
                                            !gitIdentityDraft.username?.trim() ||
                                            !gitIdentityDraft.useremail?.trim()
                                        }
                                        onClick={() => void onApplyGitIdentity(gitIdentityDraft)}
                                        className="cursor-pointer rounded-md border border-[#1e2a3a] bg-[#161c28] px-4 py-2 font-medium text-[#5b9ef5] hover:bg-[#1e2a3a] disabled:opacity-40"
                                    >
                                        Apply to active project
                                    </button>
                                </div>
                                <div className="mt-4 font-mono text-[11px] text-[#8a8580]">
                                    {activeSession?.workspace ||
                                        "Select a session with a project workspace to apply this identity."}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }
);

SettingsPanel.displayName = "SettingsPanel";
