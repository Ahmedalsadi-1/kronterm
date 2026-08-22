// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import { parseHermesReadyPort } from "./hermes-runtime";

describe("parseHermesReadyPort", () => {
    test.each([
        ["HERMES_BACKEND_READY port=43127\n", 43127],
        ["booting\nHERMES_DASHBOARD_READY port=9119\r\nready", 9119],
    ])("reads a supported readiness sentinel", (output, expected) => {
        expect(parseHermesReadyPort(output)).toBe(expected);
    });

    test.each(["HERMES_BACKEND_READY port=0", "HERMES_BACKEND_READY port=70000", "ready port=9119"])(
        "rejects an invalid readiness sentinel",
        (output) => {
            expect(parseHermesReadyPort(output)).toBeUndefined();
        }
    );
});
