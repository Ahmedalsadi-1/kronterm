// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").

import { describe, expect, it } from "vitest";
import { isControllerInputUnavailableError } from "./controller-errors";

describe("controller input lifecycle errors", () => {
    it.each([new Error("no controller found for block abc"), new Error("no shell input chan")])(
        "recognizes an expected terminal teardown race",
        (error) => {
            expect(isControllerInputUnavailableError(error)).toBe(true);
        }
    );

    it("does not hide unrelated controller errors", () => {
        expect(isControllerInputUnavailableError(new Error("connection refused"))).toBe(false);
    });
});
