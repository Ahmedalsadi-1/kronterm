import React from 'react';
import { SimpleMarkdownRenderer } from './kronoscode-v2/components/chat/MarkdownRenderer';
import { RiCodeSSlashLine, RiLayoutMasonryLine } from '@remixicon/react';
import type { AcpAgentMessage } from './use-acp-session';

type AcpPreviewPaneProps = {
    messages?: AcpAgentMessage[];
};

export const AcpPreviewPane: React.FC<AcpPreviewPaneProps> = ({ messages = [] }) => {
    // Find the latest "artifact" or tool output
    const latestArtifact = React.useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.type === 'tool_call' || msg.type === 'tool_call_update') {
                const data = msg.data as any;
                const content = data?.content?.[0];
                if (content?.type === 'diff' || content?.content?.text) {
                    return {
                        title: data?.title || data?.kind || 'Tool Output',
                        type: content?.type === 'diff' ? 'code' : 'text',
                        content: content?.newText || content?.content?.text || ''
                    };
                }
            }
        }
        return null;
    }, [messages]);

    if (!latestArtifact) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted opacity-50">
                <RiLayoutMasonryLine className="h-12 w-12 mb-4" />
                <p className="text-sm font-medium">No previews available</p>
                <p className="text-xs mt-1">Artifacts and tool outputs will appear here</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="ai-panel-preview-header gap-2">
                <RiCodeSSlashLine className="h-4 w-4 text-accent" />
                <span className="title truncate">{latestArtifact.title}</span>
                <div className="ml-auto flex items-center gap-1">
                    <div className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold uppercase">
                        {latestArtifact.type}
                    </div>
                </div>
            </div>
            <div className="ai-panel-preview-content">
                <SimpleMarkdownRenderer
                    content={latestArtifact.type === 'code' ? `\`\`\`\n${latestArtifact.content}\n\`\`\`` : latestArtifact.content}
                />
            </div>
        </div>
    );
};
