// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Adapted from MIT-licensed Hermes desktop settings primitives:
// https://github.com/NousResearch/hermes-agent/tree/main/apps/desktop

import { cn } from "@/app/lib/utils";
import { Check, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SettingsContent({ children }: { children: ReactNode }) {
    return (
        <section className="min-h-0 overflow-hidden">
            <div className="h-full min-h-0 overflow-y-auto px-3 pb-12 pt-3 sm:px-4">
                <div className="mx-auto w-full max-w-4xl">{children}</div>
            </div>
        </section>
    );
}

export function SectionHeading({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
    return (
        <div className="mb-2.5 flex items-center gap-2 pt-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{title}</span>
            {meta ? (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {meta}
                </span>
            ) : null}
        </div>
    );
}

export function ListRow({
    title,
    description,
    action,
    wide = false,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    wide?: boolean;
}) {
    return (
        <div
            className={cn(
                "grid gap-3 border-b border-border/50 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,18rem)] sm:items-center",
                wide && "sm:grid-cols-1 sm:items-start"
            )}
        >
            <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{title}</div>
                {description ? (
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>
                ) : null}
            </div>
            {action ? <div className={cn("min-w-0", !wide && "sm:justify-self-end")}>{action}</div> : null}
        </div>
    );
}

export interface SegmentedControlOption<T extends string> {
    id: T;
    label: string;
    icon?: LucideIcon;
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: readonly SegmentedControlOption<T>[];
    value: T;
    onChange: (id: T) => void;
    className?: string;
}) {
    return (
        <div
            className={cn("inline-grid w-fit auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-muted p-0.5", className)}
        >
            {options.map(({ id, label, icon: Icon }) => {
                const active = value === id;
                return (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(id)}
                        className={cn(
                            "flex cursor-pointer items-center justify-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                            active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {Icon ? <Icon className="h-3 w-3" /> : null}
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export function ActionStatus({
    state,
    idle,
    busy,
    done,
    idleIcon = null,
}: {
    state: "done" | "idle" | "saving";
    idle: string;
    busy: string;
    done: string;
    idleIcon?: ReactNode;
}) {
    return (
        <>
            {state === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : state === "done" ? (
                <Check className="h-3.5 w-3.5" />
            ) : (
                idleIcon
            )}
            {state === "saving" ? busy : state === "done" ? done : idle}
        </>
    );
}
