// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { memo, useEffect, useState } from "react";

type ProviderModel = { id: string; name?: string; toolCall?: boolean; reasoning?: boolean; status?: string };
type Provider = { id: string; name?: string; connected?: boolean; defaultModelId?: string; models?: ProviderModel[] };

const ProviderCard = memo(({ provider }: { provider: Provider }) => {
    const [expanded, setExpanded] = useState(false);
    const models = provider.models ?? [];
    return (
        <div className="border border-border rounded-md bg-black/20 overflow-hidden">
            <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", provider.connected ? "bg-green-400" : "bg-zinc-500")} />
                    <span className="text-sm font-medium text-primary">{provider.name ?? provider.id}</span>
                    <span className="text-[10px] text-secondary">({models.length} models)</span>
                </div>
                <i className={cn("fa-solid fa-chevron-down text-secondary text-[10px] transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && models.length > 0 && (
                <div className="border-t border-border/50 px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                    {models.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className={cn("text-secondary font-mono", m.id === provider.defaultModelId && "text-accent font-semibold")}>
                                {m.name ?? m.id}
                                {m.id === provider.defaultModelId && <span className="ml-1 text-[9px] text-accent/70">(default)</span>}
                            </span>
                            <div className="flex items-center gap-1.5 text-muted">
                                {m.toolCall && <span title="Tool calls" className="text-[9px] px-1 bg-blue-900/30 border border-blue-700/30 rounded text-blue-400">tools</span>}
                                {m.reasoning && <span title="Reasoning" className="text-[9px] px-1 bg-purple-900/30 border border-purple-700/30 rounded text-purple-400">reason</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
ProviderCard.displayName = "ProviderCard";

export const ProvidersPanel = memo(() => {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("http://127.0.0.1:3001/config/providers")
            .then((r) => r.json())
            .then((d) => {
                const raw: any[] = d?.data?.providers ?? d?.providers ?? d?.all ?? [];
                const list: Provider[] = raw.map((p: any) => ({
                    id: p.id ?? p.providerID ?? "",
                    name: p.name ?? p.displayName ?? p.id,
                    connected: true,
                    defaultModelId: p.defaultModelId,
                    models: (Array.isArray(p.models) ? p.models : Object.values(p.models ?? {}))
                        .map((m: any) => ({ id: m.id ?? m.modelID ?? "", name: m.name ?? m.label ?? m.id, toolCall: Boolean(m.toolCall ?? m.tool_call), reasoning: Boolean(m.reasoning), status: m.status }))
                        .filter((m: ProviderModel) => m.id)
                        .slice(0, 100),
                })).filter((p: Provider) => p.id);
                if (!cancelled) setProviders(list);
            })
            .catch(() => { if (!cancelled) setError("KronosCode not running — provider list unavailable"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                    <i className="fa-solid fa-plug text-accent" /> Providers
                </h3>
                {loading && <i className="fa-solid fa-spinner fa-spin text-secondary text-xs" />}
            </div>
            {error && (
                <div className="mb-3 px-3 py-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-400 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation" /> {error}
                </div>
            )}
            {!loading && providers.length === 0 && !error && (
                <div className="text-center py-8 text-secondary text-sm">
                    <i className="fa-solid fa-plug text-3xl mb-3 block opacity-30" />
                    No providers configured
                    <p className="text-xs mt-2 text-muted">Configure providers in KronosCode settings</p>
                </div>
            )}
            <div className="space-y-2">
                {providers.map((p) => <ProviderCard key={p.id} provider={p} />)}
            </div>
        </div>
    );
});
ProvidersPanel.displayName = "ProvidersPanel";
