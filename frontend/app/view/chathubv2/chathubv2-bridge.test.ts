import { describe, expect, it } from "vitest";
import {
    makeEmbeddedChatUrl,
    makeKronSettingsBlockDef,
    makeKronTermPowerResumeMessage,
    makeKronTermSurfaceActivityMessage,
    makeKronTermThemeMessage,
    readKronTermThemeSnapshot,
    resolveRequestedSettingsSection,
} from "./chathubv2-bridge";

describe("ChatHub V2 host bridge", () => {
    it("marks the Chamber URL as embedded and keeps its API on the same origin", () => {
        const url = new URL(makeEmbeddedChatUrl("http://127.0.0.1:4317/chat?session=abc"));

        expect(url.searchParams.get("embeddedHost")).toBe("kronterm");
        expect(url.searchParams.get("apiBaseUrl")).toBe("http://127.0.0.1:4317/api");
        expect(url.searchParams.get("tab")).toBe("canvas");
        expect(url.searchParams.get("session")).toBe("abc");
    });

    it("routes a Chamber settings section into native KronTerm block metadata", () => {
        expect(makeKronSettingsBlockDef("providers")).toEqual({
            meta: {
                view: "kronsettings",
                "kronsettings:section": "providers",
                "kronsettings:source": "kronoschamber",
            },
        });
        expect(resolveRequestedSettingsSection("not-a-section")).toBe("visual");
    });

    it("maps KronTerm semantic tokens into the Chamber theme message", () => {
        const values: Record<string, string> = {
            "--hermes-background": "#09090b",
            "--hermes-foreground": "#f4f4f5",
            "--hermes-card": "#111113",
            "--hermes-card-foreground": "#fafafa",
            "--hermes-popover": "#151518",
            "--hermes-primary": "#f4f4f5",
            "--hermes-primary-foreground": "#09090b",
            "--hermes-midground": "#7c9cff",
            "--hermes-ring": "#9db2ff",
            "--hermes-sidebar": "#080809",
            "--hermes-font-sans": '"Inter", system-ui, sans-serif',
            "--hermes-font-mono": '"JetBrains Mono", monospace',
        };
        const theme = readKronTermThemeSnapshot({
            getPropertyValue: (name) => values[name] ?? "",
        } as Pick<CSSStyleDeclaration, "getPropertyValue">);

        expect(makeKronTermThemeMessage(theme)).toMatchObject({
            type: "kronterm:theme-sync",
            theme: {
                background: "#09090b",
                foreground: "#f4f4f5",
                card: "#111113",
                cardForeground: "#fafafa",
                popover: "#151518",
                primary: "#f4f4f5",
                primaryForeground: "#09090b",
                midground: "#7c9cff",
                ring: "#9db2ff",
                sidebarBackground: "#080809",
                fontSans: '"Inter", system-ui, sans-serif',
                fontMono: '"JetBrains Mono", monospace',
            },
        });
    });

    it("keeps legacy KronTerm variables as compatibility fallbacks", () => {
        const values: Record<string, string> = {
            "--main-bg-color": "#151313",
            "--text-primary-color": "#ded8ca",
            "--accent-color": "#edb449",
            "--font-default": '"JetBrains Mono", monospace',
        };

        const theme = readKronTermThemeSnapshot({
            getPropertyValue: (name) => values[name] ?? "",
        } as Pick<CSSStyleDeclaration, "getPropertyValue">);

        expect(theme).toMatchObject({
            background: "#151313",
            foreground: "#ded8ca",
            primary: "#edb449",
            midground: "#edb449",
            fontSans: '"JetBrains Mono", monospace',
        });
    });

    it("creates a narrow power-resume signal for the embedded Chamber", () => {
        expect(makeKronTermPowerResumeMessage()).toEqual({ type: "kronterm:power-resume" });
    });

    it("wraps live KronTerm tool activity for the embedded runtime dock", () => {
        const activity = {
            source: "acp" as const,
            phase: "running" as const,
            surface: "sandbox" as const,
            action: "screenshot" as const,
            detail: "Inspecting the sandbox desktop",
            previewimageurl: "data:image/png;base64,preview",
            timestamp: 42,
        };

        expect(makeKronTermSurfaceActivityMessage(activity)).toEqual({
            type: "kronterm:surface-activity",
            activity,
        });
    });
});
