# Existing App Evolution Map V1

Phase 17 deliverable. Disposition of every meaningful current subsystem
in `bcba-workspace-ai-studio`.

**DEFAULT = KEEP.**

Disposition key:

| Code | Meaning |
|---|---|
| **KEEP AS-IS** | Remains with no structural change required for architecture |
| **KEEP + CONNECT TO DATABASE/API** | Preserve UI/logic; back with PostgreSQL/API |
| **EXPAND** | Preserve core; add fields/flows/coverage |
| **REFACTOR INTERNALLY** | Same capability; reshape internals to fit shared engines |
| **REPLACE PROTOTYPE INFRASTRUCTURE** | Concept/UX may survive; implementation cannot |
| **RETIRE** | Requires explicit justification; outcome must survive elsewhere |

---

## Evolution table

| Subsystem | Disposition | Notes |
|---|---|---|
| **Calendar UI** (`WeekView`, `MonthView`, `EventModal`, drag/resize, context menu, command palette) | **KEEP + CONNECT TO DATABASE/API** | Strongest UX surface. Persist Events via API; deepen to EventType rules later (EXPAND). |
| **CalendarEvent model** | **EXPAND** + connect | Evolve into thin Event + EventServiceDelivery; keep schedule UX. |
| **CaseloadView** | **KEEP + CONNECT TO DATABASE/API** | Roster preserved. |
| **ClientModal** | **KEEP + CONNECT**; **EXPAND** | Add caregivers/consent/diagnosis/physician/lifecycle statuses. |
| **ClientProfilePanel** | **KEEP + CONNECT**; **EXPAND** | Ancestor of 5-section workspace; add Operations/Billing/Documents depth. |
| **Client status enum** (`Active/Onboarding/Maintenance`) | **EXPAND** | Map to Active/Inactive/Discharged (+ tags for onboarding/maintenance if needed). |
| **Client hard delete** | **REPLACE PROTOTYPE INFRASTRUCTURE** | Replace with lifecycle deactivate/discharge; retain history. |
| **ServicePlanManagerModal / ServicePlan types** | **KEEP + CONNECT**; **EXPAND** | 2-layer hierarchy correct; add amendment log / templates later. |
| **ProgramEditorModal / ClinicalProgram / Objectives / Baselines / MasteryCriteria** | **KEEP + CONNECT**; **EXPAND** | Preserve `programId` linking and manual mastery rule; expand measurement types. |
| **Program Library** | **KEEP + CONNECT TO DATABASE/API** | Org-level templates. |
| **DataCollection / SessionNote lifecycle** | **KEEP + CONNECT**; **EXPAND** | Preserve RBT→Pending Review→BCBA gate; expand toward document status machine + Event links + signatures. |
| **NotesHome / ClientNotesList / cross-caseload pending queue** | **KEEP + CONNECT**; **EXPAND** | Feeds Attention Domain 2/26. |
| **Documentation QA (`complianceEngine`, DEFAULT_QA_RULES)** | **KEEP**; **EXPAND** | Keep non-billing framing; later feed richer readiness checks. |
| **DocumentEditor (FBA / Parent Training)** | **KEEP + CONNECT**; **EXPAND** | Become ClinicalDocument types in five-entity split. |
| **ClinicalProgress + `utils/clinicalProgress.ts`** | **KEEP + CONNECT TO DATABASE/API** | Derived charts; no rewrite. Annotation tools later = EXPAND. |
| **DataOverview** | **KEEP**; **REFACTOR INTERNALLY** | Deduplicate supervision math toward shared util. |
| **SupervisionView / SupervisionLogModal / 5% math** | **KEEP + CONNECT**; **REFACTOR INTERNALLY** | Preserve math/planner; wire Attention condition fully; share util. |
| **NeedsMyAttentionPanel + `deriveClinicalAttention`** | **KEEP**; **EXPAND** | Keep pure derivation engine; add persistent AttentionCoordination + NotificationHistory; broaden catalog. |
| **ActivityView + ActivityLogEntry** | **KEEP + CONNECT**; **EXPAND** | Keep as recent-activity feed; **do not** merge with AuditEntry. |
| **SettingsModal work hours + JSON backup** | **KEEP + CONNECT**; **EXPAND** | Work hours → org settings; backup becomes export Function; full Configuration is new. |
| **Sidebar / Header / App tabs** | **KEEP**; **EXPAND** | Evolve toward Function-aware AppShell / routes without discarding IA. |
| **CommandPalette / ContextMenu** | **KEEP AS-IS** (then connect actions to API) | Productivity UX. |
| **SidekickModal + `chatWithSidekick`** | **KEEP**; **REPLACE PROTOTYPE INFRASTRUCTURE** (API key path) | Keep grounded tool-use UX; proxy AI server-side. |
| **Toolkit (prompts, favorites, fallbacks)** | **KEEP**; AI key path **REPLACE PROTOTYPE INFRASTRUCTURE** | Cross-cutting utility; favorites → user prefs API. |
| **`geminiService` client-side key** | **REPLACE PROTOTYPE INFRASTRUCTURE** | Server AI proxy; preserve grounding/safety behavior. |
| **`useHistory` undo/redo** | **KEEP AS-IS** (client UX) | Remains local interaction buffer; not the durable SoT. |
| **`useAutoSave` → localStorage AppState** | **REPLACE PROTOTYPE INFRASTRUCTURE** | Debounced save becomes API mutate + draft endpoints; keep autosave *UX*. |
| **localStorage `bcba_dashboard_state_v1` (+ backup)** | **REPLACE PROTOTYPE INFRASTRUCTURE** | PostgreSQL is canonical. |
| **localStorage auth (`AuthScreen`, `bcba_users_v1`, `bcba_current_user_v1`)** | **REPLACE PROTOTYPE INFRASTRUCTURE** | Real Identity/session; preserve login-gate UX concept. |
| **User.role enum as sole RBAC** | **EXPAND** → Function + Credential Ceiling model | Preserve note gate behavior as first Ceiling instance. |
| **Draft keys `bcba_note_draft_*` / `bcba_doc_draft_*`** | **REPLACE PROTOTYPE INFRASTRUCTURE** (storage) | Keep draft recovery UX via API drafts or local ephemeral cache. |
| **constants seed data** | **KEEP AS-IS** for demo/dev | Not production SoT. |
| **`Client.interventions` legacy chip list** | **RETIRE** | See justification below. |
| **Goals / targetBehaviors free-text parallel model** | **REFACTOR INTERNALLY** / gradual | Prefer programId-based clinical model; migrate carefully; do not silent-delete mid-flight. |

