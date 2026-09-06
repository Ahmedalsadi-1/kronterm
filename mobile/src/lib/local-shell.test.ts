import { describe, expect, it } from "vitest";
import { cleanTerminalOutput, isKronosCodeCommand } from "./local-shell";

describe("local shell helpers", () => {
    it("normalizes native terminal output", () => {
        expect(cleanTerminalOutput("\u001b[32mready\u001b[0m\r\nnext\r\n")).toEqual(["ready", "next"]);
    });

    it("recognizes the KronosCode TUI handoff command", () => {
        expect(isKronosCodeCommand("kronoscode")).toBe(true);
        expect(isKronosCodeCommand("kc --continue")).toBe(true);
        expect(isKronosCodeCommand("echo kronoscode")).toBe(false);
    });
});
