import React, { useState } from 'react';
import { X, Save, BookmarkPlus, Copy, Plus, Trash2 } from 'lucide-react';
import { ClinicalProgram, ProgramType, MeasurementType, ProgramStatus } from '../../types';

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
  const [activeTab, setActiveTab] = useState<'general' | 'measurement' | 'objectives' | 'clinical'>('general');
  const [formData, setFormData] = useState<ClinicalProgram>(() => {
    if (program) return JSON.parse(JSON.stringify(program));
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
              {(['general', 'measurement', 'objectives', 'clinical'] as const).map(t => (
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
                      <h4 className="font-bold text-slate-800 mb-1 text-sm">Intensity Levels</h4>
                      <p className="text-xs text-slate-500 mb-4">
                        Levels 1-3 are always available during data collection. Give each a short
                        description (e.g. Mild / Moderate / Severe) so whoever logs a session knows
                        what to select. Add levels 4-5 only if this program needs them.
                      </p>
                      <div className="space-y-2">
                        {([1, 2, 3, 4, 5] as const).map(level => {
                          const levels = formData.measurement.intensityLevels || [];
                          const configured = levels.find(l => l.level === level);
                          if (level > 3 && !configured) return null;
                          const defaultLabel = ['Mild', 'Moderate', 'Severe'][level - 1];
                          return (
                            <div key={level} className="flex items-center gap-2">
                              <span className="w-16 shrink-0 text-xs font-bold text-slate-500">Level {level}</span>
                              <input
                                type="text"
                                value={configured?.description || ''}
                                onChange={e => {
                                  const next = [...levels];
                                  const idx = next.findIndex(l => l.level === level);
                                  if (idx > -1) next[idx] = { ...next[idx], description: e.target.value };
                                  else next.push({ level, description: e.target.value });
                                  setFormData({ ...formData, measurement: { ...formData.measurement, intensityLevels: next } });
                                }}
                                placeholder={level <= 3 ? defaultLabel : 'Description...'}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                              />
                              {level > 3 && (
                                <button
                                  onClick={() => {
                                    const next = levels.filter(l => l.level !== level);
                                    setFormData({ ...formData, measurement: { ...formData.measurement, intensityLevels: next } });
                                  }}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {(formData.measurement.intensityLevels || []).filter(l => l.level > 3).length < 2 && (
                        <button
                          onClick={() => {
                            const levels = formData.measurement.intensityLevels || [];
                            const nextLevel = (levels.some(l => l.level === 4) ? 5 : 4) as 4 | 5;
                            setFormData({
                              ...formData,
                              measurement: { ...formData.measurement, intensityLevels: [...levels, { level: nextLevel, description: '' }] }
                            });
                          }}
                          className="mt-3 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"
                        >
                          <Plus size={14} /> Add Level
                        </button>
                      )}
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
                        <div key={obj.id} className="flex items-start gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                          <div className="mt-1 font-bold text-slate-400">{idx + 1}.</div>
                          <div className="flex-1 space-y-2">
                             <input 
                               type="text"
                               value={obj.name}
                               onChange={e => {
                                 const newObjs = [...formData.objectives];
                                 newObjs[idx].name = e.target.value;
                                 setFormData({...formData, objectives: newObjs});
                               }}
                               placeholder="Objective description..."
                               className="w-full border-0 bg-transparent p-0 focus:ring-0 text-slate-900 font-medium"
                             />
                             <select 
                               value={obj.status}
                               onChange={e => {
                                 const newObjs = [...formData.objectives];
                                 newObjs[idx].status = e.target.value as ProgramStatus;
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
