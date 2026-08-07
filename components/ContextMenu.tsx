
import React, { useEffect, useRef } from 'react';
import { Trash2, Copy, FilePenLine, Plus, Clock, ClipboardPaste, Mail, CheckCircle2, XCircle } from 'lucide-react';

export interface ContextMenuCoords {
  x: number;
  y: number;
}

export type ContextMenuType = 'EVENT' | 'GRID';

interface ContextMenuProps {
  type: ContextMenuType;
  coords: ContextMenuCoords | null;
  onClose: () => void;
  onAction: (action: string) => void;
  hasClipboard?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ type, coords, onClose, onAction, hasClipboard }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleClick); // Close on secondary click elsewhere
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
    };
  }, [onClose]);

  if (!coords) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: coords.y, left: coords.x }}
      className="fixed z-[100] w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200/50 p-1.5 animate-scale-in origin-top-left"
    >
      {type === 'EVENT' ? (
        <div className="space-y-0.5">
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event Actions</div>
          <button onClick={() => onAction('EDIT')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
            <FilePenLine size={14} className="group-hover:text-white text-slate-500" /> Edit Session
          </button>
          <button onClick={() => onAction('EMAIL')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
            <Mail size={14} className="group-hover:text-white text-slate-500" /> Email Client
          </button>
          
          <div className="h-px bg-slate-200 my-1 mx-2" />
          
          <button onClick={() => onAction('COPY')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
            <Copy size={14} className="group-hover:text-white text-slate-500" /> Copy
          </button>
          <button onClick={() => onAction('DUPLICATE')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
            <Plus size={14} className="group-hover:text-white text-slate-500" /> Duplicate
          </button>

          <div className="h-px bg-slate-200 my-1 mx-2" />
          
          <button onClick={() => onAction('STATUS_COMPLETE')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors text-left group">
            <CheckCircle2 size={14} className="group-hover:text-white text-emerald-500" /> Mark Complete
          </button>
          <button onClick={() => onAction('STATUS_CANCELLED')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-amber-500 hover:text-white rounded-lg transition-colors text-left group">
            <XCircle size={14} className="group-hover:text-white text-amber-500" /> Mark Cancelled
          </button>

          <div className="h-px bg-slate-200 my-1 mx-2" />
          
          <button onClick={() => onAction('DELETE')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors text-left group">
            <Trash2 size={14} className="group-hover:text-white text-rose-500" /> Delete
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Slot Actions</div>
          <button onClick={() => onAction('ADD')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
            <Plus size={14} className="group-hover:text-white text-slate-500" /> Schedule Here
          </button>
          <button onClick={() => onAction('ADD_RBT')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left group">
             <Clock size={14} className="group-hover:text-white text-slate-500" /> Schedule Supervision
          </button>
          
          <div className="h-px bg-slate-200 my-1 mx-2" />
          
          <button 
            onClick={() => onAction('PASTE')} 
            disabled={!hasClipboard}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <ClipboardPaste size={14} className="group-hover:text-white text-slate-500" /> Paste Event
          </button>
        </div>
      )}
    </div>
  );
};
