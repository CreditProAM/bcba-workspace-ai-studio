# Dependency-Ordered Build Plan V1

Phase 18 deliverable. Construction plan for evolving
`bcba-workspace-ai-studio` in place under the approved Phase 17/17.1
architecture.

**Governing rule:** PRESERVE working clinical UX. Replace prototype
infrastructure. No greenfield app. No permanent dual-write.

Companion docs:
- `IMPLEMENTATION_STACK_V1.md`
- `CUTOVER_STRATEGY_V1.md`
- `WAVE_0_IMPLEMENTATION_SPEC_V1.md`

---

## 1. Strategy

```text
Existing React component
  → repository adapter
    → backend domain module
      → PostgreSQL
```

Prefer connected vertical slices once prerequisites exist (e.g. Wave 1
ends with Caseload on Postgres, not invisible schema alone).

---

## 2. Wave overview

| Wave | Name | Primary outcome |
|---|---|---|
| 0 | Production Spine | Backend + Postgres + conventions; UX unchanged |
| 1 | Identity + Clinic + Staff + Client Core | Real auth; Mary/BCBA proof; Caseload on API |
| 2 | Configuration + Event/Calendar | Calendar on Postgres; eligibility gates |
| 3 | Clinical Plan + Data | SP→Program→Data→Chart on Postgres |
| 4 | Documentation + Signatures | Note/review/lock + signatures |
| 5 | Insurance + Authorization | COB + PA ledger |
| 6 | Billing Readiness | Deterministic evaluator |
| 7 | Revenue Cycle | Claims/ClientInvoice/Remittance/locks |
| 8 | Provider Compensation | Rates/Timesheet/ProviderInvoice/PaymentProfile |
| 9 | Required Docs + Compliance + Attention | Mary’s operational picture |
| 10 | Reporting / Oversight / Remaining Config | Reports, Activity≠Audit, Files |
| 11 | AI + Integration + Hardening | Gemini proxy; adapters; pilot readiness |

---

## 3. React Feature Map → Wave assignment (27 domains)

| # | Domain | Wave(s) |
|---|---|---|
| 1 | App Shell / Navigation | 0 (stub), 1 (Function-aware shell expand) |
| 2 | Home / Today / Dashboards | 2 (calendar today), 9 (attention landing expand) |
| 3 | Clients | 1 (core), expand caregivers continuum 1 |
| 4 | Scheduling / Calendar | 2 |
| 5 | Events / Sessions | 2 (foundation), 4–7 (links/locks) |
| 6 | Clinical Service Plans | 3 |
| 7 | Programs / Objectives | 3 |
| 8 | Data Collection | 3 |
| 9 | Progress / Charts | 3 (keep ClinicalProgress) |
| 10 | Documentation | 4 |
| 11 | Signatures | 4 |
| 12 | Required Documents | 9 |
| 13 | Staff / Workforce | 1 |
| 14 | Credentials | 1 |
| 15 | Permissions / Authority | 0 framework, 1 enforce |
| 16 | Insurance | 5 |
| 17 | Prior Authorizations | 5 |
| 18 | Billing Codes / Services / Payers | 2 (min catalogs), 5 (rates), 7 (entities/CH) |
| 19 | Billing Readiness | 6 |
| 20 | Claims | 7 |
| 21 | Remittance | 7 |
| 22 | Provider Compensation | 8 |
| 23 | Configuration | 0–2 spine/min, 7–10 remaining surfaces |
| 24 | Compliance | 9 |
| 25 | Reporting / Oversight | 10 |
| 26 | Attention / Work Coordination | 3–4 (keep derive), 9 (persist expand) |
| 27 | Files / Help | 10 Files; Help incremental; Toolkit/Sidekick 11 |

---

## 4. PostgreSQL entities → Wave

