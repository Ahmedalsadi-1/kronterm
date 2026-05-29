// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { memo, useEffect, useState } from "react";

type AgentStatus = "ready" | "missing" | "auth-needed" | "error";

type CatalogAgent = {
    id: string;
    name: string;
    kind: string;
    status: AgentStatus;
    available: boolean;
    icon?: string;
    description?: string;
    reason?: string;
    install?: { command?: string[] };
};

const STATUS_CFG: Record<AgentStatus, { label: string; color: string; icon: string }> = {
    ready: { label: "Ready", color: "text-green-400", icon: "fa-circle-check" },
    missing: { label: "Not Installed", color: "text-yellow-400", icon: "fa-circle-exclamation" },
    "auth-needed": { label: "Auth Required", color: "text-orange-400", icon: "fa-key" },
    error: { label: "Error", color: "text-red-400", icon: "fa-circle-xmark" },
};

const FALLBACK: CatalogAgent[] = [
    { id: "kronoscode", name: "KronosCode", kind: "kronoscode", status: "ready", available: true, icon: "⬡", description: "Main AI coding agent" },
    { id: "computer-use-mcp", name: "Bytebot MCP", kind: "mcp", status: "missing", available: false, icon: "▣", description: "Computer use via MCP" },
    { id: "bytebot-desktop", name: "Bytebot Desktop", kind: "desktop", status: "missing", available: false, icon: "▤", description: "Desktop automation" },
    { id: "codex", name: "Codex", kind: "acp", status: "missing", available: false, icon: "◈", description: "OpenAI Codex CLI", install: { command: ["npm", "i", "-g", "@openai/codex"] } },
    { id: "gemini", name: "Gemini", kind: "acp", status: "missing", available: false, icon: "✦", description: "Google Gemini CLI", install: { command: ["npm", "i", "-g", "@google/gemini-cli"] } },
];

const AgentCard = memo(({ agent }: { agent: CatalogAgent }) => {
    const s = STATUS_CFG[agent.status] ?? STATUS_CFG.error;
    return (
        <div className={cn("flex items-start gap-3 p-3 rounded-md border", agent.available ? "border-border bg-black/20" : "border-border/40 bg-black/10 opacity-70")}>
            <div className="text-xl w-7 text-center flex-shrink-0 mt-0.5">{agent.icon ?? "◉"}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-primary">{agent.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-secondary border border-border/50">{agent.kind}</span>
                </div>
                {agent.description && <p className="text-xs text-secondary mt-0.5">{agent.description}</p>}
                {agent.reason && <p className="text-xs text-muted mt-0.5 italic">{agent.reason}</p>}
                {!agent.available && agent.install?.command && (
                    <code className="mt-1 block text-[10px] bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-accent font-mono">
                        {agent.install.command.join(" ")}
                    </code>
                )}
            </div>
            <div className={cn("flex items-center gap-1 text-xs flex-shrink-0", s.color)}>
                <i className={cn("fa-solid", s.icon, "text-[11px]")} />
                <span className="hidden @xs:inline">{s.label}</span>
            </div>
        </div>
    );
});
AgentCard.displayName = "AgentCard";

export const AgentsPanel = memo(() => {
    const [agents, setAgents] = useState<CatalogAgent[]>(FALLBACK);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("http://127.0.0.1:3001/agent/catalog")
            .then((r) => r.json())
            .then((d) => {
                const list: CatalogAgent[] = d?.data?.agents ?? d?.agents ?? [];
                if (!cancelled && list.length > 0) setAgents(list.slice(0, 50));
            })
            .catch(() => { if (!cancelled) setNotice("KronosCode not running — showing defaults"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const available = agents.filter((a) => a.available);
    const unavailable = agents.filter((a) => !a.available);

    return (
        <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                    <i className="fa-solid fa-robot text-accent" /> Agents
                </h3>
                {loading && <i className="fa-solid fa-spinner fa-spin text-secondary text-xs" />}
            </div>
            {notice && (
                <div className="mb-3 px-3 py-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-400 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation" /> {notice}
                </div>
            )}
            {available.length > 0 && (
                <div className="mb-4">
                    <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 px-1">Available ({available.length})</div>
                    <div className="space-y-2">{available.map((a) => <AgentCard key={a.id} agent={a} />)}</div>
                </div>
            )}
            {unavailable.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 px-1">Not Available ({unavailable.length})</div>
                    <div className="space-y-2">{unavailable.map((a) => <AgentCard key={a.id} agent={a} />)}</div>
                </div>
            )}
        </div>
    );
});
AgentsPanel.displayName = "AgentsPanel";
