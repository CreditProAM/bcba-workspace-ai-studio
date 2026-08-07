
import React, { useState } from 'react';
import { Client, CalendarEvent } from '../types';
import { AlertTriangle, CheckCircle2, CalendarPlus, Grid3X3, List, ChevronLeft, ChevronRight, Save, X, Home, Building2 } from 'lucide-react';

interface SupervisionViewProps {
  clients: Client[];
  events: CalendarEvent[];
  onSchedule: (client: Client) => void;
  onLogHours?: (client: Client) => void;
  currentDate?: Date;
  onSaveEvent?: (event: CalendarEvent) => void;
}

export const SupervisionView: React.FC<SupervisionViewProps> = ({
    clients,
    events,
    onSchedule,
    onLogHours,
    currentDate = new Date(),
    onSaveEvent
}) => {
  const [viewMode, setViewMode] = useState<'compliance' | 'planner'>('planner'); 
  const [plannerOffset, setPlannerOffset] = useState(0); 
  
  // State for the quick-add popup
  const [activeCell, setActiveCell] = useState<{ clientId: string, date: Date } | null>(null);
  const [inputHours, setInputHours] = useState('2');
  const [inputLocation, setInputLocation] = useState<'Clinic' | 'Home'>('Clinic');

  const getSupervisionStats = (clientId: string) => {
    const clientEvents = events.filter(e => e.clientId === clientId);
    
    const therapyMinutes = clientEvents
        .filter(e => e.serviceType === 'Direct 1:1')
        .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / (1000 * 60), 0);
    
    const supervisionMinutes = clientEvents
        .filter(e => e.serviceType === 'RBT Supervision')
        .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / (1000 * 60), 0);

    const therapyHours = Math.round((therapyMinutes / 60) * 10) / 10;
    const supervisionHours = Math.round((supervisionMinutes / 60) * 10) / 10;

    const requiredMinutes = therapyMinutes * 0.05;
    const requiredHours = Math.round((requiredMinutes / 60) * 100) / 100;

    const percentage = therapyHours > 0 ? (supervisionHours / therapyHours) * 100 : 0;
    const isCompliant = percentage >= 5;

    return { therapyHours, supervisionHours, requiredHours, percentage, isCompliant };
  };

  const getWeekDays = () => {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1 + (plannerOffset * 7)); // Start on Monday
      if (currentDate.getDay() === 0) start.setDate(start.getDate() - 7);
      
      return Array.from({ length: 5 }, (_, i) => { // Mon-Fri
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          d.setHours(0,0,0,0);
          return d;
      });
  };

  const weekDays = getWeekDays();

  // Get aggregated data for a specific cell
  const getDailyData = (clientId: string, date: Date) => {
      const dailyEvents = events.filter(e => 
          e.clientId === clientId && 
          e.serviceType === 'RBT Supervision' &&
          e.start.getDate() === date.getDate() &&
          e.start.getMonth() === date.getMonth() &&
          e.start.getFullYear() === date.getFullYear()
      );
      
      const clinicMinutes = dailyEvents
        .filter(e => e.location === 'Clinic')
        .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / 60000, 0);

      const homeMinutes = dailyEvents
        .filter(e => e.location === 'Home')
        .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / 60000, 0);
      
      return {
          totalHours: Math.round(((clinicMinutes + homeMinutes) / 60) * 10) / 10,
          clinicHours: Math.round((clinicMinutes / 60) * 10) / 10,
          homeHours: Math.round((homeMinutes / 60) * 10) / 10,
          isFuture: date > new Date()
      };
  };

  const handleCellClick = (clientId: string, date: Date) => {
      setActiveCell({ clientId, date });
      // Reset defaults
      setInputHours('2');
      setInputLocation('Clinic');
  };

  const handleSaveCell = () => {
      if (!activeCell || !onSaveEvent) return;
      
      const hours = parseFloat(inputHours);
      if (isNaN(hours) || hours <= 0) return;

      const start = new Date(activeCell.date);
      start.setHours(9, 0, 0, 0); // Default 9 AM
      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

      const newEvent: CalendarEvent = {
          id: crypto.randomUUID(),
          title: `Supervision (${inputLocation})`,
          start,
          end,
          clientId: activeCell.clientId,
          serviceType: 'RBT Supervision',
          location: inputLocation,
          description: `Tracker Log: ${hours} hours at ${inputLocation}`
      };

      onSaveEvent(newEvent);
      setActiveCell(null);
  };

  const totalClients = clients.length;
  const compliantClients = clients.filter(c => getSupervisionStats(c.id).isCompliant).length;
  const overallCompliance = Math.round((compliantClients / totalClients) * 100);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto relative h-full flex flex-col">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
            <div>
                <h1 className="text-2xl font-serif font-bold text-slate-900">
                    {viewMode === 'planner' ? 'Supervision Tracker' : 'Compliance Dashboard'}
                </h1>
                <p className="text-slate-500 font-medium mt-1">
                    {viewMode === 'planner' 
                        ? 'Visual weekly planner for Home & Clinic supervision.' 
                        : 'Monthly RBT Supervision Tracking (5% Requirement)'
                    }
                </p>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Mode Toggle */}
                <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
                    <button 
                        onClick={() => setViewMode('planner')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'planner' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <Grid3X3 size={14} strokeWidth={2} /> Tracker
                    </button>
                    <button 
                        onClick={() => setViewMode('compliance')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'compliance' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <List size={14} strokeWidth={2} /> Compliance
                    </button>
                </div>

                {viewMode === 'compliance' && (
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${overallCompliance === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        <span className="text-xs font-bold text-slate-700">{overallCompliance}% Compliant</span>
                    </div>
                )}
            </div>
        </div>

        {viewMode === 'compliance' ? (
            /* --- Compliance View (Existing) --- */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-4">Client / Case</div>
                    <div className="col-span-2 text-center">Total Therapy</div>
                    <div className="col-span-2 text-center">Supervision</div>
                    <div className="col-span-2 text-center">Target (5%)</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                    {clients.map(client => {
                        const stats = getSupervisionStats(client.id);
                        return (
                            <div key={client.id} className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-slate-50/50 transition-colors group">
                                <div className="col-span-4 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${client.color} ${client.textColor}`}>
                                        {client.avatar}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{client.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            {client.diagnosis}
                                            {stats.isCompliant ? (
                                                <span className="flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                                                    <CheckCircle2 size={10} strokeWidth={2} /> Compliant
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                                                    <AlertTriangle size={10} strokeWidth={2} /> Non-Compliant
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-center font-mono text-sm text-slate-600">{stats.therapyHours} hrs</div>
                                <div className="col-span-2 text-center">
                                    <span className="font-bold text-slate-900 text-sm">{stats.supervisionHours} hrs</span>
                                    <div className="text-[10px] text-slate-400">({stats.percentage.toFixed(1)}%)</div>
                                </div>
                                <div className="col-span-2 text-center font-mono text-sm text-slate-500">&gt; {stats.requiredHours} hrs</div>
                                <div className="col-span-2 flex justify-end gap-2">
                                    {onLogHours && (
                                        <button onClick={() => onLogHours(client)} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-xs transition-colors border border-slate-200">
                                            <Save size={14} strokeWidth={1.5} /> <span>Log Hours</span>
                                        </button>
                                    )}
                                    <button onClick={() => onSchedule(client)} className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs transition-colors border border-indigo-100">
                                        <CalendarPlus size={14} strokeWidth={1.5} /> <span>Schedule</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : (
            /* --- Planner View (New Visuals) --- */
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in relative">
                {/* Planner Toolbar */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm">
                            <button onClick={() => setPlannerOffset(p => p - 1)} className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-l-lg"><ChevronLeft size={16} /></button>
                            <button onClick={() => setPlannerOffset(0)} className="px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 border-x border-slate-200">
                                {plannerOffset === 0 ? 'Current Week' : (plannerOffset > 0 ? `+${plannerOffset} Weeks` : `${plannerOffset} Weeks`)}
                            </button>
                            <button onClick={() => setPlannerOffset(p => p + 1)} className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-r-lg"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-white border border-slate-300 rounded shadow-sm"></div>
                            <span className="text-slate-500">Planned</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-indigo-100 border border-indigo-200 rounded shadow-sm"></div>
                            <span className="text-slate-500">Logged</span>
                        </div>
                    </div>
                </div>

                {/* Grid Header */}
                <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50">
                    <div className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200">Client</div>
                    {weekDays.map((d, i) => (
                        <div key={i} className="p-4 text-center border-r border-slate-200 last:border-r-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div className={`text-sm font-bold mt-1 ${d.toDateString() === new Date().toDateString() ? 'text-indigo-600' : 'text-slate-700'}`}>
                                {d.getDate()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grid Body */}
                <div className="overflow-y-auto flex-1">
                    {clients.map(client => (
                        <div key={client.id} className="grid grid-cols-6 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-colors group">
                            {/* Client Row Header */}
                            <div className="p-4 flex items-center gap-3 border-r border-slate-100 bg-white group-hover:bg-slate-50/30 transition-colors">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${client.color} ${client.textColor}`}>
                                    {client.avatar}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900">{client.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        {getSupervisionStats(client.id).supervisionHours}h total
                                    </div>
                                </div>
                            </div>

                            {/* Cells */}
                            {weekDays.map((day, i) => {
                                const data = getDailyData(client.id, day);
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => handleCellClick(client.id, day)}
                                        className="border-r border-slate-100 last:border-r-0 relative p-2 cursor-pointer hover:bg-indigo-50/10 transition-colors flex items-center justify-center"
                                    >
                                        {data.totalHours > 0 ? (
                                            <div className={`
                                                w-full h-full rounded-xl flex flex-col gap-1 p-1.5 transition-all
                                                ${data.isFuture ? 'bg-white border-2 border-dashed border-indigo-200' : `${client.color} border border-transparent`}
                                            `}>
                                                {data.clinicHours > 0 && (
                                                    <div className={`
                                                        flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded
                                                        ${data.isFuture ? 'bg-indigo-50 text-indigo-700' : 'bg-white/60 text-slate-800'}
                                                    `}>
                                                        <span className="font-bold">{data.clinicHours}h</span>
                                                        <Building2 size={10} strokeWidth={2} className="opacity-70" />
                                                    </div>
                                                )}
                                                {data.homeHours > 0 && (
                                                    <div className={`
                                                        flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded
                                                        ${data.isFuture ? 'bg-indigo-50 text-indigo-700' : 'bg-white/60 text-slate-800'}
                                                    `}>
                                                        <span className="font-bold">{data.homeHours}h</span>
                                                        <Home size={10} strokeWidth={2} className="opacity-70" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-indigo-200 hover:bg-white transition-all">
                                                <PlusIcon className="text-indigo-300" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Quick Add Popover */}
                {activeCell && (
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] z-50 flex items-center justify-center animate-fade-in" onClick={() => setActiveCell(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 animate-scale-in" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-bold text-slate-900">Log Supervision</h3>
                                    <p className="text-xs text-slate-500">
                                        {clients.find(c => c.id === activeCell.clientId)?.name} • {activeCell.date.toLocaleDateString()}
                                    </p>
                                </div>
                                <button onClick={() => setActiveCell(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <div className="space-y-5">
                                {/* Location Toggle */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Location</label>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setInputLocation('Clinic')}
                                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${inputLocation === 'Clinic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <Building2 size={14} /> Clinic
                                        </button>
                                        <button
                                            onClick={() => setInputLocation('Home')}
                                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${inputLocation === 'Home' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <Home size={14} /> Home
                                        </button>
                                    </div>
                                </div>

                                {/* Hours Input */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Duration</label>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setInputHours((prev) => Math.max(0.25, parseFloat(prev) - 0.25).toString())} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold text-slate-600">-</button>
                                        <div className="flex-1 relative">
                                            <input 
                                                type="number" 
                                                value={inputHours} 
                                                onChange={e => setInputHours(e.target.value)}
                                                className="w-full text-center py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                            />
                                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">hrs</span>
                                        </div>
                                        <button onClick={() => setInputHours((prev) => (parseFloat(prev) + 0.25).toString())} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold text-slate-600">+</button>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={handleSaveCell}
                                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={16} /> Save Entry
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

// Helper component for the plus icon
const PlusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
);
