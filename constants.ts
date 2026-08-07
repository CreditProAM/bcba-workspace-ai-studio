
import { CalendarEvent, Client, DocumentationQARule } from './types';

// Helper to create dates relative to today
const today = new Date();
const getDayDate = (offset: number, hour: number, minute: number = 0) => {
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay() + offset); // Adjust to current week's day (0=Sun, 1=Mon...)
  d.setHours(hour, minute, 0, 0);
  return d;
};

// BCBA Caseload Colors: Distinct, professional, high-contrast pastel
export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'liam',
    name: 'Liam K.',
    avatar: 'LK',
    imageUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80',
    color: 'bg-blue-100',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-900',
    diagnosis: 'ASD Level 2',
    status: 'Active',
    authorizedHours: 20,
    age: 6,
    guardian: { name: 'Maria K.', contact: 'maria.k@example.com' },
    goals: ['Requesting preferred items (manding)', 'Following 2-step instructions'],
    targetBehaviors: [
      { id: 'liam-tb1', name: 'Elopement', intensity: 'moderate', frequency: 'daily', triggers: 'Transitions between activities' },
    ],
    replacementBehaviors: ['Using a "break" card instead of leaving the area'],
    interventions: ['Discrete Trial Training', 'Functional Communication Training'],
  },
  {
    id: 'sophia', name: 'Sophia R.', avatar: 'SR', color: 'bg-rose-100', borderColor: 'border-rose-400', textColor: 'text-rose-900',
    diagnosis: 'ASD Level 1', status: 'Active', authorizedHours: 15, age: 8,
    guardian: { name: 'David R.', contact: 'david.r@example.com' },
    goals: ['Initiating peer play', 'Tolerating "no" without escalation'],
    targetBehaviors: [
      { id: 'sophia-tb1', name: 'Vocal protesting', intensity: 'mild', frequency: 'daily', triggers: 'Preferred item removed' },
    ],
    replacementBehaviors: ['Asking "why" or requesting an alternative'],
    interventions: ['Natural Environment Teaching', 'Social Skills Group'],
  },
  { id: 'noah', name: 'Noah M.', avatar: 'NM', color: 'bg-emerald-100', borderColor: 'border-emerald-400', textColor: 'text-emerald-900', diagnosis: 'ASD Level 3', status: 'Onboarding', authorizedHours: 10, age: 4, guardian: { name: 'Priya M.', contact: 'priya.m@example.com' } },
  { id: 'ava', name: 'Ava T.', avatar: 'AT', color: 'bg-purple-100', borderColor: 'border-purple-400', textColor: 'text-purple-900', diagnosis: 'ASD Level 1', status: 'Active', authorizedHours: 25, age: 9, guardian: { name: 'James T.', contact: 'james.t@example.com' } },
  { id: 'ethan', name: 'Ethan B.', avatar: 'EB', color: 'bg-amber-100', borderColor: 'border-amber-400', textColor: 'text-amber-900', diagnosis: 'ASD Level 2', status: 'Maintenance', authorizedHours: 5, age: 11, guardian: { name: 'Laura B.', contact: 'laura.b@example.com' } },
];

export const INITIAL_EVENTS: CalendarEvent[] = [
  // Monday
  { 
    id: '1', 
    title: 'VB-MAPP Assessment', 
    start: getDayDate(1, 9, 0), 
    end: getDayDate(1, 11, 30), 
    clientId: 'noah', 
    serviceType: 'Assessment', 
    location: 'Clinic',
    subTasks: [
      { id: 'st1', title: 'Prepare Milestones Protocol', completed: true },
      { id: 'st2', title: 'Setup Reinforcers', completed: false },
      { id: 'st3', title: 'Data Sheet Printout', completed: false }
    ]
  },
  { id: '2', title: 'RBT Supervision (Sarah)', start: getDayDate(1, 13, 0), end: getDayDate(1, 15, 0), clientId: 'liam', serviceType: 'RBT Supervision', location: 'Home' },
  
  // Tuesday
  { id: '3', title: 'Parent Training', start: getDayDate(2, 10, 0), end: getDayDate(2, 11, 30), clientId: 'sophia', serviceType: 'Parent Training', location: 'Telehealth' },
  { id: '4', title: 'BIP Review & Update', start: getDayDate(2, 14, 0), end: getDayDate(2, 15, 30), clientId: 'ethan', serviceType: 'BIP Review', location: 'Clinic' },

  // Wednesday
  { id: '5', title: 'School Observation', start: getDayDate(3, 8, 30), end: getDayDate(3, 11, 0), clientId: 'ava', serviceType: 'School Observation', location: 'School' },
  { id: '6', title: 'Direct Therapy 1:1', start: getDayDate(3, 15, 0), end: getDayDate(3, 17, 0), clientId: 'liam', serviceType: 'Direct 1:1', location: 'Home' },

  // Thursday
  { id: '7', title: 'Team Meeting (Noah)', start: getDayDate(4, 9, 0), end: getDayDate(4, 10, 0), clientId: 'noah', serviceType: 'RBT Supervision', location: 'Clinic' },
  { 
    id: '8', 
    title: 'FBA Data Analysis', 
    start: getDayDate(4, 11, 0), 
    end: getDayDate(4, 12, 30), 
    clientId: 'noah', 
    serviceType: 'Assessment', 
    location: 'Clinic',
    subTasks: [
      { id: 'st4', title: 'Graph ABC Data', completed: true },
      { id: 'st5', title: 'Write Summary', completed: false }
    ]
  },
  { id: '9', title: 'Parent Training', start: getDayDate(4, 16, 0), end: getDayDate(4, 17, 30), clientId: 'ava', serviceType: 'Parent Training', location: 'Home' },

  // Friday
  { id: '10', title: 'Quarterly Report Writing', start: getDayDate(5, 9, 0), end: getDayDate(5, 11, 0), clientId: 'sophia', serviceType: 'BIP Review', location: 'Clinic' },
  { id: '11', title: 'RBT Supervision (Mike)', start: getDayDate(5, 13, 0), end: getDayDate(5, 15, 0), clientId: 'ethan', serviceType: 'RBT Supervision', location: 'Home' },
];

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SERVICE_TYPES = ['Direct 1:1', 'RBT Supervision', 'Parent Training', 'Assessment', 'BIP Review', 'School Observation'];

// Default documentation QA ruleset -- see services/complianceEngine.ts.
// These are house documentation-quality rules, not payer-specific billing requirements.
export const DEFAULT_QA_RULES: DocumentationQARule[] = [
  {
    id: 'qa-raw-notes',
    fieldName: 'rawNotes',
    requirementType: 'PRESENCE',
    message: 'Raw session notes are empty.',
    severity: 'ERROR',
    description: 'Every note needs the clinician\'s own observations, even briefly, before it can be completed.',
  },
  {
    id: 'qa-narrative',
    requirementType: 'NARRATIVE_PRESENT',
    message: 'No narrative has been written or generated yet.',
    severity: 'ERROR',
    description: 'A completed note should include a written narrative summarizing the session.',
  },
  {
    id: 'qa-reviewer',
    requirementType: 'REVIEWER_SIGNOFF',
    message: 'This note has no reviewer on record.',
    severity: 'WARNING',
    description: 'Notes marked Completed should generally be signed off by a BCBA.',
  },
  {
    id: 'qa-goals',
    fieldName: 'goalsAddressed',
    requirementType: 'PRESENCE',
    message: 'No goals were recorded for this session.',
    severity: 'WARNING',
    description: 'Flags sessions with no skill-acquisition data at all -- may be intentional (e.g. a supervision-only visit).',
  },
];