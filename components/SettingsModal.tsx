import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Download, Upload, Database } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workHours: { start: number; end: number };
  onSave: (hours: { start: number; end: number }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  workHours, 
  onSave 
}) => {
  const [start, setStart] = useState(workHours.start);
  const [end, setEnd] = useState(workHours.end);

  useEffect(() => {
    if (isOpen) {
      setStart(workHours.start);
      setEnd(workHours.end);
    }
  }, [isOpen, workHours]);

  const handleSave = () => {
    if (start >= end) {
      alert("Start time must be before end time.");
      return;
    }
    onSave({ start, end });
    onClose();
  };

  const handleExport = () => {
    // Collect all data from local storage
    const data = {
        appState: localStorage.getItem('bcba_dashboard_state_v1'),
        activity: localStorage.getItem('bcba_dashboard_activity_v1'),
        settings: localStorage.getItem('bcba_dashboard_settings_v1'),
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical_dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            const data = JSON.parse(content);
            
            if (data.appState) localStorage.setItem('bcba_dashboard_state_v1', data.appState);
            if (data.activity) localStorage.setItem('bcba_dashboard_activity_v1', data.activity);
            if (data.settings) localStorage.setItem('bcba_dashboard_settings_v1', data.settings);
            
            alert('Data restored successfully. The page will reload.');
            window.location.reload();
        } catch (err) {
            alert('Failed to import data. Invalid file format.');
        }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-900">
              Settings
            </h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Calendar Configuration</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-8">
          
          {/* Work Hours Section */}
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-4 items-start">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <Clock size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 text-sm">Work Hours</h4>
                    <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                        Customize the visible time range on your daily and weekly calendar views.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Time</label>
                    <select 
                        value={start}
                        onChange={(e) => setStart(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                        {hours.map(h => (
                            <option key={h} value={h}>{formatHour(h)}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Time</label>
                    <select 
                        value={end}
                        onChange={(e) => setEnd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                        {hours.map(h => (
                            <option key={h} value={h}>{formatHour(h)}</option>
                        ))}
                    </select>
                </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Backup Section */}
          <div className="space-y-4">
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-start">
                <div className="p-2 bg-slate-200 rounded-lg text-slate-600">
                    <Database size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 text-sm">Data & Backup</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Export your full database to a JSON file for backup, or restore from a previous save.
                    </p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                >
                    <Download size={16} strokeWidth={1.5} /> Export Data
                </button>
                
                <div className="relative">
                    <input 
                        type="file" 
                        accept=".json"
                        onChange={handleImport}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button 
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                    >
                        <Upload size={16} strokeWidth={1.5} /> Import Backup
                    </button>
                </div>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-lg shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 transition-all text-sm flex items-center gap-2"
          >
            <Save size={16} strokeWidth={1.5} />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};