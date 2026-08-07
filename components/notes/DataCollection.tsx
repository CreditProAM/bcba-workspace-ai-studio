import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
  Info,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Client, SessionNote, NoteStatus, ObservedBehavior, PromptLevel, User } from '../../types';
import { generateSessionNarrative } from '../../services/geminiService';
import { runDocumentationQA } from '../../services/complianceEngine';
import { useAutoSave } from '../../hooks/useAutoSave';
import { DEFAULT_QA_RULES } from '../../constants';

const PROMPT_LEVELS: PromptLevel[] = ['None', 'Verbal', 'Gestural', 'Modeling', 'Partial Physical', 'Full Physical'];

interface DataCollectionProps {
  client: Client;
  noteToEdit: SessionNote | null;
  currentUser: User;
  onSave: (clientId: string, note: Omit<SessionNote, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  addToast: (title: string, message: string) => void;
}

const RecoveryBanner: React.FC<{ onResume: () => void; onDiscard: () => void }> = ({ onResume, onDiscard }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
      <h3 className="text-lg font-serif font-bold text-slate-900">Unsaved Draft Found</h3>
      <p className="mt-2 text-sm text-slate-500">
        We found an unsaved draft for this note. Resume where you left off, or discard it and start fresh.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onDiscard} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl text-sm">Discard</button>
        <button onClick={onResume} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-sm">Resume Draft</button>
      </div>
    </div>
  </div>
);

const AIEthicsNote: React.FC = () => (
  <div className="mt-2 flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
    <Info size={14} className="shrink-0 mt-0.5" />
    <p className="text-xs">
      AI-generated text is a starting draft grounded only in the data entered above. It must be reviewed,
      edited, and verified for clinical accuracy before this note is completed.
    </p>
  </div>
);

const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed";
const labelCls = "block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5";

