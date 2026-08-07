import React, { useState } from 'react';
import { X, Plus, Save, FileText, Settings, Archive, AlertCircle, ChevronDown, ChevronRight, Edit2, Play, Pause, CheckCircle } from 'lucide-react';
import { Client, ServicePlan, ClinicalProgram, ProgramCategory } from '../../types';
import { ProgramEditorModal } from './ProgramEditorModal';

interface ServicePlanManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  servicePlans: ServicePlan[];
  programLibrary: ClinicalProgram[];
  onSavePlan: (plan: ServicePlan) => void;
  onSaveLibraryProgram: (program: ClinicalProgram) => void;
}

export const ServicePlanManagerModal: React.FC<ServicePlanManagerModalProps> = ({
  isOpen, onClose, client, servicePlans, programLibrary, onSavePlan, onSaveLibraryProgram
}) => {
  const [activePlan, setActivePlan] = useState<ServicePlan | null>(() => {
    return servicePlans.find(p => p.clientId === client.id && p.status !== 'archived') || null;
  });

  const [editingProgram, setEditingProgram] = useState<{ categoryId: string, program: ClinicalProgram | null } | null>(null);

  if (!isOpen) return null;

  const handleCreatePlan = () => {
    const newPlan: ServicePlan = {
      id: crypto.randomUUID(),
      clientId: client.id,
      name: `${client.name}'s Service Plan`,
      status: 'draft',
      startDate: new Date().toISOString(),
      categories: [
        { id: crypto.randomUUID(), name: 'Behavior Reduction', programs: [] },
        { id: crypto.randomUUID(), name: 'Skill Acquisition', programs: [] },
        { id: crypto.randomUUID(), name: 'Replacement Behaviors', programs: [] }
      ]
    };
    setActivePlan(newPlan);
    onSavePlan(newPlan);
  };

  const handleUpdatePlan = (updatedPlan: ServicePlan) => {
    setActivePlan(updatedPlan);
    onSavePlan(updatedPlan);
  };

  const handleAddCategory = () => {
    if (!activePlan) return;
    const name = prompt('Enter category name:');
    if (!name) return;
    handleUpdatePlan({
      ...activePlan,
      categories: [...activePlan.categories, { id: crypto.randomUUID(), name, programs: [] }]
    });
  };

  const handleSaveProgram = (categoryId: string, program: ClinicalProgram) => {
    if (!activePlan) return;
    handleUpdatePlan({
      ...activePlan,
      categories: activePlan.categories.map(c => {
        if (c.id === categoryId) {
          const existingIdx = c.programs.findIndex(p => p.id === program.id);
          const newPrograms = [...c.programs];
          if (existingIdx > -1) {
            newPrograms[existingIdx] = program;
          } else {
            newPrograms.push(program);
          }
          return { ...c, programs: newPrograms };
        }
        return c;
      })
    });
    setEditingProgram(null);
  };

  const handleStatusChange = (status: ServicePlan['status']) => {
    if (!activePlan) return;
    handleUpdatePlan({ ...activePlan, status });
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] animate-fade-in" onClick={onClose} />
      
      <div className="fixed inset-4 md:inset-10 bg-white rounded-2xl shadow-2xl z-[80] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${client.color} text-${client.textColor} border-2 ${client.borderColor} flex items-center justify-center font-bold text-lg`}>
              {client.avatar}
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-slate-900">Service Plan Manager</h2>
              <p className="text-sm text-slate-500">Configure programs and measurement for {client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {!activePlan ? (
            <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Service Plan</h3>
              <p className="text-slate-500 mb-6">
                Create a structured service plan to define programs, configure data collection methods, and track clinical progress.
              </p>
              <button 
                onClick={handleCreatePlan}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus size={18} strokeWidth={2} />
                Create Service Plan
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                    {activePlan.name}
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                       activePlan.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 
                       activePlan.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {activePlan.status}
                    </span>
                  </h3>
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                    <span>Started: {new Date(activePlan.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activePlan.status === 'draft' && (
                    <button onClick={() => handleStatusChange('active')} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                      Activate Plan
                    </button>
                  )}
                  {activePlan.status === 'active' && (
                    <button onClick={() => handleStatusChange('archived')} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                      Archive Plan
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-end">
                <h3 className="text-lg font-serif font-bold text-slate-900">Programs</h3>
                <button 
                  onClick={handleAddCategory}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus size={16} strokeWidth={2} /> Add Category
                </button>
              </div>

              <div className="space-y-4">
                {activePlan.categories.map(category => (
                  <div key={category.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800">{category.name}</h4>
                      <button 
                        onClick={() => setEditingProgram({ categoryId: category.id, program: null })}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14} strokeWidth={2} /> Add Program
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {category.programs.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400 italic">
                          No programs in this category yet.
                        </div>
                      ) : (
                        category.programs.map(program => (
                          <div key={program.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setEditingProgram({ categoryId: category.id, program })}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                program.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                                program.status === 'mastered' ? 'bg-indigo-50 text-indigo-600' :
                                program.status === 'paused' ? 'bg-amber-50 text-amber-600' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {program.status === 'active' ? <Play size={16} /> :
                                 program.status === 'mastered' ? <CheckCircle size={16} /> :
                                 program.status === 'paused' ? <Pause size={16} /> :
                                 <Archive size={16} />}
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{program.name}</h5>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="capitalize">{program.type.replace('_', ' ')}</span>
                                  <span>&bull;</span>
                                  <span className="capitalize">{program.measurement.type.replace('_', ' ')}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={18} strokeWidth={1.5} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Nested Modal for Editing/Creating a Program */}
      {editingProgram && (
        <ProgramEditorModal
          isOpen={true}
          onClose={() => setEditingProgram(null)}
          program={editingProgram.program}
          programLibrary={programLibrary}
          onSave={(program) => handleSaveProgram(editingProgram.categoryId, program)}
          onSaveToLibrary={onSaveLibraryProgram}
        />
      )}
    </>
  );
};
