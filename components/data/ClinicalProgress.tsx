import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Client, ServicePlan } from '../../types';
import { Activity, Target, CheckCircle2 } from 'lucide-react';
import { buildProgramSeries, formatProgramValue, isPercentageMeasurement, evaluateObjectiveCriterion, formatCriteriaLabel } from '../../utils/clinicalProgress';

interface ClinicalProgressProps {
  clients: Client[];
  servicePlans: ServicePlan[];
  preselectedClientId?: string;
  hideHeader?: boolean;
}

export const ClinicalProgress: React.FC<ClinicalProgressProps> = ({ clients, servicePlans, preselectedClientId, hideHeader }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);

  // Flatten active programs from the client's active service plan
  const activePrograms = useMemo(() => {
    if (!selectedClient) return [];
    const activePlan = servicePlans.find(p => p.clientId === selectedClient.id && p.status === 'active');
    if (!activePlan) return [];
    return activePlan.categories.flatMap(c => c.programs).filter(p => p.status === 'active');
  }, [selectedClient, servicePlans]);

  // Set default selected program when client changes
  useMemo(() => {
    if (activePrograms.length > 0 && (!selectedProgramId || !activePrograms.some(p => p.id === selectedProgramId))) {
      setSelectedProgramId(activePrograms[0].id);
    } else if (activePrograms.length === 0) {
      setSelectedProgramId('');
    }
  }, [activePrograms, selectedProgramId]);

  const selectedProgram = useMemo(() => activePrograms.find(p => p.id === selectedProgramId) || null, [activePrograms, selectedProgramId]);

  // Configured baseline reference (ClinicalProgram.baseline), kept entirely
  // separate from session-derived chartData below -- it is clinical context,
  // never plotted or treated as a session datapoint. When a program has
  // multiple baseline entries, the most recent one is shown as "the"
  // current baseline reference.
  const baselineReference = useMemo(() => {
    const points = selectedProgram?.baseline || [];
    if (points.length === 0) return null;
    const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const numericValue = Number(latest.value);
    if (isNaN(numericValue)) return null;
    return { date: latest.date, value: numericValue };
  }, [selectedProgram]);

  const formatBaselineDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Aggregate program data using the shared clinicalProgress utility so this
  // matches the math used everywhere else the same data is summarized.
  const chartData = useMemo(() => {
    if (!selectedClient || !selectedProgram) return [];
    const series = buildProgramSeries(selectedClient.sessionNotes || [], selectedProgram.id);
    return series.map(point => ({
      date: new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: point.value,
    }));
  }, [selectedClient, selectedProgram]);

  return (
    <div className={`bg-white ${hideHeader ? '' : 'rounded-2xl border border-slate-200 shadow-sm mt-8'} overflow-hidden`}>
      {!hideHeader && (
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity size={20} className="text-indigo-600" />
            Clinical Progress
          </h2>
        </div>
      )}

      <div className={hideHeader ? '' : 'p-6'}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Controls */}
          <div className="w-full md:w-64 shrink-0 space-y-4">
            {!preselectedClientId && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Client</label>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedClient && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Program</label>
                {activePrograms.length > 0 ? (
                  <select
                    value={selectedProgramId}
                    onChange={e => setSelectedProgramId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"
                  >
                    {activePrograms.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-500 italic p-2 bg-slate-50 rounded-lg border border-slate-200">
                    No active programs found in Service Plan.
                  </div>
                )}
              </div>
            )}

            {selectedProgram && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4">
                 <h4 className="font-bold text-indigo-900 text-sm mb-1">Program Details</h4>
                 <div className="text-xs text-indigo-700/80 capitalize mb-2">
                   {selectedProgram.type.replace('_', ' ')} &bull; {selectedProgram.measurement.type.replace('_', ' ')}
                 </div>
                 {selectedProgram.description && (
                   <p className="text-xs text-indigo-800/70 mb-3">{selectedProgram.description}</p>
                 )}

                 <div className="space-y-2 mt-4 pt-4 border-t border-indigo-100">
                   {baselineReference && (
                     <div className="flex justify-between text-xs">
                       <span className="font-bold text-indigo-900">Baseline</span>
                       <span className="text-indigo-700 font-bold">
                         {formatProgramValue(baselineReference.value, selectedProgram.measurement.type)}{' '}
                         <span className="font-normal text-indigo-700/70">({formatBaselineDate(baselineReference.date)})</span>
                       </span>
                     </div>
                   )}
                   <div className="flex justify-between text-xs">
                     <span className="font-bold text-indigo-900">Total Sessions</span>
                     <span className="text-indigo-700">{chartData.length}</span>
                   </div>
                   {chartData.length > 0 && (
                     <>
                       <div className="flex justify-between text-xs">
                         <span className="font-bold text-indigo-900">Latest Value</span>
                         <span className="text-indigo-700 font-bold">{formatProgramValue(chartData[chartData.length - 1].value, selectedProgram.measurement.type)}</span>
                       </div>
                     </>
                   )}
                 </div>
              </div>
            )}
          </div>

          {/* Chart Area */}
          <div className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl p-6 relative min-h-[300px]">
            {!selectedClient ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
                Select a client to view progress charts.
              </div>
            ) : !selectedProgram ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
                No active program selected.
              </div>
            ) : chartData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Activity size={32} className="text-slate-300 mb-2" />
                <p className="font-medium text-slate-500">No data collected yet</p>
                <p className="text-sm mt-1">Data from session notes will appear here.</p>
                {baselineReference && (
                  <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-bold">
                    Baseline on file: {formatProgramValue(baselineReference.value, selectedProgram.measurement.type)} ({formatBaselineDate(baselineReference.date)})
                  </div>
                )}
              </div>
            ) : chartData.length === 1 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                 <div className="text-3xl font-bold text-indigo-600 mb-1">{formatProgramValue(chartData[0].value, selectedProgram.measurement.type)}</div>
                 <p className="text-sm font-bold text-slate-500 mb-1">First Data Point</p>
                 <p className="text-xs">Recorded on {chartData[0].date}. Need more sessions to show a trend.</p>
                 {baselineReference && (
                   <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-bold">
                     Baseline: {formatProgramValue(baselineReference.value, selectedProgram.measurement.type)} ({formatBaselineDate(baselineReference.date)})
                   </div>
                 )}
              </div>
            ) : (
              <div className="w-full">
                <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      domain={
                        isPercentageMeasurement(selectedProgram.measurement.type)
                        ? [0, 100]
                        : ['auto', 'auto']
                      }
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [formatProgramValue(value, selectedProgram.measurement.type), 'Value']}
                    />
                    {baselineReference && (
                      <ReferenceLine
                        y={baselineReference.value}
                        stroke="#f59e0b"
                        strokeDasharray="5 4"
                        strokeWidth={1.5}
                        ifOverflow="extendDomain"
                        label={{ value: 'Baseline', position: 'insideTopLeft', fill: '#b45309', fontSize: 11, fontWeight: 700 }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
                      dot={{ r: 4, fill: '#fff', stroke: '#4f46e5', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                </div>
                {baselineReference && (
                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-3 border-t-2 border-dashed border-amber-500" />
                    Baseline reference: {formatProgramValue(baselineReference.value, selectedProgram.measurement.type)} on {formatBaselineDate(baselineReference.date)} -- not a session data point.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Objective Mastery Criteria V1 -- deterministic criterion progress
            only. Achieving a criterion is surfaced as a signal for BCBA
            review; it never changes ProgramObjective.status, mastery, or the
            Service Plan on its own. */}
        {selectedProgram && selectedProgram.objectives.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Target size={16} className="text-indigo-500" /> Objective Progress
            </h3>
            <div className="space-y-3">
              {selectedProgram.objectives.map(obj => {
                if (!obj.masteryCriteria) {
                  return (
                    <div key={obj.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{obj.name || 'Untitled objective'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">No mastery criteria configured for this objective.</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${obj.status === 'mastered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {obj.status}
                      </span>
                    </div>
                  );
                }

                const progress = evaluateObjectiveCriterion(chartData, obj.masteryCriteria);
                const criteriaLabel = formatCriteriaLabel(obj.masteryCriteria, selectedProgram.measurement.type);

                return (
                  <div key={obj.id} className={`border rounded-xl p-4 ${progress.achieved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{obj.name || 'Untitled objective'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Criterion: {criteriaLabel}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${obj.status === 'mastered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {obj.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-6 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[10px] block">Current</span>
                        <span className="font-bold text-slate-700">
                          {progress.currentValue === null ? 'No data yet' : formatProgramValue(progress.currentValue, selectedProgram.measurement.type)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase text-[10px] block">Streak</span>
                        <span className="font-bold text-slate-700">{progress.currentStreak} / {progress.requiredStreak} consecutive sessions</span>
                      </div>
                    </div>
                    {progress.achieved && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-700 text-xs font-bold bg-emerald-100/60 px-3 py-2 rounded-lg">
                        <CheckCircle2 size={14} /> Criterion achieved -- BCBA review required
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
