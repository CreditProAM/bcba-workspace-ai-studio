# Wave 0 Implementation Spec V1

Phase 18 deliverable. **Immediately executable** by Cursor in a later
authorized Node 7 slice. **Do not implement in Phase 18.**

Goal: production spine **without changing visible clinical UX**, without
breaking Vite/GitHub/Google AI Studio frontend workflow.

---

## 1. What remains at the existing frontend root

**Keep in place (do not move):**

```text
App.tsx
index.tsx
index.html
components/
hooks/
utils/
services/          # gemini remains until Wave 11; do not break imports
constants.ts
types.ts
config/
vite.config.ts
tsconfig.json
package.json       # root remains the frontend package
metadata.json
README.md
DEVELOPMENT_DIRECTION.md
docs/
```

**Root scripts stay:**

```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview"
```

Add **additional** root scripts that delegate to server (optional convenience):

```json
"server:dev": "npm run dev --prefix server",
"server:test": "npm run test --prefix server",
"typecheck": "tsc --noEmit --noUnusedLocals --noUnusedParameters"
```

---

## 2. Where backend code lives

New directory **sibling to frontend files**, same git repo:

```text
bcba-workspace-ai-studio/
  server/
    package.json
    tsconfig.json
    drizzle.config.ts
    src/
      index.ts                 # listen
      app.ts                   # Hono app export (for tests)
      config/env.ts            # zod-parsed env
      db/
        client.ts
        schema/
          meta.ts              # organizations, audit_entries, … Wave 0 tables
        migrate.ts
      middleware/
        requestId.ts
        errorHandler.ts
        session.ts             # stub/pass-through in Wave 0; real in Wave 1
        tenant.ts              # resolves org context when present
      modules/
        health/
          routes.ts
        platform/
          audit.ts             # AuditEntry writer helper
      shared/
        errors.ts
        concurrency.ts         # row_version helpers
    drizzle/
      0000_wave0.sql           # generated or hand-written
    tests/
      health.test.ts
      tenant_fk.test.ts
    .env.example
  docker-compose.yml           # postgres (+ optional mailhog later)
  .env.example                 # root: VITE_API_BASE_URL, VITE_DATA_MODE
```

**Do not** create `apps/web` or relocate `App.tsx`.

---

## 3. How frontend development works

```bash
# from repo root
npm install
npm run dev          # Vite :3000 — unchanged AI Studio / local workflow
```

- `VITE_DATA_MODE=local` (default): all existing localStorage behavior.
- Frontend does **not** need the backend to build or run in local mode.
- Optional: set `VITE_API_BASE_URL=http://localhost:8787` when testing health from browser later.

**Wave 0 frontend code changes (minimal):**

| File | Change |
|---|---|
| `lib/api/client.ts` **(new)** | `apiFetch('/health')` using `import.meta.env.VITE_API_BASE_URL` |
| `lib/cutover.ts` **(new)** | `DATA_MODE` constant; all domains `local` |
| `package.json` | scripts only; optional `@tanstack/react-query` can wait until Wave 1 |
| `.env.example` | document `VITE_API_BASE_URL`, `VITE_DATA_MODE` |
| `vite.config.ts` | **Do not** add server secrets; keep existing Gemini define for now |

No changes required to Calendar/Caseload/Notes components in Wave 0.

---

## 4. How backend development works

```bash
docker compose up -d          # Postgres on localhost:5432
cd server && npm install
cp .env.example .env          # DATABASE_URL, PORT=8787, SESSION_SECRET
npm run db:migrate
npm run dev                   # Hono on :8787
npm test
```

Frontend and backend are **separate processes**.

---

## 5. API base URL environment configuration

| Env var | Where | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend (Vite) | Public API origin, e.g. `http://localhost:8787` or empty |
| `VITE_DATA_MODE` | Frontend | `local` \| `api` |
| `DATABASE_URL` | Server only | Postgres connection |
| `PORT` | Server only | Default `8787` |
| `SESSION_SECRET` | Server only | Cookie signing (Wave 1+) |
| `CORS_ORIGIN` | Server only | e.g. `http://localhost:3000` |
| `GEMINI_API_KEY` | Server only (Wave 11) | Never `VITE_` |

No server secret may be exposed through Vite `define` / `VITE_*`.

---

## 6. Google AI Studio compatibility during migration

| Requirement | Wave 0 approach |
|---|---|
| Vite build at root | Unchanged |
| Import/entry `index.html` → `index.tsx` | Unchanged |
| Offline demo | `VITE_DATA_MODE=local` default |
| No backend required to preview | Guaranteed |
| GitHub canonical | Push root + `server/` together; Studio pulls frontend as today |
| Secrets | Studio may keep using `GEMINI_API_KEY` via existing vite define until Wave 11 |