| Wave | Entities introduced / migrated |
|---|---|
| 0 | Organization (minimal), AuditEntry, tenant-FK proof tables |
| 1 | UserIdentity, UserSession, OrganizationMembership, OperationalFunction, FunctionGrant, CredentialDefinition, UserCredential, Client, Caregiver, ConsentAuthority, Diagnosis, Physician, ClientAssignment |
| 2 | EventType, Service, BillingCode, ServiceBillingCodeEligibility, ServiceAllowedCredential, CredentialBillingCodeEligibility, Event, EventServiceDelivery; org work hours |
| 3 | ServicePlan, Category, Program, Objective, Baseline, MeasurementDefinition, RawObservation, Datasheet |
| 4 | ClinicalDocumentTemplate, ClinicalDocument, DocumentEventLink, Signature |
| 5 | Payer, HealthPlan, InsuranceCoverage, CoordinationOfBenefits, PayerReimbursementRate, ClientInsuranceRateOverride, PriorAuthorization, AuthorizationAllocation, AuthorizationConsumption |
| 6 | (no new SoT tables — evaluator service) |
| 7 | BillingEntity, ClearingHouseConfiguration, PayerPlanBillingEntityRole, Claim, ClaimItem, ClientInvoice, Remittance, FinancialDocumentLockPolicy |
| 8 | ProviderRate, Timesheet, ProviderInvoice, PaymentProfile |
| 9 | RequiredDocumentPolicy, RequiredDocumentInstance, AttentionCoordination, NotificationHistory |
| 10 | StoredFile metadata (+ storage); ReportDefinition (as needed) |
| 11 | Integration adapter config rows as needed; no Episode entity |

---

## 5. Wave detail

### WAVE 0 — Production Spine

| | |
|---|---|
| **Depends on** | Approved architecture; stack selection |
| **Scope** | `server/` Hono app; Docker Postgres; Drizzle migrations; health API; AuditEntry writer; row_version + tenant FK conventions; `lib/api` + `lib/cutover`; tests |
| **Preserve** | Entire clinical UI; Vite root build; AI Studio workflow |
| **New** | `server/**`, `docker-compose.yml`, `lib/api/client.ts`, `lib/cutover.ts` |
| **Backend modules** | health, platform/audit |
| **Completion gate** | Frontend build+behavior; backend starts; DB connects; health OK; tenant FK test; no clinical removal |
| **Regression** | `tsc`, `vite build`, open Today/Caseload/Notes smoke |
| **Do NOT start early** | Auth replacement; domain migrations; Gemini proxy; billing |

See `WAVE_0_IMPLEMENTATION_SPEC_V1.md`.

---

### WAVE 1 — Identity + Clinic + Staff + Client Core

| | |
|---|---|
| **Depends on** | Wave 0 |
| **Scope** | Real auth sessions; FunctionGrant+scope_mode; Credentials; Client lifecycle; Caregiver/Consent; Assignments; replace plaintext users |
| **Preserve** | AuthScreen UX concept; CaseloadView; ClientModal; ClientProfilePanel shell |
| **Connect** | Caseload/ClientModal/Profile → API |
| **Entities** | See §4 Wave 1 |
| **Backend modules** | Identity/Access, Organization (profile), Staff/Credentials, Clients |
| **Completion gate** | Mary multi-function Ceiling NONE; BCBA Owner + credential; backend denies Mary clinical write; tenant isolation test; session revoke test; Caseload on Postgres |
| **Regression** | Login/logout; caseload CRUD→lifecycle; existing profile tabs still open (clinical nests may remain local per cutover) |
| **Do NOT start early** | Claims; full Event model; PA |

**Mary operational as early as reasonable:** end of Wave 1.

**Clinical authority enforced before DB-backed clinical writes:** AuthZ framework in Wave 1; clinical write APIs in Waves 3–4 must call it (deny-by-default).

---

### WAVE 2 — Configuration + Event / Calendar Foundation

