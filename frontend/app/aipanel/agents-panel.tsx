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
    {
        id: "kronoscode",
        name: "KronosCode",
        kind: "kronoscode",
        status: "ready",
        available: true,
        icon: "⬡",
        description: "Main AI coding agent",
    },
    {
        id: "computer-use-mcp",
        name: "Kron Computer Use",
        kind: "mcp",
        status: "missing",
        available: false,
        icon: "▣",
        description: "Native desktop control with visual cursor motion",
    },
    {
        id: "kronterm-desktop",
        name: "Kronterm Desktop",
        kind: "desktop",
        status: "missing",
        available: false,
        icon: "▤",
        description: "Desktop automation",
    },
    {
        id: "codex",
        name: "Codex",
        kind: "acp",
        status: "missing",
        available: false,
        icon: "◈",
        description: "OpenAI Codex CLI",
        install: { command: ["npm", "i", "-g", "@openai/codex"] },
    },
    {
        id: "gemini",
        name: "Gemini",
        kind: "acp",
        status: "missing",
        available: false,
        icon: "✦",
        description: "Google Gemini CLI",
        install: { command: ["npm", "i", "-g", "@google/gemini-cli"] },
    },
];

const AgentCard = memo(({ agent }: { agent: CatalogAgent }) => {
    const s = STATUS_CFG[agent.status] ?? STATUS_CFG.error;
    return (
        <div className={cn("ai-agent-card", !agent.available && "unavailable")}>
            <div className="ai-agent-icon">{agent.icon ?? "◉"}</div>
            <div className="ai-agent-info">
                <div className="ai-agent-name-row">
                    <span className="ai-agent-name">{agent.name}</span>
                    <span className="ai-agent-kind">{agent.kind}</span>
                </div>
                {agent.description && <p className="ai-agent-description">{agent.description}</p>}
                {agent.reason && <p className="ai-agent-reason">{agent.reason}</p>}
                {!agent.available && agent.install?.command && (
                    <code className="ai-agent-install">{agent.install.command.join(" ")}</code>
                )}
            </div>
            <div className={cn("ai-agent-status", agent.status)}>
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
        fetch("http://127.0.0.1:4096/agent/catalog")
            .then((r) => r.json())
            .then((d) => {
                const list: CatalogAgent[] = d?.data?.agents ?? d?.agents ?? [];
                if (!cancelled && list.length > 0) setAgents(list.slice(0, 50));
            })
            .catch(() => {
                if (!cancelled) setNotice("KronosCode not running — showing defaults");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const available = agents.filter((a) => a.available);
    const unavailable = agents.filter((a) => !a.available);

    return (
        <div className="ai-agents-panel">
            <div className="ai-agents-header">
                <h3>
                    <i className="fa-solid fa-robot" /> Agents
                </h3>
                {loading && <i className="fa-solid fa-spinner fa-spin text-secondary text-xs" />}
            </div>
            {notice && (
                <div className="ai-agents-notice">
                    <i className="fa-solid fa-triangle-exclamation" /> {notice}
                </div>
            )}
            {available.length > 0 && (
                <div className="ai-agents-section">
                    <div className="ai-agents-section-title available">Available ({available.length})</div>
                    <div className="ai-agents-list">
                        {available.map((a) => (
                            <AgentCard key={a.id} agent={a} />
                        ))}
                    </div>
                </div>
            )}
            {unavailable.length > 0 && (
                <div className="ai-agents-section">
                    <div className="ai-agents-section-title">Not Available ({unavailable.length})</div>
                    <div className="ai-agents-list">
                        {unavailable.map((a) => (
                            <AgentCard key={a.id} agent={a} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
AgentsPanel.displayName = "AgentsPanel";
