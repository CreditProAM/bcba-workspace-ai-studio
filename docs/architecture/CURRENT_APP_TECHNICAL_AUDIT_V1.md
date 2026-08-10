# Current App Technical Audit V1

Phase 17 deliverable. Inventory of the **actual** `bcba-workspace-ai-studio`
implementation as of this audit. Grounded in live source inspection
(`package.json`, `App.tsx`, `types.ts`, `components/`, `hooks/`, `utils/`,
`services/`, `constants.ts`), not only blueprint descriptions.

**Stack:** Vite 6 + React 19 + TypeScript. Browser-only SPA. No backend,
no PostgreSQL, no REST API. Sole external network call: Google Gemini via
`@google/genai` (`services/geminiService.ts`, env `GEMINI_API_KEY`).

**Central ownership pattern:** Nearly all clinical/scheduling truth lives
in `AppState` owned by `useHistory` in `App.tsx`, persisted to
`localStorage` key `bcba_dashboard_state_v1`. Derived clinical progress
and attention are computed, not stored. Auth, activity, settings, drafts,
and toolkit favorites use separate localStorage keys.

**Disposition principle used below:** Separate UI/business-logic value
from persistence/infrastructure debt. localStorage does **not** make a
feature disposable.

---

## 1. App shell / navigation

| Field | Detail |
|---|---|
| **Components/files** | `App.tsx`, `components/Sidebar.tsx`, `components/Header.tsx`, `index.tsx` |
| **State owner** | `App.tsx`: `activeTab` (`PrimaryTab`), `currentDate`, calendar `view`, modal flags, toasts. Sidebar: `isCollapsed`. |
| **Persistence** | `bcba_sidebar_collapsed`. Tab/view ephemeral. |
| **Data types** | Informal `PrimaryTab`; `CalendarView`; `User` |
| **Dependencies** | All feature views; `useHistory`, `useAutoSave` |
| **Preserve** | Tab order Today → Caseload → Notes → Supervision → Data → Toolkit; Activity/Settings secondary; Cmd/Ctrl+K palette; undo/redo; Header save-status on Today |
| **Prototype limitation** | No URL router/deep links; Header only on Today; no Function-aware nav |
| **Future domain** | React Feature Map Domain 1 (App Shell / Navigation) |

---

## 2. Authentication

| Field | Detail |
|---|---|
| **Components/files** | `components/AuthScreen.tsx`; session gate in `App.tsx` |
| **State owner** | `App.tsx` `currentUser`; AuthScreen local form state |
| **Persistence** | `bcba_users_v1` (user roster with plaintext passwords); `bcba_current_user_v1` (full User JSON including password) |
| **Data types** | `User` (`id`, `name`, `email`, `password?`, `role: 'BCBA' \| 'RBT' \| 'Admin'`, `avatar?`) |
| **Dependencies** | Sidebar logout; `DataCollection.tsx` role check only |
| **Preserve** | Login-gate concept; role-aware note workflow (RBT → Pending Review, BCBA Completes) |
| **Prototype limitation** | Plaintext passwords; no sessions/tokens; no org tenancy; Admin inert; logout clears session key only |
| **Future domain** | Domain 15 (Permissions/Authority) + Identity/Access backend |

Demo seeds in `AuthScreen.tsx`: `admin`/`admin123` → Admin; `user`/`user123` → RBT. Signup always creates `role: 'BCBA'`.

---

## 3. Central AppState, history, autosave, backup

