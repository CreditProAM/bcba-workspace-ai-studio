import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import {
  clientAssignments,
  credentialDefinitions,
  functionGrants,
  operationalFunctions,
  organizationMemberships,
  userCredentials,
  userIdentities,
} from '../../db/schema/index.js';
import {
  csrfGuardMiddleware,
  optionalSessionMiddleware,
  requireAuthMiddleware,
} from '../../middleware/authContext.js';
import { hashPassword, normalizeEmail } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';
import { updateWithRowVersion } from '../../shared/optimistic.js';
import { revokeAllSessionsForUser } from '../auth/sessionService.js';
import { authorizeCapability } from '../authz/authorize.js';
import { Capabilities } from '../authz/capabilities.js';
import { writeAuditEntry } from '../platform/audit.js';

export const staffRoutes = new Hono();
staffRoutes.use('*', optionalSessionMiddleware);
staffRoutes.use('*', requireAuthMiddleware);

staffRoutes.get('/staff', async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.STAFF_VIEW });

  const db = getDb();
  const rows = await db
    .select({
      membership: organizationMemberships,
      user: userIdentities,
    })
    .from(organizationMemberships)
    .innerJoin(userIdentities, eq(userIdentities.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.organizationId, auth.organizationId));

  return c.json({
    staff: rows.map((r) => ({
      membershipId: r.membership.id,
      userId: r.user.id,
      email: r.user.email,
      name: r.user.displayName,
      employmentType: r.membership.employmentType,
      status: r.membership.status,
      jobTitle: r.membership.jobTitle,
      hireDate: r.membership.hireDate,
      terminatedAt: r.membership.terminatedAt,
      rowVersion: r.membership.rowVersion,
    })),
  });
});

staffRoutes.get('/staff/:membershipId', async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.STAFF_VIEW });
  const membershipId = c.req.param('membershipId');
  const db = getDb();
  const [row] = await db
    .select({
      membership: organizationMemberships,
      user: userIdentities,
    })
    .from(organizationMemberships)
    .innerJoin(userIdentities, eq(userIdentities.id, organizationMemberships.userId))
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Staff membership not found.');

  const grants = await db
    .select({
      id: functionGrants.id,
      code: operationalFunctions.code,
      name: operationalFunctions.name,
      scopeMode: functionGrants.scopeMode,
      effectiveFrom: functionGrants.effectiveFrom,
      effectiveTo: functionGrants.effectiveTo,
    })
    .from(functionGrants)
    .innerJoin(operationalFunctions, eq(operationalFunctions.id, functionGrants.functionId))
    .where(
      and(
        eq(functionGrants.organizationId, auth.organizationId),
        eq(functionGrants.membershipId, membershipId),
      ),
    );

  const credentials = await db
    .select({
      id: userCredentials.id,
      number: userCredentials.number,
      issuingBody: userCredentials.issuingBody,
      status: userCredentials.status,
      effectiveOn: userCredentials.effectiveOn,
      expiresOn: userCredentials.expiresOn,
      code: credentialDefinitions.code,
      name: credentialDefinitions.name,
      rowVersion: userCredentials.rowVersion,
    })
    .from(userCredentials)
    .innerJoin(
      credentialDefinitions,
      eq(credentialDefinitions.id, userCredentials.credentialDefinitionId),
    )
    .where(
      and(
        eq(userCredentials.organizationId, auth.organizationId),
        eq(userCredentials.userId, row.user.id),
      ),
    );

  const assignments = await db
    .select()
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.organizationId, auth.organizationId),
        eq(clientAssignments.membershipId, membershipId),
      ),
    );

  return c.json({
    staff: {
      membershipId: row.membership.id,
      userId: row.user.id,
      email: row.user.email,
      name: row.user.displayName,
      employmentType: row.membership.employmentType,
      status: row.membership.status,
      jobTitle: row.membership.jobTitle,
      hireDate: row.membership.hireDate,
      terminatedAt: row.membership.terminatedAt,
      rowVersion: row.membership.rowVersion,
    },
    functions: grants,
    credentials,
    assignments,
  });
});

staffRoutes.post('/staff', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.STAFF_EDIT });

  const body = z
    .object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8),
      employmentType: z.enum(['employee', 'contractor']),
      jobTitle: z.string().optional(),
    })
    .parse(await c.req.json());

  const db = getDb();
  const email = normalizeEmail(body.email);
  let [user] = await db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.email, email))
    .limit(1);
  if (!user) {
    [user] = await db
      .insert(userIdentities)
      .values({
        email,
        displayName: body.name,
        passwordHash: await hashPassword(body.password),
        status: 'active',
      })
      .returning();
  }

  const [membership] = await db
    .insert(organizationMemberships)
    .values({
      organizationId: auth.organizationId,
      userId: user.id,
      employmentType: body.employmentType,
      jobTitle: body.jobTitle,
      status: 'active',
    })
    .returning();

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'organization_membership',
    entityId: membership.id,
    action: 'CREATE',
    afterJson: { userId: user.id, email, employmentType: body.employmentType },
  });

  return c.json(
    {
      staff: {
        membershipId: membership.id,
        userId: user.id,
        email: user.email,
        name: user.displayName,
        employmentType: membership.employmentType,
        status: membership.status,
        rowVersion: membership.rowVersion,
      },
    },
    201,
  );
});

