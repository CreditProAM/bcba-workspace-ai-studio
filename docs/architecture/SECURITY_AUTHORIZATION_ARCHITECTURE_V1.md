# Security Authorization Architecture V1

Phase 17 deliverable; **hardened in Phase 17.1**. Translates
`ROLE_MODEL_V1_1_CORRECTION.md` into enforceable architecture.

**Critical rule:** UI hiding is **never** sufficient authorization.
Every protected write is enforced by the backend.

---

## 1. Authentication boundary

| Concern | Design |
|---|---|
| Identity | One human = one User Identity = one login |
| Credentials storage | Password hash (argon2/bcrypt) or OIDC subject — never plaintext |
| Session | Server-side session (or revocable refresh tokens) with `UserSession` row |
| Tenant selection | After auth, select Organization via active Membership |
| Failure mode | Unauthenticated requests receive no clinic data |

Existing `AuthScreen` UX concept may remain; storage/`bcba_users_v1` plaintext roster is replaced.

---

## 2. Organization Membership

Access to any clinic entity requires:

1. Valid session
2. Active (or policy-allowed Inactive read-only) OrganizationMembership for that `organization_id`
3. Request scoped to that organization

**Terminated membership:**
- Immediate session revocation (all devices)
- No further data access
- Historical attribution remains on UserIdentity

**Session revocation (decided — closes gap 2e):**
- Admin/security Function may revoke individual sessions or all sessions for a user
- Termination triggers global revoke
- Credential/security incidents may trigger revoke without full Termination

---

## 3. Operational Function grants

- Stored as `FunctionGrant` rows (join), **not** a single mutually-exclusive role enum
- Additive: Mary may hold Scheduling + Intake + Insurance/PA + Billing + HR + Payroll + Reporting
- Each grant carries `scope_mode`: `ORGANIZATION` \| `ASSIGNED_CLIENTS`
- Presets (e.g. “Front Desk”) are UI convenience only — never the storage mechanism
- No combined super-role values (`BCBA_ADMIN_BILLING_HR` forbidden)

Function grants gate **workflow surfaces** and non-clinical / administrative verbs, and define **WHERE** those verbs apply.

| Example | Functions | scope_mode | Credential / Ceiling |
|---|---|---|---|
| Mary | Billing, Intake, Scheduling, … | `ORGANIZATION` | none / NONE |
| Line BCBA | Clinical Delivery | `ASSIGNED_CLIENTS` | BCBA / full within assignments |
| Clinical Director | Clinical Supervision | `ORGANIZATION` | BCBA / full org-wide **where** (Ceiling still from Credential) |

---

## 4. Credential-derived Clinical Authority Ceiling

Ceiling is **computed**, never directly assigned as a permission that exceeds real credentials.

| Held active Credential | Ceiling |
|---|---|
| None | NONE — clinical AUTHOR/EDIT/REVIEW/APPROVE-SIGN hard-blocked |
| RBT | AUTHOR own work + own-session attestation only |
| BCaBA | AUTHOR/EDIT own work on assigned cases; **never** REVIEW/APPROVE-SIGN of others |
| BCBA | Full AUTHOR/EDIT/REVIEW/APPROVE-SIGN within FunctionGrant WHERE-scope |
| BCBA + Clinical Supervision Function with `ORGANIZATION` scope | Same clinical verbs, org-wide WHERE — Ceiling unchanged in WHAT |

Expired/suspended credential → Ceiling drops immediately.

**Software may narrow, never elevate** clinical authority. Function grants (including `ORGANIZATION` scope), Owner/Admin, and Client Assignments cannot manufacture BCBA-tier review/sign. Organization scope changes **WHERE** legitimate existing authority applies; it **never** increases **WHAT** the Credential supports.

---

## 5. Client scoping

`ClientAssignment` always represents **one real User↔Client relationship**.

- Used when a FunctionGrant has `scope_mode = ASSIGNED_CLIENTS`
- May narrow a credential’s normal scope on a specific case
- **Cannot** grant clinical verbs the Ceiling forbids
- **Must not** carry `agency_wide_scope` (removed Phase 17.1)
- Assignment end removes future active access for assigned-client-scoped Functions; historic PHI thereafter requires current legitimate Function/scope — history is not rewritten

---

## 5a. Tenant isolation (defense in depth)

| Layer | Requirement |
|---|---|
| Application | Every clinic query/filter includes active `organization_id`; AuthZ mandatory |
| Database | Tenant-owned FKs are organization-consistent composite FKs — a child in Org A cannot reference a parent in Org B (domain model §0.1) |

