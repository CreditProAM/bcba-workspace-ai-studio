
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WeekView } from './components/WeekView';
import { MonthView } from './components/MonthView';
import { CaseloadView } from './components/CaseloadView';
import { SupervisionView } from './components/SupervisionView';
import { SupervisionLogModal } from './components/SupervisionLogModal';
import { ActivityView } from './components/ActivityView';
import { SidekickModal } from './components/SidekickModal';
import { EventModal } from './components/EventModal';
import { ClientModal } from './components/ClientModal';
import { SettingsModal } from './components/SettingsModal';
import { ClientProfilePanel } from './components/ClientProfilePanel';
import { ServicePlanManagerModal } from './components/servicePlan/ServicePlanManagerModal';
import { CommandPalette } from './components/CommandPalette';
import { ContextMenu, ContextMenuCoords, ContextMenuType } from './components/ContextMenu';
import { AuthScreen } from './components/AuthScreen';
import { NotesHome } from './components/notes/NotesHome';
import { ClientNotesList } from './components/notes/ClientNotesList';
import { DataCollection } from './components/notes/DataCollection';
import { DocumentEditor, DocContext } from './components/notes/DocumentEditor';
import { DataOverview } from './components/data/DataOverview';
import { ToolkitHome } from './components/toolkit/ToolkitHome';
import { INITIAL_CLIENTS, INITIAL_EVENTS } from './constants';
import { CalendarEvent, Client, CalendarView, AppState, ActivityLogEntry, User, SessionNote, Assessment, ParentTrainingLog, ServicePlan, ClinicalProgram } from './types';
import { useHistory } from './hooks/useHistory';
import { useAutoSave } from './hooks/useAutoSave';
import { Bell, X, ShieldCheck, Clipboard, Sparkles, CheckCircle2 } from 'lucide-react';
import { suggestRescheduling } from './services/geminiService';

// Keys
const STORAGE_KEY_APP_STATE = 'bcba_dashboard_state_v1';
const STORAGE_KEY_SETTINGS = 'bcba_dashboard_settings_v1';
const STORAGE_KEY_ACTIVITY = 'bcba_dashboard_activity_v1';
const STORAGE_KEY_EVENTS_LEGACY = 'bcba_dashboard_events_v2';
const STORAGE_KEY_CLIENTS_LEGACY = 'bcba_dashboard_clients_v2';
const STORAGE_KEY_CURRENT_USER = 'bcba_current_user_v1';

export type PrimaryTab = 'today' | 'caseload' | 'notes' | 'supervision' | 'data' | 'toolkit' | 'activity';

