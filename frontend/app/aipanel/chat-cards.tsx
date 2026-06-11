// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Adapted from MIT-licensed Hermes desktop chat components:
// https://github.com/NousResearch/hermes-agent/tree/main/apps/desktop

import { cn } from "@/util/util";
import { Copy, MonitorPlay } from "lucide-react";
import { memo, useCallback, useState } from "react";

export const CodeCard = memo(
    ({
        title,
        subtitle,
        children,
        className,
    }: {
        title: string;
        subtitle?: string;
        children: React.ReactNode;
        className?: string;
    }) => {
        return (
            <div className={cn("min-w-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]", className)}>
                <div className="flex items-center justify-between gap-2 border-b border-[#2a2a2a] px-2.5 py-1.5">
                    <div className="min-w-0 truncate text-xs font-medium text-[#d4d4d4]">
                        {title}
                        {subtitle ? <span className="ml-1 font-normal text-[#6b6863]">{subtitle}</span> : null}
                    </div>
                </div>
                <div className="p-2">{children}</div>
            </div>
        );
    }
);

CodeCard.displayName = "CodeCard";

export const CopyablePre = memo(({ text, maxHeight = "max-h-40" }: { text: string; maxHeight?: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = useCallback(() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
    }, [text]);
    return (
        <div className="group relative">
            <pre
                className={cn(
                    maxHeight,
                    "overflow-auto whitespace-pre-wrap rounded bg-transparent p-0 font-mono text-[10px] leading-relaxed text-[#9e9a93]"
                )}
            >
                {text}
            </pre>
            <button
                type="button"
                onClick={copy}
                className="absolute right-1 top-1 hidden cursor-pointer rounded border border-[#2a2a2a] bg-[#111] p-1 text-[#8a8580] hover:text-[#d4d4d4] group-hover:block"
                title="Copy"
            >
                {copied ? <i className="fa fa-check text-[10px] text-[#5b9ef5]" /> : <Copy className="h-3 w-3" />}
            </button>
        </div>
    );
});

CopyablePre.displayName = "CopyablePre";

export const PreviewAttachmentCard = memo(({ target }: { target: string }) => {
    const open = useCallback(() => {
        window.open(target, "_blank", "noopener,noreferrer");
    }, [target]);
    return (
        <button
            type="button"
            onClick={open}
            className="mt-2 flex w-full max-w-md cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#141414] px-2.5 py-2 text-left transition-colors hover:bg-[#1a1a1a]"
        >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#1a1a1a] text-[#8a8580]">
                <MonitorPlay className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-[#d4d4d4]">Preview target</span>
                <span className="block truncate font-mono text-[10px] text-[#6b6863]">{target}</span>
            </span>
        </button>
    );
});

PreviewAttachmentCard.displayName = "PreviewAttachmentCard";

export function extractPreviewTargets(text: string): string[] {
    const matches = text.match(
        /\b(?:https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?[^\s)`"'<>]*|file:\/\/[^\s)`"'<>]+)/gi
    );
    return Array.from(new Set(matches ?? [])).slice(0, 3);
}
