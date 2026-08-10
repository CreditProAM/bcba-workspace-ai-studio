# Architecture Decision Register V1

Phase 17 deliverable; **hardened in Phase 17.1**. Material architecture
decisions for this phase.

Format per entry: Decision · Reason · Evidence/requirement · Alternatives rejected · Consequences · Can change later?

---

## ADR-001 — Existing application is the product foundation

| | |
|---|---|
| **Decision** | Evolve `bcba-workspace-ai-studio`; do not create a replacement app |
| **Reason** | Working clinical UX/logic already exists; greenfield would discard proven value |
| **Evidence** | Project rule; `EXISTING_APP_RECONCILIATION_V1.md`; `DEVELOPMENT_DIRECTION.md`; Phase 17 governing decision |
| **Alternatives rejected** | New repo / rewrite; treat current app as disposable prototype |
| **Consequences** | Architecture wraps existing React product; dispositions default KEEP |
| **Can change later?** | No (without explicit executive authorization) |

---

## ADR-002 — PostgreSQL as canonical database

| | |
|---|---|
| **Decision** | PostgreSQL is the canonical relational store for clinic data |
| **Reason** | Relational integrity, multi-tenant tenancy, auditability, billing/clinical relationships |
| **Evidence** | Phase 17 fixed decisions; finished clinic platform scope |
| **Alternatives rejected** | localStorage permanence; Firebase-style document SoT; intentionally temporary DB |
| **Consequences** | Domain model in `POSTGRES_DOMAIN_MODEL_V1.md`; migrations in a later phase |
| **Can change later?** | No for canonical SoT (read replicas/caches OK) |

---

## ADR-003 — Modular monolith

| | |
|---|---|
| **Decision** | Single backend deployable with internal domain modules |
| **Reason** | No demonstrated need for distributed systems; lower ops cost; clearer transactions |
| **Evidence** | Phase 17 fixed decisions; project complexity rule |
| **Alternatives rejected** | Microservices, K8s-required topology, event-bus-first architecture |
| **Consequences** | Module boundaries in `API_AND_DOMAIN_BOUNDARIES_V1.md` |
| **Can change later?** | Yes — extract modules only with demonstrated requirement |

---

## ADR-004 — Multi-tenancy at data-model level

| | |
|---|---|
| **Decision** | Organization/Clinic is first-class tenant root; tenant rows carry `organization_id`; tenant-owned FKs are organization-consistent composite FKs (ADR-029) |
| **Reason** | Clinic platform from day one; avoid retrofit tenancy; app filters alone insufficient |
| **Evidence** | Phase 17 fixed decisions; Phase 17.1 hardening |
| **Alternatives rejected** | Single-tenant DB per customer first; app-level-only filtering without schema support |
| **Consequences** | Every clinic query scoped; Membership required; schema enforces same-org edges |
| **Can change later?** | No for tenant root concept |

---

## ADR-005 — Identity model (Function + Credential + Assignment + Ceiling)

| | |
|---|---|
| **Decision** | One User Identity; separate Membership, FunctionGrants (additive), Credentials, ClientAssignments; Clinical Authority Ceiling derived |
| **Reason** | Mary and BCBA-Owner personas; no combined super-roles |
| **Evidence** | `ROLE_MODEL_V1_1_CORRECTION.md` |
| **Alternatives rejected** | Single mutually-exclusive Operational Role enum; shared logins; software elevation of clinical authority |
| **Consequences** | AuthZ double-gate Function AND Ceiling for clinical verbs |
| **Can change later?** | Function catalog details yes; elevation ban no |

---

## ADR-006 — Software never elevates clinical authority

| | |
|---|---|
| **Decision** | Function/Owner/Admin/Assignment may narrow only; never raise Ceiling beyond held Credentials |
| **Reason** | Legal/credential integrity; Mary must not clinically act |
| **Evidence** | ROLE_MODEL binding rule; Phase 17 fixed decisions |
| **Alternatives rejected** | Assignment override granting BCBA review to BCaBA; Admin clinical bypass |
| **Consequences** | Server must enforce Ceiling on every clinical write |
| **Can change later?** | No |

---

## ADR-007 — UI hiding is not authorization

| | |
|---|---|
| **Decision** | Every protected write enforced server-side |
| **Reason** | Office Puzzle ADMIN_READONLY nav-only gap must not be inherited |
| **Evidence** | ROLE_MODEL CRUD enforcement; FUNCTIONAL_PARITY_GAPS 2b |
| **Alternatives rejected** | Menu-only PermissionGate |
| **Consequences** | AuthZ middleware on all mutating APIs |
| **Can change later?** | No |

