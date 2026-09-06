import { describe, expect, it } from "bun:test";
import { makeKronTermRuntimeTokenBody, makeKronTermSurfaceMcpBody } from "./surface-registration.js";

describe("KronTerm widget surface registration", () => {
    it("registers the token under the surface identity used by the gateway session", () => {
        expect(
            makeKronTermRuntimeTokenBody({
                token: "header.payload.signature",
                tabId: "tab-1",
                blockId: "block-1",
                surfaceId: "surface-1",
            })
        ).toEqual({
            token: "header.payload.signature",
            tabId: "tab-1",
            blockId: "block-1",
            surfaceId: "surface-1",
        });
    });

    it("uses the reserved dynamic MCP name and keeps the JWT out of its base config", () => {
        const body = makeKronTermSurfaceMcpBody(
            "/opt/kronterm/mcp-kron-term/index.js",
            { KRONTERM_WSH: "/opt/kronterm/bin/wsh" },
            "/Applications/KronTerm.app/Contents/MacOS/KronTerm"
        );

        expect(body.name).toBe("wave-surface");
        expect(body.config.environment).toEqual({ KRONTERM_WSH: "/opt/kronterm/bin/wsh" });
        expect(body.config.environment).not.toHaveProperty("KRONTERM_JWT");
        expect(body.config.environment).not.toHaveProperty("WAVETERM_JWT");
    });
});
