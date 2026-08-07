import React from 'react';
import { CalendarEvent, Client } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { Plus, AlertCircle, CheckSquare, Bell, Sparkles, CheckCircle2, Copy } from 'lucide-react';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  clients: Client[];
  onAddEvent: (date?: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
  onQuickAction?: (action: string, event: CalendarEvent) => void;
  onSmartResolve?: (event: CalendarEvent) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  clients,
  onAddEvent,
  onEventClick,
  onEventDrop,
  onQuickAction,
  onSmartResolve
}) => {
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);
    
    // Previous month padding
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month padding to fill 6 rows (42 days) for consistency
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  // Detect overlapping events for the same client on a specific day and map them
  const getConflictsMap = (dayEvents: CalendarEvent[]) => {
    const conflictMap = new Map<string, CalendarEvent[]>();
    const eventsByClient: Record<string, CalendarEvent[]> = {};

    // Group by client
    dayEvents.forEach(e => {
        if (!eventsByClient[e.clientId]) eventsByClient[e.clientId] = [];
        eventsByClient[e.clientId].push(e);
    });

    // Check overlaps within client groups
    Object.values(eventsByClient).forEach(clientEvents => {
        for (let i = 0; i < clientEvents.length; i++) {
            for (let j = i + 1; j < clientEvents.length; j++) {
                const a = clientEvents[i];
                const b = clientEvents[j];
                // Check if time ranges overlap
                if (a.start < b.end && b.start < a.end) {
                    if (!conflictMap.has(a.id)) conflictMap.set(a.id, []);
                    if (!conflictMap.has(b.id)) conflictMap.set(b.id, []);
                    
                    const aConflicts = conflictMap.get(a.id)!;
                    const bConflicts = conflictMap.get(b.id)!;
                    
                    if (!aConflicts.some(x => x.id === b.id)) aConflicts.push(b);
                    if (!bConflicts.some(x => x.id === a.id)) bConflicts.push(a);
                }
            }
        }
    });

    return conflictMap;
  };

  const days = generateCalendarDays();

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    e.dataTransfer.setData('eventId', event.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('eventId');
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    // Keep original time, just change date
    const newStart = new Date(targetDate);
    newStart.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0);

    const durationMs = event.end.getTime() - event.start.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    onEventDrop(event, newStart, newEnd);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative h-full overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-white shadow-sm z-10 shrink-0">
            {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {day}
                </div>
            ))}
        </div>

        {/* Month Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 auto-rows-fr">
            {days.map((dayObj, idx) => {
                const isToday = dayObj.date.toDateString() === new Date().toDateString();
                const dayEvents = events.filter(e => 
                    e.start.getDate() === dayObj.date.getDate() &&
                    e.start.getMonth() === dayObj.date.getMonth() &&
                    e.start.getFullYear() === dayObj.date.getFullYear()
                ).sort((a, b) => a.start.getTime() - b.start.getTime());

                const conflictsMap = getConflictsMap(dayEvents);

                return (
                    <div 
                        key={idx} 
                        onClick={() => onAddEvent(dayObj.date)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, dayObj.date)}
                        className={`
                            border-r border-b border-slate-200 p-2 min-h-0 flex flex-col gap-1 transition-colors group cursor-pointer
                            ${!dayObj.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-white hover:bg-slate-50'}
                        `}
                    >
                        {/* Date Number */}
                        <div className="flex justify-between items-start mb-1 pointer-events-none">
                            <span className={`
                                w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold
                                ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}
                            `}>
                                {dayObj.date.getDate()}
                            </span>
                        </div>

                        {/* Events List */}
                        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                            {dayEvents.map(event => {
                                const client = clients.find(c => c.id === event.clientId);
                                if (!client) return null;
                                const conflictingEvents = conflictsMap.get(event.id);
                                const isConflict = !!conflictingEvents && conflictingEvents.length > 0;
                                const hasSubTasks = event.subTasks && event.subTasks.length > 0;
                                const hasReminders = event.reminders && event.reminders.length > 0;
                                
                                return (
                                    <div
                                        key={event.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, event)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventClick(event);
                                        }}
                                        className={`
                                            w-full text-left px-2 py-1 rounded text-[10px] font-bold truncate flex items-center gap-1.5 cursor-grab active:cursor-grabbing group/event relative
                                            ${client.color} ${client.textColor} 
                                            ${isConflict ? 'ring-1 ring-red-400 border border-red-200 bg-red-50 text-red-900' : 'hover:brightness-95'}
                                            transition-all
                                        `}
                                    >
                                        {isConflict ? (
                                            <AlertCircle size={10} strokeWidth={2} className="text-red-600 shrink-0" />
                                        ) : (
                                            <div className={`w-1.5 h-1.5 rounded-full ${client.textColor.replace('text', 'bg')} opacity-50 shrink-0`}></div>
                                        )}
                                        <span className={`truncate flex-1 ${isConflict ? 'text-red-900' : ''}`}>
                                            {event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()} {event.title}
                                        </span>
                                        {!isConflict && (
                                            <div className="flex items-center gap-1 opacity-50 shrink-0">
                                                {hasReminders && <Bell size={10} strokeWidth={2} />}
                                                {hasSubTasks && <CheckSquare size={10} strokeWidth={2} />}
                                            </div>
                                        )}

                                        {/* Hover Tooltip */}
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover/event:opacity-100 transition-opacity pointer-events-none group-hover/event:pointer-events-auto z-50">
                                            {isConflict ? (
                                                <div className="bg-slate-900/95 backdrop-blur-xl text-white px-3 py-2 rounded-xl shadow-2xl w-48 text-center ring-1 ring-white/10">
                                                    <div className="text-[10px] font-bold text-red-300 border-b border-white/10 pb-1 mb-1">Conflict</div>
                                                    <div className="text-[9px] text-slate-300 truncate">Overlaps with {conflictingEvents?.[0]?.title}</div>
                                                </div>
                                            ) : (
                                                <div className="bg-white/95 backdrop-blur-xl text-slate-900 p-1 rounded-xl shadow-2xl ring-1 ring-slate-200 flex items-center gap-1">
                                                    {onSmartResolve && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onSmartResolve(event); }}
                                                            className="p-1.5 rounded-lg hover:bg-fuchsia-50 text-slate-400 hover:text-fuchsia-600"
                                                            title="AI Reschedule"
                                                        >
                                                            <Sparkles size={12} strokeWidth={2} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onQuickAction?.('STATUS_COMPLETE', event); }}
                                                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
                                                        title="Mark Complete"
                                                    >
                                                        <CheckCircle2 size={12} strokeWidth={2} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onQuickAction?.('DUPLICATE', event); }}
                                                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                                                        title="Duplicate"
                                                    >
                                                        <Copy size={12} strokeWidth={2} />
                                                    </button>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-white rotate-45 border-r border-b border-slate-200"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
        
        {/* Floating Add Button */}
        <button 
            onClick={() => onAddEvent()}
            className="absolute bottom-10 right-10 w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/30 hover:bg-slate-800 hover:scale-105 transition-all flex items-center justify-center z-40"
        >
            <Plus size={32} strokeWidth={1.5} />
        </button>
    </div>
  );
};