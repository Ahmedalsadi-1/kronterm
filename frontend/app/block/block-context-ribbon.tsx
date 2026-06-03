// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";

type ContextRibbonStatus = "idle" | "thinking" | "active" | "error";

interface BlockContextRibbonProps {
    status?: ContextRibbonStatus;
    contextText?: string;
    blockType?: string;
}

const STATUS_CONFIG: Record<ContextRibbonStatus, { label: string; color: string; icon: string }> = {
    idle: { label: "Ready", color: "rgba(255,255,255,0.2)", icon: "fa-circle-dot" },
    thinking: { label: "Thinking...", color: "var(--color-saturn, rgb(232, 196, 124))", icon: "fa-brain" },
    active: { label: "Active", color: "var(--accent-color, rgb(88, 193, 66))", icon: "fa-circle-nodes" },
    error: { label: "Error", color: "var(--color-error, rgb(229, 77, 46))", icon: "fa-triangle-exclamation" },
};

const BLOCK_TYPE_LABELS: Record<string, string> = {
    term: "Terminal",
    waveai: "AI Chat",
    preview: "Preview",
    webview: "Web",
    codeeditor: "Editor",
    kronsettings: "Settings",
};

const BlockContextRibbon = memo(({ status = "idle", contextText, blockType }: BlockContextRibbonProps) => {
    const config = STATUS_CONFIG[status];
    const typeLabel = blockType ? BLOCK_TYPE_LABELS[blockType] ?? blockType : null;

    return (
        <div
            className="kron-context-ribbon"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px 2px 6px",
                fontSize: 10,
                color: "var(--text-muted-color)",
                borderBottom: status !== "idle" ? `1px solid ${config.color}20` : "none",
                transition: "border-color 0.2s ease, background 0.2s ease",
                background: status !== "idle" ? `${config.color}06` : "transparent",
                minHeight: 18,
            }}
        >
            <i
                className={`fa-solid ${config.icon}`}
                style={{
                    fontSize: 9,
                    color: config.color,
                    opacity: status === "idle" ? 0.4 : 1,
                    animation: status === "thinking" ? "kron-pulse 1.5s ease-in-out infinite" : "none",
                }}
            />
            {typeLabel && (
                <span style={{ opacity: 0.5 }}>{typeLabel}</span>
            )}
            {contextText && (
                <span
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                        flex: 1,
                        opacity: 0.7,
                    }}
                >
                    {contextText}
                </span>
            )}
            {status === "thinking" && (
                <span style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                    <span className="kron-context-dot" style={{ animationDelay: "0ms" }} />
                    <span className="kron-context-dot" style={{ animationDelay: "150ms" }} />
                    <span className="kron-context-dot" style={{ animationDelay: "300ms" }} />
                </span>
            )}
            {status === "active" && (
                <span style={{ marginLeft: "auto", color: config.color, opacity: 0.7 }}>
                    {config.label}
                </span>
            )}
        </div>
    );
});

BlockContextRibbon.displayName = "BlockContextRibbon";

export { BlockContextRibbon };
export type { BlockContextRibbonProps, ContextRibbonStatus };