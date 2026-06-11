import React from 'react';
import type { AcpAgentMessage } from "../use-acp-session";
import { mapAcpMessagesToSDK } from "../kronoscode-v2/utils/adapter";
import ChatMessage from "../kronoscode-v2/components/chat/ChatMessage";

interface ChatMessageListV2Props {
    messages: AcpAgentMessage[];
    isStreaming?: boolean;
    canvasBlockId?: string;
}

export const ChatMessageListV2 = React.memo(({ messages, isStreaming, canvasBlockId }: ChatMessageListV2Props) => {
    const sdkMessages = React.useMemo(() => mapAcpMessagesToSDK(messages), [messages]);

    return (
        <div className=\"mx-auto w-full max-w-3xl space-y-2\">
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
