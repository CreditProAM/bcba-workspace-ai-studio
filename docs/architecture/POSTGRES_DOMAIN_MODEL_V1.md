# PostgreSQL Domain Model V1

Phase 17 deliverable; **hardened in Phase 17.1**. Implementation-ready
**relational domain model**. This is **not** migrations SQL.

Conventions:
- Tenant root = `Organization`
- Tenant-owned entities include `organization_id` unless noted as global catalog
- Soft lifecycle preferred over hard delete for retained history
- UUIDs for primary keys unless noted
- Timestamps: `created_at`, `updated_at`; clinical authorship: `created_by_user_id`
- Mutable operational/clinical/authorization/financial rows carry `row_version` (optimistic concurrency)

---

## 0. Cross-cutting rules

| Rule | Meaning |
|---|---|
| Tenant boundary (app) | Every clinic query filters `organization_id`; AuthZ still mandatory |
| Tenant boundary (DB) | Tenant-owned relationships are **organization-consistent** — see §0.1 |
| Optimistic concurrency | Mutable important rows use `row_version`; see §0.2 |
| Hard delete | Disallowed for clinical, billing, credential, signature, audit history in normal ops; use lifecycle status |
| Mutable after lock | Reviewed/Locked clinical rows: no silent overwrite; amendments only |
| Derived vs stored | Progress scores, Billing Readiness, Clinical Authority Ceiling, Attention **source conditions**, PA used/remaining units are derived — not authoritative stored booleans |
| Files | Binaries in object storage; `StoredFile` holds metadata + storage key |
| Polymorphic FKs | Forbidden for core clinical/financial subjects where real FKs are possible; AuditEntry may remain generic |

### 0.1 Database-level tenant isolation pattern

Application `WHERE organization_id = :org` is **necessary but not sufficient**.

**Required relational pattern (tenant-aware composite keys):**

1. Every tenant-owned table includes `organization_id NOT NULL`.
2. Every tenant-owned table declares a uniqueness constraint usable as an FK target:
   - `UNIQUE (organization_id, id)` (in addition to `PRIMARY KEY (id)`), **or**
   - composite primary key `(organization_id, id)`.
3. Every FK from tenant-owned child → tenant-owned parent is a **composite FK** that includes `organization_id`:

```text
CHILD (organization_id, parent_id)
  → PARENT (organization_id, id)
```

This makes it structurally impossible for a child row in Org A to reference a parent row in Org B.

4. Same-org self-checks on multi-parent joins (e.g. DocumentEventLink) also use composite FKs to both parents sharing the child's `organization_id`.
5. Global tables (`UserIdentity`, system `OperationalFunction` catalog) are not tenant-owned; membership/grant rows that attach them into a tenant always carry `organization_id` and composite-FK to other tenant rows.

**Application/server authorization remains mandatory** even with these constraints.

### 0.2 Optimistic concurrency

| Class | Mechanism |
|---|---|
| Mutable operational, clinical (pre-lock), authorization headers/allocations, financial headers/lines, config | Integer `row_version` (or equivalent revision). Update succeeds only if `WHERE id = :id AND row_version = :expected`; then `row_version = row_version + 1`. API returns conflict on mismatch. |
| Reviewed/Locked clinical | No normal update path; amendments create new amendment rows / audit — concurrency on the locked row is irrelevant for content mutation |
| Append-only ledgers (AuthorizationConsumption, AuditEntry, Signature) | Insert-only; no last-write-wins updates of prior rows |
| Derived projections | Not stored as SoT; no concurrency token required |

Two users must not silently last-write-wins overwrite one another on mutable records.

---

## 1. Organization

| Attribute | Detail |
|---|---|
| **Purpose** | Clinic / agency tenant root |
| **Tenant owner** | Self (`id`) |
| **Relationships** | Parent of Memberships, Clients, Staff config, catalogs, financial config |
| **Uniqueness** | `slug` unique globally (optional); `id` PK |
| **Mutable** | Profile/settings yes (`row_version`) |
| **Lifecycle/audit** | Audit config changes |
| **Hard delete** | No (deactivate Organization) |
| **Key fields** | name, legal_name, timezone, status (Active/Suspended), work_hours JSON, address |

---

## 2. UserIdentity

| Attribute | Detail |
|---|---|
| **Purpose** | One human, one accountable login |
| **Tenant owner** | Global identity; clinic access via Membership |
| **Relationships** | 1→N OrganizationMembership; 1→N UserCredential; 1→N FunctionGrant (per org); 1→N ClientAssignment |
| **Uniqueness** | `email` unique (or issuer+subject if OIDC) |
| **Mutable** | Profile yes; password hash via auth flows |
| **Lifecycle/audit** | Auth events audited; identity retained after termination |
| **Hard delete** | No — anonymize only under legal process |
| **Key fields** | email, display_name, password_hash or external_subject, status (Active/Disabled) |

**Sessions:** `UserSession` (user_id, organization_id?, token_hash, device_meta, created_at, expires_at, revoked_at). Revocation supported.

---

## 3. OrganizationMembership

| Attribute | Detail |
|---|---|
| **Purpose** | User belongs to Organization; carries employment lifecycle |
| **Tenant owner** | organization_id |
| **Relationships** | UserIdentity; Employment Type; Staff profile fields |
| **Uniqueness** | (organization_id, user_id) unique; UNIQUE (organization_id, id) for composite FKs |
| **Mutable** | Yes until Terminated constraints apply (`row_version`) |
| **Lifecycle/audit** | **Required** — Active → Inactive → Terminated |
| **Hard delete** | No |
| **Key fields** | employment_type (`employee` \| `contractor`), job_title, hire_date, status, terminated_at |

