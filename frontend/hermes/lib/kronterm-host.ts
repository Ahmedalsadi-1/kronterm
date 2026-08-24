import { createContext, createElement, type ReactNode, useContext } from "react";

const KronTermWidgetFlag = "__KRONTERM_HERMES_WIDGET__";
const KronTermHudFlag = "__KRONTERM_HERMES_HUD__";

type KronTermHostWindow = Window & {
    [KronTermWidgetFlag]?: boolean;
    [KronTermHudFlag]?: boolean;
};

export function markKronTermWidgetHost(): void {
    if (typeof window !== "undefined") {
        (window as KronTermHostWindow)[KronTermWidgetFlag] = true;
    }
}

export function isKronTermWidgetHost(): boolean {
    return typeof window !== "undefined" && Boolean((window as KronTermHostWindow)[KronTermWidgetFlag]);
}

export function markKronTermHudHost(enabled: boolean): void {
    if (typeof window !== "undefined") {
        (window as KronTermHostWindow)[KronTermHudFlag] = enabled;
    }
}

export function isKronTermHudHost(): boolean {
    return typeof window !== "undefined" && Boolean((window as KronTermHostWindow)[KronTermHudFlag]);
}

const HermesShellModeContext = createContext<{ embedded: boolean; hudMode: boolean } | null>(null);

export function HermesShellModeProvider({ children, hudMode }: { children: ReactNode; hudMode: boolean }) {
    return createElement(HermesShellModeContext.Provider, { value: { embedded: hudMode, hudMode } }, children);
}

export function useHermesShellMode(): { embedded: boolean; hudMode: boolean } {
    const mode = useContext(HermesShellModeContext);
    return mode ?? { embedded: isKronTermHudHost(), hudMode: false };
}
