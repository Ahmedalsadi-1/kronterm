// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildGatewayWsUrl,
    buildProfileScopedApiUrl,
    configureHermesDesktopShim,
    replaceHermesDesktopShim,
} from "./hermes-desktop-shim";

beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
            clear: () => values.clear(),
            getItem: (key: string) => values.get(key) ?? null,
            removeItem: (key: string) => values.delete(key),
            setItem: (key: string, value: string) => values.set(key, value),
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "api");
    Reflect.deleteProperty(window, "localStorage");
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
        const hermesApi = vi.fn(async (request: HermesApiIpcRequest) => {
            const body = request.body as { name?: string } | undefined;
            return { active: body?.name ?? "default", current: "default" };
        });
        Object.defineProperty(window, "api", { configurable: true, value: { hermesApi } });
        configureHermesDesktopShim({ baseUrl: "http://127.0.0.1:9119", token: "session-token" });
        replaceHermesDesktopShim();

        await expect(window.hermesDesktop!.profile.set("research")).resolves.toEqual({ profile: "research" });
        expect(hermesApi).toHaveBeenCalledWith(
            expect.objectContaining({
                body: { name: "research" },
                method: "POST",
                path: "/api/profiles/active",
            })
        );
    });
});
