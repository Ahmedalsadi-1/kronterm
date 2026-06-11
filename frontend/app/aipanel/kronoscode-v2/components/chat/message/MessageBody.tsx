import React from 'react';
import type { Part } from '../../types/sdk';

import UserTextPart from './parts/UserTextPart';
import ToolPart from './parts/ToolPart';
import ProgressiveGroup, { type TurnActivityPart } from './parts/ProgressiveGroup';
import AssistantTextPart from './parts/AssistantTextPart';
import ReasoningPart from './parts/ReasoningPart';
import type { StreamPhase, ToolPopupContent, AgentMentionInfo } from './types';
import { cn } from '@/lib/utils';
import { isEmptyTextPart } from './partUtils';
import { FadeInOnReveal } from './FadeInOnReveal';
import type { ContentChangeReason } from '../../types/scroll';

interface MessageBodyProps {
    messageId: string;
    parts: Part[];
    isUser: boolean;
    isMessageCompleted: boolean;
    messageFinish?: string;
    messageCompletedAt?: number;

    syntaxTheme: { [key: string]: React.CSSProperties };

    isMobile: boolean;
    hasTouchInput?: boolean;
    copiedCode: string | null;
    onCopyCode: (code: string) => void;
    expandedTools: Set<string>;
    onToggleTool: (toolId: string) => void;
    onShowPopup: (content: ToolPopupContent) => void;
    streamPhase: StreamPhase;
    allowAnimation: boolean;
    onContentChange?: (reason?: ContentChangeReason, messageId?: string) => void;

    shouldShowHeader?: boolean;
    hasTextContent?: boolean;
    onCopyMessage?: () => void;
    copiedMessage?: boolean;
    onAuxiliaryContentComplete?: () => void;
    showReasoningTraces?: boolean;
    agentMention?: AgentMentionInfo;
    errorMessage?: string;
}

const UserMessageBody: React.FC<Omit<MessageBodyProps, 'isUser'>> = ({ 
    messageId, parts, isMobile, agentMention 
}) => {
    const userContentParts = React.useMemo(() => {
        return parts.filter((part) => {
            if (part.type === 'text') {
                return !isEmptyTextPart(part);
            }
            return true;
        });
    }, [parts]);

    return (
        <div className="leading-relaxed overflow-hidden text-foreground/90 text-sm">
            {userContentParts.map((part, index) => (
                <FadeInOnReveal key={part.id ?? `user-text-${index}`}>
                    <UserTextPart
                        part={part}
                        messageId={messageId}
                        isMobile={isMobile}
                        agentMention={agentMention}
                    />
                </FadeInOnReveal>
            ))}
        </div>
    );
};

const AssistantMessageBody: React.FC<Omit<MessageBodyProps, 'isUser'>> = ({
    messageId,
    parts,
    isMessageCompleted,
    syntaxTheme,
    isMobile,
    expandedTools,
    onToggleTool,
    onShowPopup,
    streamPhase,
    allowAnimation,
    onContentChange,
    showReasoningTraces = false,
}) => {
    const [isGroupExpanded, setIsGroupExpanded] = React.useState(true);
    
    const visibleParts = React.useMemo(() => {
        return parts.filter((part) => !isEmptyTextPart(part));
    }, [parts]);

    const activityParts = React.useMemo(() => {
        return visibleParts
            .filter(part => part.type === 'tool' || (showReasoningTraces && part.type === 'reasoning'))
            .map((part, index) => ({
                id: part.id || `${messageId}-activity-${index}`,
                messageId,
                kind: (part.type === 'tool' ? 'tool' : 'reasoning') as any,
                part
            } as TurnActivityPart));
    }, [visibleParts, messageId, showReasoningTraces]);

    const textParts = React.useMemo(() => {
        return visibleParts.filter(part => part.type === 'text');
    }, [visibleParts]);

    return (
        <div className="flex flex-col gap-2">
            {activityParts.length > 0 && (
                <ProgressiveGroup
                    parts={activityParts}
                    isExpanded={isGroupExpanded}
                    onToggle={() => setIsGroupExpanded(!isGroupExpanded)}
                    syntaxTheme={syntaxTheme}
                    isMobile={isMobile}
                    expandedTools={expandedTools}
                    onToggleTool={onToggleTool}
                />
            )}
            
            {textParts.map((part, index) => (
                <AssistantTextPart
                    key={part.id || `${messageId}-text-${index}`}
                    part={part}
                    messageId={messageId}
                    streamPhase={streamPhase}
                    allowAnimation={allowAnimation}
                    onContentChange={onContentChange}
                />
            ))}
        </div>
    );
};

const MessageBody: React.FC<MessageBodyProps> = (props) => {
    if (props.isUser) {
        return <UserMessageBody {...props} />;
    }
    return <AssistantMessageBody {...props} />;
};

export default MessageBody;