| Field | Detail |
|---|---|
| **Components/files** | `hooks/useHistory.ts`, `hooks/useAutoSave.ts`, `App.tsx` (`getInitialState`), `components/SettingsModal.tsx` (export/import) |
| **State owner** | `useHistory<AppState>` → `appState` / `setAppState` |
| **Persistence** | Primary: `bcba_dashboard_state_v1`. Backup: `bcba_dashboard_state_v1_backup` (every 5 min). Legacy migration: `bcba_dashboard_clients_v2` + `bcba_dashboard_events_v2`. |
| **Data types** | `AppState` = `{ clients, events, servicePlans?, programLibrary? }` |
| **Dependencies** | Every clinical/scheduling mutation |
| **Preserve** | Single undoable state for clients/events/plans/notes; debounced autosave; periodic backup; legacy migration; JSON export/import |
| **Prototype limitation** | Single-device; ~5–10MB quota risk (esp. base64 photos); no multi-user sync; unbounded in-memory history |
| **Future domain** | Cross-cutting client sync → PostgreSQL + API; undo may become client-local optimistic buffer |

---

## 4. Calendar / Today

| Field | Detail |
|---|---|
| **Components/files** | `components/WeekView.tsx`, `MonthView.tsx`, `EventModal.tsx`, `ContextMenu.tsx`, `CommandPalette.tsx`; handlers in `App.tsx`; seeds `constants.ts` (`INITIAL_EVENTS`, `SERVICE_TYPES`) |
| **State owner** | `appState.events`; App UI: `activeClients`, `editingEvent`, `clipboard`, `workHours` |
| **Persistence** | Events in AppState; work hours `bcba_dashboard_settings_v1` |
| **Data types** | `CalendarEvent`, `SubTask`, `ServiceType`, `CalendarView` |
| **Dependencies** | Sidekick, `suggestRescheduling`, SupervisionView, reminder toasts |
| **Preserve** | Drag/resize; same-client conflict detect; recurrence via `seriesId`; subtasks/reminders; copy/paste; smart resolve; client filter chips — independently the strongest UX surface |
| **Prototype limitation** | No staff/resource calendar; series edit incomplete; no Event Type rule engine; no billing-code/unit gates; reminders only while tab open |
| **Future domain** | Domains 4–5 (Scheduling / Events); current `CalendarEvent` is a prototype of Event, not yet the thin Event hub |

---

## 5. Caseload

| Field | Detail |
|---|---|
| **Components/files** | `components/CaseloadView.tsx`, `ClientModal.tsx`; `App.tsx` `handleSaveClient` / `handleDeleteClient` |
| **State owner** | `appState.clients`; Caseload local search/filter |
| **Persistence** | Via AppState |
| **Data types** | `Client`, `TargetBehavior` |
| **Dependencies** | ClientProfilePanel; calendar filter; Notes |
| **Preserve** | Searchable roster; status; age/guardian/authorizedHours; color palette; delete cascades events |
| **Prototype limitation** | Status enum `Active \| Onboarding \| Maintenance` ≠ target Active/Inactive/Discharged; id from sanitized name (collision risk); photo as data URL; goals/targetBehaviors not fully editable in UI; hard-delete removes history |
| **Future domain** | Domain 3 (Clients) |

---

## 6. ClientProfilePanel (unified clinical workspace)

| Field | Detail |
|---|---|
| **Components/files** | `components/ClientProfilePanel.tsx` |
| **State owner** | App `selectedClient`, `workspaceInitialTab`; panel-local tab/AI summary |
| **Persistence** | None own; reads AppState |
| **Data types** | Informal workspace tabs; `Client`, `ServicePlan` |
| **Dependencies** | `deriveClinicalAttention`, `clinicalProgress` helpers, `ClinicalProgress`, `generateClientSummary`, ServicePlanManager |
| **Preserve** | Unified multi-tab workspace; supervision ring; scoped Needs Attention; deep-link from Attention; progress snapshot — architectural ancestor of 5-section Client Workspace |
| **Prototype limitation** | Selected client object can stale vs live AppState; no Insurance/PA/Billing/Caregiver-consent sections yet |
| **Future domain** | Domain 3 Client Workspace (EXPAND Overview/Clinical/Operations/Billing/Documents) |

---

## 7. Service Plans