export const DataCollection: React.FC<DataCollectionProps> = ({ client, noteToEdit, currentUser, onSave, onCancel, addToast }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'skills' | 'behaviors' | 'narrative'>('details');
  const isReviewMode = noteToEdit?.status === 'Pending Review' && currentUser.role === 'BCBA';

  const DRAFT_KEY = `bcba_note_draft_${client.id}_${noteToEdit?.id || 'new'}`;

  const blankNote = useCallback((): Omit<SessionNote, 'id'> => ({
    clientId: client.id,
    date: new Date().toISOString().split('T')[0],
    authorId: currentUser.id,
    status: 'Draft',
    goalsAddressed: [],
    goalTallies: {},
    interventions: [],
    promptLevels: {},
    observedBehaviors: [],
    environmentalFactors: '',
    rawNotes: '',
    narrative: '',
  }), [client.id, currentUser.id]);

  const [note, setNote] = useState<Omit<SessionNote, 'id'> & { id?: string }>(() => noteToEdit || blankNote());
  const [showRecovery, setShowRecovery] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // One-time recovery check on mount -- distinct from the ongoing autosave below.
  useEffect(() => {
    if (noteToEdit) return; // Only offer recovery for brand-new, unsaved notes
    try {
      const draftJson = localStorage.getItem(DRAFT_KEY);
      if (draftJson) setShowRecovery(JSON.parse(draftJson));
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ongoing draft persistence uses the app's shared autosave hook rather than a
  // one-off setTimeout/localStorage implementation.
  const { status: saveStatus, lastSaved } = useAutoSave(DRAFT_KEY, note);

  const update = (updater: React.SetStateAction<typeof note>) => setNote(updater);

  const handleResume = () => {
    setNote(showRecovery);
    setShowRecovery(null);
    addToast('Draft Restored', 'Your unsaved note has been recovered.');
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowRecovery(null);
  };

  const handleField = (field: keyof typeof note, value: any) => {
    update(prev => ({ ...prev, [field]: value }));
  };

  const handleGoalTally = (goal: string, value: number) => {
    update(prev => ({ ...prev, goalTallies: { ...prev.goalTallies, [goal]: value } }));
  };

  const handlePromptLevel = (goal: string, value: PromptLevel) => {
    update(prev => ({ ...prev, promptLevels: { ...prev.promptLevels, [goal]: value } }));
  };

  const handleObservedBehavior = (behaviorId: string, field: keyof ObservedBehavior, value: any) => {
    update(prev => {
      const existing = prev.observedBehaviors || [];
      let found = false;
      const updated = existing.map(b => {
        if (b.behaviorId === behaviorId) { found = true; return { ...b, [field]: value }; }
        return b;
      });
      if (!found) updated.push({ behaviorId, frequency: 0, duration: 0, intensity: 'mild', [field]: value });
      return { ...prev, observedBehaviors: updated };
    });
  };

  const handleInterventionsToggle = (name: string) => {
    update(prev => {
      const has = prev.interventions.includes(name);
      return { ...prev, interventions: has ? prev.interventions.filter(i => i !== name) : [...prev.interventions, name] };
    });
  };

  const handleGenerateNarrative = async () => {
    setIsGenerating(true);
    const narrative = await generateSessionNarrative(note, client, currentUser.name);
    if (narrative) {
      handleField('narrative', narrative);
    } else {
      addToast('Narrative Generation Failed', 'Gemini did not return a draft. You can still write the narrative manually.');
    }
    setIsGenerating(false);
  };

  // RBT-authored notes go up for BCBA review; a BCBA writing/reviewing a note signs it off directly.
  const nextStatus: NoteStatus = isReviewMode || currentUser.role === 'BCBA' ? 'Completed' : 'Pending Review';

  const goalsAddressed = useMemo(
    () => Object.entries(note.goalTallies).filter(([, count]) => (Number(count) || 0) > 0).map(([goal]) => goal),
    [note.goalTallies]
  );

  // Live documentation QA feedback -- see services/complianceEngine.ts. This is a
  // documentation-quality check, not a payer/billing compliance determination.
  const qaIssues = useMemo(
    () => runDocumentationQA({ ...note, goalsAddressed }, DEFAULT_QA_RULES, nextStatus),
    [note, goalsAddressed, nextStatus]
  );
  const qaErrors = qaIssues.filter(i => i.severity === 'ERROR');
  const qaWarnings = qaIssues.filter(i => i.severity === 'WARNING');

  const handleSave = () => {
    if (!note.date) {
      addToast('Missing Date', 'Please set a session date before saving.');
      return;
    }
    if (qaErrors.length > 0) {
      addToast('Documentation Incomplete', qaErrors.map(e => e.message).join(' '));
      return;
    }

    onSave(client.id, { ...note, goalsAddressed, status: nextStatus });
    localStorage.removeItem(DRAFT_KEY);
  };

  const SaveStatusIndicator = () => {
    if (saveStatus === 'saving') return <span className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-500"><Loader2 size={12} className="animate-spin" /> Saving draft...</span>;
    if (saveStatus === 'error') return <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500"><AlertTriangle size={12} /> Draft not saved</span>;
    return <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 size={12} /> Draft saved {lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>;
  };

  const goals = client.goals || [];
  const targetBehaviors = client.targetBehaviors || [];
  const interventionOptions = client.interventions || [];

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      {showRecovery && <RecoveryBanner onResume={handleResume} onDiscard={handleDiscard} />}
      <div className="max-w-5xl mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft size={14} /> Back to {client.name}'s Notes
        </button>

        {isReviewMode && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="font-bold text-amber-800 text-sm">Note Pending Review</h3>
            <p className="text-xs text-amber-700 mt-1">
              This note was drafted by an RBT. Review the data, refine the narrative, and save to sign off as complete.
            </p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="border-b border-slate-200 -mx-6 px-6">
              <nav className="flex gap-6 overflow-x-auto">
                {(['details', 'skills', 'behaviors', 'narrative'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                  >
                    {tab === 'details' ? 'Details' : tab === 'skills' ? 'Skill Acquisition' : tab === 'behaviors' ? 'Observed Behaviors' : 'Narrative'}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-6">
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" value={note.date} onChange={e => handleField('date', e.target.value)} className={inputCls} disabled={isReviewMode} />
                  </div>
                  <div>
                    <label className={labelCls}>Provider</label>
                    <input type="text" value={currentUser.name} readOnly className={`${inputCls} bg-slate-100`} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Interventions Used</label>
                    <div className="flex flex-wrap gap-2">
                      {interventionOptions.length === 0 && <p className="text-xs text-slate-400">No interventions defined for this client yet.</p>}
                      {interventionOptions.map(i => (
                        <button
                          type="button"
                          key={i}
                          disabled={isReviewMode}
                          onClick={() => handleInterventionsToggle(i)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${note.interventions.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'skills' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700">Skill Acquisition</h3>
                  {goals.length === 0 && <p className="text-sm text-slate-400">No goals defined for this client yet -- add goals from the Caseload profile.</p>}
                  {goals.map(goal => (
                    <div key={goal} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="md:col-span-3 text-sm font-bold text-slate-700">{goal}</label>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Trials/Freq.</label>
                        <input type="number" min={0} value={note.goalTallies[goal] || 0} onChange={e => handleGoalTally(goal, Number(e.target.value))} className={inputCls} disabled={isReviewMode} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Prompt Level</label>
                        <select value={note.promptLevels[goal] || 'None'} onChange={e => handlePromptLevel(goal, e.target.value as PromptLevel)} className={inputCls} disabled={isReviewMode}>
                          {PROMPT_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'behaviors' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700">Observed Behaviors</h3>
                  {targetBehaviors.length === 0 && <p className="text-sm text-slate-400">No target behaviors defined for this client yet.</p>}
                  {targetBehaviors.map(b => {
                    const observed = note.observedBehaviors.find(ob => ob.behaviorId === b.id);
                    return (
                      <div key={b.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-3 text-sm font-bold text-slate-800">{b.name}</div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Frequency</label>
                          <input type="number" min={0} value={observed?.frequency || 0} onChange={e => handleObservedBehavior(b.id, 'frequency', Number(e.target.value))} className={inputCls} disabled={isReviewMode} />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Duration (min)</label>
                          <input type="number" min={0} value={observed?.duration || 0} onChange={e => handleObservedBehavior(b.id, 'duration', Number(e.target.value))} className={inputCls} disabled={isReviewMode} />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Highest Intensity</label>
                          <select value={observed?.intensity || 'mild'} onChange={e => handleObservedBehavior(b.id, 'intensity', e.target.value)} className={inputCls} disabled={isReviewMode}>
                            <option value="mild">Mild</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'narrative' && (
                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>Environmental / Context Factors</label>
                    <textarea value={note.environmentalFactors} onChange={e => handleField('environmentalFactors', e.target.value)} rows={2} className={inputCls} placeholder="Setting, unusual events, who was present..." disabled={isReviewMode} />
                  </div>
                  <div>
                    <label className={labelCls}>Raw Notes / Observations</label>
                    <textarea value={note.rawNotes} onChange={e => handleField('rawNotes', e.target.value)} rows={6} className={inputCls} placeholder="e.g., Client independently manded for juice x3..." readOnly={isReviewMode} />
                  </div>
                  <div>
                    <button
                      onClick={handleGenerateNarrative}
                      disabled={isGenerating || !note.rawNotes}
                      className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 px-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 font-bold text-sm"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isGenerating ? 'Generating...' : 'Generate AI Narrative Draft'}
                    </button>
                    <AIEthicsNote />
                  </div>
                  {note.narrative && (
                    <div>
                      <label className={labelCls}>Narrative (editable)</label>
                      <textarea value={note.narrative} onChange={e => handleField('narrative', e.target.value)} rows={8} className={inputCls} />
                      <AIEthicsNote />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-1/3 space-y-4">
            <div className="lg:sticky lg:top-8 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
                  <ShieldCheck size={16} className="text-indigo-500" /> Documentation QA
                </h3>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Checks note completeness only -- not a guarantee of payer/billing compliance.
                </p>
                {qaIssues.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                    <CheckCircle2 size={16} /> Looks complete
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qaErrors.map(issue => (
                      <div key={issue.ruleId} className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-medium">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {issue.message}
                      </div>
                    ))}
                    {qaWarnings.map(issue => (
                      <div key={issue.ruleId} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-xs font-medium">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <SaveStatusIndicator />
                <button
                  onClick={handleSave}
                  disabled={qaErrors.length > 0}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-4 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-sm"
                >
                  <Save size={16} />
                  {isReviewMode ? 'Approve & Sign Note' : (noteToEdit ? 'Update Note' : 'Save Note')}
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Notes save into this client's record and are versioned through the workspace's
                  undo/redo history, same as scheduling changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
