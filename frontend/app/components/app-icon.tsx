// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn, makeIconClass } from "@/util/util";

// icon is either a "data:..." URL (platform/app metadata) or an icon-font class name.
// When size is omitted, CSS controls the glyph/image size.
export function AppIcon({ icon, size, className }: { icon?: string; size?: number; className?: string }) {
    if (icon == null || icon === "") return null;
    if (icon.startsWith("data:")) {
        return (
            <img
                src={icon}
                alt=""
                draggable={false}
                className={className}
                style={size != null ? { width: size, height: size } : undefined}
            />
        );
    }
    return (
        <i
            className={cn(makeIconClass(icon, true), className)}
            aria-hidden="true"
            style={size != null ? { fontSize: size } : undefined}
        />
    );
}