---

## RETIRE — explicit justification

### `Client.interventions` legacy chip-toggle list

| Question | Answer |
|---|---|
| **Problem it solved** | Quick named strategy list on Client for note checkboxes before program-level interventions existed |
| **Why it cannot survive as SoT** | Duplicates/conflicts with `ClinicalProgram.interventions` / program-driven data collection — two sources of truth |
| **Where outcome is preserved** | Program antecedents/interventions on Service Plan programs; session note intervention selection from active programs |
| **Evidence** | `EXISTING_APP_RECONCILIATION_V1.md`; `CLINICAL_OPERATIONS_INTEGRATION_V1.md` §9 |

No other current capability is retired in this phase.

---

## Pattern summary (expected shape)

```
Calendar UI:              KEEP + CONNECT TO DATABASE/API
ClinicalProgress:         KEEP + CONNECT TO DATABASE/API
ServicePlan UI:           KEEP / EXPAND + CONNECT TO DATABASE/API
ClientProfilePanel:       KEEP / EXPAND + CONNECT TO DATABASE/API
deriveClinicalAttention:  KEEP / EXPAND
DataCollection review:    KEEP / EXPAND + CONNECT
localStorage AppState:    REPLACE PROTOTYPE INFRASTRUCTURE
localStorage auth:        REPLACE PROTOTYPE INFRASTRUCTURE
Client.interventions:     RETIRE (justified)
```

**Not** “rewrite everything.”

---

## Capability continuity checklist

| Current capability | Survives as |
|---|---|
| Today calendar ops | Same components → Event API |
| Caseload | Same components → Client API |
| Unified client workspace | ClientProfilePanel → expanded workspace |
| Service plans / programs / baselines / mastery | Same modals/types → Clinical Plans API |
| Data collection + note review | Same flow → Docs/Clinical Data API |
| Progress charts | Same utils/components → read API data |
| Supervision 5% | Same views → Event queries + shared util |
| Needs Attention | Same engine + new persistence layer |
| Activity feed | Same view + API; Audit separate |
| Settings backup | Export Function + org settings |
| Sidekick / Toolkit | Same UX; server AI |
| Undo/autosave UX | Local buffer + API drafts |

**No current capability disappears silently.**

---

## Change Log

- **V1 (Phase 17):** First evolution map binding existing components to preserve-first dispositions.
