// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { atoms } from "@/store/global";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AcpAgentMark } from "./acp-agent-mark";
import { CodeCard, CopyablePre, PreviewAttachmentCard, extractPreviewTargets } from "./chat-cards";
import type { AcpAgentMessage, AcpBackendInfo, AcpCapabilityLease, AcpModelInfo } from "./use-acp-session";

// ─── StatusChip ──────────────────────────────────────────────────────────────

interface StatusChipProps {
    agent: AcpBackendInfo | null;
    modelInfo?: AcpModelInfo | null;
    status: string;
    mode?: string;
}

export const StatusChip = memo(({ agent, modelInfo, status, mode }: StatusChipProps) => {
    const modelLabel = modelInfo?.currentModelLabel ?? modelInfo?.currentModelId ?? "Auto";
    const isRunning = status === "running";

    return (
        <div className="flex items-center gap-2 text-[11px] text-[#8a8580]">
            <span className="flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#161616] px-2 py-1">
                <AcpAgentMark backend={agent?.backend ?? "kronoscode"} className="h-4 w-4" />
                <span
                    className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isRunning ? "animate-pulse bg-[#5b9ef5]" : status === "error" ? "bg-[#dc7668]" : "bg-[#6b6863]"
                    )}
                />
                <span className="font-medium text-[#d4d4d4]">{agent?.name ?? "KronosCode"}</span>
            </span>
            {mode ? (
                <span className="rounded-md border border-[#1e2a3a] bg-[#161c28] px-2 py-0.5 font-medium text-[#5b9ef5]">
                    {mode}
                </span>
            ) : null}
            <span className="hidden rounded-md border border-[#2a2a2a] bg-[#161616] px-2 py-0.5 lg:inline">
                {modelLabel}
            </span>
        </div>
    );
});

StatusChip.displayName = "StatusChip";

// ─── ChatEmptyState ──────────────────────────────────────────────────────────

interface ChatEmptyStateProps {
    agent: AcpBackendInfo | null;
    agents: AcpBackendInfo[];
    onSelectAgent: (agent: AcpBackendInfo) => void | Promise<void>;
    onConfigureAgents: () => void;
    onPrompt: (prompt: string) => void;
}

const suggestionCards = [
    { prompt: "Explain this codebase", icon: "fa-diagram-project", description: "Map project structure" },
    { prompt: "Fix a failing workflow", icon: "fa-bug", description: "Debug CI and build issues" },
    { prompt: "Review these changes", icon: "fa-code-pull-request", description: "Analyze diffs and PRs" },
    { prompt: "Implement a feature", icon: "fa-wrench", description: "Plan and ship functionality" },
];