---

## ADR-008 — Persistence strategy: replace localStorage SoT

| | |
|---|---|
| **Decision** | Replace localStorage AppState/auth as durable SoT with PostgreSQL + API; keep autosave/undo as UX |
| **Reason** | Multi-user, audit, size, security |
| **Evidence** | Current audit; DEVELOPMENT_DIRECTION prototype deferral now in architecture phase |
| **Alternatives rejected** | Permanent dual-write localStorage+DB; IndexedDB as canonical |
| **Consequences** | Evolution map REPLACE PROTOTYPE INFRASTRUCTURE for storage/auth |
| **Can change later?** | Client cache technology yes |

---

## ADR-009 — Object storage for files

| | |
|---|---|
| **Decision** | Binaries in object storage; `StoredFile` metadata in PostgreSQL |
| **Reason** | Size, cost, streaming; DB not for blobs |
| **Evidence** | Phase 17 fixed decisions |
| **Alternatives rejected** | PostgreSQL bytea for documents; base64 in JSON state |
| **Consequences** | Photo/docs migrate off data URLs |
| **Can change later?** | Vendor yes; pattern no |

---

## ADR-010 — Auditability and no casual hard delete

| | |
|---|---|
| **Decision** | Lifecycle + AuditEntry for retention domains; no casual hard delete of clinical/financial/credential history |
| **Reason** | Continuity of care, compliance, attribution |
| **Evidence** | Phase 17 fixed decisions; client/staff lifecycle product decisions |
| **Alternatives rejected** | Hard-delete clients as today; mutable overwrite of reviewed records |
| **Consequences** | Amendment flows required after lock |
| **Can change later?** | Retention periods yes; principle no |

---

## ADR-011 — Client lifecycle semantics

| | |
|---|---|
| **Decision** | Active = normal; Inactive = history readable, no new delivery/scheduling unless reactivated; Discharged = history preserved, **no new service delivery while discharged**; resumption requires **explicit audited Client reactivation** (status → Active). **No Episode-of-Care entity in V1.** |
| **Reason** | Close gap 1a with explicit product decision (not OP inference); avoid inventing Episode without confirmed V1 requirement (Phase 17.1) |
| **Evidence** | Phase 17 architecture-blocking decisions; FUNCTIONAL_PARITY_GAPS 1a; Phase 17.1 correction |
| **Alternatives rejected** | Delete-on-discharge; silent cascade assumptions from OP; inventing Episode module for V1 |
| **Consequences** | Scheduling/Events APIs check Client.status; Episode may be added later only if payer/clinic/regulatory/workflow need is established |
| **Can change later?** | Episode introduction yes via new ADR; core retention no |

---

## ADR-012 — Staff lifecycle + session revocation

| | |
|---|---|
| **Decision** | Active/Inactive/Terminated as specified; Terminated revokes sessions and blocks access; attribution immutable; explicit session revocation capability exists |
| **Reason** | Close gaps 2a and 2e (PHI revocation) |
| **Evidence** | Phase 17 decisions; FUNCTIONAL_PARITY_GAPS 2a/2e |
| **Alternatives rejected** | Soft deactivate without session revoke; read-only device log without revoke |
| **Consequences** | Identity module owns UserSession.revoked_at |
| **Can change later?** | Inactive read-only nuance yes |

---

## ADR-013 — Assignment end access

| | |
|---|---|
| **Decision** | End assignment removes future active case access; historical attribution kept; later historic PHI access governed by current Function/scope |
| **Reason** | Close gap 2f without rewriting history |
| **Evidence** | Phase 17 decisions |
| **Alternatives rejected** | Keep full caseload access after removal; purge historic visibility entirely without policy |
| **Consequences** | AuthZ checks active assignments for operational case access |
| **Can change later?** | Policy matrix for legitimate historic access yes |

---

## ADR-014 — Clinical data locking + amendments

| | |
|---|---|
| **Decision** | Reviewed/Locked clinical data immutable via normal edit; corrections via auditable amendment; Datasheet Locked is hard edit-block |
| **Reason** | Integrity; consistency with Documentation; close gap 1b |
| **Evidence** | Phase 17; FUNCTIONAL_PARITY_GAPS 1b; Documentation Reviewed locks Event |
| **Alternatives rejected** | Cosmetic lock; silent overwrite |
| **Consequences** | APIs return 409/403 on illegal edits |
| **Can change later?** | Amendment UX details yes |

---

## ADR-015 — Caregiver / consent model

