// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type HermesSurfacePresentation = "closed" | "hud" | "panel" | "widget";

export type HermesHudGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type HermesSurfaceSnapshot = {
    presentation: HermesSurfacePresentation;
    geometry: HermesHudGeometry;
    sessionId: string | null;
    widgetBlockId: string | null;
};

type WidgetHost = {
    blockId: string;
    closeToHud: () => void;
};

const GeometryStorageKey = "kronterm.hermes.hud.geometry.v1";
const HudMinWidth = 380;
const HudMinHeight = 160;
const HudDefaultWidth = 620;
const HudDefaultHeight = 320;
const HudViewportMargin = 12;
const HudBottomClearance = 78;

type HudBounds = Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width">;

function viewportBounds(): HudBounds {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return { bottom: 900, height: 900, left: 0, right: 1440, top: 0, width: 1440 };
    }
    const surface = document.querySelector<HTMLElement>(".workspace-surface-row");
    return (
        surface?.getBoundingClientRect() ?? {
            bottom: window.innerHeight,
            height: window.innerHeight,
            left: 0,
            right: window.innerWidth,
            top: 0,
            width: window.innerWidth,
        }
    );
}

export function clampHermesHudGeometry(
    geometry: Partial<HermesHudGeometry>,
    bounds: HudBounds = viewportBounds()
): HermesHudGeometry {
    const maxWidth = Math.max(HudMinWidth, bounds.width - HudViewportMargin * 2);
    const maxHeight = Math.max(HudMinHeight, bounds.height - HudViewportMargin - HudBottomClearance);
    const width = Math.min(maxWidth, Math.max(HudMinWidth, geometry.width ?? HudDefaultWidth));
    const height = Math.min(maxHeight, Math.max(HudMinHeight, geometry.height ?? HudDefaultHeight));
    const defaultX = bounds.left + (bounds.width - width) / 2;
    const defaultY = bounds.bottom - height - HudBottomClearance;
    const minX = bounds.left + HudViewportMargin;
    const minY = bounds.top + HudViewportMargin;
    const maxX = Math.max(minX, bounds.right - width - HudViewportMargin);
    const maxY = Math.max(minY, bounds.bottom - height - HudBottomClearance);

    return {
        x: Math.min(maxX, Math.max(minX, geometry.x ?? defaultX)),
        y: Math.min(maxY, Math.max(minY, geometry.y ?? defaultY)),
        width,
        height,
    };
}

function loadGeometry(): HermesHudGeometry {
    if (typeof window === "undefined") {
        return clampHermesHudGeometry({});
    }
    try {
        const raw = window.localStorage.getItem(GeometryStorageKey);
        return clampHermesHudGeometry(raw ? (JSON.parse(raw) as Partial<HermesHudGeometry>) : {});
    } catch {
        return clampHermesHudGeometry({});
    }
}

class HermesSurfaceController {
    private snapshot: HermesSurfaceSnapshot = {
        presentation: "closed",
        geometry: loadGeometry(),
        sessionId: null,
        widgetBlockId: null,
    };
    private listeners = new Set<() => void>();
    private widgetHosts = new Map<string, WidgetHost>();
    private expandHandler: (() => Promise<void>) | null = null;
    private expanding = false;
    private widgetRequested = false;
    private returnAfterWidgetClose: Exclude<HermesSurfacePresentation, "widget"> = "closed";

    getSnapshot = (): HermesSurfaceSnapshot => this.snapshot;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    setExpandHandler(handler: (() => Promise<void>) | null): () => void {
        this.expandHandler = handler;
        return () => {
            if (this.expandHandler === handler) {
                this.expandHandler = null;
            }
        };
    }

    requestOpenHud(sessionId?: string | null): void {
        const activeHost = this.snapshot.widgetBlockId
            ? this.widgetHosts.get(this.snapshot.widgetBlockId)
            : [...this.widgetHosts.values()][0];
        if (activeHost) {
            this.snapshot = { ...this.snapshot, sessionId: sessionId ?? this.snapshot.sessionId };
            this.returnAfterWidgetClose = "hud";
            activeHost.closeToHud();
            return;
        }
        this.update({ presentation: "hud", sessionId: sessionId ?? this.snapshot.sessionId, widgetBlockId: null });
    }