### Staff lifecycle semantics (decided)

| Status | Effect |
|---|---|
| **Active** | Normal access per Functions/Credentials/Assignments |
| **Inactive** | Cannot perform new active workflow until reactivated; historical attribution intact; sessions may be blocked by policy |
| **Terminated** | All sessions revoked; cannot access clinic data; historical authorship/signatures/notes/compensation/audit remain attributed to immutable UserIdentity |

---

## 4. OperationalFunction

| Attribute | Detail |
|---|---|
| **Purpose** | Named permission bundle catalog |
| **Tenant owner** | May be system-defined + org-custom; system codes stable |
| **Relationships** | Referenced by FunctionGrant |
| **Uniqueness** | `code` unique (system) or (organization_id, code) for custom |
| **Mutable** | Labels yes; codes stable |
| **Hard delete** | Soft-retire only |

Representative codes: `org_admin`, `scheduling`, `intake`, `insurance_pa`, `billing`, `hr_credentialing`, `payroll`, `reporting`, `clinical_delivery`, `clinical_supervision`.

---

## 5. FunctionGrant

| Attribute | Detail |
|---|---|
| **Purpose** | Additive Function attachment to Membership, with **where-scope** |
| **Tenant owner** | organization_id |
| **Relationships** | Membership + OperationalFunction |
| **Uniqueness** | (membership_id, function_id) unique while active |
| **Mutable** | Grant/revoke; effective_from / effective_to (`row_version`) |
| **Lifecycle/audit** | **Required** — grant/revoke audited |
| **Hard delete** | Soft end-date preferred |
| **Key fields** | `scope_mode`: `ORGANIZATION` \| `ASSIGNED_CLIENTS` |

### Scope model (Phase 17.1)

| scope_mode | Meaning |
|---|---|
| `ORGANIZATION` | Function applies org-wide (WHERE authority applies). Does **not** raise Clinical Authority Ceiling. |
| `ASSIGNED_CLIENTS` | Function applies only to clients with an active `ClientAssignment` for that user |

Examples:
- Mary: Billing Function + `ORGANIZATION`
- Line BCBA: Clinical Delivery + `ASSIGNED_CLIENTS`
- Clinical Director: Clinical Supervision + `ORGANIZATION` **and** active BCBA Credential (Ceiling still credential-derived)

`ClientAssignment` is **never** used to encode org-wide scope.

---

## 6. CredentialDefinition

| Attribute | Detail |
|---|---|
| **Purpose** | Org/system catalog of credential types (RBT, BCaBA, BCBA, …) |
| **Tenant owner** | organization_id (or system) |
| **Relationships** | UserCredential; CredentialBillingCodeEligibility |
| **Uniqueness** | (organization_id, code) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

---

## 7. UserCredential

| Attribute | Detail |
|---|---|
| **Purpose** | Real-world credential held by a User in an Organization context |
| **Tenant owner** | organization_id |
| **Relationships** | UserIdentity; CredentialDefinition; optional allowed billing codes |
| **Uniqueness** | Practical unique (user_id, credential_definition_id, license_number) where applicable |
| **Mutable** | Renew/status change; never forge elevation without new credential row (`row_version`) |
| **Lifecycle/audit** | **Required** — Active/Expired/Suspended; expiration drops Clinical Authority Ceiling |
| **Hard delete** | No |
| **Key fields** | number, issuing_body, effective_on, expires_on, status |

**Clinical Authority Ceiling** is **derived** from active UserCredentials only. Organization-scoped FunctionGrants change **where** legitimate existing authority applies; they **never** increase **what** clinical authority the Credential supports.

---

## 8. Client

| Attribute | Detail |
|---|---|
| **Purpose** | Person receiving services |
| **Tenant owner** | organization_id |
| **Relationships** | Caregivers, Diagnosis, Physician, Assignments, Insurance, PA, ServicePlans, Events |
| **Uniqueness** | No global natural key required; optional MRN unique per org |
| **Mutable** | Demographics yes; lifecycle transitions audited (`row_version`) |
| **Lifecycle/audit** | **Required** |
| **Hard delete** | **No** — never delete clinical history because status changes |
| **Key fields** | legal_name, preferred_name, dob, status, photo_file_id, color_theme, authorized_hours_weekly (treatment context) |

### Client lifecycle semantics (decided — Phase 17.1)

| Status | Effect |
|---|---|
| **Active** | Normal operation |
| **Inactive** | Historical data preserved and readable by permission; no new active service delivery/scheduling unless explicitly reactivated |
| **Discharged** | Historical clinical/financial record preserved; **no new service delivery while discharged**; resumption requires an **explicit audited Client reactivation** (status → Active) |

**V1 does not invent an Episode-of-Care entity.** An Episode module may be introduced later only if a real payer, clinic, regulatory, or workflow requirement establishes the need. “New episode” language is not a V1 data-model requirement.

Map from current app `Onboarding`/`Maintenance` → Active subtypes or tags during migration, not conflicting lifecycle enums long-term.

---

## 9. Caregiver

