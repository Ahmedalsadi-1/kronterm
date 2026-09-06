// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type OSAppDragPayload = {
    blockId?: string;
    view?: string;
    appid?: string;
    appname?: string;
};

export const OSAppDragMimeType = "application/x-kronterm-os-app";

export function readOSAppDragPayload(dataTransfer: DataTransfer): OSAppDragPayload | undefined {
    const raw = dataTransfer.getData(OSAppDragMimeType);
    if (raw === "") return undefined;
    try {
        const payload = JSON.parse(raw) as OSAppDragPayload;
        if (payload.blockId == null && payload.view == null && payload.appid == null) return undefined;
        return payload;
    } catch {
        return undefined;
    }
}
