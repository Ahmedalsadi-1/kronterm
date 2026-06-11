// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export function notify(message: unknown) {
    console.info(message);
}

export function notifyError(error: unknown, fallback = "Error") {
    console.error(fallback, error);
}