| Attribute | Detail |
|---|---|
| **Purpose** | Related person for a Client |
| **Tenant owner** | organization_id |
| **Relationships** | Client (composite FK); ConsentAuthority |
| **Uniqueness** | (client_id, id); contact uniqueness not required |
| **Mutable** | Yes (`row_version`) |
| **Lifecycle/audit** | Status effective dating recommended |
| **Hard delete** | Soft preferred |
| **Key fields** | name, relationship, phone, email, is_emergency_contact, is_authorized_pickup, status, effective_from/to |

---

## 10. ConsentAuthority

| Attribute | Detail |
|---|---|
| **Purpose** | Explicit consent-to-treat / legal-guardian authority (Office Puzzle omission corrected) |
| **Tenant owner** | organization_id |
| **Relationships** | Client; optional Caregiver (composite FKs) |
| **Uniqueness** | Multiple consent records allowed with types; org policy may limit active legal-guardian count |
| **Mutable** | With audit (`row_version`) |
| **Lifecycle/audit** | **Required** |
| **Hard delete** | No |
| **Key fields** | authority_type (`legal_guardian` \| `consent_to_treat` \| `other`), holder_caregiver_id or free-text holder, status, effective_from/to, evidence_file_id |

---

## 11. Diagnosis

| Attribute | Detail |
|---|---|
| **Purpose** | Clinical diagnosis on Client |
| **Tenant owner** | organization_id |
| **Relationships** | Client (composite FK); optional code system (ICD) |
| **Uniqueness** | (client_id, code, effective_from) practical |
| **Mutable** | End-date rather than silent replace (`row_version`) |
| **Lifecycle/audit** | Recommended |
| **Hard delete** | Soft |

---

## 12. Physician

| Attribute | Detail |
|---|---|
| **Purpose** | Referring/ordering physician |
| **Tenant owner** | organization_id |
| **Relationships** | Client links; NPI; may also be referenced as a BillingEntity person identity where needed |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |
| **Key fields** | name, npi, role_code (e.g. DN/DK X12), contact |

---

## 13. ClientAssignment

| Attribute | Detail |
|---|---|
| **Purpose** | **One real User↔Client relationship** (scoping / narrowing only) |
| **Tenant owner** | organization_id |
| **Relationships** | Client, UserIdentity/Membership (composite FKs) |
| **Uniqueness** | (organization_id, client_id, user_id, assignment_type) while active |
| **Mutable** | End assignment; never rewrite historical attribution (`row_version`) |
| **Lifecycle/audit** | **Required** — start/end |
| **Hard delete** | No |
| **Key fields** | assignment_type (`primary_provider` \| `supervising_bcba` \| `consulting` \| `other`), narrowing_flags JSON, effective_from, effective_to, status |

**Removed (Phase 17.1):** `agency_wide_scope`. Org-wide access is modeled only via `FunctionGrant.scope_mode = ORGANIZATION`.

### Assignment end (decided)

Ending removes **future active case access** per policy for `ASSIGNED_CLIENTS`-scoped Functions. Historical authorship remains. Subsequent historic PHI access is governed by **current** Function/scope/legitimate-access permission — not by rewriting history.

---

## 14. InsuranceCoverage

| Attribute | Detail |
|---|---|
| **Purpose** | One coverage row for a Client |
| **Tenant owner** | organization_id |
| **Relationships** | Client, Payer, HealthPlan; COB ordering; ClientInsuranceRateOverride |
| **Uniqueness** | Multiple allowed per Client |
| **Mutable** | Yes with effective dating (`row_version`) |
| **Lifecycle/audit** | Recommended |
| **Hard delete** | Soft |
| **Key fields** | member_id, group_number, relationship, effective_from/to, status |

**Do not assume one insurance per client.**

---

## 15. CoordinationOfBenefits

| Attribute | Detail |
|---|---|
| **Purpose** | Explicit primary/secondary (N-ary) order across coverages |
| **Tenant owner** | organization_id |
| **Relationships** | Client; ordered InsuranceCoverage rows (composite FKs) |
| **Uniqueness** | (client_id, coverage_id) unique in COB set; `cob_order` unique per client among active |
| **Mutable** | Reorder audited (`row_version`) |
| **Lifecycle/audit** | **Required** for order changes |
| **Hard delete** | Soft |

---

## 16. Payer

| Attribute | Detail |
|---|---|
| **Purpose** | Payer catalog |
| **Tenant owner** | organization_id |
| **Relationships** | HealthPlans |
| **Uniqueness** | (organization_id, code/name) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

---

## 17. HealthPlan

| Attribute | Detail |
|---|---|
| **Purpose** | Plan under Payer; X12/plan configuration hub |
| **Tenant owner** | organization_id |
| **Relationships** | Payer; PayerReimbursementRate; PayerPlanBillingEntityRole; InsuranceCoverage; FinancialDocumentLockPolicy (claim lock may be plan-scoped) |
| **Uniqueness** | (payer_id, plan_code) with org-consistent FKs |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

**Payer reimbursement rates are first-class rows** (`PayerReimbursementRate`), not conflated with Provider Compensation (`ProviderRate`).

---

## 17a. PayerReimbursementRate

| Attribute | Detail |
|---|---|
| **Purpose** | Default payer/plan reimbursement amount/rule for a billing code (or service/event-type scope) |
| **Tenant owner** | organization_id |
| **Relationships** | HealthPlan; BillingCode (composite FKs) |
| **Uniqueness** | (health_plan_id, billing_code_id, effective_from, rate_category?) practical |
| **Mutable** | Effective dating (`row_version`); supersede rather than silent rewrite history |
| **Lifecycle/audit** | Recommended |
| **Hard delete** | Soft |
| **Key fields** | amount, unit_basis (`UNIT` \| `EVENT` \| `HOUR`), rate_category, effective_from/to |

