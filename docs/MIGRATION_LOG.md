# Migration Log -- BCBA Workspace Consolidation

This documents how `bcba-workspace` was assembled from the seven source projects
audited in `BCBA_PROJECT_AUDIT.md` (repository root). The seven source projects were
not modified, deleted, or renamed; they remain reference/donor projects only.

Work was done in the required order (Steps 1-7), with a successful `npm run build`
(and `npx tsc --noEmit`) after every step before moving on.

---

## Step 1 -- Foundation

**Source:** `bcba-clinical-dashboard` (entire project, minus `node_modules`).

Copied as-is: `App.tsx`, `types.ts`, `constants.ts`, `hooks/useHistory.ts`,
`hooks/useAutoSave.ts`, `services/geminiService.ts`, and every component
(`Sidebar`, `Header`, `WeekView`, `MonthView`, `CaseloadView`, `SupervisionView`,
`ActivityView`, `SidekickModal`, `EventModal`, `ClientModal`, `SettingsModal`,
`ClientProfilePanel`, `CommandPalette`, `ContextMenu`, `AuthScreen`,
`SupervisionLogModal`, `ReportModal`, root-level `SidekickModal.tsx`).

Package name changed `bcba-clinical-dashboard` -> `bcba-workspace` in `package.json`.
One pre-existing type error was fixed: `services/geminiService.ts` imported
`SchemaType` from `@google/genai`, which that package version doesn't export, and
the import was unused anyway (the file uses `Type.OBJECT` etc.) -- `npm run build`
(esbuild-based, transpile-only) didn't catch this, but `npx tsc --noEmit` did.
Removed the dead import.

**Deliberately excluded during Step 1 cleanup**, per the audit's dead-weight report:
- **Root-level `SidekickModal.tsx`** -- an orphaned earlier draft, never imported
  anywhere (confirmed via `grep`). `components/SidekickModal.tsx` is the live one.
  Deleted.
- **`components/ReportModal.tsx`** -- fully-styled UI, but `handleGenerate()` was a
  `setTimeout` that flips to a fake "generated" state with no real report content
  assembled. Per the task's explicit "do not port fake report generation"
  instruction, this was removed along with its `isReportModalOpen` state and the
  "Reports" sidebar button in `App.tsx` / `Sidebar.tsx`. A real version can be
  rebuilt once there's session-note data worth reporting on (see Data tab notes
  below).
- **`components/SupervisionLogModal.tsx`** -- initially flagged as dead code (built,
  styled, but never imported by the original `App.tsx`). Rather than delete working
  code, it was *wired in* during Step 2 as a "Log Hours" action in the Supervision
  tab's compliance view (retroactively logging already-completed supervision, as
  distinct from "Schedule" which books future supervision). See Step 2.

---

## Step 2 -- Navigation refactor

Replaced the `'schedule' | 'caseload' | 'supervision' | 'activity'` tab model with
the canonical `PrimaryTab`:

```
'today' | 'caseload' | 'notes' | 'supervision' | 'data' | 'toolkit' | 'activity'
```

`today`, `caseload`, `notes`, `supervision`, `data`, `toolkit` are the six primary
`Sidebar` nav items. `activity` was deliberately demoted to a secondary utility
button (grouped with Settings at the bottom of the sidebar, not in the primary
list) per the task's "should not dominate the main navigation" instruction --
same underlying `ActivityView` component, just not a top-level destination.

Client detail was **not** made a separate top-level destination. It's reached from
Caseload (`CaseloadView` -> `ClientProfilePanel`, unchanged) and, separately, from
Notes (`NotesHome` -> `ClientNotesList`, new in Step 4) -- both are legitimate,
distinct entry points into the same client record, not a duplicated destination.

New files (real content, not placeholders where functionality already existed):
- `components/notes/NotesHome.tsx` -- caseload-driven entry point into Notes
  (upcoming sessions + searchable client list).
- `components/data/DataOverview.tsx` -- live stats computed from `appState`
  (active caseload count, sessions this week, weekly utilization %, clients below
  the 5% supervision target). Every number is a real `useMemo` computation over
  `clients`/`events`, not mock data.
- `components/toolkit/ToolkitHome.tsx` -- placeholder in Step 2 ("being ported in"),
  replaced with the real Toolkit module in Step 6 (see below).