| | |
|---|---|
| **Depends on** | Wave 1 (Client, Staff, Credentials, Assignments) |
| **Scope** | Min catalogs for delivery; CalendarEvent → Event + EventServiceDelivery; server validation |
| **Preserve** | WeekView, MonthView, EventModal, drag/resize, context menu, command palette, reminders, interaction patterns; **existing Supervision UI** (connect to deeper Event model — do not invent a new supervision product) |
| **Entities** | EventType, Service, BillingCode, eligibility joins, Event, EventServiceDelivery |
| **Event model requirement** | EventType / Event architecture **must support** the already-confirmed Appointment → Supervision **parent/child** relationship and allowed-sub-event rules from research (parent Event, nested supervision child). Preserve SupervisionView/SupervisionLogModal UX; wire to Event parent/child + existing 5% math. |
| **Backend modules** | Organization/Configuration (subset), Scheduling/Events |
| **Completion gate** | Calendar on Postgres; survives refresh; invalid provider/service/code rejected server-side; client lifecycle gate; supervision nesting representable in Event model |
| **Regression** | Create/move/resize event; recurrence smoke; conflict detect UX; Supervision planner still usable |
| **Do NOT start early** | Claims; Documentation lock; full payer X12 |

**Wave 1 auth transport (record — implement in Wave 1, not Wave 0):**  
Frontend and API may run on separate origins (local dev / Google AI Studio /
later hosting). Cookie-session architecture must implement: allowed CORS
origins; credentials-enabled requests; Secure cookie behavior; SameSite
policy appropriate to topology; CSRF protection for state-changing
authenticated requests; server-side Origin/CSRF validation as appropriate.
**Do not** solve cross-origin auth with browser localStorage tokens.

---

### WAVE 3 — Clinical Plan + Data Migration

| | |
|---|---|
| **Depends on** | Wave 2 (Event optional link; Client required) |
| **Scope** | ServicePlan→…→RawObservation/Datasheet; keep programId; manual mastery; ClinicalProgress |
| **Preserve** | ServicePlanManagerModal, ProgramEditorModal, clinicalProgress utils, existing 5 measurement types (Wave 3A) |
| **Wave 3A** | Migrate current 5 measurement types + full SP→data→chart loop on Postgres |
| **Wave 3B (required before Wave 3 COMPLETE)** | Implement the **full confirmed Office Puzzle measurement-type breadth** already present in the research corpus (`DATA_COLLECTION_PROGRESS_ENGINE` / Functional Parity Ledger — 15-type / 6-family set). Do not re-browse Office Puzzle. Each type must land in MeasurementDefinition / entry UX, **unless** an individual capability is explicitly marked DEFERRED WITH RISK in the wave exit notes. |
| **Entities** | ServicePlan, Category, Program, Objective, Baseline, MeasurementDefinition, RawObservation, Datasheet |
| **Backend modules** | Clinical Plans, Clinical Data |
| **Completion gate** | 3A: Client→SP→Program→Objective/Baseline→data→chart on Postgres. 3B: full confirmed measurement set implemented or explicitly DEFERRED WITH RISK. |
| **Regression** | Mastery criteria indication without auto-master; Attention derive still runs; existing 5 types still work after 3B expansion |
| **Do NOT start early** | Auto-mastery; Billing Readiness; Claims |

---

### WAVE 4 — Documentation + Signatures

| | |
|---|---|
| **Depends on** | Wave 3; Wave 2 Events |
| **Scope** | SessionNote/FBA/PT → ClinicalDocument*; Signature XOR FKs; status lifecycle; locks |
| **Preserve** | Draft recovery UX; Documentation QA; RBT→Pending Review→BCBA; grounded narrative; NotesHome queue |
| **Entities** | ClinicalDocumentTemplate, ClinicalDocument, DocumentEventLink, Signature |
| **Backend modules** | Documentation/Signatures |
| **Completion gate** | RBT write → BCBA review → Reviewed → Event signature independent → lock correct; no silent overwrite |
| **Regression** | QA ERROR gate; narrative grounding; Pending Review queue |
| **Do NOT start early** | Claims generation |

Named Event lock cause begins here: `DOCUMENT_REVIEW` (distinct from financial locks).

---

### WAVE 5 — Insurance + Authorization

| | |
|---|---|
| **Depends on** | Wave 1 Clients; Wave 2 BillingCode/Service |
| **Scope** | Payer/Plan/Coverage/COB/rates/PA + Allocation/Consumption ledger |
| **Entities** | See §4 Wave 5 |
| **Backend modules** | Insurance/Authorization |
| **Completion gate** | approved/used/remaining derived after CONSUME/REVERSAL/ADJUSTMENT; duplicate Event CONSUME impossible |
| **Regression** | COB order; override rate precedence unit tests |
| **Do NOT start early** | Claim submit network |