staffRoutes.patch('/staff/:membershipId', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.STAFF_EDIT });

  const membershipId = c.req.param('membershipId');
  const body = z
    .object({
      employmentType: z.enum(['employee', 'contractor']).optional(),
      jobTitle: z.string().nullable().optional(),
      rowVersion: z.number().int(),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [existing] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Staff membership not found.');

  const row = await updateWithRowVersion(organizationMemberships, {
    organizationId: auth.organizationId,
    id: membershipId,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Staff membership not found.',
    set: {
      employmentType: body.employmentType ?? existing.employmentType,
      jobTitle: body.jobTitle !== undefined ? body.jobTitle : existing.jobTitle,
      updatedAt: new Date(),
    },
  });

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'organization_membership',
    entityId: membershipId,
    action: 'UPDATE',
    beforeJson: { employmentType: existing.employmentType, jobTitle: existing.jobTitle },
    afterJson: { employmentType: row.employmentType, jobTitle: row.jobTitle },
  });

  return c.json({ membership: row });
});

staffRoutes.post('/staff/:membershipId/lifecycle', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.STAFF_LIFECYCLE });

  const membershipId = c.req.param('membershipId');
  const body = z
    .object({
      status: z.enum(['active', 'inactive', 'terminated']),
      rowVersion: z.number().int(),
      reason: z.string().optional(),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [existing] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Staff membership not found.');

  const row = await updateWithRowVersion(organizationMemberships, {
    organizationId: auth.organizationId,
    id: membershipId,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Staff membership not found.',
    set: {
      status: body.status,
      terminatedAt: body.status === 'terminated' ? new Date() : existing.terminatedAt,
      updatedAt: new Date(),
    },
  });

  if (body.status === 'terminated') {
    await revokeAllSessionsForUser(existing.userId, auth.organizationId);
  }

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'organization_membership',
    entityId: membershipId,
    action: 'LIFECYCLE',
    beforeJson: { status: existing.status },
    afterJson: { status: row.status },
    reason: body.reason ?? null,
  });

  return c.json({ membership: row });
});

staffRoutes.post('/staff/:membershipId/functions', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.FUNCTIONS_MANAGE });

  const membershipId = c.req.param('membershipId');
  const body = z
    .object({
      functionCode: z.string().min(1),
      scopeMode: z.enum(['ORGANIZATION', 'ASSIGNED_CLIENTS']),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  if (!membership) throw new AppError(404, 'NOT_FOUND', 'Staff membership not found.');

  const [fn] = await db
    .select()
    .from(operationalFunctions)
    .where(eq(operationalFunctions.code, body.functionCode))
    .limit(1);
  if (!fn) throw new AppError(400, 'UNKNOWN_FUNCTION', 'Unknown operational function.');

  const [grant] = await db
    .insert(functionGrants)
    .values({
      organizationId: auth.organizationId,
      membershipId,
      functionId: fn.id,
      scopeMode: body.scopeMode,
    })
    .returning();

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'function_grant',
    entityId: grant.id,
    action: 'GRANT',
    afterJson: { functionCode: body.functionCode, scopeMode: body.scopeMode, membershipId },
  });

  return c.json({ grant }, 201);
});

staffRoutes.post('/staff/:membershipId/functions/:grantId/revoke', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.FUNCTIONS_MANAGE });

  const membershipId = c.req.param('membershipId');
  const grantId = c.req.param('grantId');
  const db = getDb();
  const [grant] = await db
    .update(functionGrants)
    .set({ effectiveTo: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(functionGrants.organizationId, auth.organizationId),
        eq(functionGrants.membershipId, membershipId),
        eq(functionGrants.id, grantId),
        or(isNull(functionGrants.effectiveTo), gt(functionGrants.effectiveTo, new Date())),
      ),
    )
    .returning();
  if (!grant) throw new AppError(404, 'NOT_FOUND', 'Grant not found.');

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'function_grant',
    entityId: grantId,
    action: 'REVOKE',
  });

  return c.json({ grant });
});

