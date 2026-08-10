import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getDb, closeDb } from '../src/db/client.js';
import {
  auditEntries,
  clients,
  clientAssignments,
  credentialDefinitions,
  functionGrants,
  operationalFunctions,
  organizationMemberships,
  userCredentials,
  userIdentities,
} from '../src/db/schema/index.js';
import { assertCapability, loadAuthzContext } from '../src/modules/authz/authorize.js';
import { Capabilities } from '../src/modules/authz/capabilities.js';
import { resolveClinicalCeiling } from '../src/modules/authz/ceiling.js';
import { Verbs } from '../src/modules/authz/verbs.js';
import { hashPassword } from '../src/shared/crypto.js';
import { authedHeaders, loginAs, seedAndApp } from './helpers.js';

describe('Wave 1.1 hardening', () => {
  let app: Awaited<ReturnType<typeof seedAndApp>>['app'];
  let seeded: Awaited<ReturnType<typeof seedAndApp>>['seeded'];

  beforeAll(async () => {
    ({ app, seeded } = await seedAndApp());
  });

  afterAll(async () => {
    await closeDb();
  });

  it('login returns clinicalCeiling + functions; Mary is NONE not BCBA', async () => {
    const mary = await loginAs(app, 'mary@demo.local');
    expect(mary.res.status).toBe(200);
    expect(mary.body.clinicalCeiling).toBe('NONE');
    expect(Array.isArray((mary.body as { functions?: unknown }).functions)).toBe(true);
    expect(mary.body.clinicalCeiling).not.toBe('BCBA');

    const bcaba = await loginAs(app, 'bcaba@demo.local');
    expect(bcaba.body.clinicalCeiling).toBe('BCABA');
    expect(bcaba.body.clinicalCeiling).not.toBe('BCBA');

    const bcba = await loginAs(app, 'bcba.owner@demo.local');
    expect(bcba.body.clinicalCeiling).toBe('BCBA');
  });

  it('Mary clinical deny; BCaBA review deny', async () => {
    const mary = await loadAuthzContext(
      seeded.users.mary.id,
      seeded.organizationId,
      's',
      { email: 'mary@demo.local', displayName: 'Mary' },
    );
    await expect(
      assertCapability({
        ctx: mary,
        capability: Capabilities.CLIENTS_CREATE,
        clinicalVerb: Verbs.CLINICAL_AUTHOR,
      }),
    ).rejects.toMatchObject({ code: 'CLINICAL_CEILING_DENIED' });

    const bcaba = await loadAuthzContext(
      seeded.users.bcaba.id,
      seeded.organizationId,
      's2',
      { email: 'bcaba@demo.local', displayName: 'BCaBA' },
    );
    const withSupervision = {
      ...bcaba,
      grants: [
        ...bcaba.grants,
        { code: 'clinical_supervision', scopeMode: 'ORGANIZATION' as const },
      ],
      functionCodes: [...bcaba.functionCodes, 'clinical_supervision'],
    };
    await expect(
      assertCapability({
        ctx: withSupervision,
        capability: Capabilities.CLIENTS_VIEW,
        clinicalVerb: Verbs.CLINICAL_REVIEW,
      }),
    ).rejects.toMatchObject({ code: 'CLINICAL_CEILING_DENIED' });
  });

  it('fake/custom BCBA code cannot create BCBA Ceiling', async () => {
    const db = getDb();
    const [fakeDef] = await db
      .insert(credentialDefinitions)
      .values({
        organizationId: seeded.organizationId,
        code: 'SUPER_BCBA',
        name: 'Fake',
        clinicalAuthority: 'NONE',
      })
      .returning();

    await db.insert(userCredentials).values({
      organizationId: seeded.organizationId,
      userId: seeded.users.mary.id,
      credentialDefinitionId: fakeDef.id,
      status: 'active',
      effectiveOn: '2020-01-01',
      expiresOn: '2030-01-01',
    });

    const ceiling = await resolveClinicalCeiling(
      seeded.organizationId,
      seeded.users.mary.id,
    );
    expect(ceiling).toBe('NONE');

    await db.delete(userCredentials).where(eq(userCredentials.userId, seeded.users.mary.id));
    await db.delete(credentialDefinitions).where(eq(credentialDefinitions.id, fakeDef.id));
  });

  it('future BCBA credential does not raise Ceiling', async () => {
    const db = getDb();
    const [def] = await db
      .select()
      .from(credentialDefinitions)
      .where(
        and(
          eq(credentialDefinitions.organizationId, seeded.organizationId),
          eq(credentialDefinitions.code, 'BCBA'),
        ),
      )
      .limit(1);

    await db.insert(userCredentials).values({
      organizationId: seeded.organizationId,
      userId: seeded.users.mary.id,
      credentialDefinitionId: def.id,
      status: 'active',
      effectiveOn: '2099-01-01',
      expiresOn: '2100-01-01',
    });

    expect(
      await resolveClinicalCeiling(seeded.organizationId, seeded.users.mary.id),
    ).toBe('NONE');

    await db.delete(userCredentials).where(eq(userCredentials.userId, seeded.users.mary.id));
  });

  it('future FunctionGrant does not activate early', async () => {
    const db = getDb();
    const [fn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, 'org_admin'))
      .limit(1);
    const [mem] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, seeded.organizationId),
          eq(organizationMemberships.userId, seeded.users.rbt.id),
        ),
      )
      .limit(1);

    const [grant] = await db
      .insert(functionGrants)
      .values({
        organizationId: seeded.organizationId,
        membershipId: mem.id,
        functionId: fn.id,
        scopeMode: 'ORGANIZATION',
        effectiveFrom: new Date('2099-01-01T00:00:00Z'),
      })
      .returning();

    const ctx = await loadAuthzContext(
      seeded.users.rbt.id,
      seeded.organizationId,
      's3',
      { email: 'rbt@demo.local', displayName: 'RBT' },
    );
    expect(ctx.functionCodes.includes('org_admin')).toBe(false);

    await db.delete(functionGrants).where(eq(functionGrants.id, grant.id));
  });

  it('expired/suspended credential denied for Ceiling', async () => {
    const db = getDb();
    const [def] = await db
      .select()
      .from(credentialDefinitions)
      .where(
        and(
          eq(credentialDefinitions.organizationId, seeded.organizationId),
          eq(credentialDefinitions.code, 'BCBA'),
        ),
      )
      .limit(1);

    await db.insert(userCredentials).values({
      organizationId: seeded.organizationId,
      userId: seeded.users.mary.id,
      credentialDefinitionId: def.id,
      status: 'suspended',
      effectiveOn: '2020-01-01',
      expiresOn: '2030-01-01',
    });
    expect(
      await resolveClinicalCeiling(seeded.organizationId, seeded.users.mary.id),
    ).toBe('NONE');
    await db.delete(userCredentials).where(eq(userCredentials.userId, seeded.users.mary.id));

    await db.insert(userCredentials).values({
      organizationId: seeded.organizationId,
      userId: seeded.users.mary.id,
      credentialDefinitionId: def.id,
      status: 'active',
      effectiveOn: '2020-01-01',
      expiresOn: '2020-06-01',
    });
    expect(
      await resolveClinicalCeiling(seeded.organizationId, seeded.users.mary.id),
    ).toBe('NONE');
    await db.delete(userCredentials).where(eq(userCredentials.userId, seeded.users.mary.id));
  });

  it('Scheduling-only cannot create Client; Billing-only cannot manage Staff; Payroll cannot manage Credentials', async () => {
    const db = getDb();
    const password = 'DevOnlyPass123!';
    const [user] = await db
      .insert(userIdentities)
      .values({
        email: `sched-only-${Date.now()}@demo.local`,
        displayName: 'Sched Only',
        passwordHash: await hashPassword(password),
        status: 'active',
      })
      .returning();
    const [mem] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: seeded.organizationId,
        userId: user.id,
        employmentType: 'employee',
        status: 'active',
      })
      .returning();
    const [schedFn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, 'scheduling'))
      .limit(1);
    await db.insert(functionGrants).values({
      organizationId: seeded.organizationId,
      membershipId: mem.id,
      functionId: schedFn.id,
      scopeMode: 'ORGANIZATION',
    });

    const login = await loginAs(app, user.email, password);
    const create = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(login.cookie, login.csrfToken),
      body: JSON.stringify({ legalName: 'Nope' }),
    });
    expect(create.status).toBe(403);

    // Billing-only staff deny
    const [billUser] = await db
      .insert(userIdentities)
      .values({
        email: `bill-only-${Date.now()}@demo.local`,
        displayName: 'Bill Only',
        passwordHash: await hashPassword(password),
        status: 'active',
      })
      .returning();
    const [billMem] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: seeded.organizationId,
        userId: billUser.id,
        employmentType: 'employee',
        status: 'active',
      })
      .returning();
    const [billFn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, 'billing'))
      .limit(1);
    await db.insert(functionGrants).values({
      organizationId: seeded.organizationId,
      membershipId: billMem.id,
      functionId: billFn.id,
      scopeMode: 'ORGANIZATION',
    });
    const billLogin = await loginAs(app, billUser.email, password);
    const staff = await app.request('/api/v1/staff', {
      headers: { cookie: billLogin.cookie },
    });
    expect(staff.status).toBe(403);

    // Payroll-only cannot manage credentials
    const [payUser] = await db
      .insert(userIdentities)
      .values({
        email: `pay-only-${Date.now()}@demo.local`,
        displayName: 'Pay Only',
        passwordHash: await hashPassword(password),
        status: 'active',
      })
      .returning();
    const [payMem] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: seeded.organizationId,
        userId: payUser.id,
        employmentType: 'employee',
        status: 'active',
      })
      .returning();
    const [payFn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, 'payroll'))
      .limit(1);
    await db.insert(functionGrants).values({
      organizationId: seeded.organizationId,
      membershipId: payMem.id,
      functionId: payFn.id,
      scopeMode: 'ORGANIZATION',
    });
    const payLogin = await loginAs(app, payUser.email, password);
    // can view staff
    const payStaff = await app.request('/api/v1/staff', {
      headers: { cookie: payLogin.cookie },
    });
    expect(payStaff.status).toBe(200);
    const mary = await loginAs(app, 'mary@demo.local');
    const staffList = (await (
      await app.request('/api/v1/staff', { headers: { cookie: mary.cookie } })
    ).json()) as { staff: { membershipId: string }[] };
    const target = staffList.staff[0].membershipId;
    const cred = await app.request(`/api/v1/staff/${target}/credentials`, {
      method: 'POST',
      headers: authedHeaders(payLogin.cookie, payLogin.csrfToken),
      body: JSON.stringify({ credentialCode: 'FAKE', status: 'active' }),
    });
    expect(cred.status).toBe(403);
  });

  it('Reporting ORGANIZATION grant does not widen ASSIGNED_CLIENTS clinical scope', async () => {
    const ctx = await loadAuthzContext(
      seeded.users.rbt.id,
      seeded.organizationId,
      's4',
      { email: 'rbt@demo.local', displayName: 'RBT' },
    );
    // Simulate reporting ORGANIZATION + clinical_delivery ASSIGNED
    const hybrid = {
      ...ctx,
      grants: [
        { code: 'reporting', scopeMode: 'ORGANIZATION' },
        { code: 'clinical_delivery', scopeMode: 'ASSIGNED_CLIENTS' },
      ],
      functionCodes: ['reporting', 'clinical_delivery'],
    };
    // clients.view matching grants include both — org scope from reporting is OK for view
    await expect(
      assertCapability({
        ctx: hybrid,
        capability: Capabilities.CLIENTS_VIEW,
        allowUnscopedList: true,
      }),
    ).resolves.toBe(true);

    // But clients.create must NOT be allowed via reporting
    await expect(
      assertCapability({ ctx: hybrid, capability: Capabilities.CLIENTS_CREATE }),
    ).rejects.toMatchObject({ code: 'CAPABILITY_DENIED' });
  });

  it('atomic row_version conflict: second update with stale version gets 409', async () => {
    const mary = await loginAs(app, 'mary@demo.local');
    const created = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ legalName: `Concurrency ${Date.now()}` }),
    });
    const c = (await created.json()) as { client: { id: string; rowVersion: number } };
    expect(created.status).toBe(201);

    const first = await app.request(`/api/v1/clients/${c.client.id}`, {
      method: 'PATCH',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ preferredName: 'A', rowVersion: c.client.rowVersion }),
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/v1/clients/${c.client.id}`, {
      method: 'PATCH',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ preferredName: 'B', rowVersion: c.client.rowVersion }),
    });
    expect(second.status).toBe(409);
  });

  it('duplicate open FunctionGrant and ClientAssignment rejected; membership user mismatch rejected', async () => {
    const db = getDb();
    const [mem] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, seeded.organizationId),
          eq(organizationMemberships.userId, seeded.users.rbt.id),
        ),
      )
      .limit(1);
    const [fn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, 'clinical_delivery'))
      .limit(1);

    await expect(
      db.insert(functionGrants).values({
        organizationId: seeded.organizationId,
        membershipId: mem.id,
        functionId: fn.id,
        scopeMode: 'ASSIGNED_CLIENTS',
      }),
    ).rejects.toThrow();

    const mary = await loginAs(app, 'mary@demo.local');
    const created = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ legalName: `Assign ${Date.now()}` }),
    });
    const client = (await created.json()) as { client: { id: string } };

    const [a1] = await db
      .insert(clientAssignments)
      .values({
        organizationId: seeded.organizationId,
        clientId: client.client.id,
        userId: seeded.users.rbt.id,
        membershipId: mem.id,
        assignmentType: 'caseload',
        status: 'active',
      })
      .returning();
    expect(a1).toBeTruthy();

    await expect(
      db.insert(clientAssignments).values({
        organizationId: seeded.organizationId,
        clientId: client.client.id,
        userId: seeded.users.rbt.id,
        membershipId: mem.id,
        assignmentType: 'caseload',
        status: 'active',
      }),
    ).rejects.toThrow();

    // user/membership mismatch
    await expect(
      db.insert(clientAssignments).values({
        organizationId: seeded.organizationId,
        clientId: client.client.id,
        userId: seeded.users.mary.id, // wrong user for rbt membership
        membershipId: mem.id,
        assignmentType: 'secondary',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('avatar data-url rejected; inactive client retrievable; reactivation audited', async () => {
    const mary = await loginAs(app, 'mary@demo.local');
    const bad = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        legalName: 'Photo Kid',
        avatar: 'data:image/png;base64,AAAA',
      }),
    });
    expect(bad.status).toBe(400);

    const created = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ legalName: `Life ${Date.now()}`, avatar: 'LK' }),
    });
    const c = (await created.json()) as { client: { id: string; rowVersion: number } };

    const life = await app.request(`/api/v1/clients/${c.client.id}/lifecycle`, {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({ status: 'inactive', rowVersion: c.client.rowVersion }),
    });
    expect(life.status).toBe(200);
    const afterLife = (await life.json()) as { client: { rowVersion: number; status: string } };
    expect(afterLife.client.status).toBe('inactive');

    const list = await app.request('/api/v1/clients', {
      headers: { cookie: mary.cookie },
    });
    const body = (await list.json()) as { clients: { id: string; status: string }[] };
    expect(body.clients.some((x) => x.id === c.client.id && x.status === 'inactive')).toBe(
      true,
    );

    const react = await app.request(`/api/v1/clients/${c.client.id}/lifecycle`, {
      method: 'POST',
      headers: authedHeaders(mary.cookie, mary.csrfToken),
      body: JSON.stringify({
        status: 'active',
        rowVersion: afterLife.client.rowVersion,
        reason: 'reactivate-test',
      }),
    });
    expect(react.status).toBe(200);

    const audits = await getDb()
      .select()
      .from(auditEntries)
      .where(
        and(eq(auditEntries.entityType, 'client'), eq(auditEntries.entityId, c.client.id)),
      );
    expect(audits.some((a) => a.action === 'LIFECYCLE')).toBe(true);
  });
});
