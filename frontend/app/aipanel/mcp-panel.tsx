// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";

type MCPServerConfig = { enabled?: boolean; type?: string; command?: string[]; url?: string };

const ServerRow = memo(({ name, config }: { name: string; config: MCPServerConfig }) => {
    const isEnabled = config.enabled !== false;
    const isHttp = config.type === "streamable-http" || config.type === "sse" || Boolean(config.url);
    return (
        <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-black/20">
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", isEnabled ? "bg-green-400" : "bg-zinc-500")} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">{name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-secondary border border-border/50">
                        {isHttp ? "http" : "stdio"}
                    </span>
                </div>
                {config.url && <p className="text-xs text-secondary font-mono mt-0.5 truncate">{config.url}</p>}
                {config.command && <p className="text-xs text-secondary font-mono mt-0.5 truncate">{config.command.join(" ")}</p>}
            </div>
            <span className={cn("text-xs flex-shrink-0", isEnabled ? "text-green-400" : "text-muted")}>
                {isEnabled ? "enabled" : "disabled"}
            </span>
        </div>
    );
});
ServerRow.displayName = "ServerRow";

export const McpPanel = memo(() => {
    const storedEnabled = useAtomValue(getSettingsKeyAtom("mcp:enabled" as Parameters<typeof getSettingsKeyAtom>[0]));
    const storedServers = useAtomValue(getSettingsKeyAtom("mcp:servers" as Parameters<typeof getSettingsKeyAtom>[0]));
    const [mcpEnabled, setMcpEnabled] = useState(Boolean(storedEnabled));

    useEffect(() => { setMcpEnabled(Boolean(storedEnabled)); }, [storedEnabled]);

    const servers = (storedServers as Record<string, MCPServerConfig> | null) ?? {};
    const serverEntries = Object.entries(servers);

    const toggleEnabled = () => {
        const next = !mcpEnabled;
        setMcpEnabled(next);
        void RpcApi.SetConfigCommand(TabRpcClient, { "mcp:enabled": next });
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
                    <span className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                        mcpEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                    )} />
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
                        {serverEntries.map(([name, cfg]) => <ServerRow key={name} name={name} config={cfg} />)}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-secondary text-sm">
                    <i className="fa-solid fa-server text-3xl mb-3 block opacity-30" />
                    No MCP servers configured
                    <p className="text-xs mt-2 text-muted">
                        Add servers to <code className="text-accent bg-black/30 px-1 rounded">~/.config/kronterm/settings.json</code>
                    </p>
                </div>
            )}
        </div>
    );
});
McpPanel.displayName = "McpPanel";