**Completely separate** from `ProviderRate`.

---

## 17b. ClientInsuranceRateOverride

| Attribute | Detail |
|---|---|
| **Purpose** | Explicit override of applicable payer-plan reimbursement for a specific Client InsuranceCoverage |
| **Tenant owner** | organization_id |
| **Relationships** | InsuranceCoverage; BillingCode (composite FKs) |
| **Uniqueness** | (coverage_id, billing_code_id, effective_from) practical |
| **Mutable** | Effective dating (`row_version`) |
| **Lifecycle/audit** | Recommended |
| **Hard delete** | Soft |
| **Key fields** | amount, unit_basis, effective_from/to |

**Precedence (payer reimbursement only):** ClientInsuranceRateOverride > PayerReimbursementRate (HealthPlan default). Independent of provider compensation.

---

## 18. Service

| Attribute | Detail |
|---|---|
| **Purpose** | Named clinical service line (config) |
| **Tenant owner** | organization_id |
| **Relationships** | ServiceBillingCodeEligibility; allowed credentials |
| **Uniqueness** | (organization_id, code) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |
| **Note** | Does **not** nest between Category and Program in Service Plan tree |

---

## 19. BillingCode

| Attribute | Detail |
|---|---|
| **Purpose** | CPT/HCPCS (+ modifiers as related rows) |
| **Tenant owner** | organization_id |
| **Relationships** | Eligibility joins; AuthorizationAllocation; ClaimItems |
| **Uniqueness** | (organization_id, code, modifier?) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

---

## 20. ServiceBillingCodeEligibility

| Attribute | Detail |
|---|---|
| **Purpose** | Which billing codes a Service may use |
| **Tenant owner** | organization_id |
| **Relationships** | Service ↔ BillingCode (composite FKs) |
| **Uniqueness** | (service_id, billing_code_id) |
| **Mutable** | Yes |
| **Hard delete** | Soft |

Also: **ServiceAllowedCredential** join (Service ↔ CredentialDefinition).

---

## 21. CredentialBillingCodeEligibility

| Attribute | Detail |
|---|---|
| **Purpose** | Credential-level allowed billing codes (independent gate) |
| **Tenant owner** | organization_id |
| **Relationships** | CredentialDefinition or UserCredential policy ↔ BillingCode |
| **Uniqueness** | (credential_definition_id, billing_code_id) at catalog; optional tighter per UserCredential |
| **Mutable** | Yes |
| **Hard delete** | Soft |

**Provider eligibility (decided):** All applicable gates must pass: active Credential, credential-level allowed codes, service-level allowed credentials, service/event-type allowed billing codes, Client Assignment when Function scope is `ASSIGNED_CLIENTS`.

---

## 21a. BillingEntity

| Attribute | Detail |
|---|---|
| **Purpose** | Generic X12 role identity (Person / Non-Person) assignable to claim/clearinghouse role slots |
| **Tenant owner** | organization_id |
| **Relationships** | PayerPlanBillingEntityRole; ClearingHouseConfiguration submitter/receiver refs |
| **Uniqueness** | (organization_id, id); practical unique on identification value + qualifier |
| **Mutable** | Yes (`row_version`) |
| **Lifecycle/audit** | Recommended |
| **Hard delete** | Soft |
| **Key fields** | type (`person` \| `non_person`), name, email, phone, fax, identifier_code (X12 role: 40/41/45/77/82/85/87/DK/DN/PR/PW…), id_code_qualifier, identification_value, npi, ein, taxonomy_code, address, place_of_service |

Agency identity is typically the first Non-Person BillingEntity (Billing Provider / Pay-to).

---

## 21b. ClearingHouseConfiguration

| Attribute | Detail |
|---|---|
| **Purpose** | Integration configuration for submitting/receiving claims (ISA/GS, trading partner, etc.) |
| **Tenant owner** | organization_id |
| **Relationships** | BillingEntity refs for submitter/receiver roles (composite FKs) |
| **Uniqueness** | (organization_id, code/name) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |
| **Key fields** | name, trading_partner_id, envelope/X12 config metadata, submitter_billing_entity_id, receiver_billing_entity_id, status |
| **Boundary** | **INTEGRATION configuration** — we store what is needed to use a clearinghouse; we do **not** build a clearinghouse network |

---

## 21c. PayerPlanBillingEntityRole

| Attribute | Detail |
|---|---|
| **Purpose** | Assigns a BillingEntity to a specific X12 role slot on a HealthPlan |
| **Tenant owner** | organization_id |
| **Relationships** | HealthPlan, BillingEntity (composite FKs) |
| **Uniqueness** | (health_plan_id, identifier_code / role_slot) while active |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |
| **Key fields** | role/identifier_code, billing_entity_id |

---

## 22. PriorAuthorization

| Attribute | Detail |
|---|---|
| **Purpose** | PA header for Client |
| **Tenant owner** | organization_id |
| **Relationships** | Client, InsuranceCoverage; AuthorizationAllocation children |
| **Uniqueness** | Auth number unique per payer/client practical |
| **Mutable** | Status/header fields (`row_version`); **not** used-unit counters |
| **Lifecycle/audit** | **Required** — CREATED → SUBMITTED → APPROVED/DENIED → USED |
| **Hard delete** | No |