| | |
|---|---|
| **Decision** | Model relationship, legal guardian, consent-to-treat, emergency contact, authorized pickup, effective/status metadata |
| **Reason** | Do not inherit OP omission; close gap 2d |
| **Evidence** | Phase 17; FUNCTIONAL_PARITY_GAPS 2d; ledger REJECT-as-floor |
| **Alternatives rejected** | Single free-text guardian field only |
| **Consequences** | Caregiver + ConsentAuthority entities |
| **Can change later?** | Additional consent types yes |

---

## ADR-016 — Insurance COB

| | |
|---|---|
| **Decision** | Multiple coverages with explicit primary/secondary (N-ary) COB order |
| **Reason** | Close gap 2c; claim payment order |
| **Evidence** | Phase 17; FUNCTIONAL_PARITY_GAPS 2c |
| **Alternatives rejected** | One insurance per client; unordered multi-coverage |
| **Consequences** | CoordinationOfBenefits entity; Claims use COB order |
| **Can change later?** | Secondary claim generation timing details yes |

---

## ADR-017 — Prior Authorization policy gate

| | |
|---|---|
| **Decision** | PA requirement is policy-driven (Payer/Plan/Service/Event-Type). If required → missing/invalid/exhausted PA blocks Billing Readiness. If not required → absence does not block. Approved units live on AuthorizationAllocation; used/remaining are **derived from AuthorizationConsumption ledger** (see ADR-027). |
| **Reason** | Safer than OP informational-only default while supporting cash-pay/PA-exempt; close gap 3c |
| **Evidence** | Phase 17 fixed product decision; Phase 17.1 ledger hardening |
| **Alternatives rejected** | Always informational; always hard-block regardless of policy; mutable used_units SoT |
| **Consequences** | Readiness evaluator consumes PA policy + derived remaining |
| **Can change later?** | Default org policies yes; evaluator structure no |

---

## ADR-018 — Provider eligibility multi-gate

| | |
|---|---|
| **Decision** | Eligibility requires all: active Credential, credential-level allowed billing codes, service allowed credentials, service/event-type allowed billing codes, and ClientAssignment when the acting FunctionGrant uses `ASSIGNED_CLIENTS` scope |
| **Reason** | Close gap 3e; scope-of-practice; align with Phase 17.1 scope model |
| **Evidence** | Phase 17; STAFF credential allowed codes evidence; ADR-028 |
| **Alternatives rejected** | Service-level gate only; agency_wide_scope on ClientAssignment |
| **Consequences** | Dual eligibility joins in schema; AuthZ uses FunctionGrant.scope_mode |
| **Can change later?** | Additional gates yes |

---

## ADR-019 — Payer reimbursement vs provider compensation separation

| | |
|---|---|
| **Decision** | Separate financial dimensions. Payer: `PayerReimbursementRate` (HealthPlan default) overridden by `ClientInsuranceRateOverride`. Provider: Employment Type SSOT for Employee vs Contractor pathway; `ProviderRate` amount/rule only; Employee→Timesheet, Contractor→ProviderInvoice. ClientInvoice remains structurally separate from ProviderInvoice. |
| **Reason** | Close gaps 3a/3b; avoid OP dual Type ambiguity; Phase 17.1 first-class rate entities |
| **Evidence** | Phase 17; FUNCTIONAL_PARITY_GAPS 3a/3b; REVENUE_CYCLE_ARCHITECTURE_V1.md |
| **Alternatives rejected** | Single precedence chain mixing payer and provider rates; Rate.Type independent of Employment Type; conflating ClientInvoice with ProviderInvoice |
| **Consequences** | Distinct rate tables; Compensation module reads Membership.employment_type |
| **Can change later?** | Rate amount tables yes; SSOT Employment Type no without ADR |

---

## ADR-020 — Billing Readiness as deterministic evaluator

| | |
|---|---|
| **Decision** | Return `{ eligible, unmetConditions[], warnings[] }`; never SoT stored boolean; include reviewed-doc + event-signature AND-gate minimum where applicable; compute on read |
| **Reason** | Avoid OP staleness; named-condition UX; Phase 17 requirement |
| **Evidence** | REACT Feature Map Domain 19; Phase 17 fixed decisions |
| **Alternatives rejected** | Cached eligibility flag as truth; bundled single error string only |
| **Consequences** | Shared evaluator service; UI badges are projections |
| **Can change later?** | Condition catalog yes; evaluator pattern no |

---

## ADR-021 — Attention: derived condition + persistent coordination

