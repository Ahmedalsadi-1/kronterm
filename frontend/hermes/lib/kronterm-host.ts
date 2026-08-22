const KronTermWidgetFlag = "__KRONTERM_HERMES_WIDGET__";

type KronTermHostWindow = Window & {
    [KronTermWidgetFlag]?: boolean;
};

export function markKronTermWidgetHost(): void {
    if (typeof window !== "undefined") {
        (window as KronTermHostWindow)[KronTermWidgetFlag] = true;
    }
}

export function isKronTermWidgetHost(): boolean {
    return typeof window !== "undefined" && Boolean((window as KronTermHostWindow)[KronTermWidgetFlag]);
}
