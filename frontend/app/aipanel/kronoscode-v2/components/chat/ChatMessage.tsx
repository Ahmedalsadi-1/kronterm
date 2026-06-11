import React from 'react';
import type { Message, Part } from '../../types/sdk';
import { cn } from '@/lib/utils';

import MessageHeader from './message/MessageHeader';
import MessageBody from './message/MessageBody';
import type { StreamPhase, ToolPopupContent } from './message/types';
import { deriveMessageRole } from './message/messageRole';
import { FadeInOnReveal } from './message/FadeInOnReveal';

import InsertIntoCanvasButton from './message/InsertIntoCanvasButton';
import { extractTextContent } from './message/partUtils';

interface ChatMessageProps {
    message: {
        info: Message;
        parts: Part[];
    };
    isStreaming?: boolean;
    onContentChange?: (reason?: any) => void;
    canvasBlockId?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    isStreaming = false,
    onContentChange,
    canvasBlockId,
}) => {
    const [expandedTools, setExpandedTools] = React.useState<Set<string>>(new Set());
    const [isDarkTheme, setIsDarkTheme] = React.useState(true); // Default to dark

    React.useEffect(() => {
        if (typeof document !== 'undefined') {
            setIsDarkTheme(document.documentElement.classList.contains('dark'));
        }
    }, []);

    const messageRole = React.useMemo(() => deriveMessageRole(message.info), [message.info]);
    const isUser = messageRole.isUser;

    const streamPhase: StreamPhase = isStreaming ? 'streaming' : 'completed';

    const fullText = React.useMemo(() => {
        return message.parts.map(extractTextContent).join('');
    }, [message.parts]);

    const handleToggleTool = React.useCallback((toolId: string) => {
        setExpandedTools((prev) => {
            const next = new Set(prev);
            if (next.has(toolId)) {
                next.delete(toolId);
            } else {
                next.add(toolId);
            }
            return next;
        });
    }, []);

    const handleShowPopup = React.useCallback((_content: ToolPopupContent) => {
        // TODO: Implement popup
    }, []);

    return (
        <div
            className={cn(
                'group w-full py-4',
                isUser ? 'user-message' : 'assistant-message'
            )}
            data-message-id={message.info.id}
        >
            <div className=\"relative px-4\">
                {isUser ? (
                    <div className=\"flex justify-end\">
                        <div style={{ backgroundColor: 'var(--surface-subtle-color)' }} className=\"max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2 border border-white/5 shadow-lg relative\">
                            <MessageBody
                                messageId={message.info.id}
                                parts={message.parts}
                                isUser={isUser}
                                isMessageCompleted={!isStreaming}
                                syntaxTheme={{}}
                                isMobile={false}
                                copiedCode={null}
                                onCopyCode={() => {}}
                                expandedTools={expandedTools}
                                onToggleTool={handleToggleTool}
                                onShowPopup={handleShowPopup}
                                streamPhase={streamPhase}
                                allowAnimation={true}
                                onContentChange={onContentChange}
                            />
                            {canvasBlockId && (
                                <InsertIntoCanvasButton
                                    canvasBlockId={canvasBlockId}
                                    content={fullText}
                                    title=\"User message\"
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className=\"relative\">
                        <MessageHeader
                            isUser={false}
                            providerID={message.info.providerID || null}
                            agentName={message.info.agent || message.info.mode}
                            modelName={message.info.modelID}
                            isDarkTheme={isDarkTheme}
                        />

                        <MessageBody
                            messageId={message.info.id}
                            parts={message.parts}
                            isUser={false}
                            isMessageCompleted={!isStreaming}
                            syntaxTheme={{}}
                            isMobile={false}
                            copiedCode={null}
                            onCopyCode={() => {}}
                            expandedTools={expandedTools}
                            onToggleTool={handleToggleTool}
                            onShowPopup={handleShowPopup}
                            streamPhase={streamPhase}
                            allowAnimation={true}
                            onContentChange={onContentChange}
                            showReasoningTraces={true}
                        />

                        {canvasBlockId && (
                            <InsertIntoCanvasButton
                                canvasBlockId={canvasBlockId}
                                content={fullText}
                                title=\"Assistant message\"
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ChatMessage);
