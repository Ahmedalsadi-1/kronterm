import { makeDirectMobileUiUrl, messageText, normalizeHostUrl } from "./kronos-client";

describe("normalizeHostUrl", () => {
    it("adds HTTPS and removes an API suffix", () => {
        expect(normalizeHostUrl("kron.example/api/")).toBe("https://kron.example");
    });

    it("preserves explicit local HTTP endpoints", () => {
        expect(normalizeHostUrl("http://192.168.1.8:4119/")).toBe("http://192.168.1.8:4119");
    });

    it("rejects unsupported protocols", () => {
        expect(() => normalizeHostUrl("ftp://kron.example")).toThrow("HTTPS or HTTP");
    });
});

describe("makeDirectMobileUiUrl", () => {
    it("opens the shipped KronosChamber mobile shell against the selected host", () => {
        const url = new URL(
            makeDirectMobileUiUrl("http://127.0.0.1:3107", {
                sessionId: "session-1",
                surfaceId: "surface-1",
            })
        );

        expect(url.origin).toBe("http://127.0.0.1:3107");
        expect(url.searchParams.get("apiBaseUrl")).toBe("http://127.0.0.1:3107/api");
        expect(url.searchParams.get("embeddedHost")).toBe("kronterm");
        expect(url.searchParams.get("mobileShell")).toBe("iphone");
        expect(url.searchParams.get("currentSessionId")).toBe("session-1");
    });
});

describe("messageText", () => {
    it("does not flatten tool or reasoning parts into the assistant answer", () => {
        expect(
            messageText([
                { type: "reasoning", text: "private trace" },
                { type: "tool", text: "tool result" },
                { type: "text", text: "Visible answer" },
            ])
        ).toBe("Visible answer");
    });
});
