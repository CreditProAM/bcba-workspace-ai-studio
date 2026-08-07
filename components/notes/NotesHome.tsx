import React, { useMemo, useState } from 'react';
import { NotebookPen, Search, ChevronRight } from 'lucide-react';
import { Client, CalendarEvent } from '../../types';

interface NotesHomeProps {
  clients: Client[];
  events: CalendarEvent[];
  onSelectClient: (client: Client) => void;
}

/**
 * Notes landing view. Session documentation lives on the client (Client -> Notes tab
 * inside ClientProfilePanel, built out in a later phase); this screen is the
 * caseload-driven entry point into that workflow, per the "open the workspace and
 * know what to do" UX principle: recent/upcoming sessions surface first.
 */
export const NotesHome: React.FC<NotesHomeProps> = ({ clients, events, onSelectClient }) => {
  const [search, setSearch] = useState('');

  const now = new Date();
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
          <h1 className="text-2xl font-serif font-bold text-slate-900">Session Notes</h1>
          <p className="text-slate-500 font-medium mt-1">
            Select a client to document a session, review recent notes, or continue a draft.
          </p>
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
