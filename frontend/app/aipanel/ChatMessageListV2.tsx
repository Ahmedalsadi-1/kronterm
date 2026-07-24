import React from "react";
import ChatMessage from "./kronoscode-v2/components/chat/ChatMessage";
import type { Message, Part } from "./kronoscode-v2/types/sdk";
import { mapAcpMessagesToSDK } from "./kronoscode-v2/utils/adapter";
import type { AcpAgentMessage } from "./use-acp-session";

interface ChatMessageListV2Props {
    messages: AcpAgentMessage[];
    isStreaming?: boolean;
    canvasBlockId?: string;
}

type SDKMessage = { info: Message; parts: Part[] };

type CachedSDKMessage = {
    signature: string;
    value: SDKMessage;
};

function getPartSignature(part: Part): string {
    const data = part as Record<string, unknown>;
    const state = data.state as Record<string, unknown> | undefined;
    return [
        data.type,
        data.id,
        data.text,
        data.content,
        data.value,
        data.tool,
        data.input,
        state?.status,
        state?.output,
    ]
        .map((value) => (typeof value === "string" ? value : value == null ? "" : JSON.stringify(value)))
        .join("\u001f");
}

function getMessageSignature(message: SDKMessage): string {
    return [
        message.info.id,
        message.info.role,
        message.info.agent,
        message.info.mode,
        message.info.modelID,
        message.info.providerID,
        ...message.parts.map(getPartSignature),
    ].join("\u001e");
}

export const ChatMessageListV2 = React.memo(({ messages, isStreaming, canvasBlockId }: ChatMessageListV2Props) => {
    const cacheRef = React.useRef<Map<string, CachedSDKMessage>>(new Map());
    const sdkMessages = React.useMemo(() => {
        const mappedMessages = mapAcpMessagesToSDK(messages);
        const nextCache = new Map<string, CachedSDKMessage>();
        const stableMessages = mappedMessages.map((message, index) => {
            const key = message.info.id || `index:${index}`;
            const signature = getMessageSignature(message);
            const cached = cacheRef.current.get(key);
            const value = cached?.signature === signature ? cached.value : message;
            nextCache.set(key, { signature, value });
            return value;
        });
        cacheRef.current = nextCache;
        return stableMessages;
    }, [messages]);

    return (
        <div className="mx-auto w-full max-w-3xl space-y-2">
            {sdkMessages.map((msg, index) => (
                <ChatMessage
                    key={msg.info.id || index}
                    message={msg}
                    isStreaming={isStreaming && index === sdkMessages.length - 1}
                    canvasBlockId={canvasBlockId}
                />
            ))}
        </div>
    );
});

ChatMessageListV2.displayName = "ChatMessageListV2";
