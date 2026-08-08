import React, { useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert, AlertCircle, ChevronDown, ChevronUp, ChevronRight, FileText, Sparkles } from 'lucide-react';
import { AppState, Client } from '../../types';
import { deriveClinicalAttention, AttentionPriority, AttentionItemType } from '../../utils/clinicalAttention';

interface NeedsMyAttentionPanelProps {
  appState: AppState;
  onOpenNote: (client: Client, noteId: string) => void;
  onOpenClientWorkspace: (client: Client, tab?: 'overview' | 'servicePlan' | 'data') => void;
}

export const NeedsMyAttentionPanel: React.FC<NeedsMyAttentionPanelProps> = ({
  appState,
  onOpenNote,
  onOpenClientWorkspace,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterType, setFilterType] = useState<'all' | AttentionItemType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | AttentionPriority>('all');

  const attention = useMemo(() => deriveClinicalAttention(appState), [appState]);

  const filteredItems = useMemo(() => {
    return attention.items.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
      return true;
    });
  }, [attention.items, filterType, filterPriority]);

  if (attention.items.length === 0) {
    return (
      <div className="mx-8 mt-6 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between text-emerald-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Caseload Status</h3>
            <p className="text-xs font-medium text-emerald-700 mt-0.5">All clear across your caseload! No pending reviews or overdue plans.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-8 mt-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all">
      {/* Header bar */}
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-serif font-bold text-slate-900">Needs My Attention</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                {attention.items.length} {attention.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Cross-caseload priorities requiring BCBA action</p>
          </div>
        </div>

        {/* Priority Counts & Collapse Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            {attention.highCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                {attention.highCount} High
              </span>
            )}
            {attention.mediumCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                {attention.mediumCount} Medium
              </span>
            )}
            {attention.lowCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600">
                {attention.lowCount} Low
              </span>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Type:</span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                All ({attention.items.length})
              </button>
              <button
                onClick={() => setFilterType('pending_note')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === 'pending_note' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Notes ({attention.pendingNotesCount})
              </button>
              <button
                onClick={() => setFilterType('service_plan_review')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === 'service_plan_review' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Service Plans ({attention.servicePlanReviewsCount})
              </button>
              <button
                onClick={() => setFilterType('program_no_data')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === 'program_no_data' || filterType === 'program_stale_data' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Programs ({attention.staleOrNoDataCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Priority:</span>
              <button
                onClick={() => setFilterPriority('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterPriority === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterPriority('high')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterPriority === 'high' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
              >
                High
              </button>
              <button
                onClick={() => setFilterPriority('medium')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterPriority === 'medium' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
              >
                Medium
              </button>
              <button
                onClick={() => setFilterPriority('low')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filterPriority === 'low' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Low
              </button>
            </div>
          </div>

          {/* Item List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredItems.map(item => {
              const isHigh = item.priority === 'high';
              const isMed = item.priority === 'medium';

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                    isHigh
                      ? 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50'
                      : isMed
                      ? 'bg-amber-50/30 border-amber-200/70 hover:bg-amber-50/60'
                      : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      item.type === 'pending_note'
                        ? 'bg-indigo-100 text-indigo-700'
                        : item.type === 'service_plan_review'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.type === 'pending_note' && <FileText size={16} />}
                      {item.type === 'service_plan_review' && <ShieldAlert size={16} />}
                      {(item.type === 'program_no_data' || item.type === 'program_stale_data') && <AlertCircle size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isHigh ? 'bg-rose-100 text-rose-800' : isMed ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.priority}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    {item.type === 'pending_note' && (
                      <button
                        onClick={() => onOpenNote(item.client, item.noteId!)}
                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        Review <ChevronRight size={14} />
                      </button>
                    )}

                    {item.type === 'service_plan_review' && (
                      <button
                        onClick={() => onOpenClientWorkspace(item.client, 'servicePlan')}
                        className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        View Plan <ChevronRight size={14} />
                      </button>
                    )}

                    {(item.type === 'program_no_data' || item.type === 'program_stale_data') && (
                      <button
                        onClick={() => onOpenClientWorkspace(item.client, 'data')}
                        className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        View Data <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                No items match the selected filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
