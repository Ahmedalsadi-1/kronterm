import { describe, expect, it } from "vitest";
import { isChildProcessRunning } from "./chathubv2-process";

describe("ChatHub V2 process lifecycle", () => {
    it("treats a signaled but not-yet-exited child as running", () => {
        expect(isChildProcessRunning({ exitCode: null, signalCode: null })).toBe(true);
    });

    it("recognizes exited and signal-terminated children", () => {
        expect(isChildProcessRunning({ exitCode: 0, signalCode: null })).toBe(false);
        expect(isChildProcessRunning({ exitCode: null, signalCode: "SIGTERM" })).toBe(false);
    });
});
