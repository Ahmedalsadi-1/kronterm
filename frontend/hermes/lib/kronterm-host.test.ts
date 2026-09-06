import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HermesShellModeProvider, isKronTermHudHost, isKronTermWidgetHost, useHermesShellMode } from "./kronterm-host";

function ModeProbe() {
    const mode = useHermesShellMode();
    return createElement("span", null, JSON.stringify(mode));
}

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

    it("treats the workspace panel as embedded without enabling HUD behavior", () => {
        const markup = renderToStaticMarkup(
            createElement(HermesShellModeProvider, {
                hudMode: false,
                panelMode: true,
                children: createElement(ModeProbe),
            })
        );
        expect(markup).toContain("&quot;embedded&quot;:true");
        expect(markup).toContain("&quot;hudMode&quot;:false");
        expect(markup).toContain("&quot;panelMode&quot;:true");
    });
});
