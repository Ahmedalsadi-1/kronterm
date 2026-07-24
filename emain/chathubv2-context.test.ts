import { describe, expect, it } from "vitest";
import {
    makeRuntimeTokenPayload,
    makeStartupSurfaceContext,
    makeSurfaceEnvironment,
    makeSurfaceTokenRequest,
} from "./chathubv2-context";

describe("KronosChamber startup surface context", () => {
    it("does not change when a later renderer updates the shared surface context", () => {
        const requested = {};
        const startupContext = makeStartupSurfaceContext(requested);

        Object.assign(requested, { tabId: "tab-late", blockId: "block-late" });

        expect(startupContext).toEqual({});
    });

    it("issues a token for the exact tab and block that owns the chamber", () => {
        expect(makeSurfaceTokenRequest({ tabId: "tab-1", blockId: "block-1" })).toEqual({
            tabid: "tab-1",
            blockid: "block-1",
        });
    });

    it("passes the complete surface handshake to KronosCode", () => {
        const token = {
            token: "header.payload.signature",
            tabid: "tab-1",
            blockid: "block-1",
            expiresat: 123,
        } as CommandCreateSurfaceTokenRtnData;

        expect(makeSurfaceEnvironment(token)).toEqual({
            KRONTERM_JWT: "header.payload.signature",
            WAVETERM_JWT: "header.payload.signature",
            KRONTERM_TABID: "tab-1",
            WAVETERM_TABID: "tab-1",
            KRONTERM_BLOCKID: "block-1",
            WAVETERM_BLOCKID: "block-1",
        });
        expect(makeRuntimeTokenPayload(token)).toEqual({
            token: "header.payload.signature",
            tabId: "tab-1",
            blockId: "block-1",
        });
    });
});
