import { describe, expect, it } from "vitest";
import { applyAcpEvent, getCompatibleProfileActions, type AcpRuntimeRecord } from "./use-acp-session";

function makeRuntime(conversationId: string): AcpRuntimeRecord {
    return {
        conversationId,
        status: "connected",
        sessionId: null,
        backend: "kronoscode",
        error: null,
        messages: [],
        pendingConfirmations: [],
        configOptions: [],
        modes: null,
        currentMode: "default",
        modelInfo: null,
        usage: null,
        agentInfo: null,
        capabilities: null,
        agentName: "KronosCode",
        workspace: "/tmp/workspace",
        title: "New chat",
        referencedFiles: [],
        isLive: true,
        resumeState: "live",
        createdTs: 1,
        updatedTs: 1,
    };
}

describe("ACP runtime event routing", () => {
    it("updates only the session receiving a background stream event", () => {
        const first = makeRuntime("conversation-a");
        const second = makeRuntime("conversation-b");
        const updated = applyAcpEvent(second, {
            conversationId: "conversation-b",
            type: "agent_message_chunk",
            msgId: "message-b",
            data: { text: "background result" },
            timestamp: 8,
        });

        expect(first.messages).toEqual([]);
        expect(updated.messages).toHaveLength(1);
        expect(updated.messages[0].data).toEqual({ text: "background result" });
    });

    it("keeps permission queues and model state scoped to one runtime", () => {
        const runtime = applyAcpEvent(makeRuntime("conversation-a"), {
            conversationId: "conversation-a",
            type: "tool_permission",
            msgId: "permission-event",
            data: {
                confirmation: {
                    id: "approval",
                    callId: "tool-call",
                    title: "Run command",
                    options: [],
                },
            },
            timestamp: 2,
        });
        const configured = applyAcpEvent(runtime, {
            conversationId: "conversation-a",
            type: "agent_info",
            msgId: "model-event",
            data: { modelInfo: { currentModelId: "model-a", canSwitch: true } },
            timestamp: 3,
        });

        expect(configured.pendingConfirmations[0].callId).toBe("tool-call");
        expect(configured.modelInfo?.currentModelId).toBe("model-a");
    });

    it("applies profile controls only when a live runtime advertises them", () => {
        const compatible: AcpRuntimeRecord = {
            ...makeRuntime("conversation-a"),
            modes: { availableModes: [{ id: "build" }] },
            modelInfo: { canSwitch: true, availableModels: [{ id: "openai/gpt-5" }] },
            configOptions: [{ id: "reasoning", type: "select", options: [{ value: "high" }] }],
        };

        expect(
            getCompatibleProfileActions(compatible, {
                model: "openai/gpt-5",
                mode: "build",
                configoptions: { reasoning: "high", unsupported: "on" },
            })
        ).toEqual([
            { type: "model", value: "openai/gpt-5" },
            { type: "mode", value: "build" },
            { type: "config", id: "reasoning", value: "high" },
        ]);

        expect(getCompatibleProfileActions({ ...compatible, isLive: false }, { mode: "build" })).toEqual([]);
    });
});
