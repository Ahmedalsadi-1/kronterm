// @vitest-environment jsdom

// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test, vi } from "vitest";
import { isAgentChatView, requestTabsAgentCompanion, TabsAgentCompanionRequestEvent } from "./tabs-agent-workspace";

describe("tabs agent workspace", () => {
    test("recognizes only the two agent chat widget views", () => {
        expect(isAgentChatView("chathubv2")).toBe(true);
        expect(isAgentChatView("hermes")).toBe(true);
        expect(isAgentChatView("waveai")).toBe(false);
        expect(isAgentChatView("term")).toBe(false);
    });

    test("requests a live companion without changing the workspace presentation", () => {
        const listener = vi.fn();
        window.addEventListener(TabsAgentCompanionRequestEvent, listener);

        requestTabsAgentCompanion(" browser-block ");

        expect(listener).toHaveBeenCalledOnce();
        expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ blockId: "browser-block" });
        window.removeEventListener(TabsAgentCompanionRequestEvent, listener);
    });
});
