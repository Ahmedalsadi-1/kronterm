// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

type CsiParams = readonly (number | number[])[];

export class FocusReportModeGuard {
    enabled = false;

    handleEnable(params: CsiParams): boolean {
        if (!params.includes(1004)) {
            return false;
        }
        const shouldSuppress = this.enabled && params.length === 1;
        this.enabled = true;
        return shouldSuppress;
    }

    handleDisable(params: CsiParams): boolean {
        if (params.includes(1004)) {
            this.enabled = false;
        }
        return false;
    }
}