---

## 23. AuthorizationAllocation

| Attribute | Detail |
|---|---|
| **Purpose** | Approved unit allocation under a PA for a BillingCode/Service |
| **Tenant owner** | organization_id |
| **Relationships** | PriorAuthorization; BillingCode and/or Service (composite FKs) |
| **Uniqueness** | (prior_authorization_id, billing_code_id, effective_from) practical |
| **Mutable** | approved_units and dates via controlled updates (`row_version`); never a mutable used counter |
| **Lifecycle/audit** | **Required** |
| **Hard delete** | No |
| **Key fields** | approved_units, effective_from, effective_to |

**Derived:**
- `used_units` = sum(CONSUME) − sum(REVERSAL) ± ADJUSTMENT net from `AuthorizationConsumption`
- `remaining_units` = `approved_units` − net consumed

Billing Readiness reads **derived remaining**, never a hand-edited used field.

---

## 23a. AuthorizationConsumption

| Attribute | Detail |
|---|---|
| **Purpose** | Append-only transaction ledger for authorization usage |
| **Tenant owner** | organization_id |
| **Relationships** | AuthorizationAllocation; Event (composite FKs); actor UserIdentity optional; audit_entry_id |
| **Uniqueness / idempotency** | Unique constraint preventing duplicate Event consumption for the same allocation — e.g. `UNIQUE (allocation_id, event_id) WHERE operation_type = 'CONSUME' AND NOT reversed` **or** equivalent uniqueness on `(allocation_id, event_id, operation_type='CONSUME')` with reversals as separate rows referencing the original consumption |
| **Mutable** | **Insert-only** — corrections via `REVERSAL` / `ADJUSTMENT` rows, never silent mutation of prior CONSUME |
| **Lifecycle/audit** | Each row is itself an auditable transaction; optional `audit_entry_id` |
| **Hard delete** | No |
| **Key fields** | operation_type (`CONSUME` \| `REVERSAL` \| `ADJUSTMENT`), units, event_id, actor_user_id, source (`system` \| `user`), created_at, reverses_consumption_id (nullable FK to prior row) |

**PA policy (decided):** If Payer/Plan/Service/Event-Type policy says PA required → missing/invalid/exhausted (derived remaining ≤ 0) PA is a Billing Readiness **blocker**. If not required → absence does not block.

---

## 24. EventType

| Attribute | Detail |
|---|---|
| **Purpose** | Config template for Events (allowed codes, documentation rules, PA flags, unit rules) |
| **Tenant owner** | organization_id |
| **Relationships** | Events; eligibility rules |
| **Uniqueness** | (organization_id, code) |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

Maps/evolves current free-string `ServiceType`.

---

## 25. Event

| Attribute | Detail |
|---|---|
| **Purpose** | Thin operational hub for one scheduled/delivered service unit |
| **Tenant owner** | organization_id |
| **Relationships** | Client, provider User, EventType; EventServiceDelivery; docs; signatures; claims/invoices/timesheets |
| **Uniqueness** | UNIQUE (organization_id, id) |
| **Mutable** | Ops fields until financial/clinical locks apply (`row_version`) |
| **Lifecycle/audit** | Approval one-way; financial locks governed by FinancialDocumentLockPolicy |
| **Hard delete** | Soft cancel; no wipe of linked clinical history |
| **Key fields** | start_at, end_at, location, status (`scheduled` \| `cancelled` \| `approved`…), series_id, approval_at, financial_lock_state (derived or explicit flags set by policy engine) |

Evolves current `CalendarEvent`. Keep UX; deepen model.

---

## 26. EventServiceDelivery

| Attribute | Detail |
|---|---|
| **Purpose** | Delivery facts: units, billing codes used, duration reconciliation |
| **Tenant owner** | organization_id |
| **Relationships** | Event, BillingCode, Service (composite FKs) |
| **Uniqueness** | (event_id, billing_code_id) or single primary row per design |
| **Mutable** | Until financial lock (`row_version`) |
| **Hard delete** | Soft |

---

## 27. ServicePlan

| Attribute | Detail |
|---|---|
| **Purpose** | Clinical container for Client |
| **Tenant owner** | organization_id |
| **Relationships** | Client; Categories |
| **Uniqueness** | id; at most one `active` per client optional policy |
| **Mutable** | draft/active/archived (`row_version`) |
| **Lifecycle/audit** | Status changes audited |
| **Hard delete** | No |
| **Maps from** | existing `ServicePlan` |

---

## 28. Category

| Attribute | Detail |
|---|---|
| **Purpose** | Layer under ServicePlan (2-layer hierarchy) |
| **Tenant owner** | organization_id |
| **Relationships** | ServicePlan; Programs |
| **Maps from** | `ProgramCategory` |

---

## 29. Program

| Attribute | Detail |
|---|---|
| **Purpose** | Clinical program/item |
| **Tenant owner** | organization_id |
| **Relationships** | Category; Objectives; Baselines; MeasurementDefinition |
| **Uniqueness** | Stable `id` (preserve current `programId` linking) |
| **Mutable** | Until archived; mastery manual only (`row_version`) |
| **Hard delete** | No |
| **Maps from** | `ClinicalProgram` |

Program Library = org-level template Programs (not client-owned).

---

## 30. Objective