Wired `SupervisionLogModal` into `SupervisionView`'s compliance table as a
"Log Hours" button next to the existing "Schedule" button, with a new
`onSaveSupervisionLog` handler in `App.tsx`.

Sidebar branding updated from "Clinical / Dashboard" to "BCBA / Workspace"
(text only, same visual system).

---

## Step 3 -- Unified Client/Session clinical types

Compared `bcba-clinical-dashboard/types.ts` (thin: `Client` had no clinical fields
beyond `diagnosis`/`status`/`authorizedHours`) against `aba_tool_genie/types.ts`
(rich but billing-entangled: `Client` carried `InsuranceInfo`, `Authorization[]`,
`workspaceId`, and session data carried `cptCode`).

**Added to `Client`** (all optional, so existing mock/demo clients keep working
untouched): `age`, `guardian`, `goals`, `targetBehaviors`, `replacementBehaviors`,
`interventions`, `sessionNotes`, `assessments`, `parentTrainingLogs`.

**New types**, deliberately named around documentation rather than the source
projects' `Session`/`Database` vocabulary, to make the billing exclusion explicit
in the type system itself:
- `SessionNote` -- the clinical write-up of a session. **Not** the same concept as
  `CalendarEvent` (which only represents a scheduled block of time). This is a
  deliberate architectural decision: `Today -> client -> session -> note -> QA ->
  follow-up` is the intended workflow, and conflating "scheduled" with
  "documented" would have made that impossible to express cleanly.
- `TargetBehavior`, `ObservedBehavior`, `PromptLevel`, `NoteStatus`.
- `Assessment` (FBA only), `ParentTrainingLog`, `SupervisionLog`.
- `DocumentationQARule` / `DocumentationQAIssue` / `QARequirementType` /
  `QASeverity` (added in Step 5, alongside the compliance engine port).

**Explicitly excluded** and not present anywhere in `types.ts`: `Claim`,
`ClaimStatus`, `CPTCode`, `InsuranceInfo`, `Authorization` (the billing-units
version), `workspaceId`, `AuditLog`/`AuditLogAction`/`AuditLogEntity`. The
`Database` umbrella type from the note-family was not copied at all -- each piece
of state lives on `Client` or in `AppState`, not in one enterprise-shaped object.

`SessionNote.goalTallies: Record<string, number>` was added during Step 4 (see
below) once it became clear the frequency-count data collection genie's UI
exposed was worth keeping alongside `goalsAddressed`.

---

## Step 4 -- Notes (DataCollection + DocumentEditor)

**Source:** `aba_tool_genie/components/DataCollection.tsx` (`SessionNoteEditor`) and
`aba_tool_genie/components/DocumentEditor.tsx`.

**Created:**
- `components/notes/DataCollection.tsx`
- `components/notes/DocumentEditor.tsx`
- `components/notes/ClientNotesList.tsx` (new -- not from a donor project; a
  bridge screen between "pick a client" and "edit a note/document" so a BCBA can
  find existing drafts/pending-review notes rather than only ever starting a new
  one. Without it, the review/sign-off workflow ported from genie would have had
  no way to be reached.)

**Adapted, not copied:**
- Removed every CPT code / `client.authorizations` reference (billing).
- Removed the `Database`/`Workspace`/multi-user lookup dependency -- the app only
  tracks a single `currentUser` session (via `AuthScreen`), so "Provider" is just
  `currentUser.name` rather than a lookup into a `db.users` roster.
- **Draft persistence**: genie's original was a one-off `setTimeout` +
  `localStorage.setItem` debounce, duplicated almost identically in both
  `DataCollection.tsx` and `DocumentEditor.tsx`. Both now use the app's shared
  `useAutoSave` hook for the ongoing save, per the task instruction. The one
  piece that's inherently a one-time check -- "is there an orphaned draft from
  last time" -- still reads `localStorage` directly on mount, since that's not
  something an autosave hook is responsible for.
- Kept: session documentation (details/skills/behaviors/narrative tabs), raw
  clinical notes, goals addressed + trial/frequency tallies, observed behaviors,
  interventions used, prompt levels, environmental/context factors, document
  drafts, draft recovery, and the AI-assisted narrative workflow (now calling
  `generateSessionNarrative`, added to `services/geminiService.ts`).
