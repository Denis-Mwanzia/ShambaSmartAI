import React from 'react';
import { Info, Lightbulb, AlertTriangle } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
  direction: 'inbound' | 'outbound';
}

// Simple, clean text formatter - NO Q&A, just clean formatting
const formatContent = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let keyCounter = 0;

  const processInline = (str: string): React.ReactNode => {
    // Simple markdown formatting
    let processed = str
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-emerald-700">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const lines = text.split('\n');
  let currentParagraph: string[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listType: 'ordered' | 'unordered' = 'unordered';

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paraText = currentParagraph.join(' ').trim();
      if (paraText) {
        result.push(
          <p key={`para-${keyCounter++}`} className="mb-3 last:mb-0 leading-relaxed text-sm text-gray-800">
            {processInline(paraText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <div key={`list-${keyCounter++}`} className="my-4 space-y-2">
          {listItems}
        </div>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (!inList || listType !== 'ordered') {
        flushList();
        inList = true;
        listType = 'ordered';
      }
      const [, num, content] = numberedMatch;
      listItems.push(
        <div key={`item-${keyCounter++}`} className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center">
            {num}
          </span>
          <span className="flex-1 text-sm text-gray-800 leading-relaxed">{processInline(content)}</span>
        </div>
      );
      return;
    }

    // Bullet list
    if (trimmed.match(/^[-•]\s+(.+)$/)) {
      flushParagraph();
      if (!inList || listType !== 'unordered') {
        flushList();
        inList = true;
        listType = 'unordered';
      }
      const content = trimmed.replace(/^[-•]\s+/, '');
      listItems.push(
        <div key={`item-${keyCounter++}`} className="flex gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2"></span>
          <span className="flex-1 text-sm text-gray-800 leading-relaxed">{processInline(content)}</span>
        </div>
      );
      return;
    }

    // Special callouts (only if they appear naturally)
    if (trimmed.toLowerCase().includes('tip:') || trimmed.includes('💡')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/💡|tip:/gi, '').trim();
      result.push(
        <div key={`tip-${keyCounter++}`} className="my-4 rounded-lg bg-yellow-50 border-l-4 border-yellow-400 p-3">
          <div className="flex gap-2 items-start">
            <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-900 leading-relaxed">{processInline(content)}</div>
          </div>
        </div>
      );
      return;
    }

    if (trimmed.toLowerCase().includes('warning:') || trimmed.includes('⚠️')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/⚠️|warning:/gi, '').trim();
      result.push(
        <div key={`warning-${keyCounter++}`} className="my-4 rounded-lg bg-orange-50 border-l-4 border-orange-400 p-3">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-900 leading-relaxed">{processInline(content)}</div>
          </div>
        </div>
      );
      return;
    }

    if (trimmed.toLowerCase().includes('info:') || trimmed.includes('ℹ️')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/ℹ️|info:/gi, '').trim();
      result.push(
        <div key={`info-${keyCounter++}`} className="my-4 rounded-lg bg-blue-50 border-l-4 border-blue-400 p-3">
          <div className="flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 leading-relaxed">{processInline(content)}</div>
          </div>
        </div>
      );
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/^###\s+/, '');
      result.push(
        <h3 key={`h3-${keyCounter++}`} className="text-base font-semibold mt-4 mb-2 first:mt-0 text-gray-900">
          {content}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/^##\s+/, '');
      result.push(
        <h2 key={`h2-${keyCounter++}`} className="text-lg font-semibold mt-4 mb-2 first:mt-0 text-gray-900">
          {content}
        </h2>
      );
      return;
    }

    // Regular paragraph
    if (trimmed) {
      currentParagraph.push(trimmed);
    } else {
      flushParagraph();
      flushList();
    }
  });

  flushParagraph();
  flushList();

  return result.length > 0 ? result : [<p key="default" className="leading-relaxed text-sm text-gray-800">{text}</p>];
};

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content }) => {
  const formatted = formatContent(content);
  
  return (
    <div className="formatted-message">
      {formatted}
    </div>
  );
};
