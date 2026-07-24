// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { clientPointToCanvasPoint } from "./appstream";

describe("appstream coordinate mapping", () => {
    it("maps direct fit coordinates into canvas pixels", () => {
        expect(
            clientPointToCanvasPoint(150, 75, { left: 50, top: 25, width: 200, height: 100 }, 400, 200, "fit")
        ).toEqual({ x: 200, y: 100 });
    });

    it("accounts for object-cover cropping in fill mode", () => {
        expect(
            clientPointToCanvasPoint(200, 100, { left: 0, top: 0, width: 400, height: 200 }, 400, 400, "fill")
        ).toEqual({ x: 200, y: 200 });
    });

    it("clamps points outside the covered image", () => {
        expect(clientPointToCanvasPoint(0, 0, { left: 0, top: 0, width: 400, height: 200 }, 400, 400, "fill")).toEqual({
            x: 0,
            y: 100,
        });
    });
});