- Status/sign-off logic simplified from genie's `Role`-enum-based version to the
  app's existing `User.role: 'BCBA' | 'RBT' | 'Admin'` string union: an
  RBT-authored note saves as `Pending Review`; a BCBA writing or reviewing a note
  saves it `Completed` directly.

**`App.tsx` additions:** `notesView` state (client/screen/note/doc navigation,
storing IDs rather than object references so it always reflects live,
undo/redo-aware `appState`), `upsertSessionNote`, `upsertAssessment`,
`upsertParentTrainingLog`. All three follow the same pattern as the existing
`upsertSession`-style handlers -- notes live on `Client` inside `appState`, so
they automatically participate in the same undo/redo history and localStorage
autosave as scheduling changes, with no separate persistence mechanism.

**`services/geminiService.ts` addition:** `generateSessionNarrative`, adapted from
genie's version of the same name. Removed the CPT code / `Workspace` / author
credential lookups; grounded strictly in the `SessionNote`'s own fields. Returns
`''` on failure (not a fabricated narrative) so the UI can tell the clinician to
write it manually.

**Demo data enrichment:** `constants.ts`'s `INITIAL_CLIENTS` had no goals/behaviors/
interventions at all, which would have made the ported Notes tab look broken (every
tab would say "nothing defined for this client"). Added realistic sample data to
2 of the 5 demo clients (Liam, Sophia) so the feature is actually exercisable; left
the other 3 clients sparse to also demonstrate the "no goals defined yet" empty
state honestly.

---

## Step 5 -- Documentation QA (compliance engine)

**Source:** `aba_tool_genie/services/complianceEngine.ts`.

**Created:** `services/complianceEngine.ts`, exporting `runDocumentationQA`.