---

### WAVE 6 — Billing Readiness

| | |
|---|---|
| **Depends on** | Waves 2–5 (Event, Docs, Signatures, PA, eligibility) |
| **Scope** | Deterministic evaluator `{eligible, unmetConditions[], warnings[]}`; AND-gate Reviewed Doc + Event Signature where applicable; no stored eligibility SoT |
| **Backend modules** | Shared readiness service used by Revenue |
| **Completion gate** | Mary sees exact unmet conditions why not billable |
| **Regression** | Snapshot tests for condition catalogs |
| **Do NOT start early** | Claim generation before readiness exists |

---

### WAVE 7 — Revenue Cycle

| | |
|---|---|
| **Depends on** | Wave 6 Readiness; Wave 5 Insurance |
| **Scope** | BillingEntity, ClearingHouseConfiguration, roles, Claim/Item, ClientInvoice, Remittance, FinancialDocumentLockPolicy; transmission adapter stub |
| **Preserve** | Independent Claim / Client Invoice lock policies; ClientInvoice ≠ ProviderInvoice |
| **Event lock causes** | `CLAIM`, `CLIENT_INVOICE` (+ prior `DOCUMENT_REVIEW`) |
| **Completion gate** | billing-ready Event → claim/invoice → lock per policy → status → remittance structure |
| **Do NOT start early** | Building clearinghouse network; ProviderInvoice conflation |

---

### WAVE 8 — Provider Compensation

| | |
|---|---|
| **Depends on** | Wave 2 Events; Wave 1 Employment Type; Wave 7 lock policy |
| **Scope** | ProviderRate, Timesheet, ProviderInvoice, PaymentProfile (token/ref metadata only — no raw bank secrets) |
| **Lock causes** | `PROVIDER_INVOICE`, `TIMESHEET` |
| **Completion gate** | Same Event in revenue + compensation without conflating payer vs provider rates |
| **Do NOT start early** | Actual disbursement network |

---

### WAVE 9 — Required Docs + Compliance + Attention

| | |
|---|---|
| **Depends on** | Credentials, PA, Docs (Waves 1/4/5) |
| **Scope** | RequiredDocument*; compliance rollups; AttentionCoordination; NotificationHistory; expand `deriveClinicalAttention` |
| **Preserve** | deriveClinicalAttention engine architecture |
| **Completion gate** | Mary’s single operational picture: missing/expiring/blocked/incomplete/exhausted/unsigned/unreviewed/unbillable |
| **Do NOT start early** | Replace attention with dashboard badges only |

---

### WAVE 10 — Reporting / Oversight / Remaining Config

| | |
|---|---|
| **Depends on** | Domain truth from prior waves |
| **Scope** | Report query foundation; Activity API; Audit views; Files/object-storage; config onboarding guidance; remaining config screens |
| **Preserve** | Activity ≠ Audit |
| **Completion gate** | Read-only reports; export Function-gated; file upload metadata path |
| **Do NOT start early** | Report writes mutating clinical truth |

---

### WAVE 11 — AI + Integration + Production Hardening

| | |
|---|---|
| **Depends on** | Stable API; Wave 0+ patterns |
| **Scope** | Gemini server proxy; preserve Sidekick/Toolkit/narrative safety; adapter boundaries (CH/ERA/payroll/notify); security; session/device; backup/export; indexes; monitoring; deployment readiness |
| **Preserve** | Sidekick/Toolkit UX |
| **Completion gate** | No browser secrets; adapters stubbed; pilot checklist |
| **Do NOT start early** | CR Essentials / ABA Matrix research |

---

## 6. Existing component migration paths

