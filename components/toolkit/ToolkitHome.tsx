import React, { useCallback, useEffect, useState } from 'react';
import type { Chat } from '@google/genai';
import { promptTemplates } from '../../config/promptTemplates';
import { generateToolkitResponse, createToolkitFollowUpChat } from '../../services/geminiService';
import { PromptTemplate, ToolkitSessionContext, StructuredPromptOutput, ToolkitChatMessage, PROMPT_CATEGORIES } from './toolkitTypes';
import { FavoriteToolkit } from './FavoriteToolkit';
import { PromptLibrary } from './PromptLibrary';
import { PromptOutput } from './PromptOutput';
import { ArrowLeft } from 'lucide-react';

const FAVORITES_KEY = 'bcba_toolkit_favorites_v1';

const WelcomePanel: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col justify-center items-center text-center p-10">
    <ArrowLeft size={28} className="text-slate-300 mb-4" />
    <h2 className="text-lg font-serif font-bold text-slate-900">Select a Prompt</h2>
    <p className="text-sm text-slate-500 mt-2 max-w-sm">
      Choose a scenario from the library to get an instant, AI-assisted starting point --
      always grounded, always reviewable, never a substitute for your clinical judgment.
    </p>
  </div>
);

/**
 * Clinical Toolkit -- ported from aba-clinical-decision-support-toolkit as one
 * coherent module rather than a separate app. A single prompt library covering
 * crisis help, documentation, ethics, parent scripts, data patterns, goal writing,
 * and supervisor talk tracks, with one shared output/follow-up surface (not one
 * assistant per category).
 */
export const ToolkitHome: React.FC = () => {
  const [sessionContext, setSessionContext] = useState<ToolkitSessionContext>(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return { promptsUsed: [], favorited: saved ? JSON.parse(saved) : [] };
  });
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [output, setOutput] = useState<StructuredPromptOutput | string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ToolkitChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(sessionContext.favorited));
  }, [sessionContext.favorited]);

  const handleSelectPrompt = useCallback(async (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    setIsLoading(true);
    setOutput('');
    setChat(null);
    setChatHistory([]);

    const updatedContext = { ...sessionContext, promptsUsed: [...new Set([...sessionContext.promptsUsed, prompt.id])] };
    setSessionContext(updatedContext);

    const response = await generateToolkitResponse(prompt, updatedContext);
    setOutput(response);
    setIsLoading(false);
  }, [sessionContext]);

  const toggleFavorite = useCallback((promptId: string) => {
    setSessionContext(prev => ({
      ...prev,
      favorited: prev.favorited.includes(promptId) ? prev.favorited.filter(id => id !== promptId) : [...prev.favorited, promptId],
    }));
  }, []);

  const handleSendFollowUp = useCallback(async (message: string) => {
    if (!message.trim() || !selectedPrompt) return;
    setIsChatLoading(true);
    const updatedHistory: ToolkitChatMessage[] = [...chatHistory, { role: 'user', text: message }];
    setChatHistory(updatedHistory);

    try {
      let currentChat = chat;
      if (!currentChat) {
        const initialText = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        currentChat = createToolkitFollowUpChat(selectedPrompt, initialText.split('---')[0].trim());
        setChat(currentChat);
      }
      const response = await currentChat.sendMessage({ message });
      setChatHistory([...updatedHistory, { role: 'model', text: response.text || '' }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
      setChatHistory([...updatedHistory, { role: 'model', text: `Sorry, I hit an error: ${msg}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chat, chatHistory, selectedPrompt, output]);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <FavoriteToolkit templates={promptTemplates} sessionContext={sessionContext} onSelectPrompt={handleSelectPrompt} />
          <PromptLibrary templates={promptTemplates} categories={PROMPT_CATEGORIES} onSelectPrompt={handleSelectPrompt} sessionContext={sessionContext} />
        </div>
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-8">
            {(selectedPrompt || isLoading) ? (
              <PromptOutput
                output={output}
                isLoading={isLoading}
                selectedPrompt={selectedPrompt}
                onFavoriteToggle={toggleFavorite}
                isFavorited={selectedPrompt ? sessionContext.favorited.includes(selectedPrompt.id) : false}
                chatHistory={chatHistory}
                isChatLoading={isChatLoading}
                onSendFollowUp={handleSendFollowUp}
              />
            ) : (
              <WelcomePanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
