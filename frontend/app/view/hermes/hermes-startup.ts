// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

let hudAutoOpenConsumed = false;

export function consumeHermesHudAutoOpen(): boolean {
    if (hudAutoOpenConsumed) {
        return false;
    }
    hudAutoOpenConsumed = true;
    return true;
}

export function resetHermesHudAutoOpenForTests(): void {
    hudAutoOpenConsumed = false;
}
