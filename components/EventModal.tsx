
import React, { useState, useEffect } from 'react';
import { X, Trash2, MapPin, BriefcaseBusiness, Plus, Check, Bell, AlignLeft, Repeat, AlertCircle } from 'lucide-react';
import { CalendarEvent, Client, ServiceType, SubTask } from '../types';
import { SERVICE_TYPES } from '../constants';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent | CalendarEvent[]) => void;
  onDelete: (id: string) => void;
  initialEvent?: CalendarEvent | null;
  clients: Client[];
}

type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export const EventModal: React.FC<EventModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  initialEvent, 
  clients 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Direct 1:1');
  const [location, setLocation] = useState('Clinic');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [reminders, setReminders] = useState<number[]>([]);
  
  // Validation State
  const [error, setError] = useState<string | null>(null);
  
  // Recurrence State
  const [recurrence, setRecurrence] = useState<RecurrenceType>('NONE');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialEvent) {
        setTitle(initialEvent.title);
        setDescription(initialEvent.description || '');
        setClientId(initialEvent.clientId);
        setServiceType(initialEvent.serviceType || 'Direct 1:1');
        setLocation(initialEvent.location || 'Clinic');
        setStartDate(initialEvent.start.toISOString().split('T')[0]);
        setStartTime(initialEvent.start.toTimeString().slice(0, 5));
        setEndTime(initialEvent.end.toTimeString().slice(0, 5));
        setSubTasks(initialEvent.subTasks || []);
        setReminders(initialEvent.reminders || []);
        setRecurrence('NONE');
        setRecurrenceEnd('');
      } else {
        const now = new Date();
        setTitle('');
        setDescription('');
        setClientId(clients[0]?.id || '');
        setServiceType('Direct 1:1');
        setLocation('Clinic');
        setStartDate(now.toISOString().split('T')[0]);
        setStartTime('09:00');
        setEndTime('10:00');
        setSubTasks([]);
        setReminders([]);
        setRecurrence('NONE');
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setRecurrenceEnd(nextMonth.toISOString().split('T')[0]);
      }
      setNewSubTaskTitle('');
    }
  }, [isOpen, initialEvent, clients]);

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    // Auto-adjust end time if it becomes invalid (optional QoL)
    if (endTime <= newStart) {
        const [h, m] = newStart.split(':').map(Number);
        const newEndH = (h + 1).toString().padStart(2, '0');
        setEndTime(`${newEndH}:${m.toString().padStart(2, '0')}`);
    }
  };

  const handleSave = () => {
    setError(null);

    // Validation
    if (!clientId) { setError('Please select a client.'); return; }
    if (!title.trim()) { setError('Please enter a session title.'); return; }
    if (!startDate) { setError('Please select a date.'); return; }
    if (!startTime || !endTime) { setError('Please select start and end times.'); return; }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setError('Invalid date or time format.');
        return;
    }

    if (end <= start) {
        setError('End time must be after start time.');
        return;
    }

    const duration = end.getTime() - start.getTime();

    // Base Event
    const baseEvent: CalendarEvent = {
      id: initialEvent?.id || crypto.randomUUID(),
      title,
      description,
      start,
      end,
      clientId,
      serviceType,
      location: location as any,
      subTasks,
      reminders
    };

    if (recurrence === 'NONE' || !recurrenceEnd) {
        onSave(baseEvent);
    } else {
        // Generate Series
        const events: CalendarEvent[] = [];
        const seriesId = crypto.randomUUID();
        const endDate = new Date(recurrenceEnd);
        endDate.setHours(23, 59, 59, 999);

        let current = new Date(start);
        
        while (current <= endDate) {
            const currentStart = new Date(current);
            const currentEnd = new Date(current.getTime() + duration);

            events.push({
                ...baseEvent,
                id: crypto.randomUUID(),
                start: currentStart,
                end: currentEnd,
                seriesId,
                recurrencePattern: recurrence
            });

            if (recurrence === 'DAILY') current.setDate(current.getDate() + 1);
            if (recurrence === 'WEEKLY') current.setDate(current.getDate() + 7);
            if (recurrence === 'BIWEEKLY') current.setDate(current.getDate() + 14);
            if (recurrence === 'MONTHLY') current.setMonth(current.getMonth() + 1);
        }

        onSave(events);
    }

    onClose();
  };

  const handleAddSubTask = () => {
    if (!newSubTaskTitle.trim()) return;
    const newTask: SubTask = {
      id: crypto.randomUUID(),
      title: newSubTaskTitle.trim(),
      completed: false
    };
    setSubTasks([...subTasks, newTask]);
    setNewSubTaskTitle('');
  };

  const toggleSubTask = (taskId: string) => {
    setSubTasks(subTasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  const deleteSubTask = (taskId: string) => {
    setSubTasks(subTasks.filter(t => t.id !== taskId));
  };

  const addReminder = (minutes: number) => {
    if (!reminders.includes(minutes)) {
      setReminders([...reminders, minutes].sort((a, b) => a - b));
    }
  };

  const removeReminder = (minutes: number) => {
    setReminders(reminders.filter(r => r !== minutes));
  };

  const formatReminder = (minutes: number) => {
    if (minutes >= 1440) return `${minutes / 1440} day(s) before`;
    if (minutes >= 60) return `${minutes / 60} hour(s) before`;
    return `${minutes} min before`;
  };

  const completedCount = subTasks.filter(t => t.completed).length;

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-900">
              {initialEvent ? 'Edit Session' : 'Schedule Session'}
            </h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Clinical Details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6 overflow-y-auto">
          
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-sm text-rose-600 font-bold animate-slide-in-right">
                <AlertCircle size={18} />
                {error}
            </div>
          )}

          {/* Client Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Select Client <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {clients.map(c => (
                <button
                  key={c.id}
                  onClick={() => setClientId(c.id)}
                  className={`
                    flex items-center gap-3 p-2 rounded-xl border text-left transition-all
                    ${clientId === c.id 
                      ? `${c.color} ${c.borderColor} ring-2 ring-offset-1 ring-slate-300` 
                      : 'bg-white border-slate-200 hover:border-slate-300'}
                  `}
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold border border-black/10">
                    {c.avatar}
                  </div>
                  <span className={`text-sm font-bold ${clientId === c.id ? c.textColor : 'text-slate-600'}`}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Service Type */}
            <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Type</label>
               <select 
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as ServiceType)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
               >
                 {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
               </select>
            </div>

            {/* Location */}
            <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Location</label>
               <div className="relative">
                 <MapPin size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                 />
               </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Session Title <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium placeholder:font-normal"
              placeholder="e.g. VB-MAPP Milestones Lvl 2"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-medium outline-none focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-medium outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-medium outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Recurrence Section (Only for new events) */}
          {!initialEvent && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                <div className="flex gap-4 items-center">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                           <Repeat size={14} /> Repeat
                        </label>
                        <select
                            value={recurrence}
                            onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                            className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 text-slate-700"
                        >
                            <option value="NONE">Does not repeat</option>
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="BIWEEKLY">Every 2 Weeks</option>
                            <option value="MONTHLY">Monthly</option>
                        </select>
                    </div>
                    {recurrence !== 'NONE' && (
                         <div className="flex-1">
                             <label className="block text-xs font-bold text-indigo-900 uppercase tracking-widest mb-2">Ends On</label>
                             <input 
                                type="date" 
                                value={recurrenceEnd}
                                onChange={(e) => setRecurrenceEnd(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 text-slate-700"
                             />
                         </div>
                    )}
                </div>
            </div>
          )}

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlignLeft size={14} /> Notes / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium placeholder:font-normal resize-none h-24"
              placeholder="Add details, clinical notes, or agenda..."
            />
          </div>

          {/* Checklist Section */}
          <div>
            <div className="flex justify-between items-end mb-3">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Session Checklist</label>
              {subTasks.length > 0 && (
                 <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${(completedCount / subTasks.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-600 tabular-nums">
                      {Math.round((completedCount / subTasks.length) * 100)}%
                    </span>
                 </div>
              )}
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {subTasks.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {subTasks.map((task) => (
                    <div key={task.id} className="group flex items-center justify-between p-3 hover:bg-white transition-colors">
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleSubTask(task.id)}
                      >
                        <div className={`
                          w-5 h-5 rounded flex items-center justify-center border transition-all
                          ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-indigo-400'}
                        `}>
                          {task.completed && <Check size={14} strokeWidth={3} className="text-white" />}
                        </div>
                        <span className={`text-sm font-medium transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {task.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => deleteSubTask(task.id)}
                        className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-400 italic">
                  No sub-tasks added yet.
                </div>
              )}
              
              <div className="p-2 bg-white border-t border-slate-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
                    placeholder="Add checklist item..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleAddSubTask}
                    className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reminders Section */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reminders</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {reminders.map(r => (
                <div key={r} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-indigo-100">
                  <Bell size={12} strokeWidth={1.5} />
                  <span>{formatReminder(r)}</span>
                  <button onClick={() => removeReminder(r)} className="hover:text-indigo-900 ml-1 rounded-full hover:bg-indigo-200/50 p-0.5"><X size={12} strokeWidth={1.5}/></button>
                </div>
              ))}
              {reminders.length === 0 && (
                <span className="text-xs text-slate-400 italic py-1.5">No reminders set.</span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Bell size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                  onChange={(e) => {
                    if(e.target.value) {
                        addReminder(Number(e.target.value));
                        e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Add reminder...</option>
                  <option value="5">5 minutes before</option>
                  <option value="10">10 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="120">2 hours before</option>
                  <option value="1440">1 day before</option>
                  <option value="2880">2 days before</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          {initialEvent ? (
            <button 
              onClick={() => onDelete(initialEvent.id)}
              className="flex items-center gap-2 text-rose-500 hover:text-rose-700 text-sm font-bold px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={18} strokeWidth={1.5} />
              <span>Delete</span>
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-lg shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 transition-all text-sm flex items-center gap-2"
            >
              <BriefcaseBusiness size={16} strokeWidth={1.5} />
              {recurrence !== 'NONE' ? 'Schedule Series' : (initialEvent ? 'Update Session' : 'Schedule Session')}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
