// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const TabsAgentCompanionRequestEvent = "kronterm:tabs-agent-companion";

const AgentChatViews = new Set(["chathubv2", "hermes"]);

type TabsAgentCompanionRequest = {
    blockId: string;
};

function isAgentChatView(view: string): boolean {
    return AgentChatViews.has(view);
}

function requestTabsAgentCompanion(blockId: string): void {
    if (typeof window === "undefined" || !blockId.trim()) {
        return;
    }
    window.dispatchEvent(
        new CustomEvent<TabsAgentCompanionRequest>(TabsAgentCompanionRequestEvent, {
            detail: { blockId: blockId.trim() },
        })
    );
}

export { TabsAgentCompanionRequestEvent, isAgentChatView, requestTabsAgentCompanion, type TabsAgentCompanionRequest };
