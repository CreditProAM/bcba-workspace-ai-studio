import React, { useState } from 'react';
import { X, Save, BookmarkPlus, Copy, Plus, Trash2 } from 'lucide-react';
import { ClinicalProgram, ProgramType, MeasurementType, ProgramStatus, ObjectiveMasteryCriteria, MasteryComparison } from '../../types';
import { formatProgramValue, getMeasurementUnitLabel, formatCriteriaLabel } from '../../utils/clinicalProgress';

interface ProgramEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: ClinicalProgram | null;
  programLibrary: ClinicalProgram[];
  onSave: (program: ClinicalProgram) => void;
  onSaveToLibrary: (program: ClinicalProgram) => void;
}

const PROGRAM_TYPES: { value: ProgramType; label: string }[] = [
  { value: 'behavior_reduction', label: 'Behavior Reduction' },
  { value: 'replacement', label: 'Replacement Behavior' },
  { value: 'skill_acquisition', label: 'Skill Acquisition' },
  { value: 'other', label: 'Other' }
];

const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'frequency', label: 'Frequency / Count' },
  { value: 'duration', label: 'Duration' },
  { value: 'percentage', label: 'Percentage of Opportunities' },
  { value: 'intensity', label: 'Intensity Levels' },
  { value: 'task_analysis', label: 'Task Analysis (Steps)' }
];