| Attribute | Detail |
|---|---|
| **Purpose** | Goal under Program with optional mastery criteria |
| **Tenant owner** | organization_id |
| **Relationships** | Program |
| **Mutable** | Status changes are clinical decisions (BCBA Ceiling for mastery) (`row_version`) |
| **Hard delete** | Soft |
| **Maps from** | `ProgramObjective` + `ObjectiveMasteryCriteria` |

**Mastery never auto-mutates from criteria evaluation.**

---

## 31. Baseline

| Attribute | Detail |
|---|---|
| **Purpose** | Baseline observation points |
| **Tenant owner** | organization_id |
| **Relationships** | Program |
| **Mutable** | Append preferred |
| **Hard delete** | Soft |
| **Maps from** | `ClinicalProgram.baseline[]` |

---

## 32. MeasurementDefinition

| Attribute | Detail |
|---|---|
| **Purpose** | How a Program is measured |
| **Tenant owner** | organization_id |
| **Relationships** | Program |
| **Maps from** | `MeasurementConfiguration` |
| **Expand** | Toward 15 measurement types |

---

## 33. RawObservation

| Attribute | Detail |
|---|---|
| **Purpose** | Atomic clinical observation |
| **Tenant owner** | organization_id |
| **Relationships** | Client, Program, optional Event, Objective; author User (composite FKs) |
| **Mutable** | Until Datasheet/Doc lock (`row_version`) |
| **Lifecycle/audit** | Attribution automatic (author_id); amendments after lock |
| **Hard delete** | No |
| **Maps from** | `SessionProgramData` / observed behaviors (normalized) |

---

## 34. Datasheet

| Attribute | Detail |
|---|---|
| **Purpose** | Reviewable package of observations (status machine) |
| **Tenant owner** | organization_id |
| **Relationships** | Client, Event optional; observations |
| **Lifecycle** | Unlocked → Ready for Review → Rejected → Reviewed → Locked |
| **Mutable** | **Reviewed/Locked = hard edit block**; amendments only |
| **Hard delete** | No |
| **Concurrency** | `row_version` while unlocked |

---

## 35. ClinicalDocumentTemplate

| Attribute | Detail |
|---|---|
| **Purpose** | Template definitions / merge fields |
| **Tenant owner** | organization_id |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |

---

## 36. ClinicalDocument

| Attribute | Detail |
|---|---|
| **Purpose** | Generated/authored clinical document (session note, FBA, etc.) |
| **Tenant owner** | organization_id |
| **Relationships** | Client; template; authors; status history via AuditEntry |
| **Lifecycle** | Unlocked → Ready for Review → Rejected → Reviewed → Locked |
| **Mutable** | Normal edits only when unlocked (`row_version`); **Reviewed locks document and linked Event** (clinical lock, distinct from financial lock policy) |
| **Hard delete** | No |
| **Maps from** | `SessionNote`, `Assessment`, `ParentTrainingLog` (as document types) |

---

## 37. DocumentEventLink

| Attribute | Detail |
|---|---|
| **Purpose** | Join ClinicalDocument ↔ Event (many-to-many allowed) |
| **Tenant owner** | organization_id |
| **Uniqueness** | (document_id, event_id) with org-consistent composite FKs |
| **Hard delete** | Soft unlink with audit |

---

## 38. RequiredDocumentPolicy

| Attribute | Detail |
|---|---|
| **Purpose** | Org policy for standing obligations (clinical/HR) |
| **Tenant owner** | organization_id |
| **Key fields** | category (`clinical` \| `hr`), name, recurrence, applicability rules |

---

## 39. RequiredDocumentInstance

| Attribute | Detail |
|---|---|
| **Purpose** | Per-Client or per-Staff obligation instance |
| **Tenant owner** | organization_id |
| **Relationships** | RequiredDocumentPolicy; **exactly one owner**: `client_id` XOR `membership_id` |
| **Constraints** | CHECK enforcing exactly one of (`client_id`, `membership_id`) IS NOT NULL; composite FKs to Client and OrganizationMembership |
| **Lifecycle** | Missing / Delivered / Ignored / Pending(runtime) |
| **Mutable** | Status/file attach (`row_version`); admin-only status change |
| **Hard delete** | Soft |

---

## 40. Signature

| Attribute | Detail |
|---|---|
| **Purpose** | Attestation on exactly one clinical subject: Event **or** ClinicalDocument |
| **Tenant owner** | organization_id |
| **Relationships** | signer UserIdentity; `event_id` nullable; `clinical_document_id` nullable |
| **Constraints** | CHECK: exactly one of (`event_id`, `clinical_document_id`) IS NOT NULL; composite FKs to Event / ClinicalDocument |
| **Mutable** | Append-only in practice |
| **Lifecycle/audit** | **Required** |
| **Hard delete** | No |
| **Key fields** | signed_at, meaning (`attendance` \| `clinical_approve` \| …), method, file_id optional |

**Removed (Phase 17.1):** unconstrained `subject_type` + `subject_id` for Signature.

Signature capture is **not** blocked by locked status (confirmed exemption); signing does not itself transition document status.

---

## 41. Claim

| Attribute | Detail |
|---|---|
| **Purpose** | Payer-facing revenue instrument (standalone claim path) |
| **Tenant owner** | organization_id |
| **Relationships** | Client, InsuranceCoverage, ClaimItems, Events; BillingEntity roles via plan; ClearingHouseConfiguration for submit |
| **Lifecycle** | 10-state machine (CREATED…DECLINED) shared conceptually with ClientInvoice |
| **Mutable** | Status/header (`row_version`) until terminal |
| **Hard delete** | No — cancel/void states |
| **Audit** | **Required** |
| **Lock behavior** | If FinancialDocumentLockPolicy.claim_locks_event = true, generating/linking Claim locks Event |

