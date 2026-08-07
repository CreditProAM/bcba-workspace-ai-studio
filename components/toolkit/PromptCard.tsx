import React from 'react';
import { Star } from 'lucide-react';
import type { PromptTemplate } from './toolkitTypes';

interface PromptCardProps {
  template: PromptTemplate;
  onSelect: () => void;
  isFavorited: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ template, onSelect, isFavorited }) => {
  return (
    <button
      onClick={onSelect}
      className="text-left bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-indigo-200 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between h-full"
    >
      <div>
        <h4 className="font-bold text-sm text-slate-800">{template.title}</h4>
        <p className="text-xs text-slate-500 mt-1">{template.description}</p>
      </div>
      {isFavorited && (
        <div className="flex justify-end mt-2">
          <Star size={14} className="text-amber-400 fill-amber-400" />
        </div>
      )}
    </button>
  );
};
