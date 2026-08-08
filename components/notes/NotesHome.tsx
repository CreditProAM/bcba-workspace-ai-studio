import React, { useMemo, useState } from 'react';
import { NotebookPen, Search, ChevronRight, Clock, FileText, Filter, ArrowUpDown } from 'lucide-react';
import { Client, CalendarEvent, AppState } from '../../types';
import { deriveClinicalAttention } from '../../utils/clinicalAttention';

interface NotesHomeProps {
  clients: Client[];
  events: CalendarEvent[];
  appState?: AppState;
  onSelectClient: (client: Client) => void;
  onOpenNote?: (client: Client, noteId: string) => void;
}

/**
 * Notes landing view. Session documentation lives on the client; this screen is the
 * caseload-driven entry point into that workflow, featuring a cross-caseload
 * Pending Review queue for BCBAs to review pending session notes.
 */
export const NotesHome: React.FC<NotesHomeProps> = ({ clients, events, appState, onSelectClient, onOpenNote }) => {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');

  const now = new Date();

  // Derived cross-caseload clinical attention (Pending Notes queue)
  const attention = useMemo(() => {
    const state: AppState = appState || { clients, events };
    return deriveClinicalAttention(state, now);
  }, [appState, clients, events]);

  const pendingNotes = useMemo(() => {
    let items = attention.items.filter(i => i.type === 'pending_note');

    if (clientFilter !== 'ALL') {
      items = items.filter(i => i.clientId === clientFilter);
    }

    items.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    return items;
  }, [attention.items, clientFilter, sortOrder]);

  const upcoming = useMemo(() => {
    return events
      .filter(e => e.start >= now && e.serviceType === 'Direct 1:1')
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Session Notes & Reviews</h1>
          <p className="text-slate-500 font-medium mt-1">
            Review pending notes across your caseload, document sessions, or view client files.
          </p>
        </div>

        {/* Cross-Caseload Pending Review Queue */}
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-sm overflow-hidden">
          <div className="p-6 bg-amber-50/40 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pending BCBA Review Queue</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    {attention.pendingNotesCount} {attention.pendingNotesCount === 1 ? 'note' : 'notes'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Submitted session notes requiring supervisor review and sign-off</p>
              </div>
            </div>

            {/* Controls: Client Filter & Sort */}
            <div className="flex items-center gap-3 text-xs">
              {/* Client Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Clients ({attention.pendingNotesCount})</option>
                  {clients.map(c => {
                    const count = attention.items.filter(i => i.type === 'pending_note' && i.clientId === c.id).length;
                    if (count === 0) return null;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <ArrowUpDown size={13} className="text-slate-400" />
                <button
                  onClick={() => setSortOrder(prev => (prev === 'oldest' ? 'newest' : 'oldest'))}
                  className="text-xs font-medium text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  {sortOrder === 'oldest' ? 'Oldest First' : 'Newest First'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingNotes.map(item => {
              const isHigh = item.priority === 'high';
              return (
                <div key={item.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.client.color} ${item.client.textColor}`}>
                      {item.client.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{item.clientName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isHigh ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isHigh ? 'High (>48h)' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Clock size={12} className="text-slate-400" />
                        <span>Session Date: {item.timestamp || 'Undated'}</span>
                        {item.note?.goalsAddressed && item.note.goalsAddressed.length > 0 && (
                          <span className="text-slate-400">• {item.note.goalsAddressed.length} goals documented</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenNote ? onOpenNote(item.client, item.noteId!) : onSelectClient(item.client)}
                    className="shrink-0 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1"
                  >
                    Review Note <ChevronRight size={14} />
                  </button>
                </div>
              );
            })}

            {pendingNotes.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                {clientFilter === 'ALL'
                  ? 'No session notes pending review across your caseload.'
                  : 'No pending notes for the selected client.'}
              </div>
            )}
          </div>
        </div>

        {upcoming.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Upcoming Sessions</h2>
            <div className="space-y-2">
              {upcoming.map(e => {
                const client = clients.find(c => c.id === e.clientId);
                if (!client) return null;
                return (
                  <button
                    key={e.id}
                    onClick={() => onSelectClient(client)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${client.color} ${client.textColor}`}>
                        {client.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{client.name}</div>
                        <div className="text-xs text-slate-400">{e.start.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Caseload</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => onSelectClient(client)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${client.color} ${client.textColor}`}>
                    {client.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{client.name}</div>
                    <div className="text-xs text-slate-400">{client.diagnosis || 'Diagnosis pending'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <NotebookPen size={14} />
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">No clients match "{search}".</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
