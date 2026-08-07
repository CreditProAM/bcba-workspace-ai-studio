import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Star, Copy, Check, Mail, ThumbsUp, ThumbsDown, MessageCircle, Send, Loader2, Sparkles } from 'lucide-react';
import type { PromptTemplate, StructuredPromptOutput, ToolkitChatMessage } from './toolkitTypes';
import { TOOLKIT_DISCLAIMER } from './toolkitTypes';

interface PromptOutputProps {
  output: StructuredPromptOutput | string;
  isLoading: boolean;
  selectedPrompt: PromptTemplate | null;
  onFavoriteToggle: (promptId: string) => void;
  isFavorited: boolean;
  chatHistory: ToolkitChatMessage[];
  isChatLoading: boolean;
  onSendFollowUp: (message: string) => void;
}

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <Loader2 size={24} className="animate-spin text-indigo-500" />
    <span className="text-sm text-slate-500">Generating response...</span>
  </div>
);

const OutputSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="py-2">
    <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">{title}</h4>
    {children}
  </div>
);

const CopyBlock: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative bg-slate-50 rounded-xl border border-slate-200">
      <pre className="p-4 pr-12 text-sm whitespace-pre-wrap font-mono text-slate-700 overflow-x-auto">{text}</pre>
      <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
      </button>
    </div>
  );
};

const ChatBubble: React.FC<{ message: ToolkitChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex w-full items-start gap-2 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white"><Sparkles size={12} /></div>}
      <div className={`max-w-md p-3 rounded-2xl whitespace-pre-wrap text-sm ${isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
        {message.text}
      </div>
    </div>
  );
};

export const PromptOutput: React.FC<PromptOutputProps> = ({
  output, isLoading, selectedPrompt, onFavoriteToggle, isFavorited, chatHistory, isChatLoading, onSendFollowUp,
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [showChat, setShowChat] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, isChatLoading]);

  useEffect(() => {
    setShowChat(false);
    setFollowUpInput('');
  }, [selectedPrompt?.id]);

  const fullTextOutput = useMemo(() => {
    if (typeof output === 'string') return output;
    if (!output) return '';
    const sections = [
      `Summary:\n${output.summary}`,
      output.immediateSteps ? `\nImmediate Steps:\n- ${output.immediateSteps.join('\n- ')}` : '',
      output.parentScript ? `\nParent Script:\n${output.parentScript}` : '',
      output.documentationTemplate ? `\nDocumentation Template:\n${output.documentationTemplate}` : '',
      output.risksWatchouts ? `\nRisks & Watchouts:\n- ${output.risksWatchouts.join('\n- ')}` : '',
      TOOLKIT_DISCLAIMER,
    ];
    return sections.filter(Boolean).join('\n\n');
  }, [output]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullTextOutput).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (followUpInput.trim()) {
      onSendFollowUp(followUpInput);
      setFollowUpInput('');
    }
  };

  if (!selectedPrompt && !isLoading) return null;

  const renderFallback = (content: string) => {
    const [main, ...rest] = content.split('---');
    return (
      <>
        <div className="text-sm text-slate-700 whitespace-pre-wrap">{main.trim()}</div>
        {rest.length > 0 && (
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl mt-4 italic">{rest.join('---').replace(/^\*|\*$/g, '').trim()}</div>
        )}
      </>
    );
  };

  const renderStructured = (data: StructuredPromptOutput) => (
    <div className="space-y-1">
      <OutputSection title="Summary">
        <p className="text-sm font-medium text-slate-800">{data.summary}</p>
      </OutputSection>
      {data.immediateSteps?.length > 0 && (
        <OutputSection title="Immediate Steps">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
            {data.immediateSteps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </OutputSection>
      )}
      {data.parentScript && <OutputSection title="Parent Script"><CopyBlock text={data.parentScript} /></OutputSection>}
      {data.documentationTemplate && <OutputSection title="Documentation Template"><CopyBlock text={data.documentationTemplate} /></OutputSection>}
      {data.risksWatchouts && data.risksWatchouts.length > 0 && (
        <OutputSection title="Risks & Watchouts">
          <div className="flex flex-wrap gap-2">
            {data.risksWatchouts.map((risk, i) => (
              <span key={i} className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-100">{risk}</span>
            ))}
          </div>
        </OutputSection>
      )}
      <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-xl mt-4 italic">{TOOLKIT_DISCLAIMER}</div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[calc(100vh-9rem)]">
      <div className="flex justify-between items-start p-5 border-b border-slate-100 shrink-0">
        <h3 className="text-lg font-serif font-bold text-slate-900 pr-4">{selectedPrompt?.title || 'Response'}</h3>
        {!isLoading && output && selectedPrompt && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onFavoriteToggle(selectedPrompt.id)} className={`p-2 rounded-lg transition-colors ${isFavorited ? 'text-amber-400' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`} title="Favorite">
              <Star size={16} className={isFavorited ? 'fill-amber-400' : ''} />
            </button>
            <button onClick={handleCopy} className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors" title="Copy">
              {copyStatus === 'idle' ? <Copy size={16} /> : <Check size={16} className="text-emerald-500" />}
            </button>
            <a href={`mailto:?subject=${encodeURIComponent('ABA Toolkit: ' + (selectedPrompt.title))}&body=${encodeURIComponent(fullTextOutput)}`} className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors" title="Email">
              <Mail size={16} />
            </a>
          </div>
        )}
      </div>

      <div className="p-5 flex-grow overflow-y-auto" ref={scrollRef}>
        {isLoading ? <LoadingState /> : (
          <>
            <div className={showChat ? 'pb-6' : ''}>
              {typeof output === 'object' ? renderStructured(output) : (typeof output === 'string' ? renderFallback(output) : null)}
            </div>
            {showChat && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                {chatHistory.map((msg, i) => <ChatBubble key={i} message={msg} />)}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Thinking...
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!isLoading && output && (
        <div className="shrink-0 p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          {showChat ? (
            <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={followUpInput}
                onChange={e => setFollowUpInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                disabled={isChatLoading}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button type="submit" disabled={isChatLoading || !followUpInput.trim()} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {isChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Helpful?</span>
                <button className="p-2 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-white transition-colors" title="Helpful"><ThumbsUp size={14} /></button>
                <button className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-white transition-colors" title="Not helpful"><ThumbsDown size={14} /></button>
              </div>
              <button onClick={() => setShowChat(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                <MessageCircle size={14} /> Ask a Follow-up
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