| Field | Detail |
|---|---|
| **Components/files** | `components/servicePlan/ServicePlanManagerModal.tsx`; `App.tsx` `handleSaveServicePlan` |
| **State owner** | `appState.servicePlans` |
| **Persistence** | AppState |
| **Data types** | `ServicePlan`, `ProgramCategory` |
| **Dependencies** | ProgramEditor; DataCollection; Attention; ClinicalProgress |
| **Preserve** | Client-scoped plans; draft/active/archived; Category → Program 2-layer hierarchy |
| **Prototype limitation** | Category add via `prompt()`; no Changes/amendment log; no template starter categories |
| **Future domain** | Domain 6 |

---

## 8. Programs / Objectives / Baselines / Library

| Field | Detail |
|---|---|
| **Components/files** | `components/servicePlan/ProgramEditorModal.tsx`; `App.tsx` `handleSaveProgramToLibrary` |
| **State owner** | Nested under ServicePlan categories; `appState.programLibrary` |
| **Persistence** | AppState |
| **Data types** | `ClinicalProgram`, `ProgramObjective`, `ObjectiveMasteryCriteria`, `MeasurementConfiguration`, `MeasurementType`, `ProgramType`, `ProgramStatus` |
| **Dependencies** | DataCollection (`programId` linking); ClinicalProgress; Attention |
| **Preserve** | Measurement config (5 types); Baseline tab; library clone with new IDs; optional mastery criteria (informational only; **never auto-master**); stable `programId` |
| **Prototype limitation** | 5 of 15 measurement types; criteria never write `reviewerId` path issues are note-side; no multi-sequential objective UX polish |
| **Future domain** | Domains 7–8 |

---

## 9. Data Collection / Session Notes / Documentation QA

| Field | Detail |
|---|---|
| **Components/files** | `components/notes/NotesHome.tsx`, `ClientNotesList.tsx`, `DataCollection.tsx`; `services/complianceEngine.ts`; `constants.ts` `DEFAULT_QA_RULES` |
| **State owner** | `Client.sessionNotes` in AppState; `notesView` navigation; DataCollection local + drafts |
| **Persistence** | AppState + `bcba_note_draft_{clientId}_{noteId\|new}` |
| **Data types** | `SessionNote`, `SessionProgramData`, `ObservedBehavior`, `NoteStatus`, `DocumentationQARule`, `DocumentationQAIssue` |
| **Dependencies** | Active ServicePlan programs; `runDocumentationQA`; `generateSessionNarrative` |
| **Preserve** | Program-driven data entry; RBT→Pending Review→BCBA Completed (`isReviewMode`/`nextStatus`); draft recovery; grounded narrative; QA ERROR gate; non-billing QA framing |
| **Prototype limitation** | `reviewerId` rarely/never set (QA WARNING path); no Signature entity; note statuses ≠ full Unlocked→…→Locked machine; no Datasheet second write surface; CalendarEvent ≠ Event hub |
| **Future domain** | Domains 8, 10, 11 (expand status/signatures); QA rules → RequiredDocument/Billing Readiness inputs later |

---

## 10. FBA / Parent Training documents

| Field | Detail |
|---|---|
| **Components/files** | `components/notes/DocumentEditor.tsx`; App upserts |
| **State owner** | `Client.assessments`, `Client.parentTrainingLogs` |
| **Persistence** | AppState + `bcba_doc_draft_*` |
| **Data types** | `Assessment` (`type: 'FBA'`), `ParentTrainingLog` |
| **Dependencies** | useAutoSave draft pattern |
| **Preserve** | Draft/recovery pattern parity with notes |
| **Prototype limitation** | Thin forms; FBA locked to one type; not the five-entity Documentation architecture |
| **Future domain** | Domain 10 (EXPAND assessments when justified) |

---

## 11. Progress Charts

| Field | Detail |
|---|---|
| **Components/files** | `utils/clinicalProgress.ts`, `components/data/ClinicalProgress.tsx`, `DataOverview.tsx` |
| **State owner** | Derived from sessionNotes + servicePlans; UI selection local |
| **Persistence** | None for derived metrics |
| **Data types** | Uses `SessionProgramData`, `ObjectiveMasteryCriteria`; helpers `normalizeProgramValue`, `buildProgramSeries`, `evaluateObjectiveCriterion` |
| **Dependencies** | Recharts |
| **Preserve** | Shared math; baseline ReferenceLine; criterion-achieved indication without auto-mastery |
| **Prototype limitation** | One value/program/session; no chart annotations/phase lines yet |
| **Future domain** | Domain 9 |

