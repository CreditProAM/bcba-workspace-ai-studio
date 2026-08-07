import React, { useRef, useEffect, useState } from 'react';
import { CalendarEvent, Client } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { Plus, MapPin, AlertCircle, CheckSquare, Bell, Sparkles, Copy, CheckCircle2 } from 'lucide-react';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  clients: Client[];
  onAddEvent: (date?: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
  onEventResize: (event: CalendarEvent, newEnd: Date) => void;
  onContextMenu: (e: React.MouseEvent, type: 'EVENT' | 'GRID', data?: any) => void;
  onSmartResolve?: (event: CalendarEvent) => void;
  onQuickAction?: (action: string, event: CalendarEvent) => void;
  mode: 'day' | 'week';
  startHour: number;
  endHour: number;
}

export const WeekView: React.FC<WeekViewProps> = ({ 
  currentDate, 
  events, 
  clients, 
  onAddEvent,
  onEventClick,
  onEventDrop,
  onEventResize,
  onContextMenu,
  onSmartResolve,
  onQuickAction,
  mode,
  startHour,
  endHour
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- Live Time Indicator Update ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Every minute
    return () => clearInterval(timer);
  }, []);

  // Generate dynamic hours array based on props
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Scroll to 8 AM (or start time if later) on mount or view change
  useEffect(() => {
    if (scrollRef.current) {
        // Only scroll if we haven't scrolled yet/reset
        scrollRef.current.scrollTop = 0; 
    }
  }, [mode, startHour]);

  const getDaysToShow = (date: Date) => {
    if (mode === 'day') {
        return [new Date(date)];
    }
    // Week Mode
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const daysToShow = getDaysToShow(currentDate);

  // --- Resize Logic ---
  const [resizingEventId, setResizingEventId] = useState<string | null>(null);
  
  // We attach global listeners during resize to prevent losing focus
  useEffect(() => {
    if (!resizingEventId) return;

    const handleGlobalMouseMove = () => {
        // This is handled in the drag event, but we need to ensure cursor styling
        document.body.style.cursor = 'ns-resize';
    };

    const handleGlobalMouseUp = () => {
        document.body.style.cursor = 'default';
        setResizingEventId(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        document.body.style.cursor = 'default';
    };
  }, [resizingEventId]);

  const handleResizeStart = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingEventId(event.id);

    const startY = e.clientY;
    const startHeight = (event.end.getTime() - event.start.getTime()) / (1000 * 60) * (80 / 60); // pixels
    const pixelsPerMinute = 80 / 60;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        let newDurationMinutes = (startHeight + deltaY) / pixelsPerMinute;
        
        // Snap to 15
        newDurationMinutes = Math.round(newDurationMinutes / 15) * 15;
        
        // Minimum 15 mins
        if (newDurationMinutes < 15) newDurationMinutes = 15;

        const newEnd = new Date(event.start.getTime() + newDurationMinutes * 60000);
        onEventResize(event, newEnd);
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        setResizingEventId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Layout Algorithm ---
  const areOverlapping = (a: CalendarEvent, b: CalendarEvent) => {
    return a.start < b.end && b.start < a.end;
  };

  const getDayEventLayouts = (dayEvents: CalendarEvent[]) => {
    const layoutMap = new Map<string, { 
      left: number; 
      width: number; 
      hasConflict: boolean; 
      conflictingEvents: CalendarEvent[];
      top: number; 
      height: number; 
      zIndex: number 
    }>();
    
    // 1. Sort by start time, then duration (longest first)
    const sorted = [...dayEvents].sort((a, b) => {
      if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
      return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    });
  
    // 2. Calculate vertical positions
    const dayStartMinutes = startHour * 60; 
    const pixelsPerMinute = 80 / 60; 
  
    const verticalInfo = sorted.map(event => {
       const startTotalMinutes = (event.start.getHours() * 60) + event.start.getMinutes();
       const endTotalMinutes = (event.end.getHours() * 60) + event.end.getMinutes();
       const duration = endTotalMinutes - startTotalMinutes;
       
       return {
         id: event.id,
         top: Math.max(0, (startTotalMinutes - dayStartMinutes) * pixelsPerMinute),
         height: Math.max(40, duration * pixelsPerMinute),
         event
       };
    });

    type VerticalItem = typeof verticalInfo[number];
  
    // 3. Group into overlapping clusters
    const clusters: VerticalItem[][] = [];
    let currentCluster: VerticalItem[] = [];
    let clusterEnd = 0;
  
    verticalInfo.forEach(item => {
      const itemStart = item.event.start.getTime();
      const itemEnd = item.event.end.getTime();
  
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterEnd = itemEnd;
      } else {
        if (itemStart < clusterEnd) {
          currentCluster.push(item);
          clusterEnd = Math.max(clusterEnd, itemEnd);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
          clusterEnd = itemEnd;
        }
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);
  
    // 4. Process clusters for horizontal layout
    clusters.forEach(cluster => {
      const columns: VerticalItem[][] = [];
      
      cluster.forEach(item => {
        let placed = false;
        
        // Find first column where this event fits
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const lastInCol = col[col.length - 1];
          if (lastInCol.event.end.getTime() <= item.event.start.getTime()) {
            col.push(item);
            placed = true;
            break;
          }
        }
  
        if (!placed) {
          columns.push([item]);
        }
      });
  
      const totalColumns = columns.length;
  
      columns.forEach((col, colIndex) => {
        col.forEach(item => {
           // Check for conflicts within the cluster (same client overlapping)
           const conflictingEvents = cluster
             .filter(other => 
               other.id !== item.id && 
               other.event.clientId === item.event.clientId && 
               areOverlapping(item.event, other.event)
             )
             .map(other => other.event);
           
           const hasConflict = conflictingEvents.length > 0;
  
           layoutMap.set(item.id, {
             top: item.top,
             height: item.height,
             left: (colIndex / totalColumns) * 100,
             width: 100 / totalColumns,
             hasConflict: hasConflict,
             conflictingEvents: conflictingEvents,
             zIndex: hasConflict ? 50 : 10 + colIndex
           });
        });
      });
    });
  
    return layoutMap;
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData('eventId', event.id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    e.dataTransfer.setData('offsetY', offsetY.toString());

    // Create custom ghost image
    const ghost = document.createElement('div');
    ghost.style.width = '180px';
    ghost.style.padding = '8px 12px';
    ghost.style.background = '#d946ef'; // Fuchsia-500
    ghost.style.color = 'white';
    ghost.style.borderRadius = '8px';
    ghost.style.fontSize = '12px';
    ghost.style.fontWeight = 'bold';
    ghost.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.zIndex = '1000';
    ghost.innerHTML = `
      <div style="opacity: 0.8; font-size: 10px; text-transform: uppercase;">Moving</div>
      <div style="margin-top: 2px;">${event.title}</div>
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    
    // Clean up ghost element
    setTimeout(() => {
        document.body.removeChild(ghost);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('eventId');
    const offsetY = parseFloat(e.dataTransfer.getData('offsetY')) || 0;
    
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    const gridRect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - gridRect.top; 
    const dropX = e.clientX - gridRect.left;

    const pixelsPerMinute = 80 / 60;
    const adjustedY = dropY - offsetY;
    
    let minutesFromStart = Math.round(adjustedY / pixelsPerMinute);
    minutesFromStart = Math.round(minutesFromStart / 15) * 15;
    
    const totalMinutes = (startHour * 60) + minutesFromStart;
    const newStartHour = Math.floor(totalMinutes / 60);
    const newStartMinute = totalMinutes % 60;

    const colWidth = gridRect.width / daysToShow.length;
    const dayIndex = Math.floor(dropX / colWidth);
    
    if (dayIndex < 0 || dayIndex >= daysToShow.length) return;

    const targetDate = daysToShow[dayIndex];
    const newStart = new Date(targetDate);
    newStart.setHours(newStartHour, newStartMinute, 0, 0);

    const durationMs = event.end.getTime() - event.start.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    onEventDrop(event, newStart, newEnd);
  };

  // Helper to get time from click position
  const getTimeFromClick = (e: React.MouseEvent, day: Date) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const pixelsPerMinute = 80 / 60;
      const minutesFromStart = Math.round(clickY / pixelsPerMinute);
      
      const totalMinutes = (startHour * 60) + minutesFromStart;
      const hour = Math.floor(totalMinutes / 60);
      const minute = Math.round((totalMinutes % 60) / 15) * 15; // Snap click to 15 mins
      
      const clickDate = new Date(day);
      clickDate.setHours(hour, minute, 0, 0);
      return clickDate;
  };

  const handleGridClick = (e: React.MouseEvent, day: Date) => {
      const clickDate = getTimeFromClick(e, day);
      onAddEvent(clickDate);
  };

  const handleGridContextMenu = (e: React.MouseEvent, day: Date) => {
      e.preventDefault();
      const clickDate = getTimeFromClick(e, day);
      onContextMenu(e, 'GRID', clickDate);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
      
      {/* Week/Day Header */}
      <div className="flex border-b border-slate-200 bg-white shrink-0 pl-20 shadow-sm z-10">
        {daysToShow.map((day, i) => {
          const isToday = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth();
          return (
            <div key={i} className="flex-1 py-4 text-center border-r border-slate-100 last:border-r-0 group hover:bg-slate-50 transition-colors">
              <div className={`text-xs font-bold uppercase tracking-widest ${isToday ? 'text-fuchsia-600' : 'text-slate-400'}`}>
                {DAYS_OF_WEEK[day.getDay()]}
              </div>
              <div className={`text-3xl font-light mt-1 flex items-center justify-center`}>
                <span className={`w-12 h-12 flex items-center justify-center rounded-xl tabular-nums ${isToday ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200' : 'text-slate-700'}`}>
                  {day.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto relative bg-slate-50/50" ref={scrollRef}>
        <div className="flex relative" style={{ minHeight: `${hours.length * 80}px` }}>
          
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0 bg-white border-r border-slate-200 z-30 sticky left-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
            {hours.map((hour) => (
              <div key={hour} className="h-20 text-xs font-bold text-slate-400 text-right pr-4 pt-3 border-b border-slate-50 relative tabular-nums">
                {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour} {hour >= 12 && hour !== 24 ? 'PM' : 'AM'}
                <div className="absolute right-0 top-0 w-2 h-[1px] bg-slate-200"></div>
              </div>
            ))}
          </div>

          {/* Columns */}
          <div 
            className="flex flex-1 relative"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {hours.map((hour) => (
                <div key={hour} className="h-20 border-b border-slate-200/60 w-full border-dashed" />
              ))}
            </div>

            {/* Vertical Day Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {daysToShow.map((_, i) => (
                <div key={i} className="flex-1 border-r border-slate-200/60 last:border-r-0 h-full" />
              ))}
            </div>

            {/* Current Time Indicator */}
            {daysToShow.some(d => d.getDate() === currentTime.getDate()) && (
                <div 
                    className="absolute w-full border-t border-fuchsia-500 z-20 pointer-events-none transition-all duration-1000 ease-linear"
                    style={{ 
                        top: `${(currentTime.getHours() - startHour) * 80 + (currentTime.getMinutes() * (80/60))}px`,
                        display: currentTime.getHours() < startHour || currentTime.getHours() > endHour ? 'none' : 'block'
                    }}
                >
                    <div className="absolute -left-1.5 -top-1 w-2 h-2 bg-fuchsia-500 rounded-full shadow-sm animate-pulse" />
                </div>
            )}

            {/* Interaction Layer (Click/Context Menu Targets) */}
            <div className="absolute inset-0 flex w-full h-full">
                 {daysToShow.map((day, colIndex) => (
                    <div 
                        key={colIndex} 
                        className="flex-1 h-full z-0 cursor-pointer hover:bg-black/[0.01]"
                        onClick={(e) => handleGridClick(e, day)}
                        onContextMenu={(e) => handleGridContextMenu(e, day)}
                    />
                 ))}
            </div>

            {/* Events Overlay */}
            <div className="absolute inset-0 flex w-full h-full pointer-events-none">
              {daysToShow.map((day, colIndex) => {
                const dayEvents = events.filter(e => 
                  e.start.getDate() === day.getDate() && 
                  e.start.getMonth() === day.getMonth() &&
                  e.start.getFullYear() === day.getFullYear()
                );
                
                const layouts = getDayEventLayouts(dayEvents);

                return (
                  <div key={colIndex} className="flex-1 relative h-full group/col">
                    {dayEvents.map((event) => {
                      const client = clients.find(c => c.id === event.clientId);
                      if (!client) return null;
                      
                      const layout = layouts.get(event.id);
                      if (!layout) return null;

                      if (event.end.getHours() < startHour) return null;

                      const subTaskCount = event.subTasks?.length || 0;
                      const completedSubTasks = event.subTasks?.filter(t => t.completed).length || 0;
                      const hasReminders = event.reminders && event.reminders.length > 0;
                      const isResizing = resizingEventId === event.id;

                      return (
                        <div
                          key={event.id}
                          draggable={!isResizing} // Disable drag while resizing
                          onDragStart={(e) => handleDragStart(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onContextMenu(e, 'EVENT', event);
                          }}
                          className={`
                            absolute p-1.5 rounded-lg shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing overflow-hidden group flex flex-col pointer-events-auto
                            ${client.color}
                            ${layout.hasConflict 
                              ? 'border-2 border-dashed border-red-500 ring-2 ring-red-100 z-50' 
                              : `border-l-[6px] ${client.borderColor} border-t border-r border-b border-black/5`
                            }
                            ${isResizing ? 'ring-2 ring-fuchsia-500 shadow-xl z-[60] opacity-90' : 'hover:scale-[1.02]'}
                          `}
                          style={{
                            top: `${layout.top}px`,
                            height: `${layout.height}px`,
                            left: `calc(${layout.left}% + 2px)`,
                            width: `calc(${layout.width}% - 4px)`,
                            zIndex: layout.zIndex
                          }}
                        >
                          {layout.hasConflict && (
                             <div className="flex items-center gap-1.5 bg-red-500 text-white px-2 py-1 rounded-t-sm mb-1.5 -mx-1.5 -mt-1.5 shadow-sm">
                                <AlertCircle size={11} className="shrink-0 fill-red-900 text-white" strokeWidth={3} />
                                <span className="text-[9px] font-extrabold uppercase tracking-widest">Conflict</span>
                             </div>
                          )}

                          <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-80 ${client.textColor} truncate flex items-center justify-between`}>
                            <span>{event.serviceType || 'Session'}</span>
                            <div className="flex items-center gap-1.5 opacity-70">
                                {hasReminders && <Bell size={10} strokeWidth={2} />}
                                {subTaskCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <CheckSquare size={10} strokeWidth={2} />
                                    <span className="text-[9px] font-mono tabular-nums">{completedSubTasks}/{subTaskCount}</span>
                                </div>
                                )}
                            </div>
                          </div>
                          
                          <div className={`font-bold text-xs leading-tight mb-1 ${client.textColor} line-clamp-2`}>
                            {event.title}
                          </div>
                          
                          {!layout.hasConflict && (
                            <div className="flex items-center gap-1.5 mt-auto pt-1">
                              <div className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[8px] font-bold border border-black/5 shrink-0">
                                  {client.avatar}
                              </div>
                              <span className={`text-[10px] font-semibold ${client.textColor} truncate`}>{client.name}</span>
                              
                              {event.location && (
                                <div className="ml-auto flex items-center gap-0.5 opacity-60">
                                  <MapPin size={8} strokeWidth={2} />
                                  <span className="text-[8px]">{event.location}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Resize Handle */}
                          <div 
                             className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity pb-0.5 hover:bg-black/5"
                             onMouseDown={(e) => handleResizeStart(e, event)}
                             onClick={e => e.stopPropagation()} // Prevent modal open
                          >
                             <div className="w-8 h-1 rounded-full bg-black/20"></div>
                          </div>

                          {/* Hover Tooltip for Conflict OR Quick Actions */}
                          {layout.hasConflict ? (
                             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/95 backdrop-blur-xl text-white px-3 py-2 rounded-xl shadow-2xl z-50 pointer-events-auto w-64 text-center ring-1 ring-white/10">
                                <div className="text-xs font-bold mb-2 flex items-center justify-center gap-1.5 text-red-300 border-b border-white/10 pb-2">
                                    <AlertCircle size={12} strokeWidth={2} />
                                    Conflict Detected
                                </div>
                                <div className="text-[10px] text-slate-300 leading-tight text-left mb-3">
                                    <div className="mb-1 text-slate-400 font-medium uppercase tracking-wider text-[9px]">Overlaps with:</div>
                                    <div className="space-y-1">
                                        {layout.conflictingEvents.map(ce => (
                                            <div key={ce.id} className="bg-white/10 rounded px-2 py-1.5">
                                                <div className="font-bold text-white text-[10px] mb-0.5 tabular-nums">
                                                  {ce.start.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})} - {ce.end.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                                </div>
                                                <div className="truncate text-slate-200">{ce.title}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {onSmartResolve && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSmartResolve(event);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-lg text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all active:scale-95"
                                    >
                                        <Sparkles size={12} strokeWidth={2} />
                                        <span>AI Resolve</span>
                                    </button>
                                )}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                             </div>
                          ) : (
                             // Quick Actions Tooltip for standard events
                             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-xl text-slate-900 px-1 py-1 rounded-xl shadow-2xl z-50 pointer-events-auto ring-1 ring-slate-200 flex items-center gap-1 scale-95 group-hover:scale-100 origin-top duration-200">
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 ring-1 ring-slate-200 border-l border-t border-slate-200"></div>
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 z-10"></div>
                                
                                {onSmartResolve && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSmartResolve(event);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-fuchsia-50 text-slate-400 hover:text-fuchsia-600 transition-colors relative z-20"
                                        title="AI Reschedule"
                                    >
                                        <Sparkles size={14} strokeWidth={2} />
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickAction?.('STATUS_COMPLETE', event);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors relative z-20"
                                    title="Mark Complete"
                                >
                                    <CheckCircle2 size={14} strokeWidth={2} />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickAction?.('DUPLICATE', event);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors relative z-20"
                                    title="Duplicate"
                                >
                                    <Copy size={14} strokeWidth={2} />
                                </button>
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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