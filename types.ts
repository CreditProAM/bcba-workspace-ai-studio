
// --- Clinical context (goals / behavior programs / interventions) ---
// Deliberately excludes CPT codes, insurance/payer objects, claims, and payroll --
// those are billing/enterprise concerns out of scope for this local productivity layer.
// See BCBA_PROJECT_AUDIT.md section 6 and MIGRATION_LOG.md for the reasoning.

export interface TargetBehavior {
  id: string;
  name: string;
  description?: string;
  intensity?: 'mild' | 'moderate' | 'severe';
  frequency?: 'multiple_daily' | 'daily' | 'weekly' | 'monthly';
  triggers?: string;
}

export interface Client {
  id: string;
  name: string;
  avatar: string; // Initials or placeholder
  imageUrl?: string; // Optional URL for client photo
  color: string; // Tailwind bg class
  borderColor: string;
  textColor: string;
  diagnosis?: string;
  /** Operational stage — Active / Onboarding / Maintenance (not lifecycle). */
  status: 'Active' | 'Onboarding' | 'Maintenance';
  /** Lifecycle status from API — active / inactive / discharged. */
  lifecycleStatus?: 'active' | 'inactive' | 'discharged';
  authorizedHours?: number; // Weekly authorized hours -- treatment-context only, not a billing/units record

  // Clinical context, optional so existing mock/demo clients keep working untouched.
  age?: number;
  guardian?: { name: string; contact: string };
  goals?: string[]; // free-text goal labels, referenced by SessionNote.goalsAddressed
  targetBehaviors?: TargetBehavior[];
  replacementBehaviors?: string[];
  interventions?: string[]; // named strategies/programs in place for this client
  sessionNotes?: SessionNote[];
  assessments?: Assessment[];
  parentTrainingLogs?: ParentTrainingLog[];

  /** API concurrency token — present when clients domain is API. */
  rowVersion?: number;
}

export type ServiceType = 'Direct 1:1' | 'RBT Supervision' | 'Parent Training' | 'Assessment' | 'BIP Review' | 'School Observation';

export type CalendarView = 'day' | 'week' | 'month';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  clientId: string; // formerly memberId
  serviceType?: ServiceType;
  description?: string;
  location?: 'Clinic' | 'Home' | 'School' | 'Telehealth';
  subTasks?: SubTask[];
  reminders?: number[]; // Array of minutes before event
  seriesId?: string; // ID to link recurring events
  recurrencePattern?: string; // Human readable e.g. "Weekly"
}

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  isToolCall?: boolean;
  toolResult?: string;
}

export type MeasurementType = 'frequency' | 'duration' | 'percentage' | 'intensity' | 'task_analysis';

export interface MeasurementConfiguration {
  type: MeasurementType;
  intensityLevels?: { level: number; description?: string }[]; // For intensity
  steps?: string[]; // For task_analysis
}

export type ProgramType = 'behavior_reduction' | 'replacement' | 'skill_acquisition' | 'other';
export type ProgramStatus = 'active' | 'mastered' | 'paused' | 'archived';

export interface ProgramObjective {
  id: string;
  name: string;
  status: ProgramStatus;
}

export interface ClinicalProgram {
  id: string;
  name: string;
  type: ProgramType;
  description: string;
  status: ProgramStatus;
  measurement: MeasurementConfiguration;
  baseline: { date: string; value: string }[];
  objectives: ProgramObjective[];
  antecedents: string[];
  interventions: string[];
  recommendations?: string;
}

export interface ProgramCategory {
  id: string;
  name: string;
  programs: ClinicalProgram[];
}

export interface ServicePlan {
  id: string;
  clientId: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  startDate: string; // ISO
  reviewDate?: string; // ISO
  categories: ProgramCategory[];
}