    requestOpenPanel(sessionId?: string | null): void {
        const activeHost = this.snapshot.widgetBlockId
            ? this.widgetHosts.get(this.snapshot.widgetBlockId)
            : [...this.widgetHosts.values()][0];
        if (this.snapshot.presentation === "widget" && activeHost) {
            this.snapshot = { ...this.snapshot, sessionId: sessionId ?? this.snapshot.sessionId };
            this.returnAfterWidgetClose = "panel";
            activeHost.closeToHud();
            return;
        }
        this.update({ presentation: "panel", sessionId: sessionId ?? this.snapshot.sessionId, widgetBlockId: null });
    }

    returnToHud(sessionId?: string | null): void {
        this.update({ presentation: "hud", sessionId: sessionId ?? this.snapshot.sessionId, widgetBlockId: null });
    }

    dismiss(): void {
        this.update({ presentation: "closed", widgetBlockId: null });
    }

    async expandToWidget(): Promise<void> {
        if (this.expanding || !this.expandHandler) {
            return;
        }
        this.expanding = true;
        this.widgetRequested = true;
        try {
            await this.expandHandler();
            const activeHost = [...this.widgetHosts.values()][0];
            if (activeHost) {
                this.widgetRequested = false;
                this.returnAfterWidgetClose = "closed";
                this.update({ presentation: "widget", widgetBlockId: activeHost.blockId });
            }
        } catch (error) {
            this.widgetRequested = false;
            throw error;
        } finally {
            this.expanding = false;
        }
    }

    activateWidget(blockId: string): void {
        if (!this.widgetHosts.has(blockId)) {
            return;
        }
        this.returnAfterWidgetClose = "closed";
        this.update({ presentation: "widget", widgetBlockId: blockId });
    }

    registerWidgetHost(host: WidgetHost): () => void {
        this.widgetHosts.set(host.blockId, host);
        const activeHost = this.snapshot.widgetBlockId && this.widgetHosts.get(this.snapshot.widgetBlockId);
        if (!activeHost || this.snapshot.presentation === "hud") {
            this.widgetRequested = false;
            this.update({ presentation: "widget", widgetBlockId: host.blockId });
        }
        return () => {
            this.widgetHosts.delete(host.blockId);
            if (this.snapshot.widgetBlockId !== host.blockId) {
                return;
            }
            const next = [...this.widgetHosts.values()][0];
            if (next) {
                this.update({ presentation: "widget", widgetBlockId: next.blockId });
            } else if (this.snapshot.presentation === "widget") {
                this.update({
                    presentation: this.returnAfterWidgetClose,
                    widgetBlockId: null,
                });
                this.returnAfterWidgetClose = "closed";
            }
        };
    }

    setSession(sessionId: string | null): void {
        this.update({ sessionId });
    }

    moveBy(delta: { x: number; y: number }): void {
        this.setGeometry({
            ...this.snapshot.geometry,
            x: this.snapshot.geometry.x + delta.x,
            y: this.snapshot.geometry.y + delta.y,
        });
    }

    setGeometry(geometry: Partial<HermesHudGeometry>): void {
        const next = clampHermesHudGeometry({ ...this.snapshot.geometry, ...geometry });
        try {
            window.localStorage.setItem(GeometryStorageKey, JSON.stringify(next));
        } catch {
            // In-memory geometry remains usable when storage is unavailable.
        }
        this.update({ geometry: next });
    }

    clampToViewport(): void {
        this.setGeometry(this.snapshot.geometry);
    }

    resetForTests(): void {
        this.widgetHosts.clear();
        this.expandHandler = null;
        this.expanding = false;
        this.widgetRequested = false;
        this.returnAfterWidgetClose = "closed";
        this.snapshot = {
            presentation: "closed",
            geometry: clampHermesHudGeometry({}),
            sessionId: null,
            widgetBlockId: null,
        };
        this.emit();
    }

    private update(patch: Partial<HermesSurfaceSnapshot>): void {
        const next = { ...this.snapshot, ...patch };
        if (
            next.presentation === this.snapshot.presentation &&
            next.geometry === this.snapshot.geometry &&
            next.sessionId === this.snapshot.sessionId &&
            next.widgetBlockId === this.snapshot.widgetBlockId
        ) {
            return;
        }
        this.snapshot = next;
        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const hermesSurfaceController = new HermesSurfaceController();
