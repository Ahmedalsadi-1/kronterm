// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Small Kronterm adapter for copied Hermes UI components.

export function useHermesI18n() {
    return {
        t: {
            common: {
                cancel: "Cancel",
                close: "Close",
                copied: "Copied",
                copy: "Copy",
                copyFailed: "Copy failed",
                failed: "Failed",
                send: "Send",
            },
            preview: {
                hide: "Hide",
                openPreview: "Open Preview",
                opening: "Opening",
                unavailable: "Preview unavailable",
            },
            assistant: {
                tool: {
                    renderingImage: "Rendering image",
                    statusDone: "Done",
                    statusError: "Error",
                    statusRecovered: "Recovered",
                    statusRunning: "Running",
                },
            },
            image: {
                download: "Download",
                open: "Open image",
            },
            desktop: {
                downloadStarted: "Download started",
                imageDownload: "Download image",
                imageDownloadFailed: "Could not download image",
                imageSaved: "Image saved",
                imageDownloading: "Downloading",
                imageOpen: "Open image",
                openImage: "Open image",
                restartToSaveImages: "Could not save image",
                restartToUseSaveImage: "Browser download was used",
                savingImage: "Saving image",
                downloadImage: "Download image",
            },
            ui: {
                search: {
                    clear: "Clear search",
                },
            },
        },
    };
}

export const useI18n = useHermesI18n;
