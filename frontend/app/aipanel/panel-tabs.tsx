// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { memo } from "react";

export type PanelTab = "chat" | "settings" | "agents" | "providers" | "mcp";

type PanelTabsProps = {
    activeTab: PanelTab;
    onTabChange: (tab: PanelTab) => void;
};

const TABS: { id: PanelTab; label: string; icon: string }[] = [
    { id: "chat", label: "Chat", icon: "fa-comments" },
    { id: "settings", label: "Settings", icon: "fa-sliders" },
    { id: "agents", label: "Agents", icon: "fa-robot" },
    { id: "providers", label: "Providers", icon: "fa-plug" },
    { id: "mcp", label: "MCP", icon: "fa-server" },
];

export const PanelTabs = memo(({ activeTab, onTabChange }: PanelTabsProps) => {
    return (
        <div className="flex items-center border-b border-border bg-black/20 px-1 gap-0.5 flex-shrink-0">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer rounded-t-sm",
                        "hover:text-primary hover:bg-white/5",
                        activeTab === tab.id
                            ? "text-accent border-b-2 border-accent bg-white/5"
                            : "text-secondary border-b-2 border-transparent"
                    )}
                    title={tab.label}
                >
                    <i className={cn("fa-solid", tab.icon, "text-[11px]")} />
                    <span className="hidden @sm:inline">{tab.label}</span>
                </button>
            ))}
        </div>
    );
});

PanelTabs.displayName = "PanelTabs";
