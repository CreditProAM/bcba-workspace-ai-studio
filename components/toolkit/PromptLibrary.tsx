import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { PromptTemplate, PromptCategory, ToolkitSessionContext } from './toolkitTypes';
import { PromptCard } from './PromptCard';

interface PromptLibraryProps {
  templates: PromptTemplate[];
  categories: PromptCategory[];
  onSelectPrompt: (template: PromptTemplate) => void;
  sessionContext: ToolkitSessionContext;
}

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ templates, categories, onSelectPrompt, sessionContext }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<PromptCategory | 'All'>('All');

  const filteredTemplates = templates.filter(template => {
    const searchMatch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = activeCategory === 'All' || template.category === activeCategory;
    return searchMatch && categoryMatch;
  });

  const templatesByCategory = categories
    .map(category => ({ category, templates: filteredTemplates.filter(t => t.category === category) }))
    .filter(group => group.templates.length > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-lg font-serif font-bold text-slate-900 mb-3">Prompt Library</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-4 overflow-x-auto -mb-px">
          <button
            onClick={() => setActiveCategory('All')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 text-xs font-bold transition-colors ${activeCategory === 'All' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 text-xs font-bold transition-colors ${activeCategory === category ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {category}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {filteredTemplates.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-6">No prompts found matching your search.</p>
        )}
        {filteredTemplates.length > 0 && activeCategory === 'All' && templatesByCategory.map(({ category, templates: catTemplates }) => (
          <div key={category}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catTemplates.map(template => (
                <PromptCard key={template.id} template={template} onSelect={() => onSelectPrompt(template)} isFavorited={sessionContext.favorited.includes(template.id)} />
              ))}
            </div>
          </div>
        ))}
        {filteredTemplates.length > 0 && activeCategory !== 'All' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTemplates.map(template => (
              <PromptCard key={template.id} template={template} onSelect={() => onSelectPrompt(template)} isFavorited={sessionContext.favorited.includes(template.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
