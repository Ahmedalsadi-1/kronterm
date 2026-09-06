// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * WaterFlowOverlay — scanning blue border animation.
 *
 * Ported from UI-TARS Desktop's ScreenMarker.showScreenWaterFlow():
 * - 4 gradient edges (DodgerBlue) with blur(8px)
 * - Pulsing scale (1 → 1.05) with cubic-bezier easing
 * - Click-through (pointer-events: none)
 *
 * Shown during agent "thinking" / "running" phases to signal activity.
 */

import { cn } from "@/util/util";
import { useEffect, useState } from "react";

interface WaterFlowOverlayProps {
    active: boolean;
    className?: string;
    /**
     * Color in rgba format (default: "30, 144, 255" = DodgerBlue)
     */
    color?: string;
    /**
     * Opacity of the gradient edges (default: 0.4)
     */
    opacity?: number;
    /**
     * Blur radius in px (default: 8)
     */
    blur?: number;
}

export function WaterFlowOverlay({
    active,
    className,
    color = "30, 144, 255",
    opacity = 0.4,
    blur = 8,
}: WaterFlowOverlayProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (active) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [active]);

    if (!visible) return null;

    const edgeColor = `rgba(${color}, ${opacity})`;
    const edgeClear = `rgba(${color}, 0)`;

    return (
        <div
            className={cn(
                "pointer-events-none absolute inset-0 z-50 overflow-hidden",
                active ? "opacity-100" : "opacity-0",
                className
            )}
            style={{
                transition: "opacity 0.3s ease",
                willChange: "opacity",
            }}
            aria-hidden="true"
        >
            <div
                className="absolute left-0 right-0 top-0"
                style={{
                    height: "15%",
                    background: `linear-gradient(to bottom, ${edgeColor}, ${edgeClear})`,
                    filter: `blur(${blur}px)`,
                    animation: "kronos-waterflow-edge 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
            />
            <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                    height: "15%",
                    background: `linear-gradient(to top, ${edgeColor}, ${edgeClear})`,
                    filter: `blur(${blur}px)`,
                    animation: "kronos-waterflow-edge 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
            />
            <div
                className="absolute bottom-0 left-0 top-0"
                style={{
                    width: "10%",
                    background: `linear-gradient(to right, ${edgeColor}, ${edgeClear})`,
                    filter: `blur(${blur}px)`,
                    animation: "kronos-waterflow-edge 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
            />
            <div
                className="absolute bottom-0 right-0 top-0"
                style={{
                    width: "10%",
                    background: `linear-gradient(to left, ${edgeColor}, ${edgeClear})`,
                    filter: `blur(${blur}px)`,
                    animation: "kronos-waterflow-edge 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
            />
        </div>
    );
}
