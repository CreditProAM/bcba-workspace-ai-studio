import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { caregivers, clientAssignments, clients } from '../../db/schema/index.js';
import {
  csrfGuardMiddleware,
  optionalSessionMiddleware,
  requireAuthMiddleware,
} from '../../middleware/authContext.js';
import { AppError } from '../../shared/errors.js';
import { assertSafeAvatar } from '../../shared/avatar.js';
import { updateWithRowVersion } from '../../shared/optimistic.js';
import { authorizeCapability } from '../authz/authorize.js';
import { Capabilities, grantsForCapability } from '../authz/capabilities.js';
import { writeAuditEntry } from '../platform/audit.js';
import { createOrImportClient, mapClient } from './service.js';

export const clientRoutes = new Hono();
clientRoutes.use('*', optionalSessionMiddleware);
clientRoutes.use('*', requireAuthMiddleware);

clientRoutes.get('/clients', async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({
    ctx: auth,
    capability: Capabilities.CLIENTS_VIEW,
    allowUnscopedList: true,
  });

  const db = getDb();
  const matching = grantsForCapability(auth.grants, Capabilities.CLIENTS_VIEW);
  const hasOrgScope = matching.some((g) => g.scopeMode === 'ORGANIZATION');

  if (hasOrgScope) {
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, auth.organizationId));
    return c.json({ clients: rows.map(mapClient) });
  }

  const assigns = await db
    .select({ clientId: clientAssignments.clientId })
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.organizationId, auth.organizationId),
        eq(clientAssignments.userId, auth.userId),
        eq(clientAssignments.status, 'active'),
      ),
    );
  const ids = [...new Set(assigns.map((a) => a.clientId))];
  if (ids.length === 0) return c.json({ clients: [] });

  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, auth.organizationId), inArray(clients.id, ids)));
  return c.json({ clients: rows.map(mapClient) });
});

clientRoutes.post('/clients/import-local', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.CLIENTS_CREATE });
  const body = z
    .object({
      clients: z.array(
        z.object({
          legacyId: z.string(),
          name: z.string(),
          status: z.string().optional(),
          operationalStage: z.string().nullable().optional(),
          age: z.number().nullable().optional(),
          authorizedHours: z.number().nullable().optional(),
          color: z.string().optional(),
          borderColor: z.string().optional(),
          textColor: z.string().optional(),
          avatar: z.string().optional(),
          diagnosis: z.string().optional(),
          guardianName: z.string().optional(),
          guardianContact: z.string().optional(),
        }),
      ),
    })
    .parse(await c.req.json());

  const results = [];
  for (const item of body.clients) {
    assertSafeAvatar(item.avatar);
    const status =
      item.status === 'Inactive' || item.status === 'inactive'
        ? 'inactive'
        : item.status === 'Discharged' || item.status === 'discharged'
          ? 'discharged'
          : 'active';
    const operationalStage =
      item.status === 'Onboarding' || item.operationalStage === 'onboarding'
        ? 'onboarding'
        : item.status === 'Maintenance' || item.operationalStage === 'maintenance'
          ? 'maintenance'
          : item.operationalStage === 'standard'
            ? 'standard'
            : null;

    const result = await createOrImportClient({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      legalName: item.name,
      preferredName: item.name,
      status,
      operationalStage,
      ageYears: item.age,
      authorizedHoursWeekly: item.authorizedHours,
      color: item.color,
      borderColor: item.borderColor,
      textColor: item.textColor,
      avatar: item.avatar,
      diagnosisText: item.diagnosis,
      guardianName: item.guardianName,
      guardianContact: item.guardianContact,
      legacyId: item.legacyId,
    });
    results.push({
      legacyId: item.legacyId,
      clientId: result.client.id,
      imported: result.imported,
    });
  }

  return c.json({ results });
});

clientRoutes.get('/clients/:id', async (c) => {
  const auth = c.get('auth')!;
  const id = c.req.param('id');
  await authorizeCapability({ ctx: auth, capability: Capabilities.CLIENTS_VIEW, clientId: id });
  const db = getDb();
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, auth.organizationId), eq(clients.id, id)))
    .limit(1);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
  const cares = await db
    .select()
    .from(caregivers)
    .where(
      and(eq(caregivers.organizationId, auth.organizationId), eq(caregivers.clientId, id)),
    );
  return c.json({ client: mapClient(row), caregivers: cares });
});