If AI Studio cannot see `server/`, that is fine — it only needs the frontend tree.

---

## 7. Eventual production hosting (not selected now)

Later (Wave 11 / Pilot):

- Static frontend (CDN / AI Studio / other) + Node `server` + managed Postgres + S3
- Or single VM/container compose

**Hosting vendor is explicitly deferred.** Wave 0 only needs local Docker Postgres + local Node API.

---

## 8. Dependencies to install

### Root (`package.json`) — optional Wave 0

None required for spine. Recommended add later in Wave 1:

- `@tanstack/react-query`

### `server/package.json`

```text
hono
@hono/node-server
drizzle-orm
drizzle-kit
postgres          # or pg
zod
argon2            # install Wave 0 for readiness; use Wave 1
dotenv
tsx               # dev runner
vitest
typescript
@types/node
pg-boss           # optional Wave 0 stub; or defer to Wave 9
```

Dev: `docker.io` compose with image `postgres:16`.

---

## 9. First API contract (Wave 0)

### `GET /api/v1/health`

```json
{
  "ok": true,
  "service": "bcba-workspace-api",
  "version": "0.0.0",
  "db": "up"
}
```

### `GET /api/v1/ready`

Fails (503) if DB unreachable.

CORS: allow `CORS_ORIGIN`.

No auth required on health/ready.

---

## 10. First database tables (Wave 0 only)

Keep minimal — prove conventions, not full domain.

### `organizations`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| status | text | `active` \| `suspended` |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| row_version | int | default 1 |

### `audit_entries`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid NOT NULL | FK → organizations(id) initially; later composite pattern |
| actor_user_id | uuid NULL | |
| entity_type | text | |
| entity_id | uuid | |
| action | text | |
| before_json | jsonb NULL | |
| after_json | jsonb NULL | |
| reason | text NULL | |
| created_at | timestamptz | |

Wave 0 may use simple FK to `organizations(id)`. From Wave 1 onward, apply full `UNIQUE(organization_id, id)` + composite FK pattern on tenant-owned tables (document in migration comments).

### Convention proof table `wave0_tenant_children` (test-only / drop later)

```text
id uuid
organization_id uuid NOT NULL
parent_id uuid NOT NULL
UNIQUE (organization_id, id)
FOREIGN KEY (organization_id, parent_id)
  REFERENCES organizations_with_composite OR a wave0_parents table
```

Use a small `wave0_parents (organization_id, id)` table in tests to prove composite FK rejects cross-tenant edges. Can be removed after Wave 1 real schemas exist.

---

## 11. Migration structure

```text
server/drizzle.config.ts  → schema: ./src/db/schema/*
server/drizzle/0000_wave0.sql
npm run db:generate
npm run db:migrate
```

All migrations committed to git.

---

## 12. Platform helpers to implement

| Helper | Behavior |
|---|---|
| `writeAuditEntry(...)` | Insert into `audit_entries` |
| `assertRowVersion(table, id, expected)` | Pattern for later modules |
| `env` | Zod parse; fail fast on boot |
| Error middleware | JSON `{ error: { code, message } }` |

Session middleware: **stub** that attaches empty `user` until Wave 1.

---

## 13. Test harness

`server/tests/health.test.ts`:

1. Boot app with test DB (or transactional cleanup).
2. `GET /api/v1/health` → 200 and `db: up`.

`server/tests/tenant_fk.test.ts`:

1. Insert Org A parent, Org B parent.
2. Attempt child in Org A referencing Org B parent → **DB rejects**.

---

## 14. Verification commands (Wave 0 completion proof)

```bash
# Frontend unchanged
npm install
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build

# Backend
docker compose up -d
cd server && npm install && npm run db:migrate && npm test && npm run dev
# curl http://localhost:8787/api/v1/health
```

Manual:

- Open Vite app — Calendar/Caseload/Notes still work (local mode).
- No clinical component deleted.

---

## 15. Explicitly out of Wave 0

- Replacing AuthScreen / migrating clients
- Drizzle schemas for full domain model
- Gemini proxy
- Object storage production
- Any billing/clinical API
- Repository cutover of AppState
- Monorepo tooling (pnpm workspaces, turborepo) unless proven necessary

---

## 16. Suggested implementation order for the coding agent

1. Add `docker-compose.yml` + root `.env.example`
2. Scaffold `server/` package + Hono health routes
3. Drizzle schema for organizations + audit_entries + tenant proof tables
4. Migrate + health/tenant tests
5. Add `lib/api/client.ts` + `lib/cutover.ts` (no UI behavior change)
6. Run verification commands
7. Commit with message focused on “add API spine without UX change”

---

## Change Log

- **V1 (Phase 18):** Executable Wave 0 spec; AI Studio-safe frontend-at-root layout.
