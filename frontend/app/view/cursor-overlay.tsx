// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Cursor overlay system for KronTerm.
 *
 * Provides two mechanisms:
 *   1. CURSOR_OVERLAY_SCRIPT - a script to inject into Electron <webview> pages,
 *      adds a visible ring that follows the cursor (hidden by default).
 *   2. CursorOverlay - a React component for the sandbox VNC viewer.
 *
 * Design matches the "Open Computer Use" cursor ring: semi-transparent blue circle
 * with a center dot, non-interactive (pointer-events: none), click flash effect.
 */

// ---------------------------------------------------------------------------
// Inject into Electron <webview> pages
// ---------------------------------------------------------------------------
// Call webview.executeJavaScript(CURSOR_OVERLAY_SCRIPT) after dom-ready fires.
// Show/hide via webview.executeJavaScript("window.__showKronCursor(true/false)").

export const CURSOR_OVERLAY_SCRIPT = [
    "(function() {",
    "  if (window.__kronCursorInjected) return;",
    "  window.__kronCursorInjected = true;",
    "",
    "  var ring = document.createElement('div');",
    "  ring.id = '__kron-cursor-ring';",
    "  ring.style.cssText = [",
    "    'position: fixed',",
    "    'z-index: 2147483647',",
    "    'pointer-events: none',",
    "    'top: 0',",
    "    'left: 0',",
    "    'width: 32px',",
    "    'height: 32px',",
    "    'border-radius: 50%',",
    "    'border: 2px solid rgba(30, 144, 255, 0.82)',",
    "    'background: radial-gradient(circle, rgba(30, 144, 255, 0.14) 0%, transparent 70%)',",
    "    'box-shadow: 0 0 10px rgba(30, 144, 255, 0.32), inset 0 0 6px rgba(30, 144, 255, 0.16)',",
    "    'transform: translate(-50%, -50%)',",
    "    'transition: width 0.15s ease, height 0.15s ease, border-color 0.15s ease, opacity 0.2s ease',",
    "    'will-change: transform',",
    "    'opacity: 0',",
    "    'visibility: hidden',",
    "  ].join(';') + ';';",
    "  document.body.appendChild(ring);",
    "",
    "  var dot = document.createElement('div');",
    "  dot.style.cssText = [",
    "    'position: absolute',",
    "    'top: 50%',",
    "    'left: 50%',",
    "    'width: 6px',",
    "    'height: 6px',",
    "    'border-radius: 50%',",
    "    'background: rgba(30, 144, 255, 0.95)',",
    "    'transform: translate(-50%, -50%)',",
    "    'box-shadow: 0 0 6px rgba(30, 144, 255, 0.55)',",
    "  ].join(';') + ';';",
    "  ring.appendChild(dot);",
    "",
    "  var flash = document.createElement('div');",
    "  flash.style.cssText = [",
    "    'position: absolute',",
    "    'top: 50%',",
    "    'left: 50%',",
    "    'width: 0',",
    "    'height: 0',",
    "    'border-radius: 50%',",
    "    'background: rgba(30, 144, 255, 0.3)',",
    "    'transform: translate(-50%, -50%)',",
    "    'transition: width 0.2s ease-out, height 0.2s ease-out, opacity 0.2s ease-out',",
    "    'opacity: 1',",
    "  ].join(';') + ';';",
    "  ring.appendChild(flash);",
    "",
    "  window.__showKronCursor = function(show) {",
    "    ring.style.opacity = show ? '1' : '0';",
    "    ring.style.visibility = show ? 'visible' : 'hidden';",
    "  };",
    "",
    "  document.addEventListener('mousemove', function(e) {",
    "    ring.style.left = e.clientX + 'px';",
    "    ring.style.top = e.clientY + 'px';",
    "  }, { passive: true });",
    "",
    "  document.addEventListener('mousedown', function() {",
    "    ring.style.width = '24px';",
    "    ring.style.height = '24px';",
    "    ring.style.borderColor = 'rgba(0, 155, 255, 0.9)';",
    "  }, { passive: true });",
    "",
    "  document.addEventListener('mouseup', function(e) {",
    "    ring.style.width = '32px';",
    "    ring.style.height = '32px';",
    "    ring.style.borderColor = 'rgba(30, 144, 255, 0.82)';",
    "    ring.style.left = e.clientX + 'px';",
    "    ring.style.top = e.clientY + 'px';",
    "    flash.style.width = '48px';",
    "    flash.style.height = '48px';",
    "    flash.style.opacity = '0';",
    "    setTimeout(function() {",
    "      flash.style.width = '0';",
    "      flash.style.height = '0';",
    "      flash.style.opacity = '1';",
    "    }, 250);",
    "  }, { passive: true });",
    "})();",
].join("\n");

// ---------------------------------------------------------------------------
// React component for sandbox / any DOM container
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from "react";

export interface CursorOverlayProps {
    cursorPoint?: { x: number; y: number } | null;
    containerRect?: DOMRect | null;
    active?: boolean;
    onCursorMove?: (point: { x: number; y: number; clientX: number; clientY: number }) => void;
    onCursorClick?: (point: { x: number; y: number }) => void;
    triggerClickFlash?: number;
    ringColor?: string;
    dotColor?: string;
}

