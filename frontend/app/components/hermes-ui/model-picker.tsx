// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Copied from Hermes Desktop and adapted for Kronterm. Kronterm keeps model
// selection in ACP/provider state, so this component is a reusable visual slot.

import { ChevronDown } from "@/app/components/hermes-ui/icons";
import { Button } from "@/app/components/hermes-ui/ui/button";
import { cn } from "@/lib/utils";

export type HermesModelOption = {
    id: string;
    label: string;
    provider?: string;
};

export function ModelPicker({
    className,
    disabled,
    onOpen,
    value,
}: {
    className?: string;
    disabled?: boolean;
    onOpen?: () => void;
    value?: HermesModelOption | null;
}) {
    return (
        <Button
            className={cn("min-w-0 justify-between rounded-md border border-border/55 bg-background/60", className)}
            disabled={disabled}
            onClick={onOpen}
            type="button"
            variant="ghost"
        >
            <span className="min-w-0 truncate text-left">
                {value?.label ?? "Select model"}
                {value?.provider ? <span className="ml-1 text-muted-foreground">({value.provider})</span> : null}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
    );
}
