import React, { useState } from 'react';
import { X, Clock, CalendarDays, FileText, Save } from 'lucide-react';
import { Client, CalendarEvent } from '../types';

interface SupervisionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (event: CalendarEvent) => void;
}

export const SupervisionLogModal: React.FC<SupervisionLogModalProps> = ({ 
  isOpen, 
  onClose, 
  client,
  onSave 
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('1.0');
  const [notes, setNotes] = useState('');

  if (!isOpen || !client) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Default start time to 9 AM for manual logs
    const start = new Date(`${date}T09:00:00`);
    const durationHours = parseFloat(duration);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: notes || 'Manual Supervision Log',
      start: start,
      end: end,
      clientId: client.id,
      serviceType: 'RBT Supervision',
      location: 'Clinic', // Default
      description: 'Manually logged supervision hours'
    };

    onSave(newEvent);
    
    // Reset and close
    setNotes('');
    setDuration('1.0');
    onClose();
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
              Log Hours
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">RBT Supervision</span>
                <span className="text-slate-300">•</span>
                <span className={`text-xs font-bold ${client.textColor}`}>{client.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            {/* Date Input */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Date</label>
                <div className="relative">
                    <CalendarDays size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        required
                    />
                </div>
            </div>

            {/* Duration Input */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Duration (Hrs)</label>
                <div className="relative">
                    <Clock size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        required
                    />
                </div>
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notes / Focus Area</label>
            <div className="relative">
                <FileText size={18} strokeWidth={1.5} className="absolute left-3 top-3.5 text-slate-400" />
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium resize-none h-24"
                    placeholder="e.g. Reviewed BIP implementation..."
                />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-5 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] transition-all text-sm flex items-center justify-center gap-2"
            >
              <Save size={18} strokeWidth={1.5} />
              Save Log
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};