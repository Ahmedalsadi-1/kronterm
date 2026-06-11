import type { AcpAgentMessage } from "../use-acp-session";
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

export function mapAcpMessagesToSDK(messages: AcpAgentMessage[]): Array<{ info: Message, parts: Part[] }> {
    const sdkMessages: Array<{ info: Message, parts: Part[] }> = [];
    
    // Simple stateful grouping
    let currentMessage: { info: Message, parts: Part[] } | null = null;

    for (const msg of messages) {
        const isUser = msg.type === "user_message";
        const isAssistant = msg.type === "agent_message_chunk" || msg.type === "agent_thought_chunk" || msg.type === "tool_call" || msg.type === "tool_call_update";
        
        if (isUser) {
            sdkMessages.push({
                info: {
                    id: msg.msgId,
                    role: "user",
                    parts: []
                },
                parts: [{
                    type: "text",
                    text: getMessageText(msg)
                }]
            });
            currentMessage = null;
            continue;
        }

        if (isAssistant) {
            if (!currentMessage) {
                currentMessage = {
                    info: {
                        id: msg.msgId,
                        role: \"assistant\",
                        parts: [],
                        agent: msg.agent,
                        mode: msg.mode,
                        modelID: msg.modelID,
                        providerID: msg.providerID
                    },
                    parts: []
                };
                sdkMessages.push(currentMessage);
            }

            // Sync info if it was missing in the first chunk but present now
            if (msg.agent && !currentMessage.info.agent) currentMessage.info.agent = msg.agent;
            if (msg.mode && !currentMessage.info.mode) currentMessage.info.mode = msg.mode;
            if (msg.modelID && !currentMessage.info.modelID) currentMessage.info.modelID = msg.modelID;
            if (msg.providerID && !currentMessage.info.providerID) currentMessage.info.providerID = msg.providerID;

            if (msg.type === "agent_message_chunk") {
                const text = getMessageText(msg);
                const lastPart = currentMessage.parts[currentMessage.parts.length - 1];
                if (lastPart?.type === "text") {
                    lastPart.text = (lastPart.text || "") + text;
                } else {
                    currentMessage.parts.push({
                        type: "text",
                        text: text
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
                        text: text
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
                        output: data?.content?.[0]?.content?.text
                    }
                });
            }
        }
    }

    return sdkMessages;
}
