# Cutover Strategy V1

Phase 18 deliverable. How `localStorage` AppState evolves to API +
PostgreSQL **feature-by-feature** without breaking
`bcba-workspace-ai-studio`.

**Rules:**
- No permanent dual-write of the same domain to localStorage and PostgreSQL.
- Temporary bounded adapters are allowed during a domain’s cutover window.
- Once a domain cuts over, **PostgreSQL is canonical** for that domain.
- Preserve working clinical UX throughout.

---

## 1. Target flow

```text
UI component (KEEP)
    → repository / adapter
        → [pre-cutover] localStorage AppState
        → [post-cutover] HTTP API → PostgreSQL
```

`App.tsx` stops being the durable source of truth domain-by-domain; it
remains the composition shell and local UX owner (tabs, modals, undo buffer
where still useful).

---

## 2. Repository adapter pattern

Introduce thin repositories (Wave 0 scaffolding; wire per wave):

| Repository | Pre-cutover | Post-cutover |
|---|---|---|
| `authRepo` | `bcba_users_v1` / `bcba_current_user_v1` | `/api/v1/auth/*` |
| `clientsRepo` | `appState.clients` | `/api/v1/clients` |
| `eventsRepo` | `appState.events` | `/api/v1/events` |
| `servicePlansRepo` | `appState.servicePlans` | `/api/v1/service-plans` |
| `documentsRepo` | nested sessionNotes/assessments/PT | `/api/v1/documents` |
| `activityRepo` | `bcba_dashboard_activity_v1` | `/api/v1/activity` |
| `settingsRepo` | `bcba_dashboard_settings_v1` | org settings API |

Each repository exposes the same async interface before and after cutover so
components do not branch on storage technology.

### Domain cutover registry (authoritative)

`lib/cutover.ts` owns **per-domain** mode: `LOCAL` | `API`.

Domains:

```text
auth
clients
staff
configuration
events
clinicalPlans
clinicalData
documents
insurance
authorization
billing
compensation
attention
activity
files
ai
```

- Each domain independently `LOCAL` or `API`.
- **Wave 0: all default LOCAL.**
- Optional `VITE_DATA_MODE=local|api` is an emergency/default override only;
  **domain registry entries are authoritative** when explicitly set.
- `VITE_API_BASE_URL` configures the API origin (public).

Do not rely on a single global local-vs-api switch as the migration mechanism.

### Legacy ID migration bridge

Current local entities use legacy string IDs. PostgreSQL uses UUIDs.

On import/cutover, persist a durable mapping:

| Field | Purpose |
|---|---|
| `legacy_entity_type` | e.g. `client`, `event`, `service_plan` |
| `legacy_id` | ID from localStorage / AppState |
| `postgres_id` | UUID in PostgreSQL |

Equivalent: `legacy_external_id` column on migrated rows **plus** a
`legacy_id_map` table for cross-domain lookups.

**Wave 1 Client import must not break** local clinical notes/plans that still
reference the old Client ID. The importer/cutover layer must translate old
references until downstream clinical domains migrate. Never silently
regenerate IDs and lose relationships.

### Legacy AppState persistence after partial cutover

`bcba_dashboard_state_v1` is one serialized blob today. Once a domain is
PostgreSQL-canonical:

1. That domain **must not** continue to be written as competing durable truth
   inside the legacy AppState blob.
2. The legacy persistence adapter persists **only domains still owned locally**.
3. In-memory copies of API-backed entities may exist for React rendering;
   they are **not** permanent localStorage SoT.

---

## 3. Domain cutover order (aligned to waves)

| Wave | Domains cut over to PostgreSQL | Legacy keys stop being written |
|---|---|---|
| 0 | None (spine only); Auth endpoint exists but UI may still use local until Wave 1 | — |
| 1 | Auth, Organization, Staff, Clients (+ caregivers/assignments) | `bcba_users_v1`, `bcba_current_user_v1`; client slices of `bcba_dashboard_state_v1` |
| 2 | Config catalogs (EventType/Service/BillingCode…), Events/Calendar | events portion of AppState; work hours → org settings |
| 3 | ServicePlans, Programs, Objectives, Baselines, Observations/Datasheets | servicePlans/programLibrary; programData on notes migrates with Wave 4 docs |
| 4 | ClinicalDocuments, Signatures, DocumentEventLinks | nested sessionNotes/assessments/parentTrainingLogs; note/doc draft keys → API drafts |
| 5 | Insurance, PA, allocation/consumption | (new; no legacy) |
| 6 | Billing Readiness evaluator (server) | (derived; no SoT key) |
| 7–8 | Claims, ClientInvoice, Remittance, Compensation, PaymentProfile | (new) |
| 9 | Required docs, AttentionCoordination, NotificationHistory | attention remains derived + new persistent keys on server |
| 10 | Activity API, Audit views, Files | `bcba_dashboard_activity_v1`; photos leave AppState |
| 11 | AI proxy; remove browser Gemini key path | Vite `GEMINI_API_KEY` define removed |