---

## 42. ClaimItem

| Attribute | Detail |
|---|---|
| **Purpose** | Line items / units / codes |
| **Tenant owner** | organization_id |
| **Relationships** | Claim, Event, BillingCode (composite FKs) |
| **Hard delete** | No |
| **Concurrency** | `row_version` while claim editable |

---

## 42a. ClientInvoice

| Attribute | Detail |
|---|---|
| **Purpose** | Payer/client-facing invoice (agency billing outward) |
| **Tenant owner** | organization_id |
| **Relationships** | Client; optional InsuranceCoverage; Event links/items |
| **Lifecycle** | Shares conceptual 10-state machine with Claims (ledger-confirmed) |
| **Mutable** | (`row_version`) |
| **Hard delete** | No — void/cancel |
| **Structural rule** | **Must remain separate from ProviderInvoice** (contractor compensation) |
| **Lock behavior** | If policy invoice_locks_event = true, generation locks Event |

---

## 43. Remittance

| Attribute | Detail |
|---|---|
| **Purpose** | Imported ERA / payment advice against Claims |
| **Tenant owner** | organization_id |
| **Relationships** | Claim reconciliations |
| **Hard delete** | Soft |
| **Integration** | Import/reconcile boundary — internal remittance records required; network transport is external |

---

## 44. ProviderRate

| Attribute | Detail |
|---|---|
| **Purpose** | Compensation amount/rule for a provider (agency→provider) |
| **Tenant owner** | organization_id |
| **Relationships** | Membership/User; optional Service/BillingCode scope |
| **Mutable** | Effective dating (`row_version`) |
| **Hard delete** | Soft |
| **Rule** | Does **not** store conflicting Employee/Contractor classification — **User Employment Type** is SSOT for pathway; **not** a PayerReimbursementRate |

---

## 45. Timesheet

| Attribute | Detail |
|---|---|
| **Purpose** | Employee compensation pathway |
| **Tenant owner** | organization_id |
| **Relationships** | User/Membership, Events (composite FKs) |
| **Hard delete** | No |
| **Pathway** | Employment Type = employee |
| **Lock behavior** | If policy timesheet_locks_event = true, generation locks Event |
| **Concurrency** | `row_version` |

---

## 46. ProviderInvoice

| Attribute | Detail |
|---|---|
| **Purpose** | Contractor compensation pathway (agency→provider) |
| **Tenant owner** | organization_id |
| **Relationships** | User/Membership, Events |
| **Hard delete** | No |
| **Pathway** | Employment Type = contractor |
| **Structural rule** | Separate from ClientInvoice |
| **Lock behavior** | If policy provider_invoice_locks_event = true, generation locks Event |
| **Concurrency** | `row_version` |

---

## 46a. PaymentProfile

| Attribute | Detail |
|---|---|
| **Purpose** | Payout/integration configuration metadata for provider compensation disbursement |
| **Tenant owner** | organization_id |
| **Relationships** | OrganizationMembership (payee); optional org-default profile |
| **Mutable** | Yes (`row_version`) |
| **Hard delete** | Soft |
| **Key fields** | channel_type (`bank` \| `adp` \| `gusto` \| `paychex` \| `paycor` \| `quickbooks` \| `paypal` \| `zelle` \| `cashapp` \| `venmo` \| `unify` \| `other`), external_account_ref metadata, status |
| **Boundary** | Stores configuration only. **Actual fund disbursement remains an integration boundary.** |

---

## 46b. FinancialDocumentLockPolicy

| Attribute | Detail |
|---|---|
| **Purpose** | Independently configurable financial lock behavior for Events |
| **Tenant owner** | organization_id |
| **Relationships** | Organization defaults; optional HealthPlan override for claim lock |
| **Mutable** | Yes (`row_version`); CONFIGURE by Billing/Org Admin |
| **Hard delete** | Soft |
| **Key fields** | `claim_locks_event` boolean; `client_invoice_locks_event` boolean; `provider_invoice_locks_event` boolean; `timesheet_locks_event` boolean |

These are **policy**, not accidental side effects. Defaults may mirror confirmed OP demo (all Yes) but remain configurable.

---

## 47. AuditEntry

| Attribute | Detail |
|---|---|
| **Purpose** | Immutable retention-grade history |
| **Tenant owner** | organization_id |
| **Relationships** | actor UserIdentity; generic `entity_type` + `entity_id` (allowed polymorphism for cross-cutting audit) |
| **Mutable** | **Immutable** |
| **Hard delete** | **No** |
| **Key fields** | action, before_json, after_json, reason, created_at |

Distinct from Activity feed (recent UX log). Generic polymorphism is acceptable here; it must not replace enforceable FKs on Signature, RequiredDocumentInstance, AuthorizationConsumption, etc.

---

## 48. AttentionCoordination

| Attribute | Detail |
|---|---|
| **Purpose** | Persistent work-coordination metadata for an attention item |
| **Tenant owner** | organization_id |
| **Relationships** | assignee User; subject entity refs; condition_code |
| **Mutable** | ack/snooze/escalate/resolve metadata (`row_version`) |
| **Hard delete** | Soft |
| **Note** | Source condition still re-derived; this row does not replace domain truth |

