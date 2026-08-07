import React from 'react';
import { ArrowLeft, FilePlus2, ClipboardList, Users, ChevronRight, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Client, SessionNote } from '../../types';

interface ClientNotesListProps {
  client: Client;
  onBack: () => void;
  onNewNote: () => void;
  onOpenNote: (note: SessionNote) => void;
  onNewFba: () => void;
  onNewParentTraining: () => void;
}

const statusBadge = (status: SessionNote['status']) => {
  switch (status) {
    case 'Completed':
      return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 size={10} /> Completed</span>;
    case 'Pending Review':
      return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Clock size={10} /> Pending Review</span>;
    default:
      return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200"><FileText size={10} /> Draft</span>;
  }
};

/**
 * Bridge screen between the Notes landing page and the actual editors. Lists a
 * single client's session notes (and gives access to the two document types)
 * so a BCBA can find drafts / pending-review notes rather than only ever
 * starting a new one.
 */
export const ClientNotesList: React.FC<ClientNotesListProps> = ({ client, onBack, onNewNote, onOpenNote, onNewFba, onNewParentTraining }) => {
  const notes = [...(client.sessionNotes || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> Back to Notes
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${client.color} ${client.textColor}`}>
              {client.avatar}
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-slate-900">{client.name}</h1>
              <p className="text-xs text-slate-400">{client.diagnosis || 'Diagnosis pending'}</p>
            </div>
          </div>
          <button onClick={onNewNote} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-sm shadow-sm">
            <FilePlus2 size={16} /> New Session Note
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onNewFba} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all text-left">
            <ClipboardList size={18} className="text-slate-400" />
            <div>
              <div className="text-sm font-bold text-slate-800">New FBA</div>
              <div className="text-[10px] text-slate-400">Functional Behavior Assessment</div>
            </div>
          </button>
          <button onClick={onNewParentTraining} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all text-left">
            <Users size={18} className="text-slate-400" />
            <div>
              <div className="text-sm font-bold text-slate-800">Log Parent Training</div>
              <div className="text-[10px] text-slate-400">Caregiver session</div>
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Session Notes</h2>
          </div>
          {notes.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No session notes yet for {client.name}.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notes.map(note => (
                <button
                  key={note.id}
                  onClick={() => onOpenNote(note)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-slate-800">{note.date}</div>
                    {statusBadge(note.status)}
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