App-level filtering alone is **not** sufficient architecture.

---

## 5b. Optimistic concurrency

Mutable operational, clinical (pre-lock), authorization, and financial records carry `row_version`. Updates require the expected version; conflicts return a concurrency error. Reviewed/Locked clinical content remains immutable except via amendment flows. Append-only ledgers (AuthorizationConsumption, AuditEntry, Signature) are insert-only.

---

## 6. Verb taxonomy → enforcement classes

| Class | Verbs (representative) | Gated by |
|---|---|---|
| **VIEW** | VIEW non-clinical | Function |
| **VIEW CLINICAL CONTENT** | Read note text / plan for ops reasons | Function (no Ceiling) |
| **OPERATIONAL** | CREATE/EDIT schedule, intake, insurance, PA; QA follow-up; ROUTE FOR CORRECTION; CONFIGURE; ARCHIVE/DEACTIVATE | Function (+ domain match) |
| **FINANCIAL** | FINANCIAL EDIT claims, rates, payroll coordination | Function |
| **CLINICAL** | CLINICAL AUTHOR / EDIT / REVIEW / APPROVE-SIGN | **Function AND Ceiling** (+ Assignment when grant scope is ASSIGNED_CLIENTS) |

Existing app’s `DataCollection` RBT→Pending Review→BCBA Complete path is the first live instance of CLINICAL AUTHOR vs CLINICAL APPROVE separation — generalize, do not discard.

---

## 7. Server-side enforcement pattern

On every protected write:

```
authenticate(session)
→ resolve membership(org)
→ deny if Terminated / no membership
→ resolve Function grants (+ scope_mode)
→ resolve Ceiling from active UserCredentials
→ if scope_mode = ASSIGNED_CLIENTS: require active ClientAssignment for resource
→ if scope_mode = ORGANIZATION: allow org-wide WHERE for that Function
→ deny if lifecycle blocks (client discharged, locked document, etc.)
→ deny unless Function permits verb
→ if clinical verb: deny unless Ceiling permits
→ for mutable updates: require matching row_version
→ execute write (tenant-consistent FKs)
→ append AuditEntry
```

Navigation/`PermissionGate` in React is UX only.

---

## 8. Mary validation (architecture)

Mary holds operational Functions, Credential = none, Ceiling = NONE.

| Can | Cannot |
|---|---|
| Scheduling, Intake, Insurance/PA, Billing, HR, Payroll coordination, Reporting | CLINICAL AUTHOR/EDIT/REVIEW/APPROVE-SIGN |
| VIEW CLINICAL CONTENT / OPERATIONAL QA where Function requires | Resolve clinical correctness |
| ROUTE FOR CORRECTION | Elevate herself via Admin toggles |

Backend must reject clinical writes even if a crafted client request bypasses hidden UI.

---

## 9. BCBA Owner validation (architecture)

Same operational Functions as Mary **plus** Clinical Delivery/Supervision Functions **plus** active BCBA Credential.

- Clinical authority comes from Credential/Ceiling, not Owner/Admin Function
- If BCBA credential lapses, clinical verbs block while org Functions remain
- No combined super-role required

---

## 10. Audit logging

| Event class | Logged |
|---|---|
| Auth | Login, logout, failed auth, session revoke |
| Authorization | Grant/revoke Function; credential status changes |
| Clinical | Document/Datasheet status transitions; amendments; mastery |
| Financial | Claim/rate/timesheet/invoice mutations |
| Lifecycle | Client/staff status transitions; assignment end |

Activity feed (UX) remains separate from immutable `AuditEntry`.

---

## 11. Data access after lifecycle changes

| Case | Rule |
|---|---|
| Client Inactive | Readable by permission; no new scheduling/delivery |
| Client Discharged | History preserved; no new service delivery while discharged; resumption requires explicit audited Client reactivation (no Episode entity in V1) |
| Staff Inactive | No new active workflow; attribution intact |
| Staff Terminated | No access; sessions revoked; attribution intact |
| Assignment ended | No future active case access; historic access by current legitimate permission |

---

## Change Log

- **V1.1 (Phase 17.1):** FunctionGrant.scope_mode; remove agency_wide_scope; tenant composite-FK + concurrency; Discharged reactivation without Episode.
- **V1 (Phase 17):** Enforceable authn/authz architecture from ROLE_MODEL_V1_1_CORRECTION + lifecycle/session decisions.