staffRoutes.post('/staff/:membershipId/credentials', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.CREDENTIALS_MANAGE });

  const membershipId = c.req.param('membershipId');
  const body = z
    .object({
      credentialCode: z.string().min(1),
      number: z.string().optional(),
      issuingBody: z.string().optional(),
      effectiveOn: z.string().optional(),
      expiresOn: z.string().optional(),
      status: z.enum(['active', 'expired', 'suspended', 'revoked']).default('active'),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  if (!membership) throw new AppError(404, 'NOT_FOUND', 'Staff membership not found.');

  let [def] = await db
    .select()
    .from(credentialDefinitions)
    .where(
      and(
        eq(credentialDefinitions.organizationId, auth.organizationId),
        eq(credentialDefinitions.code, body.credentialCode),
      ),
    )
    .limit(1);
  if (!def) {
    [def] = await db
      .insert(credentialDefinitions)
      .values({
        organizationId: auth.organizationId,
        code: body.credentialCode,
        name: body.credentialCode,
        clinicalAuthority: 'NONE',
      })
      .returning();
  }

  const [cred] = await db
    .insert(userCredentials)
    .values({
      organizationId: auth.organizationId,
      userId: membership.userId,
      credentialDefinitionId: def.id,
      number: body.number,
      issuingBody: body.issuingBody,
      effectiveOn: body.effectiveOn,
      expiresOn: body.expiresOn,
      status: body.status,
    })
    .returning();

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'user_credential',
    entityId: cred.id,
    action: 'CREATE',
    afterJson: {
      credentialCode: body.credentialCode,
      status: body.status,
      expiresOn: body.expiresOn ?? null,
    },
  });

  return c.json({ credential: cred }, 201);
});

staffRoutes.patch('/credentials/:credentialId', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.CREDENTIALS_MANAGE });

  const credentialId = c.req.param('credentialId');
  const body = z
    .object({
      number: z.string().optional(),
      issuingBody: z.string().optional(),
      effectiveOn: z.string().nullable().optional(),
      expiresOn: z.string().nullable().optional(),
      status: z.enum(['active', 'expired', 'suspended', 'revoked']).optional(),
      rowVersion: z.number().int(),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [existing] = await db
    .select()
    .from(userCredentials)
    .where(
      and(
        eq(userCredentials.organizationId, auth.organizationId),
        eq(userCredentials.id, credentialId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Credential not found.');

  const cred = await updateWithRowVersion(userCredentials, {
    organizationId: auth.organizationId,
    id: credentialId,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Credential not found.',
    set: {
      number: body.number ?? existing.number,
      issuingBody: body.issuingBody ?? existing.issuingBody,
      effectiveOn:
        body.effectiveOn !== undefined ? body.effectiveOn : existing.effectiveOn,
      expiresOn: body.expiresOn !== undefined ? body.expiresOn : existing.expiresOn,
      status: body.status ?? existing.status,
      updatedAt: new Date(),
    },
  });

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'user_credential',
    entityId: credentialId,
    action: 'UPDATE',
    beforeJson: { status: existing.status, expiresOn: existing.expiresOn },
    afterJson: { status: cred.status, expiresOn: cred.expiresOn },
  });

  return c.json({ credential: cred });
});

staffRoutes.post('/assignments', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.ASSIGNMENTS_MANAGE });

  const body = z
    .object({
      clientId: z.string().uuid(),
      membershipId: z.string().uuid(),
      assignmentType: z.string().default('caseload'),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, auth.organizationId),
        eq(organizationMemberships.id, body.membershipId),
      ),
    )
    .limit(1);
  if (!membership) throw new AppError(404, 'NOT_FOUND', 'Membership not found.');

  const [assignment] = await db
    .insert(clientAssignments)
    .values({
      organizationId: auth.organizationId,
      clientId: body.clientId,
      userId: membership.userId,
      membershipId: body.membershipId,
      assignmentType: body.assignmentType,
      status: 'active',
    })
    .returning();

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'client_assignment',
    entityId: assignment.id,
    action: 'CREATE',
    afterJson: { clientId: body.clientId, membershipId: body.membershipId },
  });

  return c.json({ assignment }, 201);
});

staffRoutes.post('/assignments/:id/end', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.ASSIGNMENTS_MANAGE });
  const id = c.req.param('id');
  const body = z.object({ rowVersion: z.number().int() }).parse(await c.req.json());

  const db = getDb();
  const [existing] = await db
    .select()
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.organizationId, auth.organizationId),
        eq(clientAssignments.id, id),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Assignment not found.');

  const assignment = await updateWithRowVersion(clientAssignments, {
    organizationId: auth.organizationId,
    id,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Assignment not found.',
    set: {
      status: 'ended',
      effectiveTo: new Date(),
      updatedAt: new Date(),
    },
  });

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'client_assignment',
    entityId: id,
    action: 'END',
  });

  return c.json({ assignment });
});