**Removed entirely:**
- Payor-based rule filtering (`client.insurance.provider` doesn't exist in this
  app's `Client` type).
- The `AUTH_MATCH` rule type, which checked a session's CPT code against
  `client.authorizations` for date-range/units validity -- pure billing logic.

**Kept, renamed, and re-scoped as documentation QA rather than "compliance":**
- `PRESENCE` -- a required field (e.g. raw notes) is missing/empty.
- `SIGNATURE_BCBA` -> `REVIEWER_SIGNOFF` -- a note marked Completed has no
  `reviewerId`.
- `NARRATIVE_COMPLETED` -> `NARRATIVE_PRESENT` -- a note marked Completed has no
  narrative.

The exported types (`DocumentationQARule`, `DocumentationQAIssue`,
`QARequirementType`, `QASeverity`) and the default ruleset
(`DEFAULT_QA_RULES` in `constants.ts`) are named and commented specifically to
avoid implying payer/billing compliance, per the task instruction -- both the
type file and the engine file carry an explicit comment: *"this is a
documentation-quality check, not a guarantee of payer/billing compliance."*
The same message is shown directly in the `DataCollection.tsx` QA panel UI, not
just in code comments.

Wired into `DataCollection.tsx`: live QA feedback as the clinician fills out a
note, with `ERROR`-severity issues blocking Save (a `WARNING` does not).

---

## Step 6 -- Toolkit module

**Source:** `aba-clinical-decision-support-toolkit` (`PromptLibrary.tsx`,
`PromptCard.tsx`, `PromptOutput.tsx`, `FavoriteToolkit.tsx`,
`config/promptTemplates.ts`, plus the relevant parts of `services/geminiService.ts`
and `types.ts`).

**Created:**
- `components/toolkit/toolkitTypes.ts` -- `PromptCategory`, `PromptTemplate`,
  `ToolkitSessionContext`, `StructuredPromptOutput`, `ToolkitChatMessage`,
  `TOOLKIT_DISCLAIMER`. Kept **separate** from the app's core `types.ts`
  deliberately: these describe the prompt library, not clinical/patient data, and
  the source project's `ChatMessage` name would otherwise collide with the
  app's existing (unrelated) `ChatMessage` type used by the Sidekick.
- `components/toolkit/{PromptCard,PromptLibrary,FavoriteToolkit,PromptOutput}.tsx`
  -- restyled from the source's slate/cyan/FontAwesome/dark-mode design to the
  workspace's existing rounded-xl/2xl, slate-border, indigo-accent, serif-heading
  visual language (using `lucide-react` icons instead of FontAwesome, which isn't
  loaded anywhere else in this app). Logic (search/filter, favorites, copy-to-
  clipboard, density toggle removed as unused complexity, follow-up chat) ported
  as-is.
- `components/toolkit/ToolkitHome.tsx` -- replaces the Step 2 placeholder with the
  real orchestrating screen (library + favorites + output/chat panel), matching
  the source app's `App.tsx` structure but adapted to local state instead of a
  second top-level React app.
- `config/promptTemplates.ts` -- copied essentially verbatim (only the type import
  path changed). All 22 scenario prompts across the 7 categories (Crisis Help,
  Documentation Templates, Ethics Support, Parent Scripts, Data & Patterns, Goal
  Writing, Supervisor Talk Tracks) were kept; none of them reference billing.

Favorites persist to their own `localStorage` key
(`bcba_toolkit_favorites_v1`), separate from the main `appState` key, matching
the source project's design (favorites are a personal UI preference, not
clinical data, so they don't need to be part of the undo/redo history).

One coherent Toolkit surface, not twenty separate assistants: every prompt
template flows through the same `PromptOutput` component and the same follow-up
chat, per the task instruction.

---

## Step 7 -- One Gemini service architecture

No functions were rewritten in this step (per the task instruction: "do not
perform a large AI rewrite"). What changed:
- Added a file-level architecture comment at the top of
  `services/geminiService.ts` explaining the single-service-boundary decision,
  naming which pattern was adopted from which source project, and documenting
  the two intentional fallback styles used (return-a-safe-default vs.
  throw-and-let-the-caller-decide) so future contributors don't "fix" the
  inconsistency without realizing it's deliberate.
- Added section banners (`// ---`) grouping the file into Sidekick / Client
  Summary / Session Narrative / Scheduling / Toolkit, in that order, so the file
  reads as one organized service rather than four unrelated chunks stitched
  together.
- Documented (rather than silently changed) why `sanitizePromptInput` is applied
  to Toolkit prompts but intentionally *not* to the Sidekick's chat messages --
  the Sidekick needs real client names to match real client IDs and schedule
  real events; redacting them would break the feature it's meant to protect.

The result: **one** `services/geminiService.ts`, seven exported functions
(`chatWithSidekick`, `generateClientSummary`, `generateSessionNarrative`,
`suggestRescheduling`, `sanitizePromptInput`, `generateToolkitResponse`,
`createToolkitFollowUpChat`), instead of the three separate, incompatible
implementations found across the source projects.

---

## Files NOT ported, and why

See `BCBA_PROJECT_AUDIT.md` sections 6 and 10 for the full reasoning; summarized
here for traceability:

| Source | Why excluded |
|---|---|
| `Billing.tsx`, `Claim`/`ClaimStatus`/`CPTCode` types, claim workflow in `App.tsx` (note-family) | Explicitly out of scope per product direction. |
| `TeamHub.tsx` (note-family) | Lists supervisees but can't log hours/competencies (confirmed by genie's own README audit); `SupervisionView` already does the real version of this job. |
| `Settings.tsx` (note-family) | Literal "coming soon" placeholder; the workspace's existing `SettingsModal` (work hours) is real and was kept instead. |
| `AuditLogView.tsx` + `AuditLog` type (note-family) | Compliance/legal-grade audit trail is premature for a local prototype; `ActivityView` (kept) covers "what changed recently" without that framing. |
| `AiAssistant.tsx`, `Home.tsx`, `Header.tsx` (note-family, all 5 projects) | 0-byte dead files everywhere they appeared. |
| `test-client-intelligence.js` (note-family) | Manual script with `console.log`, no framework, no assertions -- not a real test. |
| `aba_ai_toolkit_working_v3`, `aba_goto_app`, `abanote_toolkit_original_v2_08_07_25`, `note_genie_v1` (entire projects) | Provable near/exact duplicates of `aba_tool_genie` or each other (see audit section 3); nothing unique to port. |
| Root-level `SidekickModal.tsx`, `ReportModal.tsx` (bcba-clinical-dashboard) | Dead duplicate / fake-generation UI. See Step 1. |
