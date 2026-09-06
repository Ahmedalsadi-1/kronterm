// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Markdown } from "@/app/element/markdown";
import { cn, makeIconClass } from "@/util/util";
import { memo, useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

type WarpControlState =
    | "queued"
    | "thinking"
    | "running"
    | "awaiting-approval"
    | "awaiting-instructions"
    | "succeeded"
    | "failed"
    | "cancelled";

type WarpPill = {
    id: string;
    label: string;
    state: "idle" | "running" | "done" | "error";
};

type WarpOutputItem =
    | { kind: "markdown"; text: string }
    | { kind: "command"; cmd: string; output?: string; state?: "running" | "done" | "error" }
    | { kind: "tool"; label: string; detail: string; icon: string };

type WarpAgentBlockData = {
    id: string;
    query: string;
    cwd: string;
    controlState: WarpControlState;
    output?: WarpOutputItem[];
    pills?: WarpPill[];
};

const DemoBlocks: WarpAgentBlockData[] = [
    {
        id: "block-1",
        query: "What went wrong with the build?",
        cwd: "~/kronterm",
        controlState: "succeeded",
        output: [
            {
                kind: "markdown",
                text: "The build failed in `frontend/app/view/term/term.tsx` — a **TypeScript type error** introduced by the latest merge. Here's the failing check and the fix.",
            },
            {
                kind: "command",
                cmd: "npx tsc --noEmit 2>&1 | head -20",
                output: "frontend/app/view/term/term.tsx(142,5): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
                state: "done",
            },
            {
                kind: "markdown",
                text: "The `contentRef` callback can return `undefined` on first mount. Guard the ref before reading `current`:\n\n```ts\nconst el = contentRef.current;\nif (el == null) return;\n```",
            },
            {
                kind: "command",
                cmd: "task check:ts",
                output: "✓ TypeScript check passed (0 errors)",
                state: "done",
            },
        ],
        pills: [
            { id: "p1", label: "diagnose", state: "done" },
            { id: "p2", label: "explain", state: "done" },
        ],
    },
    {
        id: "block-2",
        query: "Apply the fix to term.tsx",
        cwd: "~/kronterm",
        controlState: "awaiting-approval",
        output: [
            {
                kind: "tool",
                label: "edit",
                detail: "frontend/app/view/term/term.tsx — insert null guard around contentRef",
                icon: "code",
            },
            {
                kind: "markdown",
                text: "This will modify **1 file** in your workspace. The change is reversible.",
            },
        ],
        pills: [
            { id: "p3", label: "edit-file", state: "running" },
            { id: "p4", label: "verify", state: "idle" },
        ],
    },
];

const ControlStateCopy: Record<WarpControlState, { label: string; icon: string; className: string }> = {
    queued: { label: "Agent is queued", icon: "clock-rotate-left", className: "text-muted" },
    thinking: { label: "Agent is thinking", icon: "sparkles", className: "text-secondary" },
    running: { label: "Agent is in control", icon: "bolt", className: "text-accent" },
    "awaiting-approval": { label: "Agent needs your permission to continue", icon: "shield-halved", className: "text-warning" },
    "awaiting-instructions": { label: "Agent is waiting on instructions", icon: "circle-question", className: "text-warning" },
    succeeded: { label: "Agent completed the task", icon: "circle-check", className: "text-success" },
    failed: { label: "Agent failed the task", icon: "circle-xmark", className: "text-error" },
    cancelled: { label: "Agent was cancelled", icon: "stop", className: "text-muted" },
};

function WarpAvatar({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-primary",
                className
            )}
        >
            W
        </div>
    );
}

function WarpContextChip({ cwd }: { cwd: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-secondary">
            <i className={makeIconClass("folder-open", true)} />
            {cwd}
        </span>
    );
}

function WarpControlStateLine({ state }: { state: WarpControlState }) {
    const copy = ControlStateCopy[state];
    return (
        <div className={cn("flex items-center gap-2 text-[12px] font-medium", copy.className)}>
            <i className={cn(makeIconClass(copy.icon, true), state === "running" && "fa-spin")} />
            {copy.label}
        </div>
    );
}

