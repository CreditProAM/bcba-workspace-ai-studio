import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, User, Bot, CheckCircle, BrainCircuit } from 'lucide-react';
import { CalendarEvent, Client, ChatMessage } from '../types';
import { chatWithSidekick } from '../services/geminiService';

interface SidekickModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  clients: Client[];
  onAction: (action: { type: 'CREATE', event: CalendarEvent }) => void;
}

export const SidekickModal: React.FC<SidekickModalProps> = ({ 
  isOpen, 
  onClose, 
  events, 
  clients,
  onAction
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello. I am your Clinical Analyst Assistant. I can help with caseload scheduling, RBT supervision tracking, and assessment planning.' }
  ]);
  const [loading, setLoading] = useState(false);
  
  const historyRef = useRef<any[]>([]); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const response = await chatWithSidekick(historyRef.current, userMsg.text || '', events, clients);
      const candidate = response.candidates?.[0];
      const content = candidate?.content;
      
      let replyText = "";
      let toolCalled = false;

      if (content?.parts) {
        for (const part of content.parts) {
          if (part.text) replyText += part.text;

          if (part.functionCall) {
            toolCalled = true;
            const fc = part.functionCall;
            if (fc.name === 'addClinicalEvent') {
              const args = fc.args as any;
              
              const newEvent: CalendarEvent = {
                id: crypto.randomUUID(),
                title: args.title,
                start: new Date(args.startDateTime),
                end: new Date(args.endDateTime),
                clientId: args.clientId,
                serviceType: args.serviceType || 'Direct 1:1',
                location: args.location || 'Clinic'
              };

              onAction({ type: 'CREATE', event: newEvent });

              setMessages(prev => [...prev, { 
                role: 'model', 
                text: `Scheduled: ${newEvent.title} (${newEvent.serviceType}) for ${newEvent.clientId}.`,
                isToolCall: true
              }]);
              
              historyRef.current.push({ role: 'user', parts: [{ text: userMsg.text }] });
              historyRef.current.push({ role: 'model', parts: [{ text: `I added the event ${newEvent.title}` }] });
            }
          }
        }
      }

      if (replyText && !toolCalled) {
        setMessages(prev => [...prev, { role: 'model', text: replyText }]);
        historyRef.current.push({ role: 'user', parts: [{ text: userMsg.text }] });
        historyRef.current.push({ role: 'model', parts: [{ text: replyText }] });
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Unable to process request. Please check connection." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex justify-end"
        onClick={onClose}
    >
      <div 
        className="w-[450px] h-full bg-slate-50 shadow-2xl flex flex-col animate-slide-in-right border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                <BrainCircuit className="text-indigo-600" size={24} />
            </div>
            <div>
                <h3 className="font-bold text-slate-900">Analyst Assist</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Gemini 2.5 Flash • Clinical Mode</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm border
                ${msg.role === 'user' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-indigo-600'}
                ${msg.isToolCall ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : ''}
              `}>
                {msg.role === 'user' ? <User size={16} /> : msg.isToolCall ? <CheckCircle size={18} /> : <Bot size={18} />}
              </div>
              <div className={`
                max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-slate-800 text-white rounded-tr-none' 
                  : msg.isToolCall 
                    ? 'bg-white border border-emerald-100 text-emerald-900 rounded-tl-none ring-1 ring-emerald-50'
                    : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}
              `}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4">
               <div className="w-9 h-9 rounded-full bg-white text-indigo-500 flex items-center justify-center border border-slate-200 shadow-sm">
                  <Bot size={18} />
               </div>
               <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-3">
                 <Loader2 size={18} className="animate-spin text-indigo-500" />
                 <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Analyzing Schedule...</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-5 border-t border-slate-200 bg-white">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="E.g. Schedule supervision for Liam on Friday..."
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400"
              autoFocus
            />
            <button 
              onClick={handleSend}
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};