import React from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import 'streamdown/styles.css';
import { FadeInOnReveal } from './message/FadeInOnReveal';
import type { Part } from '../../types/sdk';
import { cn } from '@/lib/utils';
import { RiFileCopyLine, RiCheckLine, RiDownloadLine } from '@remixicon/react';

// Simple clipboard helper since we don't want to port the whole OpenChamber lib/clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    console.error('Failed to copy:', err);
    return { ok: false, error: err };
  }
};

const TableWrapper: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className="group my-4 flex flex-col space-y-2">
      <div className="overflow-x-auto">
        <table className={cn('w-full border-collapse border border-border', className)}>
          {children}
        </table>
      </div>
    </div>
  );
};

type CodeBlockWrapperProps = React.HTMLAttributes<HTMLPreElement> & {
  children?: React.ReactNode;
};

const CodeBlockWrapper: React.FC<CodeBlockWrapperProps> = ({ children, className, style, ...props }) => {
  const [copied, setCopied] = React.useState(false);
  const codeRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    const codeEl = codeRef.current?.querySelector('code');
    const codeText = codeEl?.innerText || '';
    if (!codeText) return;
    const result = await copyToClipboard(codeText);
    if (result.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="group relative" ref={codeRef}>
      <pre
        {...props}
        className={cn(className)}
        style={style}
      >
        {children}
      </pre>
      <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy"
        >
          {copied ? <RiCheckLine className="size-3.5" /> : <RiFileCopyLine className="size-3.5" />}
        </button>
      </div>
    </div>
  );
};

const streamdownComponents = {
  pre: CodeBlockWrapper,
  table: TableWrapper,
};

const streamdownControls = {
  code: false,
  table: false,
  mermaid: {
    download: false,
    copy: false,
    fullscreen: false,
    panZoom: false,
  },
};

const memoizedMermaidPlugin = { mermaid };

export type MarkdownVariant = 'assistant' | 'tool';

interface MarkdownRendererProps {
  content: string;
  part?: Part;
  messageId: string;
  isAnimated?: boolean;
  className?: string;
  isStreaming?: boolean;
  variant?: MarkdownVariant;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  part,
  messageId,
  isAnimated = true,
  className,
  isStreaming = false,
  variant = 'assistant',
}) => {
  const componentKey = React.useMemo(() => {
    const signature = part?.id ? `part-${part.id}` : `message-${messageId}`;
    return `markdown-${signature}`;
  }, [messageId, part?.id]);

  const streamdownClassName = variant === 'tool'
    ? 'streamdown-content streamdown-tool'
    : 'streamdown-content';

  const markdownContent = (
    <div className={cn('break-words', className)}>
      <Streamdown
         key={`streamdown-${componentKey}`}
         mode={isStreaming ? 'streaming' : 'static'}
         className={streamdownClassName}
         controls={streamdownControls}
         plugins={memoizedMermaidPlugin}
         components={streamdownComponents}
       >
        {content}
      </Streamdown>
    </div>
  );

  if (isAnimated) {
    return (
      <FadeInOnReveal key={componentKey}>
        {markdownContent}
      </FadeInOnReveal>
    );
  }

  return markdownContent;
};

export const SimpleMarkdownRenderer: React.FC<{
  content: string;
  className?: string;
  variant?: MarkdownVariant;
}> = ({ content, className, variant = 'assistant' }) => {
  const streamdownClassName = variant === 'tool'
    ? 'streamdown-content streamdown-tool'
    : 'streamdown-content';

  return (
    <div className={cn('break-words', className)}>
      <Streamdown
        key={`streamdown-simple`}
        mode="static"
        className={streamdownClassName}
        controls={streamdownControls}
        plugins={memoizedMermaidPlugin}
        components={streamdownComponents}
      >
        {content}
      </Streamdown>
    </div>
  );
};