export const ProgramEditorModal: React.FC<ProgramEditorModalProps> = ({
  isOpen, onClose, program, programLibrary, onSave, onSaveToLibrary
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'measurement' | 'baseline' | 'objectives' | 'clinical'>('general');
  const [formData, setFormData] = useState<ClinicalProgram>(() => {
    if (program) {
      const cloned: ClinicalProgram = JSON.parse(JSON.stringify(program));
      // Defensive default: programs saved before the baseline field existed
      // (or otherwise missing it in older localStorage state) must still
      // load cleanly rather than throwing on formData.baseline.map/.length.
      return { ...cloned, baseline: cloned.baseline || [] };
    }
    return {
      id: crypto.randomUUID(),
      name: '',
      type: 'skill_acquisition',
      description: '',
      status: 'active',
      measurement: { type: 'frequency' },
      baseline: [],
      objectives: [],
      antecedents: [],
      interventions: [],
    };
  });
  
  const [showLibrary, setShowLibrary] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Program name is required.");
      return;
    }
    onSave(formData);
  };

  const loadFromLibrary = (template: ClinicalProgram) => {
    setFormData({
      ...template,
      id: crypto.randomUUID(), // always mint a new ID for the active program
      status: 'active'
    });
    setShowLibrary(false);
  };

  // Baseline capture -- reuses the program's already-configured measurement
  // type rather than introducing a second measurement system. Storage stays
  // on the existing `baseline: { date, value }[]` field; `value` always holds
  // the already-normalized measurement value as a string (a plain count,
  // minutes, 0-100 percentage, intensity level, or 0-100 task-analysis
  // percent-independent), matching the same normalized shape
  // normalizeProgramValue()/formatProgramValue() use for session data.
  const addBaselinePoint = () => {
    const newPoint = { date: new Date().toISOString().split('T')[0], value: '' };
    setFormData({ ...formData, baseline: [...formData.baseline, newPoint] });
  };

  const updateBaselinePoint = (idx: number, field: 'date' | 'value', value: string) => {
    const newBaseline = [...formData.baseline];
    newBaseline[idx] = { ...newBaseline[idx], [field]: value };
    setFormData({ ...formData, baseline: newBaseline });
  };

  const removeBaselinePoint = (idx: number) => {
    const newBaseline = [...formData.baseline];
    newBaseline.splice(idx, 1);
    setFormData({ ...formData, baseline: newBaseline });
  };

  // Objective Mastery Criteria V1 -- optional per objective. Passing
  // `undefined` clears criteria back to the pre-existing name+status-only
  // shape, so an objective can be un-configured just as easily as configured.
  const updateObjectiveCriteria = (idx: number, criteria: ObjectiveMasteryCriteria | undefined) => {
    const newObjs = [...formData.objectives];
    newObjs[idx] = { ...newObjs[idx], masteryCriteria: criteria };
    setFormData({ ...formData, objectives: newObjs });
  };

  // Same fallback used by live session data collection (DataCollection.tsx):
  // if no intensity levels are configured on the program, default to a
  // simple 1-3 scale rather than inventing a separate baseline-only scale.
  const intensityOptions = formData.measurement.intensityLevels && formData.measurement.intensityLevels.length > 0
    ? formData.measurement.intensityLevels
    : [1, 2, 3].map(level => ({ level, description: undefined as string | undefined }));

  const renderBaselineValueInput = (point: { date: string; value: string }, idx: number) => {
    const numericInputCls = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
    switch (formData.measurement.type) {
      case 'frequency':
        return (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-400">Count</label>
            <input
              type="number" min={0} step={1}
              value={point.value}
              onChange={e => updateBaselinePoint(idx, 'value', e.target.value)}
              className={numericInputCls}
              placeholder="e.g. 4"
            />
          </>
        );
      case 'duration':
        return (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-400">Minutes</label>
            <input
              type="number" min={0} step={1}
              value={point.value}
              onChange={e => updateBaselinePoint(idx, 'value', e.target.value)}
              className={numericInputCls}
              placeholder="e.g. 12"
            />
          </>
        );
      case 'percentage':
        return (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-400">% Correct (0-100)</label>
            <input
              type="number" min={0} max={100} step={1}
              value={point.value}
              onChange={e => updateBaselinePoint(idx, 'value', e.target.value)}
              className={numericInputCls}
              placeholder="e.g. 20"
            />
          </>
        );
      case 'intensity':
        return (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-400">Intensity Level</label>
            <select
              value={point.value}
              onChange={e => updateBaselinePoint(idx, 'value', e.target.value)}
              className={`${numericInputCls} bg-white`}
            >
              <option value="">-- Select level --</option>
              {intensityOptions.map(lvl => (
                <option key={lvl.level} value={String(lvl.level)}>
                  Level {lvl.level}{lvl.description ? `: ${lvl.description}` : ''}
                </option>
              ))}
            </select>
          </>
        );
      case 'task_analysis':
        return (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-400">% Steps Independent (0-100)</label>
            <input
              type="number" min={0} max={100} step={1}
              value={point.value}
              onChange={e => updateBaselinePoint(idx, 'value', e.target.value)}
              className={numericInputCls}
              placeholder="e.g. 0"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] animate-fade-in" onClick={onClose} />
      
      <div className="fixed inset-y-4 right-4 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden animate-slide-in-right">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-serif font-bold">{program ? 'Edit Program' : 'New Program'}</h2>
            <p className="text-slate-400 text-sm">{formData.name || 'Untitled Program'}</p>
          </div>
          <div className="flex items-center gap-3">
            {!program && (
              <button onClick={() => setShowLibrary(true)} className="text-sm font-bold text-slate-300 hover:text-white flex items-center gap-1 transition-colors">
                <Copy size={16} /> Library
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {showLibrary ? (
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
               <h3 className="font-bold text-slate-800">Program Library</h3>
               <button onClick={() => setShowLibrary(false)} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {programLibrary.length === 0 ? (
                 <div className="text-center p-8 text-slate-500 italic">No templates saved to library yet.</div>
               ) : (
                 programLibrary.map(lib => (
                   <div key={lib.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all" onClick={() => loadFromLibrary(lib)}>
                     <h4 className="font-bold text-slate-900">{lib.name}</h4>
                     <p className="text-xs text-slate-500 mt-1 capitalize">{lib.type.replace('_', ' ')} • {lib.measurement.type.replace('_', ' ')}</p>
                   </div>
                 ))
               )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              {(['general', 'measurement', 'baseline', 'objectives', 'clinical'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors capitalize ${
                    activeTab === t ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {activeTab === 'general' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Program Name *</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. Manding for items"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Type</label>
                      <select 
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value as ProgramType})}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        {PROGRAM_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as ProgramStatus})}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="mastered">Mastered</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description & Topography</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 h-32 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Operational definition..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'measurement' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Collection Method</label>
                    <select 
                      value={formData.measurement.type}
                      onChange={e => setFormData({...formData, measurement: { type: e.target.value as MeasurementType }})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                    >
                      {MEASUREMENT_TYPES.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">
                      Defines how this program will be tracked during a session.
                    </p>
                  </div>
                  
                  {formData.measurement.type === 'task_analysis' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <h4 className="font-bold text-slate-800 mb-3 text-sm">Task Analysis Steps</h4>
                       {(formData.measurement.steps || []).map((step, idx) => (
                         <div key={idx} className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                            <input 
                              type="text" 
                              value={step}
                              onChange={e => {
                                const newSteps = [...(formData.measurement.steps || [])];
                                newSteps[idx] = e.target.value;
                                setFormData({...formData, measurement: { ...formData.measurement, steps: newSteps }});
                              }}
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            />
                            <button 
                              onClick={() => {
                                const newSteps = [...(formData.measurement.steps || [])];
                                newSteps.splice(idx, 1);
                                setFormData({...formData, measurement: { ...formData.measurement, steps: newSteps }});
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                         </div>
                       ))}
                       <button 
                         onClick={() => {
                           const newSteps = [...(formData.measurement.steps || []), ''];
                           setFormData({...formData, measurement: { ...formData.measurement, steps: newSteps }});
                         }}
                         className="mt-2 text-sm font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"
                       >
                         <Plus size={16} /> Add Step
                       </button>
                    </div>
                  )}

                  {formData.measurement.type === 'intensity' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-3 text-sm">Intensity Levels</h4>
                      <p className="text-xs text-slate-500 mb-4">Define each level number and an optional description (e.g. Mild, Moderate, Severe). If left empty, data collection defaults to levels 1-3.</p>
                      {(formData.measurement.intensityLevels || []).map((lvl, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold shrink-0">{lvl.level}</span>
                          <input
                            type="text"
                            value={lvl.description || ''}
                            onChange={e => {
                              const newLevels = [...(formData.measurement.intensityLevels || [])];
                              newLevels[idx] = { ...newLevels[idx], description: e.target.value };
                              setFormData({ ...formData, measurement: { ...formData.measurement, intensityLevels: newLevels } });
                            }}
                            placeholder="Description (optional)"
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => {
                              const newLevels = [...(formData.measurement.intensityLevels || [])];
                              newLevels.splice(idx, 1);
                              setFormData({ ...formData, measurement: { ...formData.measurement, intensityLevels: newLevels } });
                            }}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const existing = formData.measurement.intensityLevels || [];
                          const nextLevel = existing.length > 0 ? Math.max(...existing.map(l => l.level)) + 1 : 1;
                          const newLevels = [...existing, { level: nextLevel, description: '' }];
                          setFormData({ ...formData, measurement: { ...formData.measurement, intensityLevels: newLevels } });
                        }}
                        className="mt-2 text-sm font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"
                      >
                        <Plus size={16} /> Add Level
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'baseline' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Baseline Data</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Pre-treatment reference points, captured with this program's configured{' '}
                        {MEASUREMENT_TYPES.find(mt => mt.value === formData.measurement.type)?.label.toLowerCase()} measurement.
                        Baseline is clinical reference context only -- it is never treated as a treatment session datapoint.
                      </p>
                    </div>
                    <button
                      onClick={addBaselinePoint}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-bold flex items-center gap-1 shrink-0"
                    >
                      <Plus size={16} /> Add Point
                    </button>
                  </div>

                  {formData.baseline.length === 0 ? (
                    <div className="text-center p-6 text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                      No baseline data captured yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.baseline.map((point, idx) => (
                        <div key={idx} className="flex items-end gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                          <div className="w-36 shrink-0">
                            <label className="text-[10px] uppercase font-bold text-slate-400">Date</label>
                            <input
                              type="date"
                              value={point.date}
                              onChange={e => updateBaselinePoint(idx, 'date', e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            {renderBaselineValueInput(point, idx)}
                          </div>
                          {point.value !== '' && !isNaN(Number(point.value)) && (
                            <div className="text-xs font-bold text-indigo-600 pb-2 whitespace-nowrap">
                              {formatProgramValue(Number(point.value), formData.measurement.type)}
                            </div>
                          )}
                          <button
                            onClick={() => removeBaselinePoint(idx)}
                            className="text-red-400 hover:text-red-600 p-1.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'objectives' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">Sequential Objectives</h3>
                    <button 
                       onClick={() => {
                         const newObj = { id: crypto.randomUUID(), name: '', status: 'active' as ProgramStatus };
                         setFormData({...formData, objectives: [...formData.objectives, newObj]});
                       }}
                       className="text-indigo-600 hover:text-indigo-700 text-sm font-bold flex items-center gap-1"
                    >
                      <Plus size={16} /> Add Objective
                    </button>
                  </div>
                  
                  {formData.objectives.length === 0 ? (
                    <div className="text-center p-6 text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                      No specific objectives defined.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.objectives.map((obj, idx) => (
                        <div key={obj.id} className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 font-bold text-slate-400">{idx + 1}.</div>
                            <div className="flex-1 space-y-2">
                               <input
                                 type="text"
                                 value={obj.name}
                                 onChange={e => {
                                   const newObjs = [...formData.objectives];
                                   newObjs[idx] = { ...newObjs[idx], name: e.target.value };
                                   setFormData({...formData, objectives: newObjs});
                                 }}
                                 placeholder="Objective description..."
                                 className="w-full border-0 bg-transparent p-0 focus:ring-0 text-slate-900 font-medium"
                               />
                               <select
                                 value={obj.status}
                                 onChange={e => {
                                   const newObjs = [...formData.objectives];
                                   newObjs[idx] = { ...newObjs[idx], status: e.target.value as ProgramStatus };
                                   setFormData({...formData, objectives: newObjs});
                                 }}
                                 className="text-xs border border-slate-200 rounded p-1 bg-slate-50"
                               >
                                  <option value="active">Active</option>
                                  <option value="mastered">Mastered</option>
                               </select>
                            </div>
                            <button
                              onClick={() => {
                                const newObjs = [...formData.objectives];
                                newObjs.splice(idx, 1);
                                setFormData({...formData, objectives: newObjs});
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Mastery Criteria (optional) -- an objective with no
                              criteria configured continues behaving exactly as
                              it always has. */}
                          <div className="mt-3 pt-3 border-t border-slate-100 pl-7">
                            {obj.masteryCriteria ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Mastery Criteria</span>
                                  <button
                                    onClick={() => updateObjectiveCriteria(idx, undefined)}
                                    className="text-[11px] font-bold text-red-400 hover:text-red-600"
                                  >
                                    Remove Criteria
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                  <div className="w-28">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Comparison</label>
                                    <select
                                      value={obj.masteryCriteria.comparison}
                                      onChange={e => updateObjectiveCriteria(idx, { ...obj.masteryCriteria!, comparison: e.target.value as MasteryComparison })}
                                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                                    >
                                      <option value="at_least">At least</option>
                                      <option value="at_most">At most</option>
                                    </select>
                                  </div>
                                  <div className="w-28">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                      Target ({getMeasurementUnitLabel(formData.measurement.type)})
                                    </label>
                                    <input
                                      type="number"
                                      value={obj.masteryCriteria.targetValue}
                                      onChange={e => updateObjectiveCriteria(idx, { ...obj.masteryCriteria!, targetValue: Number(e.target.value) })}
                                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div className="w-40">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Consecutive Sessions</label>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={obj.masteryCriteria.consecutiveSessions}
                                      onChange={e => updateObjectiveCriteria(idx, { ...obj.masteryCriteria!, consecutiveSessions: Math.max(1, Number(e.target.value) || 1) })}
                                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-indigo-600 font-bold">
                                  {formatCriteriaLabel(obj.masteryCriteria, formData.measurement.type)}
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  Meeting this criterion is shown as a signal for BCBA review -- it never automatically changes this objective's status.
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => updateObjectiveCriteria(idx, { targetValue: 0, comparison: 'at_least', consecutiveSessions: 3 })}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                              >
                                <Plus size={14} /> Add Mastery Criteria
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'clinical' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Antecedent Strategies</label>
                    <textarea 
                      value={formData.antecedents.join('\n')}
                      onChange={e => setFormData({...formData, antecedents: e.target.value.split('\n').filter(s => s.trim())})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 h-24 focus:ring-2 focus:ring-indigo-500"
                      placeholder="One per line..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Intervention / Consequence Strategies</label>
                    <textarea 
                      value={formData.interventions.join('\n')}
                      onChange={e => setFormData({...formData, interventions: e.target.value.split('\n').filter(s => s.trim())})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 h-24 focus:ring-2 focus:ring-indigo-500"
                      placeholder="One per line..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Additional Recommendations</label>
                    <textarea 
                      value={formData.recommendations || ''}
                      onChange={e => setFormData({...formData, recommendations: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2.5 h-24 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
               <button 
                 onClick={() => {
                   onSaveToLibrary(formData);
                 }}
                 className="text-slate-500 hover:text-indigo-600 font-bold text-sm flex items-center gap-1.5 transition-colors"
               >
                 <BookmarkPlus size={16} strokeWidth={2} /> Save as Template
               </button>
               
               <div className="flex gap-3">
                 <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">
                   Cancel
                 </button>
                 <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
                   <Save size={18} strokeWidth={2} />
                   Save Program
                 </button>
               </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