const TAB_TITLES: Record<Exclude<PrimaryTab, 'today'>, string> = {
  caseload: 'Clinical Caseload',
  notes: 'Session Notes',
  supervision: 'Supervision Planner',
  data: 'Data & Progress',
  toolkit: 'Clinical Toolkit',
  activity: 'System Activity',
};

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for active session
    const savedUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
    }
    setAuthChecked(true);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [activeTab, setActiveTab] = useState<PrimaryTab>('today');

  // Initialize State
  const getInitialState = (): AppState => {
    try {
      // 1. Try Main State
      const savedState = localStorage.getItem(STORAGE_KEY_APP_STATE);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        return {
          clients: parsed.clients || INITIAL_CLIENTS,
          events: (parsed.events || []).map((e: any) => ({
             ...e,
             start: new Date(e.start),
             end: new Date(e.end)
          })),
          servicePlans: parsed.servicePlans || [],
          programLibrary: parsed.programLibrary || []
        };
      }

      // 2. Try Backup State (Safety Net)
      const backupState = localStorage.getItem(`${STORAGE_KEY_APP_STATE}_backup`);
      if (backupState) {
        const parsed = JSON.parse(backupState);
        console.log("Restored from 5-minute backup.");
        return {
          clients: parsed.clients || INITIAL_CLIENTS,
          events: (parsed.events || []).map((e: any) => ({
             ...e,
             start: new Date(e.start),
             end: new Date(e.end)
          })),
          servicePlans: parsed.servicePlans || [],
          programLibrary: parsed.programLibrary || []
        };
      }

      // 3. Legacy Migration
      const legacyClients = localStorage.getItem(STORAGE_KEY_CLIENTS_LEGACY);
      const legacyEvents = localStorage.getItem(STORAGE_KEY_EVENTS_LEGACY);

      if (legacyClients || legacyEvents) {
         const clients = legacyClients ? JSON.parse(legacyClients) : INITIAL_CLIENTS;
         const events = legacyEvents ? JSON.parse(legacyEvents).map((e: any) => ({
             ...e,
             start: new Date(e.start),
             end: new Date(e.end)
         })) : INITIAL_EVENTS;
         return { clients, events };
      }
    } catch (e) { console.warn(e); }

    return { clients: INITIAL_CLIENTS, events: INITIAL_EVENTS };
  };

  // Core History State
  const { state: appState, set: setAppState, undo, redo, canUndo, canRedo } = useHistory<AppState>(getInitialState());
  const { clients, events } = appState;

  // --- Auto-Save Implementation ---
  // 1. Real-time Debounced Save (1s delay)
  const { status: saveStatus, lastSaved } = useAutoSave(STORAGE_KEY_APP_STATE, appState);

  // 2. Periodic Safety Backup (Every 5 minutes)
  const appStateRef = useRef(appState);
  useEffect(() => { appStateRef.current = appState; }, [appState]);

  // Toast System
  const [toasts, setToasts] = useState<{id: string, title: string, message: string, icon?: React.ReactNode, action?: {label: string, onClick: () => void}}[]>([]);

  const addToast = (title: string, message: string, icon?: React.ReactNode, action?: {label: string, onClick: () => void}) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, {id, title, message, icon, action}]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    const backupInterval = setInterval(() => {
      try {
        localStorage.setItem(`${STORAGE_KEY_APP_STATE}_backup`, JSON.stringify(appStateRef.current));
        // Visual indicator for the periodic backup
        addToast(
          'Auto-Backup Complete',
          'System state secured to safety backup.',
          <ShieldCheck size={20} strokeWidth={1.5} />
        );
      } catch (e) {
        console.error("Backup failed", e);
      }
    }, 5 * 60 * 1000); // 5 Minutes

    return () => clearInterval(backupInterval);
  }, []);

  // Activity Log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_ACTIVITY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useAutoSave(STORAGE_KEY_ACTIVITY, activityLog); // Auto-save logs too

  const logActivity = (
    action: ActivityLogEntry['action'],
    targetType: ActivityLogEntry['targetType'],
    description: string,
    metadata?: string
  ) => {
    const newEntry: ActivityLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action,
        targetType,
        description,
        metadata,
        user: currentUser?.name || 'Unknown User'
    };
    setActivityLog(prev => [newEntry, ...prev]);
  };

  // Settings
  const [workHours, setWorkHours] = useState<{ start: number; end: number }>(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
        return saved ? JSON.parse(saved) : { start: 8, end: 19 };
    } catch { return { start: 8, end: 19 }; }
  });
  useAutoSave(STORAGE_KEY_SETTINGS, workHours); // Auto-save settings

  const [activeClients, setActiveClients] = useState<string[]>([]);

  // Utilization Metrics
  const utilizationMetrics = React.useMemo(() => {
      const activeClientList = clients.filter(c => c.status === 'Active' || c.status === 'Onboarding');
      const totalAuthorized = activeClientList.reduce((acc, c) => acc + (c.authorizedHours || 0), 0);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const scheduledMinutes = events
        .filter(e => activeClientList.some(c => c.id === e.clientId) && e.start >= weekStart && e.end <= weekEnd)
        .reduce((acc, e) => acc + (e.end.getTime() - e.start.getTime()) / 60000, 0);

      const weeklyScheduled = (scheduledMinutes / 60) / 2;

      return {
          scheduled: Math.round(weeklyScheduled),
          total: totalAuthorized,
          percentage: totalAuthorized > 0 ? (weeklyScheduled / totalAuthorized) * 100 : 0
      };
  }, [clients, events]);

  // Reminders
  useEffect(() => {
    if (!currentUser) return; // Don't check reminders if logged out
    const checkReminders = () => {
        const now = new Date();
        events.forEach(event => {
            if (event.reminders && event.reminders.length > 0) {
                event.reminders.forEach(minutes => {
                    const reminderTime = new Date(event.start.getTime() - minutes * 60000);
                    const diff = now.getTime() - reminderTime.getTime();
                    if (diff >= 0 && diff < 60000) {
                        addToast(
                            'Upcoming Session',
                            `${event.title} starts in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
                        );
                    }
                });
            }
        });
    };
    const timer = setInterval(checkReminders, 60000);
    checkReminders();
    return () => clearInterval(timer);
  }, [events, currentUser]);

  useEffect(() => {
    setActiveClients(prev => {
        const currentIds = clients.map(c => c.id);
        if (prev.length === 0) return currentIds;
        return prev.filter(id => currentIds.includes(id));
    });
  }, [clients.length]);

  // Notes tab navigation: client -> notes list -> note/document editor.
  // Stores IDs only (not object references) so it always reflects the live,
  // undo/redo-aware appState rather than a stale snapshot.
  const [notesView, setNotesView] = useState<{
    clientId: string;
    screen: 'list' | 'note' | 'doc';
    noteId?: string;
    doc?: DocContext;
  } | null>(null);

  // Modal States
  const [isSidekickOpen, setIsSidekickOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [logHoursClient, setLogHoursClient] = useState<Client | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // New Overlays
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isServicePlanManagerOpen, setIsServicePlanManagerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ type: ContextMenuType, coords: ContextMenuCoords, data: any } | null>(null);

  const handleSaveServicePlan = (plan: ServicePlan) => {
    const existing = (appState.servicePlans || []);
    const idx = existing.findIndex(p => p.id === plan.id);
    let updated;
    if (idx > -1) {
      updated = [...existing];
      updated[idx] = plan;
    } else {
      updated = [...existing, plan];
    }
    setAppState({ ...appState, servicePlans: updated });
    logActivity(idx > -1 ? 'UPDATE' : 'CREATE', 'CLIENT', `Updated Service Plan for client`, plan.clientId);
    addToast('Service Plan Saved', 'The service plan has been updated.', <CheckCircle2 size={20} className="text-emerald-500" />);
  };

  const handleSaveProgramToLibrary = (program: ClinicalProgram) => {
    const existing = (appState.programLibrary || []);
    const idx = existing.findIndex(p => p.id === program.id);
    let updated;
    if (idx > -1) {
      updated = [...existing];
      updated[idx] = program;
    } else {
      updated = [...existing, program];
    }
    setAppState({ ...appState, programLibrary: updated });
    addToast('Template Saved', 'Program saved to the local library.', <CheckCircle2 size={20} className="text-emerald-500" />);
  };

  // Clipboard State
  const [clipboard, setClipboard] = useState<CalendarEvent | null>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        if (canRedo) redo();
        e.preventDefault();
      }
      // Command Palette (Cmd+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const toggleClient = (id: string) => {
    setActiveClients(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }
    const multiplier = direction === 'next' ? 1 : -1;
    if (view === 'day') {
        newDate.setDate(newDate.getDate() + multiplier);
    } else if (view === 'week') {
        newDate.setDate(newDate.getDate() + (7 * multiplier));
    } else if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + multiplier);
    }
    setCurrentDate(newDate);
  };

  const handleSaveEvent = (eventOrEvents: CalendarEvent | CalendarEvent[]) => {
    const newEvents = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
    const currentEvents = [...appState.events];
    let createdCount = 0;
    let updatedCount = 0;

    newEvents.forEach(evt => {
        const index = currentEvents.findIndex(e => e.id === evt.id);
        if (index >= 0) {
            currentEvents[index] = evt;
            updatedCount++;
        } else {
            currentEvents.push(evt);
            createdCount++;
        }
    });

    setAppState({
        ...appState,
        events: currentEvents
    });

    // Feedback
    addToast('Schedule Updated', 'Session has been saved successfully.', <CheckCircle2 size={20} className="text-emerald-500"/>);

    // Activity Log
    if (newEvents.length > 1) {
         logActivity('CREATE', 'EVENT', `Scheduled recurring series: "${newEvents[0].title}" (${newEvents.length} sessions)`, newEvents[0].seriesId);
    } else if (newEvents.length === 1) {
         const evt = newEvents[0];
         const isUpdate = updatedCount > 0;
         logActivity(isUpdate ? 'UPDATE' : 'CREATE', 'EVENT', `${isUpdate ? 'Updated' : 'Scheduled'} session: "${evt.title}"`, evt.id);
    }
  };

  const handleDeleteEvent = (id: string) => {
    const event = appState.events.find(e => e.id === id);
    setAppState({
        ...appState,
        events: appState.events.filter(e => e.id !== id)
    });
    setIsEventModalOpen(false);
    if (event) logActivity('DELETE', 'EVENT', `Deleted session: "${event.title}"`, id);
    addToast('Event Deleted', 'Session removed from schedule.');
  };

  const handleEventDrop = (event: CalendarEvent, newStart: Date, newEnd: Date) => {
    const updatedEvent = { ...event, start: newStart, end: newEnd };
    handleSaveEvent(updatedEvent);
  };

  const handleEventResize = (event: CalendarEvent, newEnd: Date) => {
    const updatedEvent = { ...event, end: newEnd };
    handleSaveEvent(updatedEvent);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleAddClick = (date?: Date) => {
    const newEventTemplate = date ? {
        id: '',
        title: '',
        start: date,
        end: new Date(date.getTime() + 60*60*1000), // 1 hour default
        clientId: clients[0]?.id,
        serviceType: 'Direct 1:1' as const,
        location: 'Clinic' as const
    } : null;

    setEditingEvent(newEventTemplate);
    setIsEventModalOpen(true);
  };

  const handleScheduleSupervision = (client: Client) => {
    setActiveTab('today');
    // Pre-fill a supervision event
    setEditingEvent({
        id: '',
        title: 'RBT Supervision',
        start: new Date(),
        end: new Date(new Date().getTime() + 60 * 60 * 1000),
        clientId: client.id,
        serviceType: 'RBT Supervision',
        location: 'Clinic',
        description: 'Supervision compliance session'
    });
    setIsEventModalOpen(true);
  };

  // Log already-completed supervision hours retroactively (SupervisionView "Log Hours" action)
  const handleLogHoursClick = (client: Client) => {
    setLogHoursClient(client);
  };

  const handleSaveSupervisionLog = (event: CalendarEvent) => {
    handleSaveEvent(event);
    setLogHoursClient(null);
  };

  const handleSidekickAction = (action: { type: 'CREATE', event: CalendarEvent }) => {
    if (action.type === 'CREATE') {
      handleSaveEvent(action.event);
      logActivity('SYSTEM', 'EVENT', `AI Agent scheduled: "${action.event.title}"`, action.event.id);
    }
  };

  // Smart Resolve Logic
  const handleSmartResolve = async (conflictEvent: CalendarEvent) => {
    addToast('AI Analyzing Schedule', 'Finding optimal slot...', <Sparkles size={20} className="animate-spin text-fuchsia-500"/>);
    try {
        const suggestion = await suggestRescheduling(conflictEvent, events);
        addToast(
            'Suggestion Found',
            suggestion.reasoning,
            <CheckCircle2 size={20} className="text-emerald-500"/>,
            {
                label: 'Apply Change',
                onClick: () => {
                    const newStart = new Date(suggestion.newStart);
                    const newEnd = new Date(suggestion.newEnd);
                    handleSaveEvent({ ...conflictEvent, start: newStart, end: newEnd });
                    addToast('Resolved', 'Event rescheduled successfully.');
                }
            }
        );
    } catch (e) {
        addToast('Analysis Failed', 'Could not find a better slot.', <X size={20} />);
    }
  };

  const handleAddClientClick = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const handleEditClientClick = (client: Client) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
    setSelectedClient(null);
  };

  const handleSaveClient = (data: { id?: string; name: string; diagnosis: string; status: Client['status']; imageUrl?: string }) => {
    if (data.id) {
        const existing = clients.find(c => c.id === data.id);
        if (!existing) return;
        const updatedClient: Client = {
            ...existing,
            name: data.name,
            diagnosis: data.diagnosis,
            status: data.status,
            imageUrl: data.imageUrl, // Persist image
            avatar: data.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
        };
        setAppState({
            ...appState,
            clients: appState.clients.map(c => c.id === data.id ? updatedClient : c)
        });
        logActivity('UPDATE', 'CLIENT', `Updated profile for: ${updatedClient.name}`, updatedClient.id);
    } else {
        const palette = [
            { c: 'bg-cyan-100', b: 'border-cyan-400', t: 'text-cyan-900' },
            { c: 'bg-lime-100', b: 'border-lime-400', t: 'text-lime-900' },
            { c: 'bg-fuchsia-100', b: 'border-fuchsia-400', t: 'text-fuchsia-900' },
            { c: 'bg-orange-100', b: 'border-orange-400', t: 'text-orange-900' },
            { c: 'bg-teal-100', b: 'border-teal-400', t: 'text-teal-900' },
            { c: 'bg-violet-100', b: 'border-violet-400', t: 'text-violet-900' },
        ];
        const color = palette[Math.floor(Math.random() * palette.length)];
        const initials = data.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        const id = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        const newClient: Client = {
            id,
            name: data.name,
            avatar: initials,
            color: color.c,
            borderColor: color.b,
            textColor: color.t,
            diagnosis: data.diagnosis,
            status: data.status,
            imageUrl: data.imageUrl, // Persist image
            authorizedHours: 15
        };
        setAppState({
            ...appState,
            clients: [...appState.clients, newClient]
        });
        logActivity('CREATE', 'CLIENT', `Onboarded new client: ${newClient.name}`, newClient.id);
        setActiveClients(prev => [...prev, id]);
    }
    setIsClientModalOpen(false);
  };

  const handleDeleteClient = (id: string) => {
    const client = clients.find(c => c.id === id);
    setAppState({
        ...appState,
        clients: appState.clients.filter(c => c.id !== id),
        events: appState.events.filter(e => e.clientId !== id)
    });
    if (client) logActivity('DELETE', 'CLIENT', `Archived/Deleted client: ${client.name}`, id);
    setIsClientModalOpen(false);
    setSelectedClient(null);
  };

  // --- Notes: session notes, FBAs, and parent training logs ---
  // These live on the client record inside appState, so they automatically
  // participate in the same undo/redo history and autosave as everything else.

  const upsertSessionNote = (clientId: string, noteData: Omit<SessionNote, 'id'> & { id?: string }) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.sessionNotes || [];
    const existingIndex = noteData.id ? existing.findIndex(n => n.id === noteData.id) : -1;
    let updatedNotes: SessionNote[];
    if (existingIndex > -1) {
      updatedNotes = [...existing];
      updatedNotes[existingIndex] = { ...updatedNotes[existingIndex], ...noteData, id: noteData.id! };
    } else {
      updatedNotes = [...existing, { ...noteData, id: `note_${Date.now()}` } as SessionNote];
    }
    setAppState({
      ...appState,
      clients: appState.clients.map(c => c.id === clientId ? { ...c, sessionNotes: updatedNotes } : c)
    });
    logActivity(existingIndex > -1 ? 'UPDATE' : 'CREATE', 'CLIENT', `${existingIndex > -1 ? 'Updated' : 'Saved'} session note for ${client.name} (${noteData.date})`, clientId);
    addToast('Note Saved', `Session note for ${client.name} saved to their record.`, <CheckCircle2 size={20} className="text-emerald-500" />);
    setNotesView(prev => prev ? { clientId: prev.clientId, screen: 'list' } : prev);
  };

  const upsertAssessment = (clientId: string, docData: Omit<Assessment, 'id'> & { id?: string }) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.assessments || [];
    const existingIndex = docData.id ? existing.findIndex(a => a.id === docData.id) : -1;
    let updated: Assessment[];
    if (existingIndex > -1) {
      updated = [...existing];
      updated[existingIndex] = { ...updated[existingIndex], ...docData, id: docData.id! };
    } else {
      updated = [...existing, { ...docData, id: `assessment_${Date.now()}` } as Assessment];
    }
    setAppState({
      ...appState,
      clients: appState.clients.map(c => c.id === clientId ? { ...c, assessments: updated } : c)
    });
    logActivity(existingIndex > -1 ? 'UPDATE' : 'CREATE', 'CLIENT', `Saved FBA for ${client.name}`, clientId);
    addToast('FBA Saved', `Functional Behavior Assessment saved for ${client.name}.`, <CheckCircle2 size={20} className="text-emerald-500" />);
    setNotesView(prev => prev ? { clientId: prev.clientId, screen: 'list' } : prev);
  };

  const upsertParentTrainingLog = (clientId: string, logData: Omit<ParentTrainingLog, 'id'> & { id?: string }) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.parentTrainingLogs || [];
    const existingIndex = logData.id ? existing.findIndex(l => l.id === logData.id) : -1;
    let updated: ParentTrainingLog[];
    if (existingIndex > -1) {
      updated = [...existing];
      updated[existingIndex] = { ...updated[existingIndex], ...logData, id: logData.id! };
    } else {
      updated = [...existing, { ...logData, id: `pt_${Date.now()}` } as ParentTrainingLog];
    }
    setAppState({
      ...appState,
      clients: appState.clients.map(c => c.id === clientId ? { ...c, parentTrainingLogs: updated } : c)
    });
    logActivity(existingIndex > -1 ? 'UPDATE' : 'CREATE', 'CLIENT', `Logged parent training for ${client.name}`, clientId);
    addToast('Parent Training Logged', `Training log saved for ${client.name}.`, <CheckCircle2 size={20} className="text-emerald-500" />);
    setNotesView(prev => prev ? { clientId: prev.clientId, screen: 'list' } : prev);
  };

  // --- Copy/Paste Logic ---
  const handleCopyEvent = (event: CalendarEvent) => {
    setClipboard(event);
    addToast('Copied to Clipboard', 'You can now paste this event into a new time slot.', <Clipboard size={20} />);
    setContextMenu(null);
  };

  const handlePasteEvent = (targetDate: Date) => {
    if (!clipboard) return;
    const duration = clipboard.end.getTime() - clipboard.start.getTime();
    const newStart = new Date(targetDate);
    const newEnd = new Date(newStart.getTime() + duration);

    const newEvent = {
        ...clipboard,
        id: crypto.randomUUID(),
        title: `${clipboard.title} (Copy)`,
        start: newStart,
        end: newEnd
    };
    handleSaveEvent(newEvent);
    addToast('Event Pasted', `Scheduled copy of "${clipboard.title}"`);
    setContextMenu(null);
  };

  // --- Action Executors ---
  const executeEventAction = (action: string, data: any) => {
    if (action === 'EDIT') handleEventClick(data);
    if (action === 'DELETE') {
        if (window.confirm('Delete this event?')) handleDeleteEvent(data.id);
    }
    if (action === 'DUPLICATE') {
        const newEvent = { ...data, id: crypto.randomUUID(), title: `${data.title} (Copy)` };
        handleSaveEvent(newEvent);
        addToast('Event Duplicated', `Created copy of ${data.title}`);
    }
    if (action === 'COPY') handleCopyEvent(data);
    if (action === 'EMAIL') {
        const client = clients.find(c => c.id === data.clientId);
        if (client) window.open(`mailto:?subject=Session Update: ${data.title}&body=Hi ${client.name}, regarding our session on ${data.start.toLocaleDateString()}...`);
    }
    if (action === 'STATUS_COMPLETE') {
       handleSaveEvent({ ...data, title: `[Completed] ${data.title}` });
       addToast('Marked Complete', 'Event status updated.');
    }
  };

  // Context Menu
  const handleContextMenu = (e: React.MouseEvent, type: ContextMenuType, data?: any) => {
    e.preventDefault();
    setContextMenu({
        type,
        coords: { x: e.clientX, y: e.clientY },
        data
    });
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return;
    const { type, data } = contextMenu;

    if (type === 'EVENT') {
        executeEventAction(action, data);
    } else if (type === 'GRID') {
        if (action === 'ADD') handleAddClick(data);
        if (action === 'ADD_RBT') {
           setEditingEvent({
              id: '',
              title: 'RBT Supervision',
              start: data,
              end: new Date(data.getTime() + 60*60*1000),
              clientId: clients[0]?.id || '',
              serviceType: 'RBT Supervision',
              location: 'Clinic'
           });
           setIsEventModalOpen(true);
        }
        if (action === 'PASTE') handlePasteEvent(data);
    }
    setContextMenu(null);
  };

  const handleQuickAction = (action: string, event: CalendarEvent) => {
      if (action === 'AI_RESOLVE') handleSmartResolve(event);
      else executeEventAction(action, event);
  };

  const visibleEvents = events.filter(e => activeClients.includes(e.clientId));

  const renderMainContent = () => {
    switch (activeTab) {
      case 'activity':
        return <ActivityView logs={activityLog} />;
      case 'caseload':
        return (
          <CaseloadView
            clients={clients}
            onAddClient={handleAddClientClick}
            onClientClick={setSelectedClient}
          />
        );
      case 'notes': {
        const notesClient = notesView ? clients.find(c => c.id === notesView.clientId) || null : null;

        if (!notesView || !notesClient) {
          return (
            <NotesHome
              clients={clients}
              events={events}
              onSelectClient={(client) => setNotesView({ clientId: client.id, screen: 'list' })}
            />
          );
        }

        if (notesView.screen === 'note') {
          const noteToEdit = notesView.noteId ? notesClient.sessionNotes?.find(n => n.id === notesView.noteId) || null : null;
          const activeServicePlan = appState.servicePlans?.find(p => p.clientId === notesClient.id && p.status === 'active');
          return (
            <DataCollection
              client={notesClient}
              activeServicePlan={activeServicePlan}
              noteToEdit={noteToEdit}
              currentUser={currentUser}
              onSave={upsertSessionNote}
              onCancel={() => setNotesView({ clientId: notesClient.id, screen: 'list' })}
              addToast={addToast}
            />
          );
        }

        if (notesView.screen === 'doc' && notesView.doc) {
          return (
            <DocumentEditor
              client={notesClient}
              context={notesView.doc}
              onSaveAssessment={upsertAssessment}
              onSaveParentTraining={upsertParentTrainingLog}
              onCancel={() => setNotesView({ clientId: notesClient.id, screen: 'list' })}
            />
          );
        }

        return (
          <ClientNotesList
            client={notesClient}
            onBack={() => setNotesView(null)}
            onNewNote={() => setNotesView({ clientId: notesClient.id, screen: 'note' })}
            onOpenNote={(note) => setNotesView({ clientId: notesClient.id, screen: 'note', noteId: note.id })}
            onNewFba={() => setNotesView({ clientId: notesClient.id, screen: 'doc', doc: { docType: 'FBA' } })}
            onNewParentTraining={() => setNotesView({ clientId: notesClient.id, screen: 'doc', doc: { docType: 'ParentTraining' } })}
          />
        );
      }
      case 'supervision':
        return (
            <SupervisionView
                clients={clients}
                events={events}
                onSchedule={handleScheduleSupervision}
                onLogHours={handleLogHoursClick}
                currentDate={currentDate}
                onSaveEvent={handleSaveEvent}
            />
        );
      case 'data':
        return <DataOverview clients={clients} events={events} utilizationMetrics={utilizationMetrics} servicePlans={appState.servicePlans || []} />;
      case 'toolkit':
        return <ToolkitHome />;
      case 'today':
      default:
        return view === 'month' ? (
            <MonthView
                currentDate={currentDate}
                events={visibleEvents}
                clients={clients}
                onAddEvent={handleAddClick}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
                onQuickAction={handleQuickAction}
                onSmartResolve={handleSmartResolve}
            />
        ) : (
            <WeekView
                currentDate={currentDate}
                events={visibleEvents}
                clients={clients}
                onAddEvent={() => handleAddClick()}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onContextMenu={handleContextMenu}
                onSmartResolve={handleSmartResolve}
                onQuickAction={handleQuickAction}
                mode={view as 'week' | 'day'}
                startHour={workHours.start}
                endHour={workHours.end}
            />
        );
    }
  };

  if (!authChecked) return null; // Prevent flash
  if (!currentUser) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-fuchsia-100 selection:text-fuchsia-900">

      <Sidebar
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {activeTab === 'today' ? (
            <Header
              clients={clients}
              activeClients={activeClients}
              toggleClient={toggleClient}
              onClientClick={setSelectedClient}
              onSidekickClick={() => setIsSidekickOpen(true)}
              currentDate={currentDate}
              onNavigate={handleNavigate}
              onAddClient={handleAddClientClick}
              view={view}
              onViewChange={setView}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              saveStatus={saveStatus} // Auto-save status
              lastSaved={lastSaved}
              utilizationMetrics={utilizationMetrics}
            />
        ) : (
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm z-30 sticky top-0">
                 <h1 className="text-xl font-serif font-bold text-slate-900">
                    {TAB_TITLES[activeTab]}
                 </h1>
                 <div className="flex items-center gap-4">
                     <button
                        onClick={() => setIsSidekickOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                     >
                        Ask Sidekick
                     </button>
                 </div>
            </div>
        )}

        {renderMainContent()}
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
            <div key={toast.id} className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-80 animate-slide-in-right pointer-events-auto flex gap-3 relative overflow-hidden">
                <div className={`w-1.5 absolute left-0 top-0 bottom-0 ${toast.icon ? 'bg-emerald-50' : 'bg-fuchsia-50'}`}></div>
                <div className={`${toast.icon ? 'bg-emerald-50 text-emerald-600' : 'bg-fuchsia-50 text-fuchsia-600'} rounded-lg p-2 h-fit`}>
                    {toast.icon || <Bell size={20} strokeWidth={1.5} />}
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-sm">{toast.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{toast.message}</p>
                    {toast.action && (
                        <button
                            onClick={() => { toast.action.onClick(); setToasts(t => t.filter(x => x.id !== toast.id)); }}
                            className="mt-2 text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
                <button onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))} className="text-slate-400 hover:text-slate-600 h-fit">
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
        ))}
      </div>

      {/* Overlays */}
      <SidekickModal
        isOpen={isSidekickOpen}
        onClose={() => setIsSidekickOpen(false)}
        events={visibleEvents}
        clients={clients}
        onAction={handleSidekickAction}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={editingEvent}
        clients={clients}
      />

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        onDelete={handleDeleteClient}
        initialClient={editingClient}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        workHours={workHours}
        onSave={setWorkHours}
      />

      <ClientProfilePanel
        client={selectedClient}
        events={events}
        servicePlans={appState.servicePlans || []}
        onClose={() => setSelectedClient(null)}
        onEdit={() => selectedClient && handleEditClientClick(selectedClient)}
        onLogHours={handleSaveEvent}
        onOpenServicePlan={() => setIsServicePlanManagerOpen(true)}
        onNavigateToNotes={(view) => {
          setActiveTab('notes');
          setNotesView(view);
          setSelectedClient(null); // Optional: Close workspace when jumping to full screen notes? Or leave it open? Let's close it so they see the Notes view.
        }}
      />

      {isServicePlanManagerOpen && selectedClient && (
        <ServicePlanManagerModal
          isOpen={isServicePlanManagerOpen}
          onClose={() => setIsServicePlanManagerOpen(false)}
          client={selectedClient}
          servicePlans={appState.servicePlans || []}
          programLibrary={appState.programLibrary || []}
          onSavePlan={handleSaveServicePlan}
          onSaveLibraryProgram={handleSaveProgramToLibrary}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        clients={clients}
        onClientSelect={setSelectedClient}
        onViewChange={setView}
        onNavigate={handleNavigate}
        onAddEvent={() => handleAddClick()}
      />

      <SupervisionLogModal
        isOpen={!!logHoursClient}
        client={logHoursClient}
        onClose={() => setLogHoursClient(null)}
        onSave={handleSaveSupervisionLog}
      />

      <ContextMenu
        type={contextMenu?.type || 'GRID'}
        coords={contextMenu ? contextMenu.coords : null}
        onClose={() => setContextMenu(null)}
        onAction={handleContextMenuAction}
        hasClipboard={!!clipboard}
      />
    </div>
  );
}

export default App;
