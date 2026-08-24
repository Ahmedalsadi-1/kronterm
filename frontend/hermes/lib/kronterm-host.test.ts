import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HermesShellModeProvider, isKronTermHudHost, isKronTermWidgetHost } from "./kronterm-host";

describe("KronTerm Hermes host module", () => {
    it("initializes its React context when the module loads", () => {
        expect(HermesShellModeProvider).toBeTypeOf("function");
        expect(isKronTermHudHost()).toBe(false);
        expect(isKronTermWidgetHost()).toBe(false);
    });

    it("declares the React import before context initialization for Vite's CommonJS interop", () => {
        const source = readFileSync(new URL("./kronterm-host.ts", import.meta.url), "utf8");
        expect(source.indexOf('from "react"')).toBeLessThan(source.indexOf("createContext<"));
    });
});
