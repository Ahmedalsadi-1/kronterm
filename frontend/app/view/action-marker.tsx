// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ActionMarker — animated action indicator overlay.
 *
 * Ported from UI-TARS setOfMarks.ts:
 * - Click: rotating dashed circle with spin animation + center dot + label
 * - Type: text overlay showing content
 * - Hotkey: text overlay showing key combination
 *
 * Positioned at agent interaction coordinates, auto-dismisses after timeout.
 */

import { cn } from "@/util/util";
import { useEffect, useState, useCallback } from "react";

type ActionType = "click" | "left_click" | "left_single" | "left_double" | "double_click" | "type" | "hotkey" | string;

interface ActionMarkerProps {
    /** Action type — determines visual style */
    actionType: ActionType;
    /** Optional label/content (e.g. typed text, key combo) */
    label?: string;
    /** X position (relative to container, in px) */
    x: number;
    /** Y position (relative to container, in px) */
    y: number;
    /** Whether the marker is active/visible */
    active: boolean;
    /** Ring color (default: "red" for click, "red" for text) */
    ringColor?: string;
    /** Auto-dismiss timeout in ms (default: 5000, like UI-TARS) */
    timeout?: number;
    /** Z-index (default: 2147483647 — max) */
    zIndex?: number;
    /** Container width for marker offset centering */
    containerWidth?: number;
    /** Container height for marker offset centering */
    containerHeight?: number;
    className?: string;
}

function isClickAction(type: string): boolean {
    return ["click", "left_click", "left_single", "left_double", "double_click"].includes(type);
}

export function ActionMarker({
    actionType,
    label,
    x,
    y,
    active,
    ringColor = "#ff0000",
    timeout = 5000,
    zIndex = 2147483647,
    containerWidth = 250,
    containerHeight = 100,
    className,
}: ActionMarkerProps) {
    const [dismissed, setDismissed] = useState(false);

    const dismiss = useCallback(() => setDismissed(true), []);

    useEffect(() => {
        if (!active) {
            setDismissed(true);
            return;
        }
        setDismissed(false);
        const timer = setTimeout(dismiss, timeout);
        return () => clearTimeout(timer);
    }, [active, timeout, dismiss]);

    if (!active || dismissed) return null;

    const isClick = isClickAction(actionType);
    const offsetX = -containerWidth / 2;
    const offsetY = -containerHeight / 2;

    return (
        <div
            className={cn(
                "pointer-events-none absolute",
                "animate-in fade-in zoom-in-75 duration-200",
                className
            )}
            style={{
                left: x + offsetX,
                top: y + offsetY,
                width: containerWidth,
                height: containerHeight,
                zIndex,
                willChange: "transform, opacity",
            }}
        >
            {isClick ? (
                <ClickMarker color={ringColor} />
            ) : (
                <TextMarker actionType={actionType} label={label} color={ringColor} />
            )}
        </div>
    );
}

function ClickMarker({ color }: { color: string }) {
    const cx = 125;
    const cy = 50;
    return (
        <svg
            width="250"
            height="100"
            viewBox="0 0 250 100"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0"
            aria-hidden="true"
        >
            <circle
                cx={cx}
                cy={cy}
                r="16"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray="80 20"
                strokeLinecap="round"
            >
                <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`0 ${cx} ${cy}`}
                    to={`360 ${cx} ${cy}`}
                    dur="1s"
                    repeatCount="indefinite"
                />
            </circle>
            <circle cx={cx} cy={cy} r="3" fill={color} />
            <text
                x={cx + 65}
                y={cy}
                fontFamily="-apple-system, BlinkMacSystemFont, Arial, sans-serif"
                fontSize="16"
                fill={color}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="600"
            >
                click
            </text>
        </svg>
    );
}

function TextMarker({
    actionType,
    label,
    color,
}: {
    actionType: string;
    label?: string;
    color: string;
}) {
    const displayText =
        actionType === "type"
            ? `Typing: "${label ?? ""}"`
            : actionType === "hotkey"
              ? `Hotkey: ${label ?? ""}`
              : `${actionType}: ${label ?? ""}`;

    return (
        <svg
            width="400"
            height="100"
            viewBox="0 0 400 100"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0"
            aria-hidden="true"
        >
            <text
                x="200"
                y="50"
                fontFamily="-apple-system, BlinkMacSystemFont, Arial, sans-serif"
                fontSize="16"
                fill={color}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="600"
            >
                {displayText}
            </text>
        </svg>
    );
}
