// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type ChildProcessExitState = {
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
};

export function isChildProcessRunning(process: ChildProcessExitState): boolean {
    return process.exitCode == null && process.signalCode == null;
}
