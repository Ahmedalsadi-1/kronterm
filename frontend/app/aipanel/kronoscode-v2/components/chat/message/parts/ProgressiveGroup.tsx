import React from 'react';
import { RiArrowDownSLine, RiArrowRightSLine, RiStackLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { Part } from '../../../types/sdk';
import ToolPart from './ToolPart';
import ReasoningPart from './ReasoningPart';
import JustificationBlock from './JustificationBlock';
import { FadeInOnReveal } from '../FadeInOnReveal';

export interface TurnActivityPart {
    id: string;
    messageId: string;
    kind: 'tool' | 'reasoning' | 'justification';
    part: Part;
    endedAt?: number;
}

interface ProgressiveGroupProps {
    parts: TurnActivityPart[];
    isExpanded: boolean;
    onToggle: () => void;
    syntaxTheme: Record<string, React.CSSProperties>;
    isMobile: boolean;
    expandedTools: Set<string>;
    onToggleTool: (toolId: string) => void;
    onContentChange?: (reason?: any) => void;
}

const ProgressiveGroup: React.FC<ProgressiveGroupProps> = ({
    parts,
    isExpanded,
    onToggle,
    syntaxTheme,
    isMobile,
    expandedTools,
    onToggleTool,
    onContentChange,
}) => {
    if (parts.length === 0) {
        return null;
    }

    return (
        <FadeInOnReveal>
            <div className="my-1">
                <div
                    className={cn(
                        'group/tool flex items-center gap-2 pr-2 pl-px pt-0 pb-1.5 rounded-xl cursor-pointer'
                    )}
                    onClick={onToggle}
                >
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative h-3.5 w-3.5 flex-shrink-0">
                            <RiStackLine className="h-3.5 w-3.5 text-primary/70" />
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity flex items-center justify-center',
                                    isExpanded ? 'opacity-100' : 'opacity-0'
                                )}
                            >
                                {isExpanded ? (
                                    <RiArrowDownSLine className="h-3.5 w-3.5" />
                                ) : (
                                    <RiArrowRightSLine className="h-3.5 w-3.5" />
                                )}
                            </div>
                        </div>
                        <span className="text-[11px] font-medium opacity-80">Activity</span>
                    </div>
                </div>

                <div
                    className={cn(
                        'relative pr-2 pb-1 pt-1 pl-[1.4375rem]'
                    )}
                >
                    <div className="absolute left-[0.4375rem] w-px top-[-0.25rem] bottom-0 bg-white/10"></div>
                    
                    {isExpanded && parts.map((activity) => {
                        const partId = activity.id;

                        switch (activity.kind) {
                            case 'tool':
                                return (
                                    <ToolPart
                                        key={partId}
                                        part={activity.part}
                                        isExpanded={expandedTools.has(partId)}
                                        onToggle={() => onToggleTool(partId)}
                                        syntaxTheme={syntaxTheme}
                                        isMobile={isMobile}
                                        onContentChange={onContentChange}
                                    />
                                );

                            case 'reasoning':
                                return (
                                    <ReasoningPart
                                        key={partId}
                                        part={activity.part}
                                        messageId={activity.messageId}
                                        onContentChange={onContentChange}
                                    />
                                );

                            case 'justification':
                                return (
                                    <JustificationBlock
                                        key={partId}
                                        part={activity.part}
                                        messageId={activity.messageId}
                                        onContentChange={onContentChange}
                                    />
                                );

                            default:
                                return null;
                        }
                    })}
                    {!isExpanded && (
                        <div className="text-[10px] opacity-40 italic">
                            {parts.length} step{parts.length === 1 ? '' : 's'}...
                        </div>
                    )}
                </div>
            </div>
        </FadeInOnReveal>
    );
};

export default React.memo(ProgressiveGroup);