---

## 49. NotificationHistory

| Attribute | Detail |
|---|---|
| **Purpose** | What was sent/read |
| **Tenant owner** | organization_id |
| **Relationships** | User; optional AttentionCoordination |
| **Mutable** | read_at updates |
| **Hard delete** | Retention-policy purge only |

---

## 50. StoredFile

| Attribute | Detail |
|---|---|
| **Purpose** | Relational metadata for object-storage binary |
| **Tenant owner** | organization_id |
| **Relationships** | uploader; optional linked entity |
| **Key fields** | storage_key, content_type, byte_size, checksum, filename, status |
| **Hard delete** | Soft delete metadata + lifecycle object purge job |

**Never store large document blobs in PostgreSQL.**

---

## Entity → React Feature Map coverage (27 domains)

| # | Domain | Primary entities |
|---|---|---|
| 1 | App Shell / Navigation | UserIdentity, Membership, FunctionGrant (incl. scope_mode) |
| 2 | Home / Today / Dashboards | AttentionCoordination, NotificationHistory (+ derived) |
| 3 | Clients | Client, Caregiver, ConsentAuthority, Diagnosis, Physician |
| 4 | Scheduling / Calendar | Event, EventType |
| 5 | Events / Sessions | Event, EventServiceDelivery, FinancialDocumentLockPolicy |
| 6 | Clinical Service Plans | ServicePlan, Category |
| 7 | Programs / Objectives | Program, Objective, Baseline |
| 8 | Data Collection | MeasurementDefinition, RawObservation, Datasheet |
| 9 | Progress / Charts | Derived over RawObservation/Program (no score entity) |
| 10 | Documentation | ClinicalDocumentTemplate, ClinicalDocument, DocumentEventLink |
| 11 | Signatures | Signature (event_id XOR clinical_document_id) |
| 12 | Required Documents | RequiredDocumentPolicy, RequiredDocumentInstance (client XOR membership) |
| 13 | Staff / Workforce | OrganizationMembership (+ UserIdentity) |
| 14 | Credentials | CredentialDefinition, UserCredential |
| 15 | Permissions / Authority | OperationalFunction, FunctionGrant.scope_mode, ClientAssignment (+ derived Ceiling) |
| 16 | Insurance | InsuranceCoverage, CoordinationOfBenefits, Payer, HealthPlan, ClientInsuranceRateOverride |
| 17 | Prior Authorizations | PriorAuthorization, AuthorizationAllocation, AuthorizationConsumption |
| 18 | Billing Codes / Services / Payers | Service, BillingCode, eligibility joins, Payer, HealthPlan, PayerReimbursementRate, BillingEntity, PayerPlanBillingEntityRole, ClearingHouseConfiguration |
| 19 | Billing Readiness | Derived evaluator (reads Docs/Signatures/Event/PA derived remaining/…) |
| 20 | Claims | Claim, ClaimItem, ClientInvoice, BillingEntity role wiring |
| 21 | Remittance | Remittance |
| 22 | Provider Compensation | ProviderRate, Timesheet, ProviderInvoice, PaymentProfile |
| 23 | Configuration | Organization + catalogs + FinancialDocumentLockPolicy + ClearingHouseConfiguration |
| 24 | Compliance | Derived rollup over Required Docs, PA, Credentials |
| 25 | Reporting / Oversight | Report definitions (future) + AuditEntry/Activity queries |
| 26 | Attention / Work Coordination | AttentionCoordination, NotificationHistory |
| 27 | Files / Help | StoredFile (+ help content records future) |

### Revenue-cycle parity homes (Phase 17.1 re-audit)

| Confirmed capability | Home |
|---|---|
| Billing Entities (generic X12 role identity) | BillingEntity |
| Clearing Houses (submitter/receiver, trading partner, envelope config) | ClearingHouseConfiguration (integration **config**, not network) |
| Payer Plan Billing Entity role assignment | PayerPlanBillingEntityRole |
| Payer/plan reimbursement rates | PayerReimbursementRate |
| Client insurance rate override | ClientInsuranceRateOverride |
| Claims | Claim / ClaimItem |
| Client Invoices (payer/client-facing) | ClientInvoice (**≠** ProviderInvoice) |
| Provider Invoices (contractor) | ProviderInvoice |
| Timesheets (employee) | Timesheet |
| Payment Profiles (disbursement config) | PaymentProfile (disbursement execution = integration) |
| Claim/Invoice/Timesheet Locks Event | FinancialDocumentLockPolicy |
| Remittance/ERA | Remittance (import/reconcile; transport = integration) |
| PA Approved/Used/Remaining | AuthorizationAllocation + AuthorizationConsumption (derived used/remaining) |

Integration boundary means we do not build the external network. It does **not** mean omitting internal records/configuration needed to use that network.

Cross-cutting AI Toolkit/Sidekick: no new source-of-truth entities required beyond Files/optional prompt preference rows.

---

## Change Log

- **V1.1 (Phase 17.1):** Revenue-cycle entities completed; AuthorizationAllocation/Consumption ledger; tenant-aware composite FKs + optimistic concurrency; FunctionGrant.scope_mode replaces ClientAssignment.agency_wide_scope; Signature/RequiredDocumentInstance XOR FKs; Discharged = audited reactivation only (no Episode entity in V1).
- **V1 (Phase 17):** First relational domain model for the ABA clinic platform evolving `bcba-workspace-ai-studio`. No SQL migrations in this phase.