function WarpPillBar({ pills }: { pills: WarpPill[] }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((pill, idx) => (
                <div key={pill.id} className="flex items-center gap-1.5">
                    {idx > 0 && <i className={cn(makeIconClass("angle-right", true), "text-[10px] text-muted")} />}
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px]",
                            pill.state === "running" && "border-accent/40 bg-accentbg text-primary",
                            pill.state === "done" && "border-border bg-panel text-secondary",
                            pill.state === "error" && "border-error/40 bg-error/10 text-error",
                            pill.state === "idle" && "border-border bg-panel text-muted"
                        )}
                    >
                        <i
                            className={cn(
                                makeIconClass(
                                    pill.state === "running" ? "rotate" : pill.state === "done" ? "check" : "circle",
                                    true
                                ),
                                pill.state === "running" && "fa-spin text-accent"
                            )}
                        />
                        {pill.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

function WarpCommandBlock({ item }: { item: Extract<WarpOutputItem, { kind: "command" }> }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-modalbg">
            <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-1.5">
                <i className={cn(makeIconClass("terminal", true), "text-[12px] text-accent")} />
                <code className="flex-1 truncate font-mono text-[12px] text-primary">{item.cmd}</code>
                <i
                    className={cn(
                        makeIconClass(
                            item.state === "running" ? "rotate" : item.state === "error" ? "circle-xmark" : "circle-check",
                            true
                        ),
                        item.state === "running" && "fa-spin",
                        item.state === "running" && "text-accent",
                        item.state === "error" && "text-error",
                        item.state === "done" && "text-success"
                    )}
                />
            </div>
            {item.output != null && (
                <pre className="overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-secondary">
                    {item.output}
                </pre>
            )}
        </div>
    );
}

function WarpToolLine({ item }: { item: Extract<WarpOutputItem, { kind: "tool" }> }) {
    return (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-panel px-3 py-2">
            <i className={cn(makeIconClass(item.icon, true), "mt-0.5 text-[12px] text-accent")} />
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-primary">{item.label}</div>
                <div className="truncate text-[11px] text-secondary">{item.detail}</div>
            </div>
            <i className={cn(makeIconClass("rotate", true), "fa-spin text-[12px] text-accent")} />
        </div>
    );
}

function WarpOutput({ items }: { items: WarpOutputItem[] }) {
    return (
        <div className="flex flex-col gap-2.5">
            {items.map((item, idx) => {
                if (item.kind === "markdown") {
                    return (
                        <Markdown
                            key={idx}
                            text={item.text}
                            className="typography-markdown text-[13px] leading-relaxed text-primary"
                            contentClassName="text-[13px]"
                        />
                    );
                }
                if (item.kind === "command") {
                    return <WarpCommandBlock key={idx} item={item} />;
                }
                return <WarpToolLine key={idx} item={item} />;
            })}
        </div>
    );
}

