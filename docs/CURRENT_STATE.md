# Current State -- BCBA Workspace

Snapshot after the Phase 1 consolidation described in `MIGRATION_LOG.md`. This is a
local-only prototype: no backend, no auth server, no database, no billing
infrastructure. Everything below runs in the browser against `localStorage` and
(optionally) the Gemini API.

## Navigation

Today / Caseload / Notes / Supervision / Data / Toolkit, in that order in the
sidebar. Activity and Settings are secondary utility buttons, not primary nav
items. Client detail opens from Caseload (side panel) or from Notes (dedicated
screen) -- it is not a separate top-level destination.

## What genuinely works

- **Today** -- week/day/month calendar. Drag to move events, drag the edge to
  resize, right-click for a context menu (edit/duplicate/copy/paste/email/mark
  complete), `Cmd/Ctrl+K` command palette, `Cmd/Ctrl+Z`/`Cmd/Ctrl+Shift+Z` undo/
  redo across the whole app state (clients, events, and now notes/assessments --
  all funnel through the same `useHistory` stack).
- **Caseload** -- searchable/filterable client grid, add/edit/archive clients,
  opens the client detail panel.
- **Notes** -- real session documentation. Pick a client (from the Notes landing
  page or an "upcoming session" shortcut) to see their existing notes, start a
  new one, or open an FBA / Parent Training log. The note editor has four real
  tabs (Details, Skill Acquisition, Observed Behaviors, Narrative), a live
  Documentation QA panel that blocks saving on missing raw notes / missing
  narrative / (as a warning) missing reviewer, draft autosave via the shared
  `useAutoSave` hook, and draft-recovery-on-reload. RBT-authored notes save as
  "Pending Review"; a BCBA writing or reviewing a note signs it off as
  "Completed" directly.
- **Supervision** -- weekly visual planner (click a cell to log hours at a
  location) and a compliance table computing the real BACB 5% supervision ratio
  per client from actual scheduled/logged events. "Schedule" books a future
  supervision session; "Log Hours" (newly wired from a previously-orphaned
  component) retroactively logs hours already completed.
- **Data** -- live counts computed from `appState`: active caseload size,
  sessions scheduled this week, weekly utilization %, and which active clients
  are currently below the 5% supervision target. No mock numbers.
- **Toolkit** -- 22 scenario-based prompts across 7 categories (crisis help,
  documentation, ethics, parent scripts, data patterns, goal writing, supervisor
  talk tracks). Search/filter, favorites (persisted separately from clinical
  data), AI-generated structured response with a static fallback per prompt,
  and a grounded follow-up chat about the specific response shown.
- **Undo/redo, autosave, backups** -- `useHistory` + `useAutoSave` are real,
  generic, and now used by scheduling, caseload edits, notes, assessments, and
  parent-training logs alike. A periodic (5-minute) full-state backup exists
  alongside the debounced live autosave, with automatic fallback-to-backup and a
  legacy-key migration path on load.
