// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Cross-View Event Bus — lightweight state sharing between block types.
 *
 * Each view type (terminal, browser, sandbox) publishes relevant state
 * changes here. The AI panel, overlays, and other consumers subscribe
 * to build cross-view context.
 *
 * This is NOT a full replacement for the Wave PubSub system (wps).
 * It's a focused, synchronous bus for view-level state needed by the
 * agent overlay and AI context systems.
 */

export type CrossViewPayload = CrossViewTerminalPayload | CrossViewBrowserPayload | CrossViewSandboxPayload;

export interface CrossViewTerminalPayload {
    viewType: "term";
    blockId: string;
    lastCommand?: string;
    lastExitCode?: number | null;
    scrollbackSnippet?: string;
    cwd?: string;
    /** Timestamp of last command completion */
    lastActivity: number;
}

export interface CrossViewBrowserPayload {
    viewType: "web";
    blockId: string;
    url?: string;
    title?: string;
    /** Whether the browser block has focus / is visible */
    visible?: boolean;
    lastActivity: number;
}

export interface CrossViewSandboxPayload {
    viewType: "sandbox";
    blockId: string;
    mode?: string;
    browserUrl?: string;
    runtime?: string;
    /** Embedded screenshot base64 (without data:image prefix) */
    screenshot?: string;
    lastActivity: number;
}

export type CrossViewEventType =
    | "terminal:command-complete"
    | "terminal:error"
    | "browser:navigate"
    | "browser:title-change"
    | "sandbox:status-change"
    | "sandbox:screenshot";

export interface CrossViewEvent {
    type: CrossViewEventType;
    blockId: string;
    payload: CrossViewPayload;
    timestamp: number;
}

type CrossViewEventHandler = (event: CrossViewEvent) => void;

const busEventName = "kronos-cross-view-event";

const subscribers = new Set<CrossViewEventHandler>();

/**
 * Subscribe to all cross-view events.
 * Returns an unsubscribe function.
 */
export function subscribeCrossViewEvents(handler: CrossViewEventHandler): () => void {
    subscribers.add(handler);
    return () => {
        subscribers.delete(handler);
    };
}

/**
 * Publish a cross-view event. Dispatches synchronously to all subscribers
 * and also fires a window CustomEvent for React hook consumers.
 */
export function publishCrossViewEvent(type: CrossViewEventType, blockId: string, payload: CrossViewPayload): void {
    const event: CrossViewEvent = {
        type,
        blockId,
        payload,
        timestamp: Date.now(),
    };
    for (const handler of subscribers) {
        try {
            handler(event);
        } catch (e) {
            console.error("cross-view-bus handler error:", e);
        }
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent<CrossViewEvent>(busEventName, { detail: event }));
    }
}

/**
 * React hook — subscribe to cross-view events in a component.
 */
export function createCrossViewHook(): () => {
    lastEvent: CrossViewEvent | null;
    terminalContext: CrossViewTerminalPayload | null;
    browserContext: CrossViewBrowserPayload | null;
    sandboxContext: CrossViewSandboxPayload | null;
} {
    let lastEvent: CrossViewEvent | null = null;
    const latestByBlock = new Map<string, CrossViewPayload>();

    function onEvent(event: CrossViewEvent) {
        lastEvent = event;
        latestByBlock.set(event.blockId, event.payload);
    }

    const unsub = subscribeCrossViewEvents(onEvent);

    return function useCrossView() {
        // We use a pattern of reading from the captured state
        // This is a simple reactivity wrapper
        const terminalContext =
            [...latestByBlock.values()].find((p): p is CrossViewTerminalPayload => p.viewType === "term") ?? null;
        const browserContext =
            [...latestByBlock.values()].find((p): p is CrossViewBrowserPayload => p.viewType === "web") ?? null;
        const sandboxContext =
            [...latestByBlock.values()].find((p): p is CrossViewSandboxPayload => p.viewType === "sandbox") ?? null;
        return { lastEvent, terminalContext, browserContext, sandboxContext };
    };
}

/* Helper to build terminal payloads from TermWrap state */
export function makeTerminalPayload(
    blockId: string,
    lastCommand?: string,
    lastExitCode?: number | null,
    scrollbackSnippet?: string,
    cwd?: string
): CrossViewTerminalPayload {
    return {
        viewType: "term",
        blockId,
        lastCommand,
        lastExitCode,
        scrollbackSnippet,
        cwd,
        lastActivity: Date.now(),
    };
}

/* Helper to build browser payloads */
export function makeBrowserPayload(
    blockId: string,
    url?: string,
    title?: string,
    visible?: boolean
): CrossViewBrowserPayload {
    return {
        viewType: "web",
        blockId,
        url,
        title,
        visible,
        lastActivity: Date.now(),
    };
}

/* Helper to build sandbox payloads */
export function makeSandboxPayload(
    blockId: string,
    mode?: string,
    browserUrl?: string,
    runtime?: string,
    screenshot?: string
): CrossViewSandboxPayload {
    return {
        viewType: "sandbox",
        blockId,
        mode,
        browserUrl,
        runtime,
        screenshot,
        lastActivity: Date.now(),
    };
}