Nested clinical data today lives on `Client` inside one AppState blob.
**Practical rule:** When Clients cut over in Wave 1, clinical subcollections
may still travel as JSON columns **temporarily** only if required for
zero-breakage — prefer **keeping clinical subdocs in local AppState until
Wave 3–4** while Client identity/roster is API-backed.

Recommended Client cutover split:

1. **Wave 1:** Client roster + demographics + lifecycle + caregivers via API; sessionNotes/plans still local keyed by client id.
2. **Wave 3–4:** Clinical plans/data/docs leave localStorage.

This avoids a big-bang migration of the entire `bcba_dashboard_state_v1` blob.

---

## 4. Temporary adapters (allowed)

| Adapter | Purpose | Must end by |
|---|---|---|
| `LocalAppStateStore` | Current get/set AppState + autosave | When last domain leaves |
| `HybridClientsRepo` | API clients + merge local clinical nests | End of Wave 4 |
| `LegacyDateReviver` | `new Date` on events | Events cutover |
| `DemoSeedImporter` | Load `constants.ts` seeds into empty org | Wave 1+ |

**Forbidden as permanent architecture:** writing the same Client/Event/Note
to both localStorage and PostgreSQL on every save after that domain’s
cutover gate.

---

## 5. Demo / local data handling

| Scenario | Behavior |
|---|---|
| Fresh API org | Seed script creates Organization + Mary + BCBA Owner + demo clients (from `INITIAL_CLIENTS` / events) |
| Existing browser localStorage | One-time **import wizard** (Settings evolution): upload/read legacy JSON → POST import API (Wave 1–2) |
| AI Studio without backend | `VITE_DATA_MODE=local` keeps today’s behavior fully offline |
| AI Studio with remote API | Point `VITE_API_BASE_URL` at deployed API when available |

Google AI Studio preview continues to work in **local mode** until an API
is intentionally configured.

---

## 6. Switching canonical source (per domain)

Checklist when flipping a domain to `api`:

1. Migrations + API handlers live and tested.
2. Repository implementation switched; UI still compiles.
3. Import path for any residual local data documented/run.
4. Writes go only to API.
5. Regression gate for that wave passes.
6. Stop writing that domain’s localStorage keys (read-only fallback optional for one release).
7. Record cutover in `docs/MIGRATION_LOG.md` (or roadmap changelog).

---

## 7. Rollback during development

| Level | Action |
|---|---|
| Feature flag | Set domain back to `local` in `lib/cutover.ts` |
| Database | Dev DB reset via migrate fresh; no production yet |
| UI | Git revert repository adapter commit |
| Data | Local JSON export still available until Activity/Settings cutover |

No production pilot until Wave 11 hardening — rollback is a **dev** concern first.

---

## 8. When legacy keys die

| Key | Stop writing | May delete locally |
|---|---|---|
| `bcba_users_v1` / `bcba_current_user_v1` | Wave 1 complete | After confirmed API login |
| `bcba_dashboard_state_v1` clients slice | Wave 1 (identity) / Wave 4 (clinical nests) | After import |
| events slice | Wave 2 | After import |
| servicePlans / programLibrary | Wave 3 | After import |
| `bcba_dashboard_activity_v1` | Wave 10 | After Activity API |
| `bcba_dashboard_settings_v1` | Wave 2 (org settings) | After import |
| `bcba_note_draft_*` / `bcba_doc_draft_*` | Wave 4 | After draft API |
| `bcba_toolkit_favorites_v1` | Wave 11 (user prefs) | Optional keep local |
| `bcba_sidebar_collapsed` | Never required on server | Keep as pure UI local |

Backup key `bcba_dashboard_state_v1_backup`: stop with primary state.

---

## 9. JSON backup / export evolution

| Phase | Behavior |
|---|---|
| Today | SettingsModal exports state + activity + settings |
| Wave 1–2 | Export remains; add “Import into server org” for admins |
| Mid waves | Export becomes **API export** (Function-gated EXPORT verb) producing JSON/zip of tenant slice |
| Later | Object-storage backed large exports via pg-boss job |

Do not remove local export until API export exists for cut-over domains.

---

## 10. Undo / autosave

| Concern | Strategy |
|---|---|
| `useHistory` | Remains **client UX buffer** for in-session undo on forms/calendar gestures; not durable SoT |
| `useAutoSave` | Becomes debounced repository.save → API; drop localStorage writes per cutover domain |
| Drafts | Server draft resources (Wave 4) replace `bcba_note_draft_*` |

---

## 11. Success definition

Cutover is successful when:

1. A clinician can use Calendar + Caseload + clinical loop against PostgreSQL.
2. AI Studio can still run the frontend in local mode for demos.
3. No domain has silent dual-write.
4. Mary/BCBA authz tests pass on the API.
5. Legacy keys for cut-over domains are no longer written.

---

## Change Log

- **V1.1 (Node 7 / Wave 0):** Domain cutover registry authoritative; legacy ID bridge; AppState ownership after partial cutover.
- **V1 (Phase 18):** Initial cutover strategy for evolving the existing app.