---

## 12. Supervision

| Field | Detail |
|---|---|
| **Components/files** | `components/SupervisionView.tsx`, `SupervisionLogModal.tsx`; App handlers; ratio also computed in Profile/Data/Attention |
| **State owner** | Props from AppState events; planner local UI |
| **Persistence** | Via `CalendarEvent` with `serviceType: 'RBT Supervision'` |
| **Data types** | `CalendarEvent` |
| **Dependencies** | Event create path; attention engine |
| **Preserve** | Planner + compliance table; Schedule vs Log Hours; Clinic/Home split; BACB 5% Direct 1:1 vs RBT Supervision ratio |
| **Prototype limitation** | All-time hours not period-scoped; math duplicated (not all via shared util); not wired fully as Attention catalog condition in product breadth |
| **Future domain** | Domains 5–6 ops + Domain 26 Attention condition; Event nesting later |

---

## 13. Needs Attention

| Field | Detail |
|---|---|
| **Components/files** | `utils/clinicalAttention.ts`, `components/today/NeedsMyAttentionPanel.tsx`; also consumed by NotesHome, ClientProfilePanel |
| **State owner** | Pure derivation — no persistence |
| **Persistence** | None |
| **Data types** | `AttentionItem`, `AttentionItemType`, `AttentionPriority`, `ClinicalAttentionResult` (in clinicalAttention.ts) |
| **Dependencies** | AppState clients/events/plans/notes |
| **Preserve** | Unified pure-function engine; flags ≠ clinical decisions; single source of truth |
| **Prototype limitation** | Clinical-only condition set; no assignee/ack/snooze persistence; no notification history; timestamp proxies |
| **Future domain** | Domains 2 + 26 — **KEEP engine, EXPAND conditions + add persistent coordination/notification layer** |

Current condition types include: `pending_note`, `service_plan_review`, `program_no_data`, `program_stale_data`, `supervision_below_target`.

---

## 14. Activity

| Field | Detail |
|---|---|
| **Components/files** | `components/ActivityView.tsx`; `logActivity` in `App.tsx` |
| **State owner** | `App.tsx` `activityLog` |
| **Persistence** | `bcba_dashboard_activity_v1` |
| **Data types** | `ActivityLogEntry` |
| **Dependencies** | Client/event/plan/note mutations, Sidekick SYSTEM |
| **Preserve** | Filterable recent-activity feed UX |
| **Prototype limitation** | Not immutable compliance audit; not per-entity Status History; incomplete target coverage; not PHI-safe export |
| **Future domain** | Domain 25 Reporting feed **distinct from** AuditEntry / Document Status History |

---

## 15. Settings

| Field | Detail |
|---|---|
| **Components/files** | `components/SettingsModal.tsx` |
| **State owner** | Local form; App `workHours` |
| **Persistence** | `bcba_dashboard_settings_v1`; export/import of state+activity+settings |
| **Data types** | Informal `{ start, end }` work hours |
| **Dependencies** | WeekView hours |
| **Preserve** | Work-hours config; real JSON backup/restore |
| **Prototype limitation** | Incomplete key coverage on export; not org Configuration catalog |
| **Future domain** | Domain 23 (EXPAND); backup becomes admin/export Function |

---

## 16. Sidekick / AI / Toolkit

