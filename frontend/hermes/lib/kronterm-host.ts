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

interface HermesShellMode {
    embedded: boolean;
    hudMode: boolean;
    panelMode: boolean;
}

const HermesShellModeContext = createContext<HermesShellMode | null>(null);

export function HermesShellModeProvider({
    children,
    hudMode,
    panelMode = false,
}: {
    children: ReactNode;
    hudMode: boolean;
    panelMode?: boolean;
}) {
    return createElement(HermesShellModeContext.Provider, {
        value: { embedded: hudMode || panelMode, hudMode, panelMode },
        children,
    });
}

export function useHermesShellMode(): HermesShellMode {
    const mode = useContext(HermesShellModeContext);
    return mode ?? { embedded: isKronTermHudHost(), hudMode: false, panelMode: false };
}