export const ChatEmptyState = memo(
    ({ agent, agents, onSelectAgent, onConfigureAgents, onPrompt }: ChatEmptyStateProps) => {
        const primaryAgent = agent ?? agents.find((a) => a.backend === "kronoscode") ?? agents[0];

        return (
            <div className="flex h-full flex-col items-center justify-center px-5 pb-8 text-center">
                <div className="relative mb-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#161616]">
                        <AcpAgentMark backend={primaryAgent?.backend ?? "kronoscode"} className="h-9 w-9" />
                    </div>
                    <span
                        className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111111]",
                            primaryAgent?.available ? "bg-[#5b9ef5]" : "bg-[#6b6863]"
                        )}
                    />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#eeeeee]">
                    {primaryAgent?.name ?? "KronosCode"}
                </h2>
                <p className="mt-1.5 max-w-[300px] text-sm leading-relaxed text-[#8a8580]">
                    Agent for your workspace. Runs tools, edits files, and works alongside you.
                </p>

                <div className="mt-5 flex max-w-full items-center overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#151515] p-1">
                    {primaryAgent ? (
                        <button
                            type="button"
                            onClick={() => void onSelectAgent(primaryAgent)}
                            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs font-semibold text-[#eeeeee]"
                        >
                            <AcpAgentMark backend={primaryAgent.backend} className="h-5 w-5" />
                            {primaryAgent.name}
                            {!primaryAgent.available ? (
                                <span className="text-[10px] font-normal text-[#6b6863]">not installed</span>
                            ) : null}
                        </button>
                    ) : null}
                    {agents
                        .filter((a) => a.backend !== primaryAgent?.backend)
                        .map((altAgent) => (
                            <button
                                key={altAgent.backend}
                                type="button"
                                onClick={() => void onSelectAgent(altAgent)}
                                className={cn(
                                    "ml-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[#1a1a1a]",
                                    !altAgent.available && "opacity-40"
                                )}
                                title={`${altAgent.name}${altAgent.available ? "" : " (not installed)"}`}
                            >
                                <AcpAgentMark backend={altAgent.backend} className="h-5 w-5" />
                            </button>
                        ))}
                    <button
                        type="button"
                        onClick={onConfigureAgents}
                        className="ml-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#6b6863] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
                        title="Configure agents"
                    >
                        <i className="fa fa-plus text-[10px]" />
                    </button>
                </div>

                <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2.5">
                    {suggestionCards.map((card) => (
                        <button
                            key={card.prompt}
                            type="button"
                            onClick={() => onPrompt(card.prompt)}
                            className="group cursor-pointer rounded-lg border border-[#2a2a2a] bg-[#151515] p-3 text-left transition-colors hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
                        >
                            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111111]">
                                <i className={cn("fa", card.icon, "text-[10px] text-[#5b9ef5]")} />
                            </div>
                            <div className="text-xs font-medium text-[#d4d4d4]">{card.prompt}</div>
                            <div className="mt-0.5 text-[10px] text-[#6b6863]">{card.description}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
);

ChatEmptyState.displayName = "ChatEmptyState";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessageText(message: AcpAgentMessage): string {
    const data = message.data;
    if (typeof data === "string") return data;
    if (data == null) return "";
    if (typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (typeof obj.text === "string") return obj.text;
        const content = obj.content;
        if (typeof content === "object" && content != null) {
            const contentText = (content as Record<string, unknown>).text;
            if (typeof contentText === "string") return contentText;
        }
    }
    return "";
}

// ─── ReasoningTrace ──────────────────────────────────────────────────────────

const ReasoningTrace = memo(
    ({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) => {
        const lines = text.split("\n").filter(Boolean);
        const preview = lines[lines.length - 1] ?? text.slice(0, 80);

        return (
            <div className="ml-9 border-l border-[#2a2a2a] pl-3">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex w-full cursor-pointer items-center gap-2 py-1 text-left"
                >
                    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                        <span className="absolute h-4 w-4 animate-ping rounded-full bg-[#5b9ef5]/20" />
                        <span className="relative h-2 w-2 rounded-full bg-[#5b9ef5]" />
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b6863]">
                        Reasoning
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#7f7b75]">{preview}</span>
                    <i
                        className={cn(
                            "fa fa-chevron-down text-[9px] text-[#6b6863] transition-transform",
                            expanded && "rotate-180"
                        )}
                    />
                </button>
                {expanded ? (
                    <div className="mb-2 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#2a2a2a] bg-[#0d0d0d] p-2.5">
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#8a8580]">
                            {text}
                        </pre>
                    </div>
                ) : null}
            </div>
        );
    }
);

ReasoningTrace.displayName = "ReasoningTrace";

// ─── ChatMessage ─────────────────────────────────────────────────────────────

interface ChatMessageProps {
    message: AcpAgentMessage;
    assistantLabel: string;
    agentBackend: string;
    mode?: string;
    canvasBlockId?: string;
}

const InsertIntoCanvasButton = memo(
    ({ canvasBlockId, content, title }: { canvasBlockId?: string; content: string; title: string }) => {
        const workspaceId = useAtomValue(atoms.workspaceId);
        const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
        const insert = useCallback(async () => {
            if (!canvasBlockId || !content.trim()) {
                return;
            }
            setState("saving");
            try {
                const nodeId = `chat-${Date.now()}`;
                await RpcApi.CanvasCreateNodeCommand(TabRpcClient, {
                    workspaceid: workspaceId,
                    blockid: canvasBlockId,
                    node: {
                        id: nodeId,
                        shapeid: nodeId,
                        type: "text",
                        title,
                        content,
                        status: "inserted",
                    },
                });
                setState("saved");
                window.setTimeout(() => setState("idle"), 1600);
            } catch (e) {
                console.error("failed to insert message into canvas", e);
                setState("error");
            }
        }, [canvasBlockId, content, title, workspaceId]);
        if (!canvasBlockId || !content.trim()) {
            return null;
        }
        return (
            <button
                type="button"
                onClick={() => void insert()}
                className="mt-1.5 cursor-pointer rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 text-[10px] text-[#8a8580] opacity-0 transition-opacity hover:text-[#d4d4d4] group-hover:opacity-100"
                title="Insert into Canvas"
            >
                <i
                    className={cn(
                        "fa",
                        state === "saving"
                            ? "fa-spinner fa-spin"
                            : state === "saved"
                              ? "fa-check text-[#5b9ef5]"
                              : state === "error"
                                ? "fa-triangle-exclamation text-[#dc7668]"
                                : "fa-diagram-project",
                        "mr-1"
                    )}
                />
                {state === "saving" ? "Inserting" : state === "saved" ? "Inserted" : "Insert into Canvas"}
            </button>
        );
    }
);

InsertIntoCanvasButton.displayName = "InsertIntoCanvasButton";

export const ChatMessage = memo(({ message, assistantLabel, agentBackend, mode, canvasBlockId }: ChatMessageProps) => {
    const [copied, setCopied] = useState(false);
    const text = getMessageText(message);
    const previewTargets = useMemo(() => extractPreviewTargets(text), [text]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    if (message.type === "tool_call" || message.type === "tool_call_update") {
        return <ToolCallMessage canvasBlockId={canvasBlockId} message={message} />;
    }

    if (message.type === "harness_lease") {
        const data = message.data as { lease?: AcpCapabilityLease; profile?: { summary?: string } } | null;
        const lease = data?.lease;
        if (!lease) {
            return null;
        }
        return (
            <div className="ml-8 rounded-lg border border-[#1e2a3a] bg-[#121824] px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <i className="fa fa-shield-halved text-[11px] text-[#5b9ef5]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b9ef5]">
                        Specialist lease
                    </span>
                    <span className="rounded border border-[#273953] bg-[#161c28] px-1.5 py-0.5 text-[10px] text-[#a8c9f5]">
                        {lease.taskClass}
                    </span>
                    <span className="ml-auto font-mono text-[9px] text-[#6b6863]">
                        {lease.id.split(":")[0].slice(0, 8)}
                    </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#9e9a93]">{lease.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {lease.capabilities.map((capability) => (
                        <span
                            key={capability}
                            className="rounded border border-[#2a2a2a] bg-[#101010] px-1.5 py-0.5 font-mono text-[9px] text-[#8a8580]"
                        >
                            {capability}
                        </span>
                    ))}
                </div>
                <div className="mt-2 truncate font-mono text-[9px] text-[#6b6863]" title={lease.workspace}>
                    workspace only · approval for writes and external effects · {lease.workspace}
                </div>
            </div>
        );
    }

    const isUser = message.type === "user_message";
    const isThought = message.type === "agent_thought_chunk";

    if (!text && !isThought) return null;

    if (isThought) {
        return null;
    }

    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="group relative max-w-[88%]">
                    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5">
                        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[#6b6863]">
                            You
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#e4e4e4]">{text}</div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="absolute -bottom-5 right-0 cursor-pointer rounded p-1 text-[10px] text-[#6b6863] opacity-0 transition-opacity hover:text-[#d4d4d4] group-hover:opacity-100"
                        title="Copy"
                    >
                        <i className={cn("fa", copied ? "fa-check text-[#5b9ef5]" : "fa-copy")} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group flex gap-2.5">
            <AcpAgentMark backend={agentBackend} className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#d4d4d4]">{assistantLabel}</span>
                    {mode ? (
                        <span className="rounded border border-[#1e2a3a] bg-[#161c28] px-1.5 py-0.5 text-[10px] font-medium text-[#5b9ef5]">
                            {mode}
                        </span>
                    ) : null}
                    <span className="text-[10px] text-[#6b6863]">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
                <div className="text-sm leading-relaxed text-[#d4d4d4]">
                    <div className="whitespace-pre-wrap">{text}</div>
                </div>
                {previewTargets.map((target) => (
                    <PreviewAttachmentCard key={target} target={target} />
                ))}
                <button
                    type="button"
                    onClick={handleCopy}
                    className="mt-1.5 cursor-pointer rounded p-1 text-[10px] text-[#6b6863] opacity-0 transition-opacity hover:text-[#d4d4d4] group-hover:opacity-100"
                    title="Copy"
                >
                    <i className={cn("fa", copied ? "fa-check text-[#5b9ef5]" : "fa-copy")} />
                </button>
                <InsertIntoCanvasButton canvasBlockId={canvasBlockId} content={text} title="Assistant message" />
            </div>
        </div>
    );
});

ChatMessage.displayName = "ChatMessage";

// ─── ToolCallMessage ─────────────────────────────────────────────────────────

const ToolCallMessage = memo(({ canvasBlockId, message }: { canvasBlockId?: string; message: AcpAgentMessage }) => {
    const [expanded, setExpanded] = useState(false);
    const data = message.data as Record<string, unknown> | null;
    const content = Array.isArray(data?.content) ? (data.content as Array<Record<string, unknown>>) : [];
    const state = (data?.status as string) ?? "pending";
    const title = (data?.title as string) ?? (data?.kind as string) ?? "Tool";

    const statusConfig = {
        completed: { dot: "bg-[#5b9ef5]", label: "done", icon: "fa-check" },
        failed: { dot: "bg-[#dc6554]", label: "failed", icon: "fa-xmark" },
        pending: { dot: "bg-[#d7a85d] animate-pulse", label: "running", icon: "fa-spinner fa-spin" },
    };
    const config = statusConfig[state as keyof typeof statusConfig] ?? statusConfig.pending;
    const isRunning = state === "pending";

    return (
        <div className="ml-8">
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-left transition-colors hover:bg-[#1a1a1a]"
            >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
                <i
                    className={cn(
                        "fa",
                        isRunning ? "fa-terminal text-[#5b9ef5]" : config.icon,
                        "text-[10px] text-[#8a8580]"
                    )}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#d4d4d4]">{title}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6b6863]">
                    {config.label}
                </span>
                <i
                    className={cn(
                        "fa fa-chevron-down text-[9px] text-[#6b6863] transition-transform",
                        expanded && "rotate-180"
                    )}
                />
            </button>
            {expanded ? (
                <div className="mt-1 space-y-2 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] p-2.5">
                    {data != null && typeof data.rawInput === "object" ? (
                        <CodeCard title="Input">
                            <CopyablePre text={JSON.stringify(data.rawInput, null, 2)} maxHeight="max-h-32" />
                        </CodeCard>
                    ) : null}
                    {content.length > 0 ? (
                        <div className="space-y-2">
                            {content.map((item, index) => {
                                let text: string | null = null;
                                if (item?.type === "diff") {
                                    text = (item.newText as string) ?? (item.oldText as string) ?? null;
                                } else {
                                    const itemContent = item?.content as Record<string, unknown> | null;
                                    text = typeof itemContent?.text === "string" ? itemContent.text : null;
                                }
                                if (!text) return null;
                                return (
                                    <CodeCard key={index} title={item?.type === "diff" ? "Diff" : "Output"}>
                                        <CopyablePre text={text} />
                                        <InsertIntoCanvasButton
                                            canvasBlockId={canvasBlockId}
                                            content={text}
                                            title={item?.type === "diff" ? "Tool diff" : "Tool output"}
                                        />
                                    </CodeCard>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
});

ToolCallMessage.displayName = "ToolCallMessage";

// ─── ChatMessageList ─────────────────────────────────────────────────────────

interface ChatMessageListProps {
    messages: AcpAgentMessage[];
    assistantLabel: string;
    agentBackend: string;
    mode: string;
    canvasBlockId?: string;
}

export const ChatMessageList = memo(
    ({ messages, assistantLabel, agentBackend, mode, canvasBlockId }: ChatMessageListProps) => {
        const [reasoningExpanded, setReasoningExpanded] = useState(false);

        const visibleMessages = messages.filter(
            (message) =>
                !["status", "session_id", "config_option", "usage", "agent_info", "finish"].includes(message.type)
        );

        const combinedMessages = visibleMessages.reduce<AcpAgentMessage[]>((combined, message) => {
            const prior = combined[combined.length - 1];
            const streamsText = message.type === "agent_message_chunk" || message.type === "agent_thought_chunk";
            if (prior?.type === message.type && streamsText) {
                const text = `${getMessageText(prior)}${getMessageText(message)}`;
                combined[combined.length - 1] = { ...prior, data: { text }, timestamp: message.timestamp };
                return combined;
            }
            combined.push(message);
            return combined;
        }, []);

        const reasoningText = useMemo(() => {
            return combinedMessages
                .filter((m) => m.type === "agent_thought_chunk")
                .map((m) => getMessageText(m))
                .join("");
        }, [combinedMessages]);

        const displayMessages = combinedMessages.filter((m) => m.type !== "agent_thought_chunk");

        if (!displayMessages.length && !reasoningText) {
            return null;
        }

        return (
            <div className="mx-auto w-full max-w-3xl space-y-5">
                {displayMessages.map((message) => (
                    <ChatMessage
                        key={message.msgId}
                        message={message}
                        assistantLabel={assistantLabel}
                        agentBackend={agentBackend}
                        canvasBlockId={canvasBlockId}
                        mode={mode}
                    />
                ))}
                {reasoningText ? (
                    <ReasoningTrace
                        text={reasoningText}
                        expanded={reasoningExpanded}
                        onToggle={() => setReasoningExpanded((e) => !e)}
                    />
                ) : null}
            </div>
        );
    }
);

ChatMessageList.displayName = "ChatMessageList";

// ─── TypingIndicator ─────────────────────────────────────────────────────────

interface TypingIndicatorProps {
    agentBackend?: string;
    detail?: string;
}

export const TypingIndicator = memo(({ agentBackend = "kronoscode", detail = "Working" }: TypingIndicatorProps) => {
    const [tick, setTick] = useState(0);
    const frameRef = useRef(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            frameRef.current = (frameRef.current + 1) % 4;
            setTick(frameRef.current);
        }, 400);
        return () => window.clearInterval(interval);
    }, []);

    const dots = ".".repeat(tick === 0 ? 1 : tick);

    return (
        <div className="flex gap-2.5">
            <AcpAgentMark backend={agentBackend} className="mt-0.5 h-6 w-6 shrink-0 opacity-80" />
            <div className="flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2">
                <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                    <span className="absolute h-3 w-3 animate-ping rounded-full bg-[#5b9ef5]/25" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-[#5b9ef5]" />
                </span>
                <span className="font-mono text-xs text-[#8a8580]">
                    {detail}
                    <span className="inline-block w-3 text-[#5b9ef5]">{dots}</span>
                </span>
            </div>
        </div>
    );
});

TypingIndicator.displayName = "TypingIndicator";