| | |
|---|---|
| **Decision** | Source condition derived; assignee/ack/snooze/escalation + notification history persistent |
| **Reason** | MASTER_PRODUCT_MAP Attention correction; existing `deriveClinicalAttention` keep |
| **Evidence** | REACT Feature Map Domain 26; Phase 16 correction |
| **Alternatives rejected** | Pure derivation only forever; stored stale “isAttention” flag as SoT |
| **Consequences** | AttentionCoordination + NotificationHistory entities |
| **Can change later?** | Condition catalog yes |

---

## ADR-022 — Preserve-first component disposition

| | |
|---|---|
| **Decision** | Default KEEP; replace only when prototype infra cannot meet production, structural inability, or conflicting SoT |
| **Reason** | Phase 17 / project rule |
| **Evidence** | EXISTING_APP_RECONCILIATION; Evolution Map |
| **Alternatives rejected** | Rewrite-for-cleanliness |
| **Consequences** | Calendar/clinical core retained |
| **Can change later?** | Individual dispositions with justification yes |

---

## ADR-023 — Activity feed ≠ Audit trail

| | |
|---|---|
| **Decision** | Keep ActivityView-style feed separate from immutable AuditEntry / document status history |
| **Reason** | OP confirmed separation; different retention/purpose |
| **Evidence** | EXISTING_APP_RECONCILIATION; ledger branch 26 |
| **Alternatives rejected** | Merge into one log |
| **Consequences** | Two mechanisms in Reporting/Compliance |
| **Can change later?** | Yes, carefully |

---

## ADR-024 — AI provider is server-proxied integration

| | |
|---|---|
| **Decision** | Production Gemini (or successor) calls go through backend; preserve grounding/safety behaviors from current services |
| **Reason** | Key security; audit; rate control |
| **Evidence** | Current client-side key limitation |
| **Alternatives rejected** | Browser-held API keys in production |
| **Consequences** | Sidekick/Toolkit/narratives keep UX, change transport |
| **Can change later?** | Model vendor yes |

---

## ADR-025 — Clearinghouse / disbursement are integration boundaries

| | |
|---|---|
| **Decision** | Do not build clearinghouse/payroll networks. **Do** persist first-class internal records/config: ClearingHouseConfiguration, BillingEntity, PayerPlanBillingEntityRole, Claim/ClientInvoice/Remittance, PaymentProfile, Timesheet/ProviderInvoice computation |
| **Reason** | Integration boundary ≠ omit internal model; ledger/revenue research requires these homes |
| **Evidence** | REVENUE_CYCLE_ARCHITECTURE_V1.md; FUNCTIONAL_PARITY_LEDGER Billing Entities/Clearing Houses; Phase 17.1 |
| **Alternatives rejected** | Native X12 network stack as core; omitting BillingEntity/ClearingHouseConfiguration because transmission is external |
| **Consequences** | Adapter seams for transmit/disburse; full internal revenue config model |
| **Can change later?** | Vendor adapters yes |

---

## ADR-026 — Function grant storage shape

| | |
|---|---|
| **Decision** | FunctionGrant as relational join table with effective dating and `scope_mode` (`ORGANIZATION` \| `ASSIGNED_CLIENTS`) |
| **Reason** | Closes open schema question from ROLE_MODEL; auditable; additive; org-wide WHERE without polluting ClientAssignment |
| **Evidence** | ROLE_MODEL open questions; Phase 17 / 17.1 |
| **Alternatives rejected** | Single role enum; opaque bitmask as sole representation; agency_wide_scope on ClientAssignment |
| **Consequences** | Simple grant/revoke audit; AuthZ uses scope_mode |
| **Can change later?** | Yes (add caching) |

---

## ADR-027 — Authorization usage is a transaction ledger

| | |
|---|---|
| **Decision** | AuthorizationAllocation holds approved_units + effective dates. AuthorizationConsumption is append-only (CONSUME / REVERSAL / ADJUSTMENT). Used and remaining are derived. Duplicate Event CONSUME prevented by uniqueness. Corrections via reversal, not silent mutation. |
| **Reason** | Mutable used_units SoT is unsafe for concurrency, audit, and cancellation |
| **Evidence** | Phase 17.1 requirement; Billing Readiness must read derived remaining |
| **Alternatives rejected** | Mutable used_units column as SoT; silent overwrite on cancel |
| **Consequences** | PA module writes allocations + consumption rows; readiness reads derived balances |
| **Can change later?** | Adjustment reason codes yes; ledger pattern no |

---

## ADR-028 — Organization scope on FunctionGrant, not ClientAssignment

