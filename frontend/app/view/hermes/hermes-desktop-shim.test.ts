// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";
import {
    buildGatewayWsUrl,
    buildProfileScopedApiUrl,
    configureHermesDesktopShim,
    replaceHermesDesktopShim,
} from "./hermes-desktop-shim";

afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
});

describe("Kronos profile routing", () => {
    it("never persists the daemon session token across renderer lifetimes", () => {
        window.localStorage.setItem("kronterm.hermes.shim.token", "expired-token");

        configureHermesDesktopShim({ baseUrl: "http://127.0.0.1:62554", token: "current-token" });

        expect(window.localStorage.getItem("kronterm.hermes.shim.token")).toBeNull();
    });

    it("routes REST settings to the selected profile without dropping existing query parameters", () => {
        expect(buildProfileScopedApiUrl("http://127.0.0.1:9119", "/api/skills?enabled=true", "research")).toBe(
            "http://127.0.0.1:9119/api/skills?enabled=true&profile=research"
        );
    });

    it("routes the gateway socket to the selected profile while retaining token authentication", () => {
        expect(buildGatewayWsUrl("http://127.0.0.1:9119", "session token", "research")).toBe(
            "ws://127.0.0.1:9119/api/ws?token=session+token&profile=research"
        );
    });

    it("persists profile selection through the managed backend instead of returning a no-op success", async () => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            return new Response(JSON.stringify({ active: body?.name ?? "default", current: "default" }), {
                headers: { "content-type": "application/json" },
                status: 200,
            });
        });
        vi.stubGlobal("fetch", fetchMock);
        configureHermesDesktopShim({ baseUrl: "http://127.0.0.1:9119", token: "session-token" });
        replaceHermesDesktopShim();

        await expect(window.hermesDesktop!.profile.set("research")).resolves.toEqual({ profile: "research" });
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:9119/api/profiles/active",
            expect.objectContaining({
                body: JSON.stringify({ name: "research" }),
                method: "POST",
            })
        );
    });
});
