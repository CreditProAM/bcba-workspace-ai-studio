
import React, { useState } from 'react';
import { X, Calendar, Clock, Activity, CheckCircle2, AlertTriangle, ShieldCheck, TrendingUp, MapPin, History, Sparkles, RefreshCw, Plus, Minus, Save, FileText, ChevronRight } from 'lucide-react';
import { Client, CalendarEvent, ServicePlan } from '../types';
import { generateClientSummary, ClientSummary } from '../services/geminiService';

interface ClientProfilePanelProps {
  client: Client | null;
  events: CalendarEvent[];
  servicePlans?: ServicePlan[];
  onClose: () => void;
  onEdit: () => void;
  onLogHours?: (event: CalendarEvent) => void;
  onOpenServicePlan?: () => void;
}

export const ClientProfilePanel: React.FC<ClientProfilePanelProps> = ({ client, events, servicePlans = [], onClose, onEdit, onLogHours, onOpenServicePlan }) => {
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [manualHours, setManualHours] = useState(1.0);

  if (!client) return null;

  // --- Metrics Calculation (Real-time) ---
  const clientEvents = events.filter(e => e.clientId === client.id);
  
  // Hours Calculation
  const therapyHours = clientEvents
    .filter(e => e.serviceType === 'Direct 1:1')
    .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / (1000 * 60 * 60), 0);
  
  const supervisionHours = clientEvents
    .filter(e => e.serviceType === 'RBT Supervision')
    .reduce((acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()) / (1000 * 60 * 60), 0);

  // Compliance
  const requiredSupervision = therapyHours * 0.05;
  const compliancePct = therapyHours > 0 ? (supervisionHours / therapyHours) * 100 : 0;
  const isCompliant = compliancePct >= 5;

  // Upcoming Schedule
  const upcomingEvents = clientEvents
    .filter(e => e.start > new Date())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 3);

  // Past History
  const pastEvents = clientEvents
    .filter(e => e.end < new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime()) // Newest first
    .slice(0, 10); // Analyze last 10 sessions

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const result = await generateClientSummary(client, events);
      setSummary(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const adjustManualHours = (delta: number) => {
    setManualHours(prev => Math.max(0.25, prev + delta));
  };

  const handleLogHours = () => {
    if (!onLogHours) return;
    
    const now = new Date();
    // Default to a completed log for today
    const start = new Date(now);
    start.setHours(9, 0, 0, 0); // Default to 9 AM if creating for today, or current time
    if (now.getHours() > 9) {
        start.setHours(now.getHours(), 0, 0, 0);
    }
    
    const end = new Date(start.getTime() + manualHours * 60 * 60 * 1000);

    const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        title: 'Manual Supervision Log',
        start: start,
        end: end,
        clientId: client.id,
        serviceType: 'RBT Supervision',
        location: 'Clinic',
        description: `Manually logged ${manualHours} hours via profile panel.`
    };

    onLogHours(newEvent);
    // Visual feedback handled by App toast, but we can reset
    setManualHours(1.0);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-2 bottom-2 right-2 w-[400px] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 z-50 flex flex-col overflow-hidden animate-slide-in-right">
        
        {/* Header Image/Avatar Area */}
        <div className={`h-32 ${client.color} relative shrink-0`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-colors text-slate-600 backdrop-blur-md z-10"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
          
          <div className="absolute -bottom-10 left-6">
            {client.imageUrl ? (
              <img 
                src={client.imageUrl} 
                alt={client.name} 
                className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg object-cover bg-white"
              />
            ) : (
              <div className={`w-20 h-20 rounded-2xl ${client.color} border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold ${client.textColor}`}>
                {client.avatar}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pt-12 px-6 pb-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          
          {/* Identity */}
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-serif font-bold text-slate-900">{client.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    client.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {client.status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Activity size={12} strokeWidth={1.5} /> {client.diagnosis || 'No Diagnosis'}
                  </span>
                </div>
              </div>
              <button 
                onClick={onEdit}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline decoration-slate-300 hover:decoration-indigo-300 underline-offset-4 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Service Plan Entry */}
          {(() => {
            const activePlan = servicePlans.find(p => p.clientId === client.id && p.status === 'active');
            const draftPlan = servicePlans.find(p => p.clientId === client.id && p.status === 'draft');
            const planToDisplay = activePlan || draftPlan;
            const programCount = planToDisplay ? planToDisplay.categories.reduce((acc, cat) => acc + cat.programs.length, 0) : 0;
            
            return (
              <div 
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center justify-between"
                onClick={onOpenServicePlan}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                    <FileText size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {planToDisplay ? planToDisplay.name : 'Service Plan'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      {planToDisplay ? (
                        <>
                           <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                             planToDisplay.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                           }`}>
                             {planToDisplay.status}
                           </span>
                           <span>{programCount} {programCount === 1 ? 'Program' : 'Programs'}</span>
                        </>
                      ) : (
                        'No active plan. Click to create.'
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} strokeWidth={1.5} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
            );
          })()}

          {/* AI Progress Summary */}
          <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-2xl border border-indigo-100 p-5 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-center mb-4 relative z-10">
               <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                 <Sparkles size={14} strokeWidth={1.5} className="text-indigo-500" /> Clinical Insight
               </h3>
               {!summary && !isLoadingSummary && (
                 <button 
                    onClick={handleGenerateSummary}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold shadow-sm hover:shadow-md hover:bg-indigo-50 transition-all"
                 >
                    <RefreshCw size={10} strokeWidth={1.5} /> Generate
                 </button>
               )}
            </div>

            {isLoadingSummary ? (
                <div className="space-y-3 p-1">
                   <div className="h-4 w-3/4 bg-slate-200/50 rounded animate-shimmer"></div>
                   <div className="h-4 w-1/2 bg-slate-200/50 rounded animate-shimmer"></div>
                   <div className="h-20 w-full bg-slate-200/50 rounded-xl animate-shimmer mt-2"></div>
                </div>
            ) : summary ? (
                <div className="space-y-4 relative z-10 animate-scale-in">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                            <TrendingUp size={12} strokeWidth={1.5} /> Key Achievements
                        </div>
                        <ul className="space-y-1.5">
                            {summary.achievements.map((item, idx) => (
                                <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                                    <CheckCircle2 size={12} strokeWidth={1.5} className="text-emerald-500 mt-0.5 shrink-0" />
                                    {item}
                                </li>
                            ))}
                            {summary.achievements.length === 0 && <li className="text-xs text-slate-400 italic">No significant achievements recorded yet.</li>}
                        </ul>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-amber-700 uppercase mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} strokeWidth={1.5} /> Areas for Focus
                        </div>
                        <ul className="space-y-1.5">
                            {summary.areasForFocus.map((item, idx) => (
                                <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                                    {item}
                                </li>
                            ))}
                            {summary.areasForFocus.length === 0 && <li className="text-xs text-slate-400 italic">No focus areas identified.</li>}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-xs text-slate-500 italic relative z-10">
                    Click generate to analyze recent session logs, checklists, and outcomes using AI.
                </div>
            )}
            
            {/* Background Decoration */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-xl pointer-events-none"></div>
          </div>

          {/* Supervision Ring */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 relative z-10">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} strokeWidth={1.5} /> Supervision Compliance
              </h3>
              {isCompliant ? (
                 <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} strokeWidth={1.5} /> Compliant
                 </div>
              ) : (
                 <div className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle size={12} strokeWidth={1.5} /> {Math.max(0, requiredSupervision - supervisionHours).toFixed(1)} hrs needed
                 </div>
              )}
            </div>

            <div className="flex items-center gap-6 relative z-10 mb-4">
               {/* Progress Ring */}
               <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200" />
                    <circle 
                        cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" 
                        strokeDasharray={201} 
                        strokeDashoffset={201 - (Math.min(compliancePct, 100) / 100) * 201}
                        strokeLinecap="round"
                        className={`${isCompliant ? 'text-emerald-500' : 'text-indigo-500'} transition-all duration-1000 ease-out`} 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{compliancePct.toFixed(0)}%</span>
                  </div>
               </div>

               <div className="space-y-2 flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Therapy Hrs</span>
                    <span className="font-mono font-bold tabular-nums">{therapyHours.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Supervision</span>
                    <span className="font-mono font-bold text-indigo-600 tabular-nums">{supervisionHours.toFixed(1)}</span>
                  </div>
                  <div className="w-full h-px bg-slate-200 my-1"></div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Target (5%)</span>
                    <span className="font-mono font-bold text-slate-400 tabular-nums">{requiredSupervision.toFixed(2)}</span>
                  </div>
               </div>
            </div>

            {/* Quick Log Manual Entry */}
            {onLogHours && (
                <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between shadow-sm relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Clock size={14} strokeWidth={2} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quick Log</div>
                            <div className="text-xs font-semibold text-slate-900">Add Hours</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                            <button 
                                onClick={() => adjustManualHours(-0.25)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-all"
                            >
                                <Minus size={12} strokeWidth={2} />
                            </button>
                            <span className="w-12 text-center text-xs font-mono font-bold text-slate-700 tabular-nums">
                                {manualHours.toFixed(2)}
                            </span>
                            <button 
                                onClick={() => adjustManualHours(0.25)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-all"
                            >
                                <Plus size={12} strokeWidth={2} />
                            </button>
                        </div>
                        <button 
                            onClick={handleLogHours}
                            className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            title="Save Log"
                        >
                            <Save size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            )}
          </div>

          {/* Upcoming Schedule (Mini List) */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calendar size={14} strokeWidth={1.5} /> Upcoming Sessions
            </h3>
            <div className="space-y-2">
                {upcomingEvents.length > 0 ? upcomingEvents.map(evt => (
                    <div key={evt.id} className="flex gap-3 items-start p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex flex-col items-center min-w-[3rem] p-1 bg-slate-50 rounded-lg border border-slate-100">
                             <span className="text-[9px] font-bold text-slate-400 uppercase">{evt.start.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                             <span className="text-sm font-bold text-slate-900 tabular-nums">{evt.start.getDate()}</span>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-900">{evt.title}</div>
                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <Clock size={10} strokeWidth={1.5} />
                                <span className="tabular-nums">
                                  {evt.start.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})} - {evt.end.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}
                                </span>
                            </div>
                            {evt.location && (
                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <MapPin size={10} strokeWidth={1.5} /> {evt.location}
                                </div>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="text-xs text-slate-400 italic p-2">No upcoming sessions scheduled.</div>
                )}
            </div>
          </div>

          {/* Past History */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 mt-6">
                <History size={14} strokeWidth={1.5} /> Recent Sessions
            </h3>
            <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
                {pastEvents.length > 0 ? pastEvents.map(evt => (
                    <div key={evt.id} className="relative">
                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white"></div>
                        <div className="flex flex-col gap-1 group">
                             <div className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{evt.title}</div>
                             <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5">
                                <span className="tabular-nums">{evt.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="font-semibold text-slate-600">{evt.serviceType}</span>
                                {evt.location && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        <span className="flex items-center gap-0.5">
                                            <MapPin size={10} strokeWidth={1.5} className="text-slate-400" />
                                            {evt.location}
                                        </span>
                                    </>
                                )}
                             </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-xs text-slate-400 italic">No past sessions recorded.</div>
                )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