function WarpAgentBlock({ block }: { block: WarpAgentBlockData }) {
    return (
        <div className="group rounded-xl border border-transparent px-4 py-3 transition-colors hover:border-border">
            <div className="mb-2 flex items-center gap-2">
                <WarpContextChip cwd={block.cwd} />
                <span className="text-[11px] text-muted">Agent</span>
                <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <i className={cn(makeIconClass("copy", true), "cursor-pointer text-[12px] text-muted hover:text-secondary")} />
                    <i className={cn(makeIconClass("arrow-up-right-from-square", true), "cursor-pointer text-[12px] text-muted hover:text-secondary")} />
                    <i className={cn(makeIconClass("ellipsis", true), "cursor-pointer text-[12px] text-muted hover:text-secondary")} />
                </div>
            </div>

            <div className="mb-3 flex items-start gap-3">
                <WarpAvatar />
                <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium leading-snug text-primary">{block.query}</div>
                </div>
            </div>

            {block.pills != null && block.pills.length > 0 && (
                <div className="mb-3">
                    <WarpPillBar pills={block.pills} />
                </div>
            )}

            {block.output != null && (
                <div className="mb-3 pl-10">
                    <WarpOutput items={block.output} />
                </div>
            )}

            <div className="pl-10">
                <WarpControlStateLine state={block.controlState} />
                {block.controlState === "awaiting-approval" && (
                    <div className="mt-2.5 flex items-center gap-2">
                        <button
                            className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-accenthover"
                            type="button"
                        >
                            Allow
                        </button>
                        <button
                            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12px] text-secondary transition-colors hover:bg-hoverbg"
                            type="button"
                        >
                            Deny
                        </button>
                        <button
                            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12px] text-secondary transition-colors hover:bg-hoverbg"
                            type="button"
                        >
                            Allow for session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function WarpModelSelector() {
    return (
        <button
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-secondary transition-colors hover:bg-hoverbg"
            type="button"
        >
            <i className={cn(makeIconClass("sparkles", true), "text-[11px] text-accent")} />
            GPT-5.1
            <i className={cn(makeIconClass("chevron-down", true), "text-[10px]")} />
        </button>
    );
}

function WarpInputFooter({ disabled }: { disabled?: boolean }) {
    const [value, setValue] = useState("");
    const [fastForward, setFastForward] = useState(false);

    return (
        <div className="shrink-0 border-t border-border bg-panel/60 p-3">
            <div className="mb-2 flex items-center gap-1.5">
                <WarpContextChip cwd="~/kronterm" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-secondary">
                    <i className={makeIconClass("location-crosshairs", true)} />
                    Term · block-3
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-secondary">
                    <i className={makeIconClass("scissors", true)} />
                    Selection
                </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-bginput px-3 py-2 transition-colors focus-within:border-accent">
                <textarea
                    className="min-h-[22px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-primary outline-none placeholder:text-muted"
                    rows={1}
                    placeholder="Ask anything…"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                        }
                    }}
                />
                <div className="flex shrink-0 items-center gap-1.5">
                    <i className={cn(makeIconClass("paperclip", true), "cursor-pointer text-[13px] text-muted hover:text-secondary")} />
                    <i className={cn(makeIconClass("microphone", true), "cursor-pointer text-[13px] text-muted hover:text-secondary")} />
                    <button
                        className={cn(
                            "cursor-pointer rounded-md p-1.5 text-[12px] transition-colors",
                            fastForward ? "bg-accent text-primary" : "text-muted hover:text-secondary"
                        )}
                        title="Fast forward"
                        type="button"
                        onClick={() => setFastForward((v) => !v)}
                    >
                        <i className={makeIconClass("forward", true)} />
                    </button>
                    <button
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-accenthover"
                        type="button"
                    >
                        <i className={makeIconClass("paper-plane", true)} />
                        Send
                    </button>
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
                <WarpModelSelector />
                <span className="text-[10px] text-muted">Enter to send · Shift+Enter for newline</span>
            </div>
        </div>
    );
}

function WarpZeroState({ onNewConversation }: { onNewConversation: () => void }) {
    const suggestions = [
        "What went wrong with the build?",
        "Fix the type error in auth.ts",
        "Explain this git branch",
    ];
    return (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
            <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-[20px] font-bold text-primary">
                    W
                </div>
                <div className="text-center">
                    <div className="typography-ui-header text-primary">What can I help you build?</div>
                    <div className="mt-1 text-[12px] text-secondary">KronosCode works from your workspace context.</div>
                </div>
            </div>
            <div className="flex flex-col items-center gap-2">
                {suggestions.map((s) => (
                    <button
                        key={s}
                        className="cursor-pointer rounded-lg border border-border bg-panel px-4 py-2 text-[12px] text-secondary transition-colors hover:border-accent/50 hover:text-primary"
                        type="button"
                        onClick={onNewConversation}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}

function WarpConversation() {
    const [blocks, setBlocks] = useState<WarpAgentBlockData[]>(DemoBlocks);

    const handleSend = (query: string) => {
        if (!query.trim()) {
            return;
        }
        const block: WarpAgentBlockData = {
            id: `block-${Date.now()}`,
            query: query.trim(),
            cwd: "~/kronterm",
            controlState: "thinking",
            output: [{ kind: "markdown", text: "Working on it…" }],
        };
        setBlocks((prev) => [...prev, block]);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <OverlayScrollbarsComponent className="min-h-0 flex-1" options={{ scrollbars: { autoHide: "leave" } }}>
                <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-2 py-6">
                    {blocks.length === 0 ? (
                        <WarpZeroState onNewConversation={() => setBlocks([])} />
                    ) : (
                        <div className="flex flex-col gap-1">
                            {blocks.map((block) => (
                                <WarpAgentBlock key={block.id} block={block} />
                            ))}
                        </div>
                    )}
                </div>
            </OverlayScrollbarsComponent>
            <WarpInputFooter disabled={blocks.length === 0} />
        </div>
    );
}

export const WarpAgentView = memo(function WarpAgentView() {
    return <WarpConversation />;
});
WarpAgentView.displayName = "WarpAgentView";