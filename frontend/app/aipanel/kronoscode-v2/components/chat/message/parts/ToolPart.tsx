import React from 'react';
import { RiArrowDownSLine, RiArrowRightSLine, RiToolsLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { Part } from '../../../../types/sdk';

interface ToolPartProps {
    part: Part;
    isExpanded: boolean;
    onToggle: (toolId: string) => void;
    syntaxTheme: { [key: string]: React.CSSProperties };
    isMobile: boolean;
    onContentChange?: (reason?: any) => void;
    hasPrevTool?: boolean;
    hasNextTool?: boolean;
}

const ToolPart: React.FC<ToolPartProps> = ({
    part,
    isExpanded,
    onToggle,
    syntaxTheme: _syntaxTheme,
    isMobile: _isMobile,
    onContentChange: _onContentChange,
    hasPrevTool: _hasPrevTool,
    hasNextTool: _hasNextTool,
}) => {
    const toolName = part.tool || 'tool';
    const status = part.state?.status || 'completed';

    return (
        <div className="my-1">
            <div
                className={cn(
                    'group/tool flex items-center gap-2 pr-2 pl-px py-1.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors'
                )}
                onClick={() => onToggle(part.id)}
            >
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative h-3.5 w-3.5 flex-shrink-0">
                         <RiToolsLine className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-medium opacity-80">{toolName}</span>
                    <span className={cn(
                        "text-[9px] px-1 rounded uppercase font-bold",
                        status === 'running' ? "bg-primary/20 text-primary" : "bg-white/10 text-white/50"
                    )}>
                        {status}
                    </span>
                </div>
                <div className="ml-auto">
                    {isExpanded ? <RiArrowDownSLine className="h-3.5 w-3.5" /> : <RiArrowRightSLine className="h-3.5 w-3.5" />}
                </div>
            </div>

            {isExpanded && (
                <div className="pl-[1.4375rem] py-2 text-[11px] opacity-70 bg-white/5 rounded-lg border border-white/5 mt-1">
                    <pre className="whitespace-pre-wrap break-all font-mono">
                        {JSON.stringify(part.input || {}, null, 2)}
                    </pre>
                    {part.state?.output && (
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <pre className="whitespace-pre-wrap break-all font-mono">
                                {part.state.output}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(ToolPart);
