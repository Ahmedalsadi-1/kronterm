// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";

export { cn };

export function fuzzyMatch(query: string, target: string): boolean {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let queryIndex = 0;
    for (let i = 0; i < t.length && queryIndex < q.length; i++) {
        if (t[i] === q[queryIndex]) {
            queryIndex++;
        }
    }
    return queryIndex === q.length;
}

export function formatTokens(value?: number | null): string {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "—";
    }
    if (value === 0) {
        return "0";
    }
    const formatter = new Intl.NumberFormat("en-US", {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    });
    const formatted = formatter.format(value);
    return formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted;
}

export function formatCurrency(value?: number | null): string {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "—";
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4,
        minimumFractionDigits: 2,
    }).format(value);
}

export function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length - 1) + "…";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}