// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { FocusReportModeGuard } from "./focusreportguard";

describe("FocusReportModeGuard", () => {
    it("allows the first focus-report enable and consumes duplicates", () => {
        const guard = new FocusReportModeGuard();

        expect(guard.handleEnable([1004])).toBe(false);
        expect(guard.handleEnable([1004])).toBe(true);
        expect(guard.handleEnable([1004])).toBe(true);
    });

    it("allows focus-report mode to be enabled again after a reset", () => {
        const guard = new FocusReportModeGuard();

        expect(guard.handleEnable([1004])).toBe(false);
        expect(guard.handleDisable([1004])).toBe(false);
        expect(guard.handleEnable([1004])).toBe(false);
    });

    it("does not consume unrelated or combined mode sequences", () => {
        const guard = new FocusReportModeGuard();

        expect(guard.handleEnable([1000])).toBe(false);
        expect(guard.handleEnable([1000, 1004])).toBe(false);
        expect(guard.handleEnable([1000, 1004])).toBe(false);
        expect(guard.handleEnable([1004])).toBe(true);
        expect(guard.handleDisable([1000, 1004])).toBe(false);
        expect(guard.handleEnable([1004])).toBe(false);
    });
});
