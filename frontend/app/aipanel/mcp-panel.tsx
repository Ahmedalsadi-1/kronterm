// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";

type MCPServerConfig = { enabled?: boolean; type?: string; command?: string[]; url?: string };
type MCPServerStatus = { name: string; status: string; error?: string };

const ServerRow = memo(
    ({
        name,
        config,
        status,
        toolCount,
        onConnect,
        onDisconnect,
    }: {
        name: string;
        config: MCPServerConfig;
        status?: MCPServerStatus;
        toolCount?: number;
        onConnect: () => void;
        onDisconnect: () => void;
    }) => {
        const isEnabled = config.enabled !== false;
        const isHttp = config.type === "streamable-http" || config.type === "sse" || Boolean(config.url);
        const health = status?.status ?? (isEnabled ? "disconnected" : "disabled");
        const isConnected = health === "connected";
        const isBusy = health === "connecting";
        const isHealthy = isConnected || isBusy;
        return (
            <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-black/20">
                <div
                    className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
                        isConnected && "bg-green-400",
                        isBusy && "animate-pulse bg-amber-400",
                        !isHealthy && "bg-zinc-500"
                    )}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">{name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-secondary border border-border/50">
                            {isHttp ? "http" : "stdio"}
                        </span>
                    </div>
                    {status?.error && <p className="text-xs text-red-400 mt-1">{status.error}</p>}
                    {isConnected && toolCount != null && (
                        <p className="mt-1 text-[10px] text-secondary">{toolCount} discovered tools</p>
                    )}
                    {(config.url || config.command) && (
                        <details className="mt-1 text-[10px] text-muted">
                            <summary className="cursor-pointer select-none hover:text-secondary">diagnostics</summary>
                            {config.url && <p className="mt-1 truncate font-mono text-secondary">{config.url}</p>}
                            {config.command && (
                                <p className="mt-1 truncate font-mono text-secondary">{config.command.join(" ")}</p>
                            )}
                        </details>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <span className={cn("text-xs flex-shrink-0", isHealthy ? "text-green-400" : "text-muted")}>
                        {health}
                    </span>
                    {isEnabled && !isConnected ? (
                        <button
                            type="button"
                            onClick={onConnect}
                            disabled={isBusy}
                            className="cursor-pointer text-[10px] text-accent hover:text-primary disabled:cursor-default disabled:text-muted"
                        >
                            connect
                        </button>
                    ) : null}
                    {isConnected ? (
                        <button
                            type="button"
                            onClick={onDisconnect}
                            className="cursor-pointer text-[10px] text-secondary hover:text-primary"
                        >
                            disconnect
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }
);
ServerRow.displayName = "ServerRow";

export const McpPanel = memo(() => {
    const storedEnabled = useAtomValue(getSettingsKeyAtom("mcp:enabled" as Parameters<typeof getSettingsKeyAtom>[0]));
    const storedServers = useAtomValue(getSettingsKeyAtom("mcp:servers" as Parameters<typeof getSettingsKeyAtom>[0]));
    const [mcpEnabled, setMcpEnabled] = useState(Boolean(storedEnabled));
    const [statuses, setStatuses] = useState<Record<string, MCPServerStatus>>({});
    const [toolCounts, setToolCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        setMcpEnabled(Boolean(storedEnabled));
    }, [storedEnabled]);

    const refreshStatuses = () => {
        void RpcApi.McpGetStatusCommand(TabRpcClient)
            .then(async (nextStatuses) => {
                setStatuses(nextStatuses);
                const connectedServers = Object.values(nextStatuses).filter((status) => status.status === "connected");
                const discoveredTools = await Promise.all(
                    connectedServers.map(async ({ name }) => {
                        const tools = await RpcApi.McpListToolsCommand(TabRpcClient, name);
                        return [name, tools.length] as const;
                    })
                );
                setToolCounts(Object.fromEntries(discoveredTools));
            })
            .catch(() => undefined);
    };

    useEffect(() => {
        refreshStatuses();
        const timer = window.setInterval(refreshStatuses, 5000);
        return () => window.clearInterval(timer);
    }, [storedServers, mcpEnabled]);

    const servers = (storedServers as Record<string, MCPServerConfig> | null) ?? {};
    const serverEntries = Object.entries(servers);

    const toggleEnabled = () => {
        const next = !mcpEnabled;
        setMcpEnabled(next);
        void RpcApi.SetConfigCommand(TabRpcClient, { "mcp:enabled": next });
    };

    const connectServer = (name: string) => {
        setStatuses((current) => ({ ...current, [name]: { name, status: "connecting" } }));
        void RpcApi.McpConnectCommand(TabRpcClient, name)
            .catch((error) => {
                setStatuses((current) => ({ ...current, [name]: { name, status: "error", error: String(error) } }));
            })
            .finally(refreshStatuses);
    };

    const disconnectServer = (name: string) => {
        void RpcApi.McpDisconnectCommand(TabRpcClient, name)
            .catch((error) => {
                setStatuses((current) => ({ ...current, [name]: { name, status: "error", error: String(error) } }));
            })
            .finally(refreshStatuses);
    };

    return (
        <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                    <i className="fa-solid fa-server text-accent" /> MCP
                </h3>
                <button
                    onClick={toggleEnabled}
                    className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer",
                        mcpEnabled ? "bg-accent" : "bg-zinc-600"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                            mcpEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                    />
                </button>
            </div>

            {!mcpEnabled && (
                <div className="mb-4 px-3 py-2 bg-zinc-900/50 border border-border/50 rounded text-xs text-secondary flex items-center gap-2">
                    <i className="fa-solid fa-circle-info text-accent" /> MCP is disabled. Toggle above to enable.
                </div>
            )}

            {serverEntries.length > 0 ? (
                <div>
                    <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 px-1">
                        Configured Servers ({serverEntries.length})
                    </div>
                    <div className="space-y-2">
                        {serverEntries.map(([name, cfg]) => (
                            <ServerRow
                                key={name}
                                name={name}
                                config={cfg}
                                status={statuses[name]}
                                toolCount={toolCounts[name]}
                                onConnect={() => connectServer(name)}
                                onDisconnect={() => disconnectServer(name)}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-secondary text-sm">
                    <i className="fa-solid fa-server text-3xl mb-3 block opacity-30" />
                    No MCP servers configured
                    <p className="text-xs mt-2 text-muted">
                        Add servers to{" "}
                        <code className="text-accent bg-black/30 px-1 rounded">~/.config/kronterm/settings.json</code>
                    </p>
                </div>
            )}
        </div>
    );
});
McpPanel.displayName = "McpPanel";
