import React, { useState } from 'react';
import { X, Calendar, Clock, Activity, CheckCircle2, AlertTriangle, ShieldCheck, TrendingUp, MapPin, History, Sparkles, RefreshCw, Plus, Minus, Save, FileText, ChevronRight, FilePlus2, ClipboardList, Users } from 'lucide-react';
import { Client, CalendarEvent, ServicePlan, SessionNote, Assessment, ParentTrainingLog } from '../types';
import { generateClientSummary, ClientSummary } from '../services/geminiService';
import { ClinicalProgress } from './data/ClinicalProgress';

interface ClientProfilePanelProps {
  client: Client | null;
  events: CalendarEvent[];
  servicePlans?: ServicePlan[];
  onClose: () => void;
  onEdit: () => void;
  onLogHours?: (event: CalendarEvent) => void;
  onOpenServicePlan?: () => void;
  onNavigateToNotes?: (view: { clientId: string, screen: 'list' | 'note' | 'doc', noteId?: string, doc?: any }) => void;
}

type WorkspaceTab = 'overview' | 'servicePlan' | 'data' | 'notes' | 'documents';

export const ClientProfilePanel: React.FC<ClientProfilePanelProps> = ({ client, events, servicePlans = [], onClose, onEdit, onLogHours, onOpenServicePlan, onNavigateToNotes }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
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
    const start = new Date(now);
    start.setHours(9, 0, 0, 0); 
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
    setManualHours(1.0);
  };

  const activePlan = servicePlans.find(p => p.clientId === client.id && p.status === 'active');
  const draftPlan = servicePlans.find(p => p.clientId === client.id && p.status === 'draft');
  const planToDisplay = activePlan || draftPlan;
  
  const pendingNotes = client.sessionNotes?.filter(n => n.status === 'Pending Review') || [];
  const noSessionData = activePlan && (!client.sessionNotes || client.sessionNotes.length === 0);
  const reviewDueSoon = activePlan && activePlan.reviewDate && (new Date(activePlan.reviewDate).getTime() - new Date().getTime()) < 30 * 24 * 60 * 60 * 1000;

  const renderOverview = () => (
    <div className="space-y-8 animate-fade-in">
       {/* Needs Attention */}
       {(pendingNotes.length > 0 || noSessionData || reviewDueSoon) && (
         <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
           <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-2">
             <AlertTriangle size={14} strokeWidth={1.5} /> Needs Attention
           </h3>
           <div className="space-y-2">
             {pendingNotes.map(n => (
               <div key={n.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                 <div className="flex items-center gap-3">
                   <Clock size={16} className="text-amber-500" />
                   <div>
                     <p className="text-sm font-bold text-slate-800">Session Note Pending Review</p>
                     <p className="text-[10px] text-slate-500">{n.date}</p>
                   </div>
                 </div>
                 <button onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'note', noteId: n.id })} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Review</button>
               </div>
             ))}
             {noSessionData && (
               <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                 <div className="flex items-center gap-3">
                   <Activity size={16} className="text-amber-500" />
                   <div>
                     <p className="text-sm font-bold text-slate-800">No Session Data Yet</p>
                     <p className="text-[10px] text-slate-500">Active Service Plan is not being tracked</p>
                   </div>
                 </div>
                 <button onClick={() => setActiveTab('notes')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Start Note</button>
               </div>
             )}
             {reviewDueSoon && (
               <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                 <div className="flex items-center gap-3">
                   <Calendar size={16} className="text-amber-500" />
                   <div>
                     <p className="text-sm font-bold text-slate-800">Service Plan Review Soon</p>
                     <p className="text-[10px] text-slate-500">Scheduled for {activePlan.reviewDate}</p>
                   </div>
                 </div>
                 <button onClick={onOpenServicePlan} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Manage</button>
               </div>
             )}
           </div>
         </div>
       )}

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Supervision Ring */}
         <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck size={14} strokeWidth={1.5} /> Supervision
             </h3>
             {isCompliant ? (
                <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">Compliant</div>
             ) : (
                <div className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold">{Math.max(0, requiredSupervision - supervisionHours).toFixed(1)} hrs needed</div>
             )}
           </div>
           <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90">
                   <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                   <circle 
                       cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" 
                       strokeDasharray={201} 
                       strokeDashoffset={201 - (Math.min(compliancePct, 100) / 100) * 201}
                       strokeLinecap="round"
                       className={`${isCompliant ? 'text-emerald-500' : 'text-indigo-500'} transition-all`} 
                   />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col">
                   <span className="text-sm font-bold text-slate-900">{compliancePct.toFixed(0)}%</span>
                 </div>
              </div>
              <div className="space-y-2 flex-1">
                 <div className="flex justify-between text-xs"><span className="text-slate-500">Therapy Hrs</span><span className="font-bold">{therapyHours.toFixed(1)}</span></div>
                 <div className="flex justify-between text-xs"><span className="text-slate-500">Supervision</span><span className="font-bold text-indigo-600">{supervisionHours.toFixed(1)}</span></div>
                 <div className="w-full h-px bg-slate-100 my-1"></div>
                 <div className="flex justify-between text-xs"><span className="text-slate-500">Target (5%)</span><span className="font-bold text-slate-400">{requiredSupervision.toFixed(2)}</span></div>
              </div>
           </div>
         </div>

         {/* Clinical Progress Preview */}
         {activePlan && (
           <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-200 transition-all" onClick={() => setActiveTab('data')}>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Activity size={14} strokeWidth={1.5} /> Progress Snapshot
               </h3>
               <ChevronRight size={16} className="text-slate-300" />
             </div>
             <div className="space-y-3">
               {(() => {
                 const activePrograms = activePlan.categories.flatMap(c => c.programs).filter(p => p.status === 'active');
                 const programsWithData = activePrograms.map(program => {
                    const notes = [...(client.sessionNotes || [])].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    let latestVal: any = null;
                    for (let i = notes.length - 1; i >= 0; i--) {
                       const pd = notes[i].programData?.find(p => p.programId === program.id);
                       if (pd) {
                          if (pd.measurementType === 'percentage') {
                             latestVal = (pd.value?.total > 0 ? Math.round((pd.value.correct / pd.value.total) * 100) : 0) + '%';
                          } else if (pd.measurementType === 'task_analysis') {
                             const steps = Object.values(pd.value || {});
                             const ind = steps.filter(s => s === 'independent').length;
                             latestVal = (steps.length > 0 ? Math.round((ind / steps.length) * 100) : 0) + '%';
                          } else {
                             latestVal = pd.value;
                          }
                          break;
                       }
                    }
                    return { program, latestVal };
                 }).filter(p => p.latestVal !== null).slice(0, 3);

                 if (programsWithData.length === 0) return <div className="text-xs text-slate-400 italic py-2">No data recorded yet.</div>;
                 return programsWithData.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                     <div className="flex-1 truncate pr-2">
                       <p className="text-xs font-bold text-slate-800 truncate">{item.program.name}</p>
                     </div>
                     <div className="font-bold text-indigo-700 text-sm bg-white px-2.5 py-1 rounded-md shadow-sm border border-indigo-50">{item.latestVal}</div>
                   </div>
                 ));
               })()}
             </div>
           </div>
         )}
       </div>

       {/* AI Progress Summary */}
       <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-2xl border border-indigo-100 p-5 shadow-sm">
         <div className="flex justify-between items-center mb-4">
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
             </div>
         ) : summary ? (
             <div className="space-y-4 animate-scale-in">
                 <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                     <div className="text-[10px] font-bold text-emerald-700 uppercase mb-2">Key Achievements</div>
                     <ul className="space-y-1.5">
                         {summary.achievements.map((item, idx) => (
                             <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                                 <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                                 {item}
                             </li>
                         ))}
                     </ul>
                 </div>
                 <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                     <div className="text-[10px] font-bold text-amber-700 uppercase mb-2">Areas for Focus</div>
                     <ul className="space-y-1.5">
                         {summary.areasForFocus.map((item, idx) => (
                             <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                                 {item}
                             </li>
                         ))}
                     </ul>
                 </div>
             </div>
         ) : (
             <div className="text-center py-4 text-xs text-slate-500 italic">
                 Click generate to analyze recent session logs and outcomes using AI.
             </div>
         )}
       </div>

       {/* Schedule & History */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
               <Calendar size={14} strokeWidth={1.5} /> Upcoming Sessions
           </h3>
           <div className="space-y-2">
               {upcomingEvents.length > 0 ? upcomingEvents.map(evt => (
                   <div key={evt.id} className="flex gap-3 items-start p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                       <div className="flex flex-col items-center min-w-[3rem] p-1 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{evt.start.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-sm font-bold text-slate-900">{evt.start.getDate()}</span>
                       </div>
                       <div>
                           <div className="text-xs font-bold text-slate-900">{evt.title}</div>
                           <div className="text-[10px] text-slate-500 mt-0.5"><Clock size={10} className="inline mr-1" />{evt.start.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})} - {evt.end.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</div>
                       </div>
                   </div>
               )) : <div className="text-xs text-slate-400 italic">No upcoming sessions.</div>}
           </div>
         </div>
         <div>
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
               <History size={14} strokeWidth={1.5} /> Recent Sessions
           </h3>
           <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
               {pastEvents.length > 0 ? pastEvents.map(evt => (
                   <div key={evt.id} className="relative">
                       <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white"></div>
                       <div className="flex flex-col gap-1">
                            <div className="text-xs font-bold text-slate-700">{evt.title}</div>
                            <div className="text-[10px] text-slate-500">{evt.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {evt.serviceType}</div>
                       </div>
                   </div>
               )) : <div className="text-xs text-slate-400 italic">No past sessions.</div>}
           </div>
         </div>
       </div>
    </div>
  );

  const renderServicePlan = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
         <div>
           <h3 className="text-lg font-bold text-slate-900">Active Service Plan</h3>
           {planToDisplay ? (
             <p className="text-sm text-slate-500 mt-1">Status: <span className="font-bold text-slate-700 capitalize">{planToDisplay.status}</span> • Review Date: {planToDisplay.reviewDate || 'Not set'}</p>
           ) : (
             <p className="text-sm text-slate-500 mt-1">No active plan for this client.</p>
           )}
         </div>
         <button onClick={onOpenServicePlan} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">
           {planToDisplay ? 'Manage Plan' : 'Create Plan'}
         </button>
      </div>

      {planToDisplay && (
        <div className="space-y-4">
           {planToDisplay.categories.map(cat => (
             <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h4 className="font-bold text-slate-800">{cat.name}</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {cat.programs.length === 0 ? (
                    <div className="p-4 text-sm text-slate-400 italic">No programs in this category.</div>
                  ) : (
                    cat.programs.map(p => (
                      <div key={p.id} className="p-4 flex items-center justify-between">
                         <div>
                           <p className="text-sm font-bold text-slate-900">{p.name}</p>
                           <p className="text-xs text-slate-500 mt-0.5 capitalize">{p.type.replace('_', ' ')} • {p.measurement.type.replace('_', ' ')}</p>
                         </div>
                         <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                           p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                           p.status === 'mastered' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                         }`}>
                           {p.status}
                         </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );

  const renderNotes = () => (
    <div className="space-y-6 animate-fade-in">
       <div className="flex justify-between items-center">
         <h3 className="text-lg font-bold text-slate-900">Session Notes</h3>
         <button onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'note' })} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700">
           <FilePlus2 size={16} /> New Note
         </button>
       </div>
       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         {(!client.sessionNotes || client.sessionNotes.length === 0) ? (
            <div className="p-8 text-center text-sm text-slate-400">No session notes recorded yet.</div>
         ) : (
            <div className="divide-y divide-slate-100">
              {[...client.sessionNotes].sort((a,b) => b.date.localeCompare(a.date)).map(note => (
                <button
                  key={note.id}
                  onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'note', noteId: note.id })}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-slate-800">{note.date}</div>
                    {note.status === 'Completed' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 size={10} /> Completed</span>
                    ) : note.status === 'Pending Review' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Clock size={10} /> Pending Review</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200"><FileText size={10} /> Draft</span>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              ))}
            </div>
         )}
       </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
         <h3 className="text-lg font-bold text-slate-900">Clinical Documents</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <button onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'doc', doc: { type: 'FBA', clientName: client.name, date: new Date().toISOString().split('T')[0] } })} className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left">
           <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><ClipboardList size={20} /></div>
           <div>
             <div className="text-sm font-bold text-slate-900">Functional Behavior Assessment</div>
             <div className="text-[10px] text-slate-500 mt-0.5">Start new FBA draft</div>
           </div>
         </button>
         <button onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'doc', doc: { type: 'Parent Training', clientName: client.name, date: new Date().toISOString().split('T')[0] } })} className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left">
           <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><Users size={20} /></div>
           <div>
             <div className="text-sm font-bold text-slate-900">Parent Training Log</div>
             <div className="text-[10px] text-slate-500 mt-0.5">Record caregiver session</div>
           </div>
         </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
         <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">Saved Documents</div>
         {(!client.assessments?.length && !client.parentTrainingLogs?.length) ? (
            <div className="p-8 text-center text-sm text-slate-400 italic">No saved documents.</div>
         ) : (
            <div className="divide-y divide-slate-100">
               {client.assessments?.map(doc => (
                 <button key={doc.id} onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'doc', doc: { type: 'FBA', id: doc.id, clientName: client.name, date: doc.date } })} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left">
                    <div>
                      <div className="text-sm font-bold text-slate-800">FBA • {doc.date}</div>
                      <div className="text-xs text-slate-500">{doc.status}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                 </button>
               ))}
               {client.parentTrainingLogs?.map(doc => (
                 <button key={doc.id} onClick={() => onNavigateToNotes?.({ clientId: client.id, screen: 'doc', doc: { type: 'Parent Training', id: doc.id, clientName: client.name, date: doc.date } })} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Parent Training • {doc.date}</div>
                      <div className="text-xs text-slate-500">{doc.attendees.join(', ')}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                 </button>
               ))}
            </div>
         )}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      
      <div className="fixed inset-4 md:inset-10 bg-white rounded-2xl shadow-2xl z-50 flex overflow-hidden animate-scale-in">
         {/* Left Sidebar (Identity & Nav) */}
         <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col">
            <div className="p-6 relative pb-8 border-b border-slate-200">
               <button onClick={onClose} className="absolute top-4 right-4 p-1.5 bg-white/50 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                  <X size={16} strokeWidth={2} />
               </button>
               
               <div className="flex flex-col items-center text-center mt-4">
                  {client.imageUrl ? (
                    <img src={client.imageUrl} alt={client.name} className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white mb-4" />
                  ) : (
                    <div className={`w-24 h-24 rounded-full ${client.color} border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold ${client.textColor} mb-4`}>
                      {client.avatar}
                    </div>
                  )}
                  <h2 className="text-xl font-serif font-bold text-slate-900">{client.name}</h2>
                  <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mt-2 inline-block ${
                    client.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {client.status}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">{client.diagnosis || 'Diagnosis pending'}</p>
               </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
               {(['overview', 'servicePlan', 'data', 'notes', 'documents'] as WorkspaceTab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                       activeTab === tab 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                 >
                    {tab === 'overview' && 'Overview'}
                    {tab === 'servicePlan' && 'Service Plan'}
                    {tab === 'data' && 'Data & Progress'}
                    {tab === 'notes' && 'Session Notes'}
                    {tab === 'documents' && 'Documents'}
                    
                    {tab === 'notes' && pendingNotes.length > 0 && (
                       <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeTab === tab ? 'bg-indigo-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                         {pendingNotes.length}
                       </span>
                    )}
                 </button>
               ))}
            </nav>
            
            <div className="p-4 border-t border-slate-200">
               <button onClick={onEdit} className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                  Edit Client Profile
               </button>
            </div>
         </div>

         {/* Main Content Area */}
         <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8">
            <div className="max-w-4xl mx-auto">
               {activeTab === 'overview' && renderOverview()}
               {activeTab === 'servicePlan' && renderServicePlan()}
               {activeTab === 'data' && (
                 <div className="animate-fade-in">
                   <ClinicalProgress clients={[client]} servicePlans={servicePlans} preselectedClientId={client.id} hideHeader={true} />
                 </div>
               )}
               {activeTab === 'notes' && renderNotes()}
               {activeTab === 'documents' && renderDocuments()}
            </div>
         </div>
      </div>
    </>
  );
};
