import { describe, expect, test } from "vitest";
import { shouldOpenKronarchyLauncher } from "./kronarchy-shell";

const makeShortcut = (overrides: Partial<KeyboardEvent> = {}) =>
    ({
        altKey: false,
        code: "Space",
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        ...overrides,
    }) as KeyboardEvent;

describe("shouldOpenKronarchyLauncher", () => {
    test("opens Shift+Command+Space outside Kronarchy mode", () => {
        expect(shouldOpenKronarchyLauncher(makeShortcut(), false)).toBe(true);
    });

    test("keeps plain Command+Space exclusive to Kronarchy mode", () => {
        expect(shouldOpenKronarchyLauncher(makeShortcut({ shiftKey: false }), false)).toBe(false);
        expect(shouldOpenKronarchyLauncher(makeShortcut({ shiftKey: false }), true)).toBe(true);
    });

    test("does not open for conflicting modifiers", () => {
        expect(shouldOpenKronarchyLauncher(makeShortcut({ altKey: true }), true)).toBe(false);
        expect(shouldOpenKronarchyLauncher(makeShortcut({ ctrlKey: true }), true)).toBe(false);
    });
});
