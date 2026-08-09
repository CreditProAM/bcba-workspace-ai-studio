import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Client, ServicePlan, ClinicalProgram, SessionNote, SessionProgramData } from '../../types';
import { Activity, Info } from 'lucide-react';

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

  // Aggregate program data
  const chartData = useMemo(() => {
    if (!selectedClient || !selectedProgram) return [];
    
    const notes = selectedClient.sessionNotes || [];
    // Sort chronological
    const sortedNotes = [...notes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dataPoints: any[] = [];

    sortedNotes.forEach(note => {
      if (!note.programData) return;
      const pData = note.programData.find(pd => pd.programId === selectedProgram.id);
      if (!pData) return;

      const dateStr = new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      let val = 0;
      if (pData.measurementType === 'frequency' || pData.measurementType === 'duration' || pData.measurementType === 'intensity') {
        val = Number(pData.value) || 0;
      } else if (pData.measurementType === 'percentage') {
        const correct = Number(pData.value?.correct) || 0;
        const total = Number(pData.value?.total) || 0;
        val = total > 0 ? Math.round((correct / total) * 100) : 0;
      } else if (pData.measurementType === 'task_analysis') {
        // compute % independent
        const steps = Object.values(pData.value || {});
        const totalSteps = steps.length;
        const independentSteps = steps.filter(s => s === 'independent').length;
        val = totalSteps > 0 ? Math.round((independentSteps / totalSteps) * 100) : 0;
      }

      dataPoints.push({
        date: dateStr,
        value: val,
        raw: pData.value
      });
    });

    return dataPoints;
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
                   <div className="flex justify-between text-xs">
                     <span className="font-bold text-indigo-900">Total Sessions</span>
                     <span className="text-indigo-700">{chartData.length}</span>
                   </div>
                   {chartData.length > 0 && (
                     <>
                       <div className="flex justify-between text-xs">
                         <span className="font-bold text-indigo-900">Latest Value</span>
                         <span className="text-indigo-700 font-bold">{chartData[chartData.length - 1].value}{selectedProgram.measurement.type === 'percentage' || selectedProgram.measurement.type === 'task_analysis' ? '%' : ''}</span>
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
              </div>
            ) : chartData.length === 1 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                 <div className="text-3xl font-bold text-indigo-600 mb-1">{chartData[0].value}{selectedProgram.measurement.type === 'percentage' || selectedProgram.measurement.type === 'task_analysis' ? '%' : ''}</div>
                 <p className="text-sm font-bold text-slate-500 mb-1">Baseline / First Data Point</p>
                 <p className="text-xs">Recorded on {chartData[0].date}. Need more sessions to show a trend.</p>
              </div>
            ) : (
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
                        selectedProgram.measurement.type === 'percentage' || selectedProgram.measurement.type === 'task_analysis' 
                        ? [0, 100] 
                        : ['auto', 'auto']
                      }
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => {
                         const suffix = selectedProgram.measurement.type === 'percentage' || selectedProgram.measurement.type === 'task_analysis' ? '%' : '';
                         return [`${value}${suffix}`, 'Value'];
                      }}
                    />
                    {/* Optionally add an objective reference line if there's a baseline/objective target, though we keep it simple for now */}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
