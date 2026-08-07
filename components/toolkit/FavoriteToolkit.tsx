import React from 'react';
import { Star } from 'lucide-react';
import type { PromptTemplate, ToolkitSessionContext } from './toolkitTypes';

interface FavoriteToolkitProps {
  templates: PromptTemplate[];
  sessionContext: ToolkitSessionContext;
  onSelectPrompt: (template: PromptTemplate) => void;
}

export const FavoriteToolkit: React.FC<FavoriteToolkitProps> = ({ templates, sessionContext, onSelectPrompt }) => {
  const favoriteTemplates = templates.filter(t => sessionContext.favorited.includes(t.id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Star size={16} className="text-amber-400 fill-amber-400" /> Favorites
      </h3>
      <p className="text-xs text-slate-400 mt-1 mb-4">Your saved prompts for quick access.</p>
      {favoriteTemplates.length > 0 ? (
        <div className="space-y-2">
          {favoriteTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => onSelectPrompt(template)}
              className="w-full text-left p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-white transition-colors"
            >
              <span className="block font-bold text-xs text-indigo-700">{template.title}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">{template.category}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">
          Tap the star on a response to save it here.
        </p>
      )}
    </div>
  );
};