export interface AppState {
  clients: Client[];
  events: CalendarEvent[];
  servicePlans?: ServicePlan[];
  programLibrary?: ClinicalProgram[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO String
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'SYSTEM';
  targetType: 'CLIENT' | 'EVENT' | 'SUPERVISION' | 'SETTINGS';
  description: string;
  metadata?: string; // e.g. Client Name or Event Title
  user: string; // Mocked for now (e.g. "Dr. Smith")
}

export type ClinicalCeiling = 'NONE' | 'RBT' | 'BCABA' | 'BCBA';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In real app, this would be hashed
  role: 'BCBA' | 'BCaBA' | 'RBT' | 'Admin';
  avatar?: string;
  /** Operational function grants from API auth. */
  functions?: { code: string; name?: string; scopeMode: string }[];
  /** Credential-derived clinical ceiling — role is derived from this in API mode. */
  clinicalCeiling?: ClinicalCeiling;
}

// --- Session documentation (Notes tab) ---
// A SessionNote is the clinical write-up of a session; it is a separate concept
// from a CalendarEvent (which only represents a scheduled block of time and may or
// may not yet have a note attached). This mirrors the intended workflow:
// Today -> client -> session -> note -> QA -> follow-up.

export type NoteStatus = 'Draft' | 'Pending Review' | 'Completed';

export type PromptLevel = 'None' | 'Verbal' | 'Gestural' | 'Modeling' | 'Partial Physical' | 'Full Physical';

export interface ObservedBehavior {
  behaviorId: string; // TargetBehavior.id
  frequency: number;
  duration: number; // minutes
  intensity?: 'mild' | 'moderate' | 'severe';
}

export interface SessionProgramData {
  programId: string;
  programNameSnapshot: string;
  measurementType: MeasurementType;
  value: any; // Can be number, string, array depending on measurementType
  objectiveId?: string;
  notes?: string;
}

export interface SessionNote {
  id: string;
  clientId: string;
  eventId?: string; // linked CalendarEvent id, if this note documents a scheduled session
  date: string; // YYYY-MM-DD
  authorId?: string; // typically the RBT/clinician who wrote the note
  reviewerId?: string; // BCBA who reviewed/signed off
  status: NoteStatus;
  goalsAddressed: string[]; // subset of Client.goals covered this session
  goalTallies: Record<string, number>; // { [goal]: trial/frequency count } -- skill acquisition data
  programData?: SessionProgramData[];
  interventions: string[];
  promptLevels: Record<string, PromptLevel>; // { [goal or target]: level }
  observedBehaviors: ObservedBehavior[];
  environmentalFactors?: string;
  rawNotes: string; // the clinician's own raw/quick notes -- always the source of truth
  narrative?: string; // optional AI-assisted narrative generated FROM rawNotes + the fields above
}

export interface ParentTrainingLog {
  id: string;
  date: string;
  attendees: string[];
  topics: string;
  caregiverResponse: string;
}

// Functional Behavior Assessment -- the other "document draft" type alongside session notes.
export interface Assessment {
  id: string;
  date: string;
  type: 'FBA';
  summary: string;
  targetBehavior: string;
  antecedent: string;
  consequence: string;
  hypothesizedFunction: string;
}

// --- Documentation QA ---
// Deliberately named around "documentation quality" rather than "compliance":
// these checks catch missing/incomplete notes before a BCBA signs off. They are
// NOT a guarantee of payer/billing compliance and must not be presented as one.
export type QARequirementType = 'PRESENCE' | 'REVIEWER_SIGNOFF' | 'NARRATIVE_PRESENT';
export type QASeverity = 'ERROR' | 'WARNING';

export interface DocumentationQARule {
  id: string;
  fieldName?: keyof SessionNote; // used by PRESENCE rules
  requirementType: QARequirementType;
  message: string;
  severity: QASeverity;
  description: string; // human-readable explanation shown in the UI
}

export interface DocumentationQAIssue {
  ruleId: string;
  message: string;
  severity: QASeverity;
}