| Component / subsystem | Disposition | Wave path |
|---|---|---|
| WeekView / MonthView / EventModal / ContextMenu / CommandPalette | KEEP + CONNECT | 2 |
| CaseloadView / ClientModal / ClientProfilePanel | KEEP + CONNECT / EXPAND | 1 |
| ServicePlanManager / ProgramEditor | KEEP + CONNECT / EXPAND | 3 |
| DataCollection / NotesHome / ClientNotesList | KEEP + CONNECT / EXPAND | 3–4 |
| ClinicalProgress / clinicalProgress.ts | KEEP + CONNECT | 3 |
| SupervisionView / SupervisionLogModal | KEEP + CONNECT / REFACTOR util | 2–3, Attention 9 |
| NeedsMyAttentionPanel / clinicalAttention.ts | KEEP / EXPAND | 9 (engine earlier) |
| ActivityView | KEEP + CONNECT | 10 |
| SettingsModal | KEEP + CONNECT / EXPAND | 2, 10 |
| AuthScreen | REPLACE infra / KEEP UX | 1 |
| Sidekick / Toolkit / geminiService | KEEP UX / REPLACE key path | 11 |
| useHistory | KEEP AS-IS (UX) | all |
| useAutoSave / localStorage AppState | REPLACE infra | cutover per wave |
| Client.interventions | RETIRE | after program interventions authoritative (Wave 3) |
| complianceEngine QA | KEEP / EXPAND | 4 |

**No KEEP/EXPAND capability is scheduled for deletion.**

---

## 7. Event financial lock model (implementation note)

Do **not** use one mysterious mutable `locked` boolean as SoT.

Track named lock causes (set/clear by owning flows):

| Cause | Set when | Policy |
|---|---|---|
| `DOCUMENT_REVIEW` | Linked doc reaches Reviewed | Clinical rule |
| `CLAIM` | Claim generated/linked | `FinancialDocumentLockPolicy.claim_locks_event` |
| `CLIENT_INVOICE` | ClientInvoice generated | `client_invoice_locks_event` |
| `PROVIDER_INVOICE` | ProviderInvoice generated | `provider_invoice_locks_event` |
| `TIMESHEET` | Timesheet generated | `timesheet_locks_event` |

Event is locked if any active cause applies. Mary UI lists **why**.

---

## 8. PaymentProfile safety

Store provider/channel/token/reference metadata only. **Do not** plan raw
bank-account credentials in app DB unless a future regulated payment
architecture explicitly requires and secures it.

---

## 9. Cross-wave invariants

1. Upstream truth before downstream consumers.
2. Billing Readiness (6) before Claims consume Events (7).
3. Clinical AuthZ before clinical DB writes (1 before 3–4).
4. PA ledger append-only (5).
5. AI Studio Vite root preserved (0–11).
6. Regression checks every wave.

---

## 10. Quality gate answers

| # | Question | Answer |
|---|---|---|
| 1 | 27 domains assigned? | Yes — §3 |
| 2 | Every Postgres entity assigned? | Yes — §4 |
| 3 | KEEP/EXPAND migration paths? | Yes — §6 |
| 4 | Accidental deletion scheduled? | No — only justified RETIRE interventions |
| 5 | Downstream waits for prereqs? | Yes — wave depends-on |
| 6 | Avoid weeks of invisible infra? | Wave 0 minimal; Wave 1 reconnects Caseload UI |
| 7 | Mary early? | Wave 1 |
| 8 | Clinical authority before clinical DB writes? | Yes |
| 9 | Billing Readiness before Claims? | Yes (6 before 7) |
| 10 | localStorage cutover explicit? | `CUTOVER_STRATEGY_V1.md` |
| 11 | Regression per wave? | Yes |
| 12 | Wave 0 startable now? | Yes — `WAVE_0_IMPLEMENTATION_SPEC_V1.md` |

---

## 11. What must NOT be started early (global)

- Greenfield replacement app
- Microservices / K8s
- CR Essentials / ABA Matrix research
- Clearinghouse or payroll networks
- Episode-of-Care module
- Auto-mastery
- Permanent localStorage+Postgres dual-write
- Frontend relocation that breaks AI Studio
- Final hosting vendor selection as a planning blocker

---

## Change Log

- **V1.1 (Node 7 / Wave 0):** Wave 2 supervision parent/child + Wave 1 CORS/CSRF cookie transport; Wave 3A/3B measurement breadth gate.
- **V1 (Phase 18):** Initial dependency-ordered build plan for Integrated Product Build.
