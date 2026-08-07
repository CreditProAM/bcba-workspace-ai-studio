
import React, { useState, useMemo } from 'react';
import { ActivityLogEntry } from '../types';
import { History, Plus, Trash2, FilePenLine, CheckCircle2, Bot, SlidersHorizontal, Search, Shield, CalendarDays, UserRound } from 'lucide-react';

interface ActivityViewProps {
  logs: ActivityLogEntry[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENT' | 'EVENT' | 'SYSTEM' | 'SUPERVISION'>('ALL');
  
  const getIcon = (action: ActivityLogEntry['action'], type: ActivityLogEntry['targetType']) => {
    if (action === 'SYSTEM') return <Bot size={16} strokeWidth={1.5} />;
    if (action === 'DELETE') return <Trash2 size={16} strokeWidth={1.5} />;
    if (action === 'CREATE') return <Plus size={16} strokeWidth={1.5} />;
    if (action === 'COMPLETE') return <CheckCircle2 size={16} strokeWidth={1.5} />;
    if (type === 'SETTINGS') return <SlidersHorizontal size={16} strokeWidth={1.5} />;
    return <FilePenLine size={16} strokeWidth={1.5} />;
  };

  const getColor = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DELETE': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'SYSTEM': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'COMPLETE': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Filter by Type
      if (filterType !== 'ALL') {
        if (filterType === 'SYSTEM') {
           if (log.action !== 'SYSTEM') return false;
        } else {
           if (log.targetType !== (filterType as ActivityLogEntry['targetType'])) return false;
        }
      }

      // 2. Filter by Search
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        return (
          log.description.toLowerCase().includes(lowerTerm) ||
          log.user.toLowerCase().includes(lowerTerm) ||
          (log.metadata && log.metadata.toLowerCase().includes(lowerTerm))
        );
      }

      return true;
    });
  }, [logs, filterType, searchTerm]);

  // Group logs by Date
  const groupedLogs: Record<string, ActivityLogEntry[]> = {};
  filteredLogs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groupedLogs[date]) groupedLogs[date] = [];
    groupedLogs[date].push(log);
  });

  // Quick Stats
  const stats = {
    total: logs.length,
    system: logs.filter(l => l.action === 'SYSTEM').length,
    destructive: logs.filter(l => l.action === 'DELETE').length,
  };

  const filters = [
    { id: 'ALL', label: 'All Activity', icon: History },
    { id: 'CLIENT', label: 'Clients', icon: UserRound },
    { id: 'EVENT', label: 'Schedule', icon: CalendarDays },
    { id: 'SUPERVISION', label: 'Supervision', icon: Shield },
    { id: 'SYSTEM', label: 'AI & System', icon: Bot },
  ];

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-2xl font-serif font-bold text-slate-900">System Activity Log</h1>
                <p className="text-slate-500 font-medium mt-1 text-sm">
                   Audit trail • <span className="text-indigo-600 font-bold">{stats.total}</span> records • <span className="text-rose-500 font-bold">{stats.destructive}</span> deletions
                </p>
            </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-30">
          
          {/* Filters */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-hide px-2 md:px-0">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                  ${filterType === f.id 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
                `}
              >
                <f.icon size={14} strokeWidth={1.5} />
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-64 px-2 md:px-0">
            <Search size={16} strokeWidth={1.5} className="absolute left-5 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search audit trail..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all focus:bg-white"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} strokeWidth={1.5} className="opacity-50" />
                </div>
                <h3 className="text-slate-900 font-bold">No results found</h3>
                <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
            </div>
        ) : (
            <div className="space-y-8 animate-scale-in">
                {Object.entries(groupedLogs).map(([date, dayLogs]) => (
                    <div key={date}>
                        <div className="sticky top-16 md:top-20 py-2 z-20 mb-4 flex items-center gap-4">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-md bg-opacity-90">
                                {date}
                            </span>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>
                        
                        <div className="relative pl-8 space-y-4 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 before:border-l before:border-dashed before:border-slate-300">
                            {dayLogs.map((log) => (
                                <div key={log.id} className="relative group">
                                    <div className={`
                                        absolute -left-[34px] w-7 h-7 rounded-full border-4 border-slate-50 shadow-sm flex items-center justify-center z-10
                                        ${getColor(log.action)}
                                    `}>
                                        {getIcon(log.action, log.targetType)}
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex justify-between items-start gap-4 group-hover:translate-x-1">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${getColor(log.action)} bg-opacity-10 tracking-wider`}>
                                                    {log.action}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                                    {log.action === 'SYSTEM' && <Bot size={10} strokeWidth={1.5} />}
                                                    {log.targetType}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                                                {log.description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                                {log.user.substring(0,1)}
                                              </div>
                                              <span className="text-xs text-slate-500 font-medium">{log.user}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </div>
                                            {log.metadata && (
                                                <div className="text-[9px] text-slate-300 mt-2 font-mono">
                                                    #{log.metadata.substring(0,6)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
