import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Client, Assessment, ParentTrainingLog } from '../../types';
import { useAutoSave } from '../../hooks/useAutoSave';

export type DocContext = { docType: 'FBA' | 'ParentTraining'; docId?: string };

interface DocumentEditorProps {
  client: Client;
  context: DocContext;
  docToEdit?: Assessment | ParentTrainingLog | null;
  onSaveAssessment: (clientId: string, doc: Omit<Assessment, 'id'> & { id?: string }) => void;
  onSaveParentTraining: (clientId: string, doc: Omit<ParentTrainingLog, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

const RecoveryBanner: React.FC<{ onResume: () => void; onDiscard: () => void }> = ({ onResume, onDiscard }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
      <h3 className="text-lg font-serif font-bold text-slate-900">Unsaved Draft Found</h3>
      <p className="mt-2 text-sm text-slate-500">We found an unsaved draft for this document. Resume or discard it.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onDiscard} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl text-sm">Discard</button>
        <button onClick={onResume} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-sm">Resume Draft</button>
      </div>
    </div>
  </div>
);

const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all";
const labelCls = "block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5";

const blankFba = () => ({
  date: new Date().toISOString().split('T')[0],
  summary: '', targetBehavior: '', antecedent: '', consequence: '', hypothesizedFunction: '',
});

const blankParentTraining = (client: Client) => ({
  date: new Date().toISOString().split('T')[0],
  attendees: client.guardian?.name || '',
  topics: '', caregiverResponse: '',
});

/**
 * Handles the two lightweight clinical documents ported from aba_tool_genie:
 * a Functional Behavior Assessment (FBA) summary and a Parent Training log.
 * Both share the same draft-recovery-on-mount + autosave-while-editing pattern
 * used by DataCollection.tsx, backed by the workspace's shared useAutoSave hook.
 */
export const DocumentEditor: React.FC<DocumentEditorProps> = ({ client, context, docToEdit, onSaveAssessment, onSaveParentTraining, onCancel }) => {
  const DRAFT_KEY = `bcba_doc_draft_${client.id}_${context.docType}_${context.docId || 'new'}`;

  const initialFormData = () => {
    if (docToEdit && context.docType === 'FBA') {
      const a = docToEdit as Assessment;
      return { id: a.id, date: a.date, summary: a.summary, targetBehavior: a.targetBehavior, antecedent: a.antecedent, consequence: a.consequence, hypothesizedFunction: a.hypothesizedFunction };
    }
    if (docToEdit && context.docType === 'ParentTraining') {
      const p = docToEdit as ParentTrainingLog;
      return { id: p.id, date: p.date, attendees: p.attendees.join(', '), topics: p.topics, caregiverResponse: p.caregiverResponse };
    }
    return context.docType === 'FBA' ? blankFba() : blankParentTraining(client);
  };

  const [formData, setFormData] = useState<any>(initialFormData);
  const [showRecovery, setShowRecovery] = useState<any>(null);

  useEffect(() => {
    try {
      const draftJson = localStorage.getItem(DRAFT_KEY);
      if (draftJson) setShowRecovery(JSON.parse(draftJson));
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status: saveStatus, lastSaved } = useAutoSave(DRAFT_KEY, formData);

  const handleResume = () => {
    setFormData(showRecovery);
    setShowRecovery(null);
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowRecovery(null);
    setFormData(initialFormData());
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (context.docType === 'FBA') {
      onSaveAssessment(client.id, { ...formData, type: 'FBA' } as Omit<Assessment, 'id'> & { id?: string });
    } else {
      onSaveParentTraining(client.id, {
        ...formData,
        attendees: String(formData.attendees).split(',').map((s: string) => s.trim()).filter(Boolean),
      } as Omit<ParentTrainingLog, 'id'> & { id?: string });
    }
    localStorage.removeItem(DRAFT_KEY);
  };

  const SaveStatusIndicator = () => {
    if (saveStatus === 'saving') return <span className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-500"><Loader2 size={12} className="animate-spin" /> Saving draft...</span>;
    if (saveStatus === 'error') return <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500"><AlertTriangle size={12} /> Draft not saved</span>;
    return <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 size={12} /> Draft saved {lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>;
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      {showRecovery && <RecoveryBanner onResume={handleResume} onDiscard={handleDiscard} />}
      <div className="max-w-3xl mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft size={14} /> Back to {client.name}'s Notes
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-serif font-bold text-slate-900 mb-6">
            {context.docType === 'FBA' ? 'Functional Behavior Assessment' : 'Parent Training Log'}
            <span className="text-sm text-slate-400 font-medium ml-2">for {client.name}</span>
          </h2>

          {context.docType === 'FBA' ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Assessment Date</label>
                <input type="date" value={formData.date || ''} onChange={e => handleChange('date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Target Behavior</label>
                <input type="text" value={formData.targetBehavior || ''} onChange={e => handleChange('targetBehavior', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Antecedent Events</label>
                <textarea value={formData.antecedent || ''} onChange={e => handleChange('antecedent', e.target.value)} className={inputCls} rows={3} />
              </div>
              <div>
                <label className={labelCls}>Consequences</label>
                <textarea value={formData.consequence || ''} onChange={e => handleChange('consequence', e.target.value)} className={inputCls} rows={3} />
              </div>
              <div>
                <label className={labelCls}>Hypothesized Function</label>
                <input type="text" value={formData.hypothesizedFunction || ''} onChange={e => handleChange('hypothesizedFunction', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Summary</label>
                <textarea value={formData.summary || ''} onChange={e => handleChange('summary', e.target.value)} className={inputCls} rows={4} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Training Date</label>
                <input type="date" value={formData.date || ''} onChange={e => handleChange('date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Attendees (comma-separated)</label>
                <input type="text" value={formData.attendees || ''} onChange={e => handleChange('attendees', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Topics Covered / Skills Taught</label>
                <textarea value={formData.topics || ''} onChange={e => handleChange('topics', e.target.value)} className={inputCls} rows={4} />
              </div>
              <div>
                <label className={labelCls}>Caregiver Response &amp; Performance</label>
                <textarea value={formData.caregiverResponse || ''} onChange={e => handleChange('caregiverResponse', e.target.value)} className={inputCls} rows={4} />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center gap-4 pt-6 mt-6 border-t border-slate-100">
            <SaveStatusIndicator />
            <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 font-bold text-sm shadow-sm">
              Save Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
