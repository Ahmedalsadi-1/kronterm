// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState, useCallback, useRef, useEffect } from "react";

type AgentAction = {
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
};

const TERMINAL_ACTIONS: AgentAction[] = [
    { id: "explain-output", label: "Explain Output", icon: "fa-lightbulb", shortcut: "⌘⇧E" },
    { id: "fix-error", label: "Fix Error", icon: "fa-wrench", shortcut: "⌘⇧F" },
    { id: "suggest-command", label: "Suggest Command", icon: "fa-terminal", shortcut: "⌘⇧S" },
];

const PREVIEW_ACTIONS: AgentAction[] = [
    { id: "summarize", label: "Summarize", icon: "fa-file-lines" },
    { id: "explain", label: "Explain", icon: "fa-lightbulb" },
];

const AI_ACTIONS: AgentAction[] = [
    { id: "refactor", label: "Refactor", icon: "fa-code" },
    { id: "improve", label: "Improve Response", icon: "fa-arrow-up" },
    { id: "export", label: "Export Chat", icon: "fa-download" },
];

const WEB_ACTIONS: AgentAction[] = [
    { id: "summarize-page", label: "Summarize Page", icon: "fa-file-lines" },
    { id: "extract-data", label: "Extract Data", icon: "fa-table" },
];

const BLOCK_TYPE_ACTIONS: Record<string, AgentAction[]> = {
    term: TERMINAL_ACTIONS,
    waveai: AI_ACTIONS,
    preview: PREVIEW_ACTIONS,
    webview: WEB_ACTIONS,
    codeeditor: TERMINAL_ACTIONS,
    kronsettings: [],
};

interface AgentActionButtonProps {
    blockType: string;
    blockId: string;
}

const AgentActionButton = memo(({ blockType, blockId }: AgentActionButtonProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredAction, setHoveredAction] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const actions = BLOCK_TYPE_ACTIONS[blockType] ?? [];
    if (actions.length === 0) return null;

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const handleAction = useCallback((actionId: string) => {
        setIsOpen(false);
        const event = new CustomEvent("kronoscode:block-action", {
            detail: { actionId, blockId, blockType },
            bubbles: true,
        });
        document.dispatchEvent(event);
    }, [blockId, blockType]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    return (
        <div style={{ position: "relative" }}>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="kron-agent-action-trigger"
                title="KronosCode actions"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: "1px solid transparent",
                    background: "transparent",
                    color: "var(--color-saturn, rgb(232, 196, 124))",
                    cursor: "pointer",
                    fontSize: 10,
                    opacity: 0.5,
                    transition: "opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.background = "var(--surface-hover-color)";
                    e.currentTarget.style.borderColor = "var(--border-color)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.5";
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                }}
            >
                <i className="fa-solid fa-circle-nodes" />
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    className="kron-agent-action-menu"
                    style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        marginTop: 4,
                        background: "var(--surface-raised-color)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                        padding: "4px 0",
                        minWidth: 180,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            padding: "4px 12px 6px",
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.06em",
                            color: "var(--color-saturn, rgb(232, 196, 124))",
                        }}
                    >
                        <i className="fa-solid fa-circle-nodes" style={{ marginRight: 4 }} />
                        KronosCode
                    </div>
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleAction(action.id)}
                            onMouseEnter={() => setHoveredAction(action.id)}
                            onMouseLeave={() => setHoveredAction(null)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "6px 12px",
                                border: "none",
                                background: hoveredAction === action.id ? "var(--surface-hover-color)" : "transparent",
                                color: "var(--text-primary-color)",
                                fontSize: 12,
                                cursor: "pointer",
                                transition: "background 0.1s ease",
                                textAlign: "left" as const,
                            }}
                        >
                            <i className={`fa-solid ${action.icon}`} style={{ width: 14, fontSize: 10, opacity: 0.7, color: "var(--text-secondary-color)" }} />
                            <span style={{ flex: 1 }}>{action.label}</span>
                            {action.shortcut && (
                                <span style={{ fontSize: 10, color: "var(--text-muted-color)", fontFamily: "var(--font-mono)" }}>
                                    {action.shortcut}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

AgentActionButton.displayName = "AgentActionButton";

export { AgentActionButton };
export type { AgentAction, AgentActionButtonProps };