| | |
|---|---|
| **Decision** | Remove agency_wide_scope from ClientAssignment. ClientAssignment is always one User↔Client row. Org-wide WHERE uses FunctionGrant.scope_mode = ORGANIZATION. |
| **Reason** | Prevent fake “assignments”; keep assignment semantics honest; Mary/Clinical Director examples |
| **Evidence** | Phase 17.1; ROLE_MODEL personas |
| **Alternatives rejected** | agency_wide_scope boolean on ClientAssignment |
| **Consequences** | AuthZ and domain model updated; Ceiling still credential-derived |
| **Can change later?** | Additional scope modes only with ADR |

---

## ADR-029 — Tenant-aware composite FK isolation + optimistic concurrency

| | |
|---|---|
| **Decision** | Tenant-owned relationships use organization-consistent composite FKs. Mutable operational/clinical/authorization/financial rows use row_version optimistic concurrency. Locked clinical content remains amendment-only. |
| **Reason** | App `organization_id` filters alone cannot prevent cross-tenant FK edges or silent last-write-wins |
| **Evidence** | Phase 17.1 hardening |
| **Alternatives rejected** | App-filter-only tenancy; last-write-wins updates |
| **Consequences** | Schema/migration design must include UNIQUE(organization_id,id) + composite FKs; APIs return concurrency conflicts |
| **Can change later?** | Concurrency token representation yes; isolation principle no |

---

## ADR-030 — Typed FKs for Signature and RequiredDocumentInstance

| | |
|---|---|
| **Decision** | Signature: event_id XOR clinical_document_id with real FKs + CHECK. RequiredDocumentInstance: client_id XOR membership_id with real FKs + CHECK. Generic polymorphism reserved for AuditEntry-class cross-cuts. |
| **Reason** | Enforceable integrity on core clinical relationships |
| **Evidence** | Phase 17.1 |
| **Alternatives rejected** | Unconstrained subject_type + subject_id for Signature/RequiredDocumentInstance |
| **Consequences** | Cleaner joins; DB rejects invalid subjects |
| **Can change later?** | Additional typed subject tables only with ADR |

---

## ADR-031 — FinancialDocumentLockPolicy

| | |
|---|---|
| **Decision** | Independently configurable booleans: claim_locks_event, client_invoice_locks_event, provider_invoice_locks_event, timesheet_locks_event |
| **Reason** | Preserve confirmed OP independently configurable lock pattern as policy, not accidental side effects |
| **Evidence** | REVENUE_CYCLE_ARCHITECTURE_V1.md §6; FUNCTIONAL_PARITY_LEDGER Invoice/Timesheet/Claim Locks Event |
| **Alternatives rejected** | Hard-coded always-lock; single shared lock flag |
| **Consequences** | Revenue/Compensation generation consults policy |
| **Can change later?** | Defaults yes; independent flags no without ADR |

---

## ADR-032 — Complete revenue-cycle internal model

| | |
|---|---|
| **Decision** | First-class homes for BillingEntity, ClearingHouseConfiguration, PayerPlanBillingEntityRole, PayerReimbursementRate, ClientInsuranceRateOverride, ClientInvoice, PaymentProfile, FinancialDocumentLockPolicy |
| **Reason** | Phase 17 model omitted confirmed ledger/revenue capabilities; integration boundary must not erase internal records |
| **Evidence** | FUNCTIONAL_PARITY_LEDGER Claims/Client Invoices/Billing Entities/Clearing Houses/Provider Compensation; REVENUE_CYCLE_ARCHITECTURE_V1.md; VISUAL_IMPLEMENTATION_ATLAS billing groups |
| **Alternatives rejected** | Deferring BillingEntity/ClearingHouse/ClientInvoice because transmission is external |
| **Consequences** | Domain model + module boundaries updated in Phase 17.1 |
| **Can change later?** | Field-level X12 detail yes |

---

## Gap closure checklist (Rank 1–3)

| Gap | ADR |
|---|---|
| 1a Client lifecycle | ADR-011 |
| 1b Datasheet lock | ADR-014 |
| 2a Staff lifecycle | ADR-012 |
| 2b CRUD enforcement | ADR-007 |
| 2c COB | ADR-016 |
| 2d Caregiver consent | ADR-015 |
| 2e Session revocation | ADR-012 |
| 2f Assignment end | ADR-013 |
| 3a Employment Type SSOT | ADR-019 |
| 3b Payer rate precedence | ADR-019 |
| 3c PA policy gate | ADR-017 |
| 3e Credential billing-code gate | ADR-018 |

---

## Change Log

- **V1.1 (Phase 17.1):** ADR-011 Episode removal; ADR-017/019/025/026 hardened; ADR-027–032 added (PA ledger, scope_mode, tenant/concurrency, typed FKs, lock policy, revenue entities).
- **V1 (Phase 17):** Initial architecture decision register for Technical Architecture node.