export function CursorOverlay({
    cursorPoint,
    containerRect,
    active = true,
    onCursorMove,
    onCursorClick,
    triggerClickFlash,
    ringColor = "30, 144, 255",
    dotColor = "30, 144, 255",
}: CursorOverlayProps) {
    const ringRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback((clientX: number, clientY: number) => {
        const el = ringRef.current;
        if (!el) return;
        el.style.left = clientX + "px";
        el.style.top = clientY + "px";
    }, []);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!active) return;
            updatePosition(e.clientX, e.clientY);
            const rect = containerRef.current?.getBoundingClientRect();
            onCursorMove?.({
                x: rect ? e.clientX - rect.left : e.clientX,
                y: rect ? e.clientY - rect.top : e.clientY,
                clientX: e.clientX,
                clientY: e.clientY,
            });
        },
        [active, updatePosition, onCursorMove]
    );

    const flashClick = useCallback(() => {
        const el = ringRef.current;
        if (!el) return;
        const flash = el.querySelector(".__kron-flash") as HTMLDivElement | null;
        if (!flash) return;
        flash.style.width = "48px";
        flash.style.height = "48px";
        flash.style.opacity = "0";
        setTimeout(() => {
            flash.style.width = "0";
            flash.style.height = "0";
            flash.style.opacity = "1";
        }, 250);
    }, []);

    const handleMouseClick = useCallback(
        (e: MouseEvent) => {
            if (!active) return;
            flashClick();
            const rect = containerRef.current?.getBoundingClientRect();
            onCursorClick?.({
                x: rect ? e.clientX - rect.left : e.clientX,
                y: rect ? e.clientY - rect.top : e.clientY,
            });
        },
        [active, flashClick, onCursorClick]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener("mousemove", handleMouseMove, { passive: true });
        container.addEventListener("click", handleMouseClick, { passive: true });
        return () => {
            container.removeEventListener("mousemove", handleMouseMove);
            container.removeEventListener("click", handleMouseClick);
        };
    }, [handleMouseMove, handleMouseClick]);

    useEffect(() => {
        if (!cursorPoint || !containerRect || !active) return;
        updatePosition(containerRect.left + cursorPoint.x, containerRect.top + cursorPoint.y);
    }, [cursorPoint, containerRect, active, updatePosition]);

    useEffect(() => {
        if (triggerClickFlash == null) return;
        flashClick();
    }, [triggerClickFlash, flashClick]);

    return (
        <div
            ref={containerRef}
            className="__kron-cursor-overlay"
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 2147483647,
                pointerEvents: "none",
                overflow: "hidden",
            }}
        >
            <div
                ref={ringRef}
                className="__kron-cursor-ring"
                style={{
                    position: "fixed",
                    zIndex: 2147483647,
                    pointerEvents: "none",
                    top: 0,
                    left: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "2.5px solid rgba(" + ringColor + ", 0.75)",
                    background: "radial-gradient(circle, rgba(" + ringColor + ", 0.12) 0%, transparent 70%)",
                    boxShadow: "0 0 10px rgba(" + ringColor + ", 0.35), inset 0 0 6px rgba(" + ringColor + ", 0.15)",
                    transform: "translate(-50%, -50%)",
                    transition: [
                        "width 0.12s ease",
                        "height 0.12s ease",
                        "border-color 0.12s ease",
                        "opacity 0.2s ease",
                    ].join(", "),
                    willChange: "transform",
                    opacity: active ? 1 : 0,
                }}
            >
                <div
                    className="__kron-cursor-dot"
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "rgba(" + dotColor + ", 0.85)",
                        transform: "translate(-50%, -50%)",
                        boxShadow: "0 0 5px rgba(" + dotColor + ", 0.5)",
                    }}
                />
                <div
                    className="__kron-flash"
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: 0,
                        height: 0,
                        borderRadius: "50%",
                        background: "rgba(" + dotColor + ", 0.25)",
                        transform: "translate(-50%, -50%)",
                        transition: "width 0.2s ease-out, height 0.2s ease-out, opacity 0.2s ease-out",
                        opacity: 1,
                    }}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pet cursor tracking utility
// ---------------------------------------------------------------------------
// Reports cursor positions to the AionUi pet API so the pet can track/eyes-follow.

const PET_ACTIVITY_URL = "http://127.0.0.1:4097/pet/activity";

export function reportCursorToPet(point: { x: number; y: number }, source: "browser" | "sandbox" | "desktop"): void {
    fetch(PET_ACTIVITY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            kind: "tool",
            detail: "cursor " + source,
            cursorPoint: point,
            surfaceActivity: {
                source: "kronoscode-tui",
                phase: "running",
                surface: source === "sandbox" ? "sandbox" : "browser",
                action: "move",
                detail: "cursor overlay",
                point,
            },
        }),
    }).catch(() => {
        // best-effort — pet tracking is non-critical
    });
}
