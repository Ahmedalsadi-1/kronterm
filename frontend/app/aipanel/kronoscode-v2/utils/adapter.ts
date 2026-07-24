import type { AcpAgentMessage } from "../../use-acp-session";
import type { Message, Part } from "../types/sdk";

export function getMessageText(message: AcpAgentMessage): string {
    const data = message.data;
    if (typeof data === "string") return data;
    if (data == null) return "";
    if (typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (typeof obj.text === "string") return obj.text;
        const content = obj.content;
        if (typeof content === "object" && content != null) {
            const contentText = (content as Record<string, unknown>).text;
            if (typeof contentText === "string") return contentText;
        }
    }
    return "";
}

function getMessageMetadata(message: AcpAgentMessage): Record<string, string> {
    if (message.data == null || typeof message.data !== "object") {
        return {};
    }
    const data = message.data as Record<string, unknown>;
    return {
        agent: typeof data.agent === "string" ? data.agent : "",
        mode: typeof data.mode === "string" ? data.mode : "",
        modelID: typeof data.modelID === "string" ? data.modelID : "",
        providerID: typeof data.providerID === "string" ? data.providerID : "",
    };
}

export function mapAcpMessagesToSDK(messages: AcpAgentMessage[]): Array<{ info: Message; parts: Part[] }> {
    const sdkMessages: Array<{ info: Message; parts: Part[] }> = [];

    // Simple stateful grouping
    let currentMessage: { info: Message; parts: Part[] } | null = null;

    for (const msg of messages) {
        const isUser = msg.type === "user_message";
        const isAssistant =
            msg.type === "agent_message_chunk" ||
            msg.type === "agent_thought_chunk" ||
            msg.type === "tool_call" ||
            msg.type === "tool_call_update";

        if (isUser) {
            sdkMessages.push({
                info: {
                    id: msg.msgId,
                    role: "user",
                    parts: [],
                },
                parts: [
                    {
                        type: "text",
                        text: getMessageText(msg),
                    },
                ],
            });
            currentMessage = null;
            continue;
        }

        if (isAssistant) {
            const metadata = getMessageMetadata(msg);
            if (!currentMessage) {
                currentMessage = {
                    info: {
                        id: msg.msgId,
                        role: "assistant",
                        parts: [],
                        agent: metadata.agent,
                        mode: metadata.mode,
                        modelID: metadata.modelID,
                        providerID: metadata.providerID,
                    },
                    parts: [],
                };
                sdkMessages.push(currentMessage);
            }

            // Sync info if it was missing in the first chunk but present now
            if (metadata.agent && !currentMessage.info.agent) currentMessage.info.agent = metadata.agent;
            if (metadata.mode && !currentMessage.info.mode) currentMessage.info.mode = metadata.mode;
            if (metadata.modelID && !currentMessage.info.modelID) currentMessage.info.modelID = metadata.modelID;
            if (metadata.providerID && !currentMessage.info.providerID) currentMessage.info.providerID = metadata.providerID;

            if (msg.type === "agent_message_chunk") {
                const text = getMessageText(msg);
                const lastPart = currentMessage.parts[currentMessage.parts.length - 1];
                if (lastPart?.type === "text") {
                    lastPart.text = (lastPart.text || "") + text;
                } else {
                    currentMessage.parts.push({
                        type: "text",
                        text: text,
                    });
                }
            } else if (msg.type === "agent_thought_chunk") {
                const text = getMessageText(msg);
                const lastPart = currentMessage.parts[currentMessage.parts.length - 1];
                if (lastPart?.type === "reasoning") {
                    lastPart.text = (lastPart.text || "") + text;
                } else {
                    currentMessage.parts.push({
                        type: "reasoning",
                        text: text,
                    });
                }
            } else if (msg.type === "tool_call" || msg.type === "tool_call_update") {
                const data = msg.data as any;
                currentMessage.parts.push({
                    id: msg.msgId,
                    type: "tool",
                    tool: data?.title || data?.kind || "tool",
                    input: data?.rawInput,
                    state: {
                        status: data?.status || "running",
                        output: data?.content?.[0]?.content?.text,
                    },
                });
            }
        }
    }

    return sdkMessages;
}
