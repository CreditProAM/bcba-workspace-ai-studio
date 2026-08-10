/**
 * Development/test seed: Organization + Mary + BCBA Owner + RBT + BCaBA.
 * Passwords from DEV_SEED_PASSWORD env — never commit real secrets.
 */
import { and, eq } from 'drizzle-orm';
import { getEnv } from '../config/env.js';
import { hashPassword, normalizeEmail } from '../shared/crypto.js';
import { getDb } from './client.js';
import {
  credentialDefinitions,
  functionGrants,
  operationalFunctions,
  organizationMemberships,
  organizations,
  userCredentials,
  userIdentities,
} from './schema/index.js';

const MARY_FUNCS = [
  'scheduling',
  'intake',
  'insurance_pa',
  'billing',
  'hr_credentialing',
  'payroll',
  'reporting',
] as const;

const BCBA_OWNER_FUNCS = [
  'org_admin',
  ...MARY_FUNCS,
  'clinical_delivery',
  'clinical_supervision',
] as const;

async function ensureUser(email: string, name: string, password: string) {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const [existing] = await db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.email, normalized))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(userIdentities)
    .values({
      email: normalized,
      displayName: name,
      passwordHash: await hashPassword(password),
      status: 'active',
    })
    .returning();
  return created;
}

async function ensureMembership(
  orgId: string,
  userId: string,
  employmentType: 'employee' | 'contractor',
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.status !== 'active') {
      const [reactivated] = await db
        .update(organizationMemberships)
        .set({
          status: 'active',
          terminatedAt: null,
          employmentType,
          updatedAt: new Date(),
        })
        .where(eq(organizationMemberships.id, existing.id))
        .returning();
      return reactivated;
    }
    return existing;
  }
  const [created] = await db
    .insert(organizationMemberships)
    .values({
      organizationId: orgId,
      userId,
      employmentType,
      status: 'active',
    })
    .returning();
  return created;
}

async function grantFunctions(
  orgId: string,
  membershipId: string,
  codes: readonly string[],
  scopeMode: 'ORGANIZATION' | 'ASSIGNED_CLIENTS',
) {
  const db = getDb();
  const existing = await db
    .select()
    .from(functionGrants)
    .where(
      and(
        eq(functionGrants.organizationId, orgId),
        eq(functionGrants.membershipId, membershipId),
      ),
    );

  for (const code of codes) {
    const [fn] = await db
      .select()
      .from(operationalFunctions)
      .where(eq(operationalFunctions.code, code))
      .limit(1);
    if (!fn) continue;
    if (existing.some((g) => g.functionId === fn.id)) continue;
    await db.insert(functionGrants).values({
      organizationId: orgId,
      membershipId,
      functionId: fn.id,
      scopeMode,
    });
  }
}

async function ensureCredentialDef(orgId: string, code: string, name: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(credentialDefinitions)
    .where(eq(credentialDefinitions.organizationId, orgId));
  const found = rows.find((r) => r.code === code);
  if (found) return found;
  const [created] = await db
    .insert(credentialDefinitions)
    .values({ organizationId: orgId, code, name })
    .returning();
  return created;
}

export async function seedDevPersonas() {
  const env = getEnv();
  const db = getDb();
  const password = env.DEV_SEED_PASSWORD;

  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({ name: 'Demo ABA Clinic', status: 'active' })
      .returning();
  }

  const mary = await ensureUser('mary@demo.local', 'Mary Operations', password);
  const bcba = await ensureUser('bcba.owner@demo.local', 'BCBA Owner', password);
  const rbt = await ensureUser('rbt@demo.local', 'RBT Clinician', password);
  const bcaba = await ensureUser('bcaba@demo.local', 'BCaBA Clinician', password);

  const maryMem = await ensureMembership(org.id, mary.id, 'employee');
  const bcbaMem = await ensureMembership(org.id, bcba.id, 'employee');
  const rbtMem = await ensureMembership(org.id, rbt.id, 'employee');
  const bcabaMem = await ensureMembership(org.id, bcaba.id, 'contractor');

  await grantFunctions(org.id, maryMem.id, MARY_FUNCS, 'ORGANIZATION');
  await grantFunctions(org.id, bcbaMem.id, BCBA_OWNER_FUNCS, 'ORGANIZATION');
  await grantFunctions(org.id, rbtMem.id, ['clinical_delivery'], 'ASSIGNED_CLIENTS');
  await grantFunctions(org.id, bcabaMem.id, ['clinical_delivery'], 'ASSIGNED_CLIENTS');

  const bcbaDef = await ensureCredentialDef(org.id, 'BCBA', 'Board Certified Behavior Analyst');
  const rbtDef = await ensureCredentialDef(org.id, 'RBT', 'Registered Behavior Technician');
  const bcabaDef = await ensureCredentialDef(
    org.id,
    'BCaBA',
    'Board Certified Assistant Behavior Analyst',
  );

  // Reset org credentials for idempotent seed of known personas
  await db.delete(userCredentials).where(eq(userCredentials.organizationId, org.id));
  await db.insert(userCredentials).values([
    {
      organizationId: org.id,
      userId: bcba.id,
      credentialDefinitionId: bcbaDef.id,
      number: 'BCBA-DEV-1',
      issuingBody: 'BACB',
      status: 'active',
      effectiveOn: '2020-01-01',
      expiresOn: '2030-01-01',
    },
    {
      organizationId: org.id,
      userId: rbt.id,
      credentialDefinitionId: rbtDef.id,
      number: 'RBT-DEV-1',
      issuingBody: 'BACB',
      status: 'active',
      effectiveOn: '2020-01-01',
      expiresOn: '2030-01-01',
    },
    {
      organizationId: org.id,
      userId: bcaba.id,
      credentialDefinitionId: bcabaDef.id,
      number: 'BCABA-DEV-1',
      issuingBody: 'BACB',
      status: 'active',
      effectiveOn: '2020-01-01',
      expiresOn: '2030-01-01',
    },
  ]);

  return {
    organizationId: org.id,
    password,
    users: {
      mary: { id: mary.id, email: mary.email },
      bcbaOwner: { id: bcba.id, email: bcba.email },
      rbt: { id: rbt.id, email: rbt.email },
      bcaba: { id: bcaba.id, email: bcaba.email },
    },
  };
}
