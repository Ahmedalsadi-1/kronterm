// KronTerm desktop runtime detection (simplified for Electron)
// kronosChamber uses Tauri/VSCode/web detection — KronTerm is always Electron desktop.

export const isTauriShell = (): boolean => false;

export const isExtensionHost = (): boolean => false;

export const isDesktopShell = (): boolean => true;

export const isVSCodeRuntime = (): boolean => false;

export const isWebRuntime = (): boolean => {
    if (typeof window === "undefined") return false;
    return window.location.protocol !== "file:" && !window.location.host?.includes("localhost:9124");
};

export const isDesktopLocalOriginActive = (): boolean => true;
