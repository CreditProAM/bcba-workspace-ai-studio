# Implementation Stack V1

Phase 18 deliverable. Concrete libraries for the approved architecture.
Selected for one development team; TypeScript end-to-end; no microservices
pressure; AI Studio / Vite frontend preserved at repo root.

---

## Summary

| Layer | Choice |
|---|---|
| Frontend | Existing Vite 6 + React 19 + TypeScript (unchanged location) |
| Backend | Node.js + **Hono** (TypeScript modular monolith in `server/`) |
| Database | **PostgreSQL** 16+ |
| Query / schema | **Drizzle ORM** + **drizzle-kit** (SQL migrations; custom SQL allowed) |
| Validation | **Zod** (shared request/response schemas) |
| Auth / sessions | Server-side sessions in PostgreSQL + **argon2** password hashing + httpOnly cookies |
| Frontend data | **TanStack Query** + thin repository adapters |
| Testing | **Vitest** (unit/integration); **supertest**-style Hono request tests; Playwright later (Wave 11) |
| Object storage | **S3-compatible** interface (`@aws-sdk/client-s3`); MinIO or local filesystem stub in dev |
| Background jobs | **pg-boss** (PostgreSQL-backed; no Redis required) |
| API style | Versioned HTTP/JSON (`/api/v1/...`) |

---

## Frontend (preserve)

| Item | Decision | Rationale |
|---|---|---|
| Bundler | Vite (existing) | AI Studio + current workflow |
| UI | React 19 + TS (existing) | Preserve product |
| Charts | Recharts (existing) | ClinicalProgress |
| Icons | lucide-react (existing) | Keep |
| AI client | Remove browser key over Waves 0–11; call backend proxy | Security |
| New deps | `@tanstack/react-query`, thin `src/api/` or `lib/api/` client | Incremental API adoption without rewriting screens |

**Do not** relocate frontend into `apps/web` or force frontend to build through the backend.

---

## Backend

| Item | Decision | Rationale |
|---|---|---|
| Runtime | Node.js 22 LTS | Same language as frontend |
| Framework | **Hono** | Lightweight, explicit middleware, excellent TS, easy modular routes; not Nest-heavy |
| Layout | `server/` directory sibling to existing frontend files | Around, not instead of, frontend |
| Module style | Domain folders under `server/src/modules/*` matching API boundaries | Modular monolith |
| Process | Separate `npm run server:dev` from `npm run dev` (Vite) | Independent runtimes |

**Rejected:** NestJS (heavier DI ceremony), microservices frameworks, Next.js full-stack rewrite (would break AI Studio Vite app shape).

---

## Database access & migrations

| Item | Decision | Rationale |
|---|---|---|
| ORM | **Drizzle** | SQL-first, explicit schema, composite FKs expressible, TypeScript |
| Migrations | `drizzle-kit` + checked-in SQL under `server/drizzle/` | Reviewable; custom SQL for CHECK/partial unique indexes |
| Driver | `postgres` (postgres.js) or `pg` via Drizzle | Mature PostgreSQL |
| Conventions | `organization_id` + `UNIQUE(organization_id, id)` + composite FKs; `row_version` | Architecture ADRs |

**Rejected:** Prisma migrate-only opacity for complex CHECKs; Knex alone (weaker TS schema); Firebase.

---

## Validation

**Zod** at API boundary. Optionally share types with frontend via `server/src/shared` or duplicate thin client types initially (avoid premature monorepo packages that break AI Studio).

---

## Authentication / session

| Item | Decision |
|---|---|
| Passwords | **argon2** (`@node-rs/argon2` or `argon2`) |
| Sessions | `user_sessions` table; opaque session id in **httpOnly Secure SameSite** cookie |
| Revocation | `revoked_at` on session row (Terminated / admin revoke) |
| Org context | Cookie or header after membership resolution; always validated server-side |
| Cross-origin (Wave 1) | CORS allowlist + `credentials: true`; Secure/SameSite appropriate to topology; CSRF protection on mutating authenticated requests; server Origin/CSRF validation — **not** localStorage bearer tokens |
| Future OIDC | Adapter behind same UserIdentity — not required Wave 0 |

**Rejected:** JWT-only without revocation store; plaintext localStorage users; exposing secrets via `VITE_*`; solving Studio/dev cross-origin with tokens in localStorage.

---

## Frontend data / query layer

1. `lib/api/client.ts` — `fetch` wrapper with `VITE_API_BASE_URL` (empty/default for mock/localStorage mode).
2. Domain repositories (`clientsRepo`, `eventsRepo`, …) called from App handlers.
3. TanStack Query for server-backed domains after cutover.
4. Until a domain cuts over: repository reads/writes localStorage AppState (existing behavior).

---

## Testing

| Layer | Tool |
|---|---|
| Unit (utils, evaluators, authz) | Vitest |
| API integration | Vitest + Hono app.request + test PostgreSQL (Docker) |
| Frontend typecheck/build | Existing `tsc` + `vite build` |
| E2E | Playwright (Wave 11 hardening; not Wave 0 blocker) |

---

## Object storage

Interface `StoredFileStorage` with implementations:

- `LocalDevStorage` (filesystem under `server/.data/files`) for Wave 0–9
- `S3Storage` for staging/production

No large blobs in PostgreSQL.

---

## Background jobs

**pg-boss** for: notification delivery, expiration digests, remittance import hooks, large exports.

Wave 0: install + health only; first real jobs in Wave 9+.

---

## Deployment assumptions (non-binding)

| Concern | Assumption for planning |
|---|---|
| Dev | Docker Compose: PostgreSQL (+ optional MinIO); Vite :3000; API :8787 |
| Staging/prod | Frontend static (or AI Studio preview) + Node API + managed PostgreSQL + S3 — **hosting vendor deferred** |
| Secrets | Server env only (`DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`, …) |
| Browser env | Only `VITE_API_BASE_URL` (public) |

---

## Lock-in posture

All choices are replaceable adapters except PostgreSQL and the React product.
Hono/Drizzle/pg-boss are not platform-defining; domain model and AuthZ are.

---

## Change Log

- **V1 (Phase 18):** Initial stack selection for Integrated Product Build.