- **Settings** -- work-hours configuration (used by the Today week view), plus
  an existing export/import-to-JSON backup feature (unrelated to the note-family
  project's fake "Settings coming soon" screen, which was not carried forward).

## What remains mocked or intentionally thin

- **Demo caseload**: 5 clients in `constants.ts`. Only 2 (Liam, Sophia) have
  sample goals/target behaviors/interventions filled in, so the Notes tab has
  something to show; the other 3 will show honest "nothing defined yet" empty
  states until goals are added through further Caseload/profile editing work
  (there is currently no dedicated "edit goals" UI -- goals live on the `Client`
  type but are only editable by hand in `constants.ts` right now).
- **Data tab** is numeric only. Per-goal trend charts (analogous to genie's
  `Analytics`/`ProgressChart`) were not ported in this phase -- flagged directly
  in the UI ("will appear here once...") rather than faked.
- **Documentation QA** is a completeness check (missing fields, missing
  reviewer/narrative), not a real payer/billing compliance determination. This
  is stated in the UI panel itself, not just in code comments.
- **AuthScreen** is a local, single-session login gate backed by a plaintext user
  list in `localStorage` (`bcba_users_v1`) -- adequate for switching between a
  demo "BCBA" and "RBT" role locally, explicitly not real authentication. Do not
  build on top of this for anything beyond local prototyping.

## localStorage usage

| Key | What it holds |
|---|---|
| `bcba_dashboard_state_v1` (+ `_backup`) | Clients and events (`AppState`) -- includes notes/assessments/parent-training logs, since those now live on `Client`. |
| `bcba_dashboard_activity_v1` | Activity log entries. |
| `bcba_dashboard_settings_v1` | Work-hours setting. |
| `bcba_current_user_v1` | The logged-in user's session. |
| `bcba_users_v1` | The local demo user roster (AuthScreen). |
| `bcba_sidebar_collapsed` | UI preference only. |
| `bcba_toolkit_favorites_v1` | Toolkit favorited prompt IDs -- deliberately separate from clinical `appState`. |
| `bcba_note_draft_<clientId>_<noteId\|new>` | In-progress session note draft, cleared on save. |
| `bcba_doc_draft_<clientId>_<docType>_<docId\|new>` | In-progress FBA/parent-training draft, cleared on save. |
| Legacy keys (`bcba_dashboard_events_v2`, `bcba_dashboard_clients_v2`) | Read once for migration on first load if the current keys are empty; not written to anymore. |

## Gemini usage

One service file: `services/geminiService.ts`. See its file-level comment for the
full architecture rationale. Exported functions:

- `chatWithSidekick` -- function-calling agent on the Today tab; can schedule
  events via tool use, grounded in the actual current caseload/schedule.
- `generateClientSummary` -- schema-constrained JSON progress summary from real
  event history; wired into the Caseload client detail panel
  (`components/ClientProfilePanel.tsx`), which calls it directly.
- `generateSessionNarrative` -- Notes tab; grounded strictly in the session note's
  own fields, returns `''` (not a fabrication) on failure.
- `suggestRescheduling` -- Today tab conflict resolution; throws on failure, caller
  shows a toast.
- `generateToolkitResponse` / `sanitizePromptInput` / `createToolkitFollowUpChat`
  -- Toolkit tab; schema-constrained JSON with a static per-prompt fallback and a
  basic PII/PHI text scrub.

**Without a `GEMINI_API_KEY`** (no `.env.local` present in this repo -- add one
locally, see `vite.config.ts`), the app still boots and is usable: the Toolkit
falls back to its static templates, session narrative generation returns empty
(the clinician just writes it manually), and Sidekick/reschedule calls fail
gracefully into an error toast. Nothing crashes.

## Known limitations

- No automated tests exist (the one "test" file in the note-family projects was a
  manual console-log script, not a real test, and was not carried forward --
  see `BCBA_PROJECT_AUDIT.md`).
- No goal/behavior-editing UI yet -- `Client.goals`/`targetBehaviors`/
  `interventions` are typed and consumed by Notes, but only seeded via
  `constants.ts`, not editable from the app itself.
- `ClientModal` (Caseload's add/edit form) has not been extended for the new
  clinical fields (age, guardian, goals, etc.) -- it still only edits name,
  diagnosis, status, and photo, matching the original dashboard's scope.
- Single-tenant, single concurrent user, browser-local data only, by design at
  this stage.

## Cleanup pass (see CLEANUP_REPORT.md)

A dead-code/lean-up pass removed a handful of speculative, never-wired pieces
left over from the consolidation: the unused `EventAction` and
`SupervisionLog` types in `types.ts`, an unused `HOURS` constant, an unused
`events` prop on `CaseloadView`, and a set of unused imports/local variables
across several components. No behavior changed. It also fixed a dangling
`<link rel="stylesheet" href="/index.css">` in `index.html` (the file never
existed) that had been silently triggering a Vite build warning on every
build. Nothing in the "What genuinely works" section above was affected.
