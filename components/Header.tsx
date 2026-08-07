
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  UserPlus, 
  Undo2, 
  Redo2,
  Clock,
  CloudSun,
  Calendar,
  LayoutGrid,
  Rows,
  Sparkles,
  Cloud,
  Loader2,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-react';
import { Client, CalendarView } from '../types';

interface HeaderProps {
  clients: Client[];
  activeClients: string[];
  toggleClient: (id: string) => void;
  onClientClick: (client: Client) => void;
  onSidekickClick: () => void;
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onAddClient: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date;
  utilizationMetrics?: { scheduled: number; total: number; percentage: number };
}

export const Header: React.FC<HeaderProps> = ({ 
  clients, 
  activeClients, 
  toggleClient, 
  onClientClick,
  onSidekickClick,
  currentDate,
  view,
  onViewChange,
  onNavigate,
  onAddClient,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
  lastSaved,
  utilizationMetrics
}) => {
  const [time, setTime] = useState(new Date());
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getHeaderText = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'month') {
      return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }
    // Week view
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleString('default', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`;
  };

  const viewOptions: { id: CalendarView; label: string; icon: React.ElementType }[] = [
    { id: 'day', label: 'Day View', icon: Rows },
    { id: 'week', label: 'Week View', icon: LayoutGrid },
    { id: 'month', label: 'Month View', icon: Calendar },
  ];

  const activeViewOption = viewOptions.find(v => v.id === view) || viewOptions[1];

  const getUtilizationColor = (pct: number) => {
      if (pct > 100) return 'text-rose-600 bg-rose-50 border-rose-100';
      if (pct > 90) return 'text-emerald-600 bg-emerald-50 border-emerald-100'; // Optimal
      if (pct > 70) return 'text-indigo-600 bg-indigo-50 border-indigo-100'; // Good
      return 'text-amber-600 bg-amber-50 border-amber-100'; // Under-utilized
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 z-30 sticky top-0 flex flex-col transition-all">
      
      {/* Main Toolbar */}
      <div className="px-8 py-5 flex items-center justify-between gap-8">
        
        {/* Left Group: Context */}
        <div className="flex flex-col justify-center">
             <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight leading-none mb-1.5">
               {getHeaderText()}
             </h1>

             {/* Meta Info Line */}
             <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-1.5 text-indigo-900/60">
                  <Clock size={12} strokeWidth={2} />
                  <span className="tabular-nums">{formatTime(time)}</span>
                </div>
                
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                
                <div className="flex items-center gap-1.5 text-amber-600/70">
                  <CloudSun size={12} strokeWidth={2} />
                  <span>72° Clinic</span>
                </div>
                
                {/* Smart Utilization Monitor */}
                {utilizationMetrics && (
                  <>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${getUtilizationColor(utilizationMetrics.percentage)}`}>
                          {utilizationMetrics.percentage > 100 ? <AlertCircle size={10} strokeWidth={2.5}/> : <TrendingUp size={10} strokeWidth={2.5} />}
                          <span className="tabular-nums">{utilizationMetrics.percentage.toFixed(0)}% Cap.</span>
                      </div>
                  </>
                )}
                
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>

                {/* Save Status Indicator */}
                <div className="flex items-center gap-1.5" title={`Last saved: ${lastSaved.toLocaleTimeString()}`}>
                    {saveStatus === 'saving' ? (
                      <>
                        <Loader2 size={10} className="animate-spin text-fuchsia-500" />
                        <span className="text-fuchsia-500">Saving...</span>
                      </>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <Cloud size={10} strokeWidth={2.5} className="text-emerald-500" />
                        <span className="text-emerald-600">Saved</span>
                      </>
                    ) : (
                      <span className="text-rose-500">Sync Error</span>
                    )}
                </div>
             </div>
        </div>

        {/* Right Group: Controls */}
        <div className="flex items-center gap-4">
          
          {/* Consolidated Nav & View Control */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-1">
               {/* Navigation */}
               <div className="flex items-center">
                    <button 
                        onClick={() => onNavigate('prev')} 
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                        title="Previous"
                    >
                        <ChevronLeft size={18} strokeWidth={2} />
                    </button>
                    <button
                        onClick={() => onNavigate('today')}
                        className="px-3 py-1.5 rounded-lg text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                     >
                        Today
                     </button>
                    <button 
                        onClick={() => onNavigate('next')} 
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                        title="Next"
                    >
                        <ChevronRight size={18} strokeWidth={2} />
                    </button>
               </div>

               {/* Divider */}
               <div className="w-px h-5 bg-slate-200 mx-2"></div>

               {/* View Switcher Dropdown */}
               <div className="relative" ref={viewMenuRef}>
                   <button 
                      onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                   >
                       <activeViewOption.icon size={14} strokeWidth={2} className="text-slate-400" />
                       <span className="text-xs font-bold uppercase tracking-wide">{activeViewOption.label}</span>
                       <ChevronDown size={14} strokeWidth={2} className="text-slate-400" />
                   </button>
                   
                   {isViewMenuOpen && (
                       <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 z-50 animate-scale-in">
                           {viewOptions.map(opt => (
                               <button
                                  key={opt.id}
                                  onClick={() => {
                                      onViewChange(opt.id);
                                      setIsViewMenuOpen(false);
                                  }}
                                  className={`
                                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors
                                      ${view === opt.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}
                                  `}
                               >
                                  <div className="flex items-center gap-2">
                                      <opt.icon size={14} strokeWidth={2} />
                                      {opt.label}
                                  </div>
                                  {view === opt.id && <Check size={14} strokeWidth={2} />}
                               </button>
                           ))}
                       </div>
                   )}
               </div>
          </div>

          {/* History Tools */}
          <div className="flex items-center gap-1 bg-slate-50/50 p-1 rounded-xl border border-slate-200/50">
                 <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                    title="Undo (Ctrl+Z)"
                 >
                    <Undo2 size={16} strokeWidth={2} />
                 </button>
                 <button 
                    onClick={onRedo} 
                    disabled={!canRedo}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                    title="Redo (Ctrl+Y)"
                 >
                    <Redo2 size={16} strokeWidth={2} />
                 </button>
          </div>

          {/* AI Action */}
          <button 
                onClick={onSidekickClick}
                className="group pl-3 pr-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 hover:scale-[1.02] hover:bg-slate-800 transition-all flex items-center gap-2 border border-slate-700 ml-2"
             >
                <div className="p-1 rounded bg-white/10 group-hover:bg-white/20 transition-colors">
                    <Sparkles size={14} strokeWidth={2} />
                </div>
                <span className="text-xs font-bold tracking-wide">AI Assist</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Bottom) */}
      <div className="px-8 pb-4 overflow-x-auto scrollbar-hide flex items-center">
         <div className="flex items-center gap-2 min-w-max">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Caseload</span>
            <button 
                onClick={onAddClient}
                className="w-7 h-7 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all shrink-0 mr-2"
                title="Add Client"
            >
                <UserPlus size={14} strokeWidth={1.5} />
            </button>
            
            {clients.map((client) => {
                const isActive = activeClients.includes(client.id);
                return (
                    <button
                        key={client.id}
                        onClick={(e) => {
                            onClientClick(client);
                            if (e.shiftKey) toggleClient(client.id);
                        }}
                        className={`
                            group flex items-center gap-2 px-1.5 py-1 pr-3 rounded-full transition-all duration-200 border
                            ${isActive 
                                ? 'bg-white border-slate-200 shadow-sm ring-1 ring-slate-100' 
                                : 'bg-transparent border-transparent opacity-50 hover:opacity-100 hover:bg-slate-50'}
                        `}
                    >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold overflow-hidden ${client.color} ${client.textColor}`}>
                            {client.imageUrl ? (
                                <img src={client.imageUrl} alt={client.name} className="w-full h-full object-cover" />
                            ) : (
                                client.avatar
                            )}
                        </div>
                        <span className={`text-[11px] font-bold ${isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                            {client.name}
                        </span>
                        
                        {isActive && (
                            <span className={`
                                text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-1
                                ${client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                  client.status === 'Onboarding' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                            `}>
                                {client.status === 'Active' ? 'ACT' : client.status === 'Onboarding' ? 'ONB' : 'MNT'}
                            </span>
                        )}
                    </button>
                );
            })}
         </div>
      </div>
    </div>
  );
};
