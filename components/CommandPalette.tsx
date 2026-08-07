
import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, ArrowRight, Plus, LayoutGrid, Rows, Mail, FileBarChart2 } from 'lucide-react';
import { Client, CalendarView } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onClientSelect: (client: Client) => void;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (dir: 'today' | 'prev' | 'next') => void;
  onAddEvent: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  clients,
  onClientSelect,
  onViewChange,
  onNavigate,
  onAddEvent
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    c.diagnosis?.toLowerCase().includes(query.toLowerCase())
  );

  const staticCommands = [
    { id: 'add-event', label: 'Schedule New Session', icon: Plus, action: () => onAddEvent(), group: 'Actions' },
    { id: 'view-week', label: 'Switch to Week View', icon: LayoutGrid, action: () => onViewChange('week'), group: 'Navigation' },
    { id: 'view-day', label: 'Switch to Day View', icon: Rows, action: () => onViewChange('day'), group: 'Navigation' },
    { id: 'view-month', label: 'Switch to Month View', icon: Calendar, action: () => onViewChange('month'), group: 'Navigation' },
    { id: 'go-today', label: 'Jump to Today', icon: Calendar, action: () => onNavigate('today'), group: 'Navigation' },
  ].filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));

  // Dynamic Context Actions based on search
  const contextActions = filteredClients.flatMap(c => [
    { 
        id: `email-${c.id}`, 
        label: `Email ${c.name}`, 
        icon: Mail, 
        action: () => window.open(`mailto:?subject=Clinical Update: ${c.name}`), 
        group: 'Quick Actions',
        meta: 'Send secure email'
    },
    { 
        id: `report-${c.id}`, 
        label: `Generate Report: ${c.name}`, 
        icon: FileBarChart2, 
        action: () => { /* Placeholder */ }, 
        group: 'Quick Actions',
        meta: 'PDF Export'
    }
  ]).filter(() => query.length > 2); // Only show specific actions when user has typed something

  const allItems = [
    ...contextActions.map(c => ({ type: 'command' as const, data: c })),
    ...staticCommands.map(c => ({ type: 'command' as const, data: c })),
    ...filteredClients.map(c => ({ type: 'client' as const, data: c }))
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(allItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const execute = (item: typeof allItems[0]) => {
    if (!item) return;
    if (item.type === 'command') {
      item.data.action();
    } else {
      onClientSelect(item.data);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-4 border-b border-slate-100 gap-3">
          <Search size={20} className="text-slate-400" strokeWidth={1.5} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-slate-300 text-slate-800"
            placeholder="Search clients, reports, or commands..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-1">
             <kbd className="hidden sm:inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-400">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
                <p className="text-sm">No results found.</p>
            </div>
          ) : (
            <div className="space-y-1">
               {/* Context Actions (Dynamic) */}
               {contextActions.length > 0 && (
                 <div className="px-3 py-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50/50 rounded-lg mb-1">
                    Quick Actions
                 </div>
               )}
               {contextActions.map((cmd, idx) => {
                 const isSelected = idx === selectedIndex;
                 return (
                   <button
                     key={cmd.id}
                     onClick={() => execute({ type: 'command', data: cmd })}
                     onMouseEnter={() => setSelectedIndex(idx)}
                     className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors text-left
                        ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'}
                     `}
                   >
                     <div className="flex items-center gap-3">
                        <cmd.icon size={18} strokeWidth={1.5} className={isSelected ? 'text-indigo-200' : 'text-slate-400'} />
                        <span className="font-medium text-sm">{cmd.label}</span>
                     </div>
                     <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {cmd.meta}
                     </span>
                   </button>
                 );
               })}

               {/* Static Commands */}
               {staticCommands.length > 0 && (
                 <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    Navigation & Views
                 </div>
               )}
               {staticCommands.map((cmd, idx) => {
                 const actualIdx = contextActions.length + idx;
                 const isSelected = actualIdx === selectedIndex;
                 return (
                   <button
                     key={cmd.id}
                     onClick={() => execute({ type: 'command', data: cmd })}
                     onMouseEnter={() => setSelectedIndex(actualIdx)}
                     className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors text-left
                        ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'}
                     `}
                   >
                     <div className="flex items-center gap-3">
                        <cmd.icon size={18} strokeWidth={1.5} className={isSelected ? 'text-indigo-200' : 'text-slate-400'} />
                        <span className="font-medium text-sm">{cmd.label}</span>
                     </div>
                     {isSelected && <ArrowRight size={14} strokeWidth={2} className="text-indigo-200" />}
                   </button>
                 );
               })}

               {/* Clients Group */}
               {filteredClients.length > 0 && (
                 <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    Clients
                 </div>
               )}
               {filteredClients.map((client, idx) => {
                 const actualIdx = contextActions.length + staticCommands.length + idx;
                 const isSelected = actualIdx === selectedIndex;
                 return (
                   <button
                     key={client.id}
                     onClick={() => execute({ type: 'client', data: client })}
                     onMouseEnter={() => setSelectedIndex(actualIdx)}
                     className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors text-left
                        ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'}
                     `}
                   >
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border
                            ${isSelected ? 'bg-white/20 border-white/20 text-white' : `${client.color} ${client.borderColor} ${client.textColor}`}
                         `}>
                            {client.avatar}
                         </div>
                         <div>
                            <div className="font-bold text-sm">{client.name}</div>
                            <div className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {client.diagnosis || 'No Diagnosis'}
                            </div>
                         </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded
                          ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}
                      `}>
                          {client.status}
                      </div>
                   </button>
                 );
               })}
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-medium">
             <div className="flex gap-3">
                 <span className="flex items-center gap-1"><ArrowRight size={10}/> Select</span>
                 <span className="flex items-center gap-1"><ArrowRight size={10} className="rotate-90"/> Navigate</span>
             </div>
             <div>Clinical Dashboard OS</div>
        </div>
      </div>
    </div>
  );
};