| Field | Detail |
|---|---|
| **Components/files** | `components/SidekickModal.tsx`, `components/toolkit/*`, `services/geminiService.ts`, `config/promptTemplates.ts` |
| **State owner** | Modal/session local; mutations via App for Sidekick tools |
| **Persistence** | Toolkit favorites `bcba_toolkit_favorites_v1`; chats not persisted |
| **Data types** | `ChatMessage`; toolkit types in `toolkitTypes.ts` |
| **Dependencies** | Gemini API; caseload/schedule context for Sidekick |
| **Preserve** | Grounded narratives; Sidekick tool→real event create; toolkit schema+sanitizer+static fallback; clinical-safety boundaries (no fabricated judgment) |
| **Prototype limitation** | Client-side API key; no server proxy; Toolkit not caseload-grounded |
| **Future domain** | Cross-cutting AI integration boundary ( Domains 2/4/10 consumers ) |

Gemini functions: `chatWithSidekick`, `suggestRescheduling`, `generateClientSummary`, `generateSessionNarrative`, `generateToolkitResponse`, `createToolkitFollowUpChat`.

---

## 17. Compliance engine (Documentation QA)

| Field | Detail |
|---|---|
| **Components/files** | `services/complianceEngine.ts` |
| **State owner** | Derived at note-edit time |
| **Persistence** | None |
| **Data types** | `DocumentationQARule`, `DocumentationQAIssue` |
| **Dependencies** | SessionNote |
| **Preserve** | Explicit non-billing framing; PRESENCE / NARRATIVE_PRESENT / REVIEWER_SIGNOFF |
| **Prototype limitation** | Static ruleset; not Billing Readiness evaluator |
| **Future domain** | Feeds Domain 10 validation; conceptual ancestor of Domain 19 evaluator (do not conflate) |

---

## LocalStorage key map (complete)

| Key | Contents |
|---|---|
| `bcba_dashboard_state_v1` | AppState |
| `bcba_dashboard_state_v1_backup` | Periodic safety copy |
| `bcba_dashboard_activity_v1` | ActivityLogEntry[] |
| `bcba_dashboard_settings_v1` | Work hours |
| `bcba_dashboard_clients_v2` / `bcba_dashboard_events_v2` | Legacy only |
| `bcba_current_user_v1` | Session User |
| `bcba_users_v1` | User directory |
| `bcba_sidebar_collapsed` | UI |
| `bcba_note_draft_*` | Note drafts |
| `bcba_doc_draft_*` | FBA/PT drafts |
| `bcba_toolkit_favorites_v1` | Toolkit favorites |

---

## What is absent (by design today)

No: PostgreSQL, backend API, multi-tenancy, real auth sessions, Function grants, Credentials, ClientAssignment join, Caregiver consent model, Insurance/COB/PA, Billing Codes/Services/Payers, Billing Readiness, Claims, Remittance, Provider compensation, object-file storage, immutable AuditEntry, Signature capture UI, Required Documents engine.

These absences are intentional product sequencing (`DEVELOPMENT_DIRECTION.md` §7), not silent oversights. Architecture must provide homes for them without requiring a greenfield rewrite of the clinical core.

---

## Audit summary

| Category | Subsystems |
|---|---|
| **Production-grade UX/logic to preserve** | Calendar, Caseload, ClientProfilePanel, Service Plans, Programs/Objectives/Baselines/Mastery, Data Collection + note review gate, ClinicalProgress, Needs Attention engine, Supervision math, Documentation QA framing, grounded AI, Toolkit, Activity feed UX, Settings backup |
| **Prototype infrastructure to replace** | localStorage AppState as Sole DB; plaintext localStorage auth; client-side Gemini key; ActivityLog as sole “audit”; hard-delete client history |
| **Must expand (not replace)** | Client lifecycle statuses; ClientProfilePanel sections; measurement types; Attention conditions + persistence; note → document/signature/Event model; role check → Function+Ceiling |

**Verdict for evolution:** The clinical application can evolve into the target architecture without a greenfield rewrite, provided persistence and auth are replaced under the existing React product and Event/Documentation models are introduced as expansions of today’s CalendarEvent/SessionNote shapes.

## Change Log

- **V1 (Phase 17):** First source-grounded technical audit of `bcba-workspace-ai-studio` for production architecture.
