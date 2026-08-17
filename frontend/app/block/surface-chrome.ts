// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const SurfaceLabels: Record<string, string> = {
    codeeditor: "Editor",
    preview: "Files",
    term: "Terminal",
    web: "Browser",
    webview: "Browser",
};

function getSurfaceChromeLabel(metaView: string, viewName?: string): string {
    return SurfaceLabels[metaView] ?? viewName ?? "Widget";
}

function getSurfaceChromeName(metaView: string): string {
    if (metaView === "webview") {
        return "web";
    }
    return metaView || "widget";
}

export { getSurfaceChromeLabel, getSurfaceChromeName };
