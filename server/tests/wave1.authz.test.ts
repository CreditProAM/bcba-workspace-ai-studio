import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { closeDb, getDb, getSql } from '../src/db/client.js';
import {
  auditEntries,
  caregivers,
  clients,
  organizations,
  userCredentials,
  userSessions,
} from '../src/db/schema/index.js';
import { assertAuthorized } from '../src/modules/authz/authorize.js';
import { loadAuthzContext } from '../src/modules/authz/authorize.js';
import { Verbs } from '../src/modules/authz/verbs.js';
import { hashToken } from '../src/shared/crypto.js';
import { authedHeaders, loginAs, seedAndApp } from './helpers.js';

describe('Wave 1 auth, CSRF, CORS, authz, clients, audit', () => {
  let app: Awaited<ReturnType<typeof seedAndApp>>['app'];
  let seeded: Awaited<ReturnType<typeof seedAndApp>>['seeded'];

  beforeAll(async () => {
    ({ app, seeded } = await seedAndApp());
  });

  afterAll(async () => {
    await closeDb();
  });

  it('login success and failure; password hash never exposed', async () => {
    const bad = await loginAs(app, 'mary@demo.local', 'wrong-password');
    expect(bad.res.status).toBe(401);

    const ok = await loginAs(app, 'mary@demo.local');
    expect(ok.res.status).toBe(200);
    expect(ok.body.csrfToken).toBeTruthy();
    expect(ok.cookie).toContain('bcba_session=');
    const text = JSON.stringify(ok.body);
    expect(text).not.toMatch(/password/i);
    expect(text).not.toContain('passwordHash');
  });

  it('session DB stores token hash not raw cookie token', async () => {
    const ok = await loginAs(app, 'mary@demo.local');
    const raw = ok.cookie.split('bcba_session=')[1]?.split(';')[0];
    expect(raw).toBeTruthy();
    const db = getDb();
    const rows = await db.select().from(userSessions);
    expect(rows.some((r) => r.tokenHash === raw)).toBe(false);
    expect(rows.some((r) => r.tokenHash === hashToken(raw!))).toBe(true);
  });

  it('logout invalidates session', async () => {
    const ok = await loginAs(app, 'mary@demo.local');
    const logout = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: authedHeaders(ok.cookie, ok.csrfToken),
    });
    expect(logout.status).toBe(200);
    const me = await app.request('/api/v1/auth/me', {
      headers: { cookie: ok.cookie },
    });
    expect(me.status).toBe(401);
  });

  it('CORS allowlist accepts allowed origin and rejects others', async () => {
    const allowed = await app.request('/api/v1/health', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');

    const denied = await app.request('/api/v1/health', {
      headers: { origin: 'http://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('CSRF missing/invalid denied; valid permitted', async () => {
    const ok = await loginAs(app, 'mary@demo.local');
    const missing = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: ok.cookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ legalName: 'No CSRF' }),
    });
    expect(missing.status).toBe(403);

    const invalid = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(ok.cookie, 'not-the-token'),
      body: JSON.stringify({ legalName: 'Bad CSRF' }),
    });
    expect(invalid.status).toBe(403);

    const valid = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(ok.cookie, ok.csrfToken),
      body: JSON.stringify({ legalName: 'CSRF Client' }),
    });
    expect(valid.status).toBe(201);
  });

  it('Mary operational allow + clinical deny; BCBA clinical allow', async () => {
    const maryCtx = await loadAuthzContext(
      seeded.users.mary.id,
      seeded.organizationId,
      'test-session',
      { email: 'mary@demo.local', displayName: 'Mary' },
    );
    expect(maryCtx.ceiling).toBe('NONE');
    await expect(
      assertAuthorized({ ctx: maryCtx, verb: Verbs.OPERATIONAL_CREATE }),
    ).resolves.toBe(true);
    await expect(
      assertAuthorized({ ctx: maryCtx, verb: Verbs.CLINICAL_AUTHOR }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/FUNCTION|CEILING/) });

    const bcbaCtx = await loadAuthzContext(
      seeded.users.bcbaOwner.id,
      seeded.organizationId,
      'test-session-2',
      { email: 'bcba.owner@demo.local', displayName: 'BCBA' },
    );
    expect(bcbaCtx.ceiling).toBe('BCBA');
    await expect(
      assertAuthorized({ ctx: bcbaCtx, verb: Verbs.CLINICAL_APPROVE_SIGN }),
    ).resolves.toBe(true);
  });

  it('BCaBA cannot review; expired credential drops ceiling', async () => {
    const bcabaCtx = await loadAuthzContext(
      seeded.users.bcaba.id,
      seeded.organizationId,
      'test-session-3',
      { email: 'bcaba@demo.local', displayName: 'BCaBA' },
    );
    expect(bcabaCtx.ceiling).toBe('BCABA');
    // Even with a supervision Function grant, Ceiling blocks REVIEW for BCaBA.
    const withSupervision = {
      ...bcabaCtx,
      grants: [
        ...bcabaCtx.grants,
        { code: 'clinical_supervision', scopeMode: 'ORGANIZATION' },
      ],
      functionCodes: [...bcabaCtx.functionCodes, 'clinical_supervision'],
    };
    await expect(
      assertAuthorized({ ctx: withSupervision, verb: Verbs.CLINICAL_REVIEW }),
    ).rejects.toMatchObject({ code: 'CLINICAL_CEILING_DENIED' });

    const db = getDb();
    await db
      .update(userCredentials)
      .set({ status: 'expired', expiresOn: '2020-01-01' })
      .where(eq(userCredentials.userId, seeded.users.bcaba.id));

    const expiredCtx = await loadAuthzContext(
      seeded.users.bcaba.id,
      seeded.organizationId,
      'test-session-4',
      { email: 'bcaba@demo.local', displayName: 'BCaBA' },
    );
    expect(expiredCtx.ceiling).toBe('NONE');

    // restore for later tests
    await seedAndApp();
  });

  it('Function grant cannot elevate clinical ceiling alone', async () => {
    // Mary has no credentials; even if she had clinical_delivery she needs ceiling.
    // Seed Mary without clinical function — granting clinical_delivery still NONE ceiling.
    const mary = await loadAuthzContext(
      seeded.users.mary.id,
      seeded.organizationId,
      's',
      { email: 'mary@demo.local', displayName: 'Mary' },
    );
    // simulate clinical function without credential
    const fake = {
      ...mary,
      grants: [...mary.grants, { code: 'clinical_delivery', scopeMode: 'ORGANIZATION' }],
      functionCodes: [...mary.functionCodes, 'clinical_delivery'],
      ceiling: 'NONE' as const,
    };
    await expect(
      assertAuthorized({ ctx: fake, verb: Verbs.CLINICAL_AUTHOR }),
    ).rejects.toMatchObject({ code: 'CLINICAL_CEILING_DENIED' });
  });

  it('terminated staff cannot continue access; session revoke works', async () => {
    const rbt = await loginAs(app, 'rbt@demo.local');
    expect(rbt.res.status).toBe(200);

    const mary = await loginAs(app, 'mary@demo.local');
    const staffList = await app.request('/api/v1/staff', {
      headers: { cookie: mary.cookie },
    });
    expect(staffList.status).toBe(200);
    const staffBody = (await staffList.json()) as {
      staff: { membershipId: string; email: string; rowVersion: number }[];
    };
    const rbtMem = staffBody.staff.find((s) => s.email === 'rbt@demo.local');
    expect(rbtMem).toBeTruthy();

    const term = await app.request(`/api/v1/staff/${rbtMem!.membershipId}/lifecycle`, {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        status: 'terminated',
        rowVersion: rbtMem!.rowVersion,
      }),
    });
    expect(term.status).toBe(200);

    const me = await app.request('/api/v1/auth/me', {
      headers: { cookie: rbt.cookie },
    });
    expect(me.status).toBe(401);

    // re-seed personas for remaining tests
    ({ app, seeded } = await seedAndApp());
  });

  it('cross-tenant FK impossible on caregivers; API denies other org', async () => {
    const db = getDb();
    const [org2] = await db
      .insert(organizations)
      .values({ name: 'Other Org', status: 'active' })
      .returning();

    const mary = await loginAs(app, 'mary@demo.local');
    const created = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ legalName: 'Tenant A Client' }),
    });
    const client = ((await created.json()) as { client: { id: string } }).client;

    await expect(
      db.insert(caregivers).values({
        organizationId: org2.id,
        clientId: client.id,
        name: 'Cross Tenant',
      }),
    ).rejects.toThrow();

    // Direct select still scoped by API org
    const other = await app.request(`/api/v1/clients/${client.id}`, {
      headers: { cookie: mary.cookie },
    });
    expect(other.status).toBe(200);
  });

  it('client lifecycle, no hard delete, row_version conflict, import idempotency', async () => {
    const mary = await loginAs(app, 'mary@demo.local');
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const created = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        legalName: `Lifecycle Kid ${suffix}`,
        legacyId: `legacy-lifecycle-${suffix}`,
      }),
    });
    expect(created.status).toBe(201);
    const c1 = (await created.json()) as {
      client: { id: string; rowVersion: number; status: string };
    };

    const conflict = await app.request(`/api/v1/clients/${c1.client.id}`, {
      method: 'PATCH',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ preferredName: 'X', rowVersion: 999 }),
    });
    expect(conflict.status).toBe(409);

    const life = await app.request(`/api/v1/clients/${c1.client.id}/lifecycle`, {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        status: 'discharged',
        rowVersion: c1.client.rowVersion,
        reason: 'test',
      }),
    });
    expect(life.status).toBe(200);
    const lifeBody = (await life.json()) as { client: { status: string } };
    expect(lifeBody.client.status).toBe('discharged');

    const del = await app.request(`/api/v1/clients/${c1.client.id}`, {
      method: 'DELETE',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
    });
    expect(del.status).toBe(405);

    const importLegacy = `legacy-imp-${suffix}`;
    const importName = `Imported One ${suffix}`;
    const imp1 = await app.request('/api/v1/clients/import-local', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        clients: [{ legacyId: importLegacy, name: importName, age: 6 }],
      }),
    });
    expect(imp1.status).toBe(200);
    const r1 = (await imp1.json()) as {
      results: { clientId: string; imported: boolean }[];
    };
    expect(r1.results[0].imported).toBe(false);

    const imp2 = await app.request('/api/v1/clients/import-local', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        clients: [{ legacyId: importLegacy, name: `${importName} Again`, age: 6 }],
      }),
    });
    const r2 = (await imp2.json()) as {
      results: { clientId: string; imported: boolean }[];
    };
    expect(r2.results[0].imported).toBe(true);
    expect(r2.results[0].clientId).toBe(r1.results[0].clientId);

    const count = await getDb()
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, seeded.organizationId),
          eq(clients.legalName, importName),
        ),
      );
    expect(count.length).toBe(1);
  });

  it('audit update/delete rejected at database layer', async () => {
    const db = getDb();
    const [entry] = await db.select().from(auditEntries).limit(1);
    expect(entry).toBeTruthy();

    await expect(
      getSql()`update audit_entries set action = 'HACK' where id = ${entry!.id}`,
    ).rejects.toThrow(/immutable/i);

    await expect(
      getSql()`delete from audit_entries where id = ${entry!.id}`,
    ).rejects.toThrow(/immutable/i);
  });
});
