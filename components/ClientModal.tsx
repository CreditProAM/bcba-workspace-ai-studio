
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Activity, UserRound, Save, Trash2, Camera, Upload } from 'lucide-react';
import { Client } from '../types';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; diagnosis: string; status: Client['status']; imageUrl?: string }) => void;
  onDelete?: (id: string) => void;
  initialClient?: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  initialClient 
}) => {
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [status, setStatus] = useState<Client['status']>('Onboarding');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialClient) {
        setName(initialClient.name);
        setDiagnosis(initialClient.diagnosis || '');
        setStatus(initialClient.status);
        setImageUrl(initialClient.imageUrl || '');
      } else {
        setName('');
        setDiagnosis('');
        setStatus('Onboarding');
        setImageUrl('');
      }
    }
  }, [isOpen, initialClient]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSave({ 
      id: initialClient?.id,
      name, 
      diagnosis, 
      status,
      imageUrl
    });
    
    onClose();
  };

  if (!isOpen) return null;

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
              {initialClient ? 'Edit Client' : 'New Client'}
            </h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">
              {initialClient ? 'Update Profile' : 'Onboarding Flow'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Image Upload */}
          <div className="flex justify-center">
            <div className="relative group cursor-pointer">
                <div className={`w-28 h-28 rounded-full overflow-hidden border-4 ${imageUrl ? 'border-indigo-100' : 'border-dashed border-slate-200'} flex items-center justify-center bg-slate-50 transition-colors group-hover:border-indigo-300`}>
                    {imageUrl ? (
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                            <Camera size={24} className="mx-auto mb-1 opacity-50" />
                            <span className="text-[10px] font-bold uppercase">Add Photo</span>
                        </div>
                    )}
                </div>
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white">
                    <Upload size={24} />
                </div>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Client Name</label>
            <div className="relative">
              <UserRound size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
                placeholder="e.g. John Doe"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Diagnosis Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Diagnosis</label>
            <div className="relative">
              <Activity size={18} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
                placeholder="e.g. ASD Level 2"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Onboarding', 'Active', 'Maintenance'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`
                    px-2 py-2.5 rounded-lg text-xs font-bold border transition-all
                    ${status === s 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center gap-3">
             {initialClient && onDelete && (
                <button
                    type="button"
                    onClick={() => {
                        if (window.confirm('Are you sure you want to remove this client? This action cannot be undone.')) {
                            onDelete(initialClient.id);
                            onClose();
                        }
                    }}
                    className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Client"
                >
                    <Trash2 size={20} strokeWidth={1.5} />
                </button>
             )}
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
              {initialClient ? <Save size={18} strokeWidth={1.5} /> : <UserPlus size={18} strokeWidth={1.5} />}
              {initialClient ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