const createSchema = z.object({
  legalName: z.string().min(1),
  preferredName: z.string().optional(),
  status: z.enum(['active', 'inactive', 'discharged']).default('active'),
  operationalStage: z.enum(['onboarding', 'maintenance', 'standard']).nullable().optional(),
  ageYears: z.number().int().positive().nullable().optional(),
  authorizedHoursWeekly: z.number().nullable().optional(),
  color: z.string().optional(),
  borderColor: z.string().optional(),
  textColor: z.string().optional(),
  avatar: z.string().optional(),
  diagnosisText: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
  legacyId: z.string().optional(),
});

clientRoutes.post('/clients', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await authorizeCapability({ ctx: auth, capability: Capabilities.CLIENTS_CREATE });
  const body = createSchema.parse(await c.req.json());
  assertSafeAvatar(body.avatar);
  const result = await createOrImportClient({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    ...body,
  });
  const status = result.imported ? 200 : 201;
  return c.json({ client: mapClient(result.client), imported: result.imported }, status);
});

const patchSchema = createSchema.partial().extend({
  rowVersion: z.number().int(),
});

clientRoutes.patch('/clients/:id', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  const id = c.req.param('id');
  await authorizeCapability({ ctx: auth, capability: Capabilities.CLIENTS_EDIT, clientId: id });
  const body = patchSchema.parse(await c.req.json());
  if (body.avatar !== undefined) assertSafeAvatar(body.avatar);

  const db = getDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, auth.organizationId), eq(clients.id, id)))
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Client not found.');

  const row = await updateWithRowVersion(clients, {
    organizationId: auth.organizationId,
    id,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Client not found.',
    set: {
      legalName: body.legalName ?? existing.legalName,
      preferredName: body.preferredName ?? existing.preferredName,
      operationalStage:
        body.operationalStage !== undefined
          ? body.operationalStage
          : existing.operationalStage,
      ageYears: body.ageYears !== undefined ? body.ageYears : existing.ageYears,
      authorizedHoursWeekly:
        body.authorizedHoursWeekly !== undefined
          ? body.authorizedHoursWeekly != null
            ? String(body.authorizedHoursWeekly)
            : null
          : existing.authorizedHoursWeekly,
      color: body.color ?? existing.color,
      borderColor: body.borderColor ?? existing.borderColor,
      textColor: body.textColor ?? existing.textColor,
      avatar: body.avatar ?? existing.avatar,
      diagnosisText: body.diagnosisText ?? existing.diagnosisText,
      updatedAt: new Date(),
    },
  });

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'client',
    entityId: id,
    action: 'UPDATE',
    beforeJson: { rowVersion: existing.rowVersion },
    afterJson: { rowVersion: row.rowVersion },
  });

  return c.json({ client: mapClient(row as typeof existing) });
});

clientRoutes.post('/clients/:id/lifecycle', csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  const id = c.req.param('id');
  await authorizeCapability({
    ctx: auth,
    capability: Capabilities.CLIENTS_LIFECYCLE,
    clientId: id,
  });
  const body = z
    .object({
      status: z.enum(['active', 'inactive', 'discharged']),
      rowVersion: z.number().int(),
      reason: z.string().optional(),
    })
    .parse(await c.req.json());

  const db = getDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, auth.organizationId), eq(clients.id, id)))
    .limit(1);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Client not found.');

  const row = await updateWithRowVersion(clients, {
    organizationId: auth.organizationId,
    id,
    expectedVersion: body.rowVersion,
    notFoundMessage: 'Client not found.',
    set: {
      status: body.status,
      updatedAt: new Date(),
    },
  });

  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'client',
    entityId: id,
    action: 'LIFECYCLE',
    beforeJson: { status: existing.status },
    afterJson: { status: row.status },
    reason: body.reason ?? null,
  });

  return c.json({ client: mapClient(row as typeof existing) });
});

clientRoutes.delete('/clients/:id', async () => {
  throw new AppError(405, 'HARD_DELETE_FORBIDDEN', 'Client hard delete is not allowed.');
});
