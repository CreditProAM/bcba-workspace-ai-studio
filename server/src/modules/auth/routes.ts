import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { organizationMemberships, organizations, userIdentities } from '../../db/schema/index.js';
import {
  csrfGuardMiddleware,
  optionalSessionMiddleware,
  requireAuthMiddleware,
} from '../../middleware/authContext.js';
import { writeAuditEntry } from '../platform/audit.js';
import { normalizeEmail, verifyPassword } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';
import {
  cookieOptions,
  createSession,
  revokeAllSessionsForUser,
  revokeSession,
  SESSION_COOKIE,
} from './sessionService.js';

export const authRoutes = new Hono();

authRoutes.use('*', optionalSessionMiddleware);

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

authRoutes.post('/auth/login', async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const db = getDb();
  const email = normalizeEmail(body.email);

  const [user] = await db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'USER_DISABLED', 'User identity is disabled.');
  }

  const memberships = await db
    .select({
      membership: organizationMemberships,
      org: organizations,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, user.id));

  const active = memberships.filter((m) => m.membership.status === 'active');
  if (active.length === 0) {
    throw new AppError(403, 'NO_MEMBERSHIP', 'No active organization membership.');
  }

  let selected = active[0];
  if (body.organizationId) {
    const match = active.find((m) => m.membership.organizationId === body.organizationId);
    if (!match) {
      throw new AppError(403, 'ORG_DENIED', 'Not a member of that organization.');
    }
    selected = match;
  }

  const tokens = await createSession({
    userId: user.id,
    organizationId: selected.membership.organizationId,
    deviceMeta: { userAgent: c.req.header('user-agent') ?? null },
  });

  setCookie(c, SESSION_COOKIE, tokens.sessionToken, cookieOptions());

  await writeAuditEntry({
    organizationId: selected.membership.organizationId,
    actorUserId: user.id,
    entityType: 'user_session',
    entityId: tokens.sessionId,
    action: 'LOGIN',
    afterJson: { userId: user.id, email: user.email },
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.displayName,
    },
    organization: {
      id: selected.org.id,
      name: selected.org.name,
    },
    membershipId: selected.membership.id,
    csrfToken: tokens.csrfToken,
  });
});

authRoutes.post('/auth/logout', requireAuthMiddleware, csrfGuardMiddleware, async (c) => {
  const auth = c.get('auth')!;
  await revokeSession(auth.sessionId);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  await writeAuditEntry({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    entityType: 'user_session',
    entityId: auth.sessionId,
    action: 'LOGOUT',
  });
  return c.json({ ok: true });
});

authRoutes.get('/auth/me', requireAuthMiddleware, async (c) => {
  const auth = c.get('auth')!;
  return c.json({
    user: {
      id: auth.userId,
      email: auth.email,
      name: auth.displayName,
    },
    organizationId: auth.organizationId,
    membershipId: auth.membershipId,
    employmentType: auth.employmentType,
    functions: auth.grants,
    clinicalCeiling: auth.ceiling,
  });
});

authRoutes.get('/auth/csrf', requireAuthMiddleware, async (c) => {
  // Issue a fresh CSRF token bound to the existing session by rotating hash.
  // For Wave 1 simplicity: require login response csrf; this endpoint returns
  // 501 unless we store plaintext — instead re-login provides csrf.
  // Practical approach: store csrf raw only in login response; clients keep it
  // in memory. This endpoint validates session and returns 204 if already have token.
  // Better: rotate CSRF on GET.
  const { createHash, randomBytes } = await import('node:crypto');
  const { getDb } = await import('../../db/client.js');
  const { userSessions } = await import('../../db/schema/index.js');
  const { eq } = await import('drizzle-orm');
  const auth = c.get('auth')!;
  const csrfToken = randomBytes(32).toString('base64url');
  const csrfTokenHash = createHash('sha256').update(csrfToken).digest('hex');
  await getDb()
    .update(userSessions)
    .set({ csrfTokenHash })
    .where(eq(userSessions.id, auth.sessionId));
  return c.json({ csrfToken });
});

authRoutes.post(
  '/auth/sessions/revoke-all',
  requireAuthMiddleware,
  csrfGuardMiddleware,
  async (c) => {
    const auth = c.get('auth')!;
    // org_admin or hr may revoke; Wave 1 allow self + hr/org_admin
    const canRevokeOthers =
      auth.functionCodes.includes('org_admin') ||
      auth.functionCodes.includes('hr_credentialing');
    const body = z
      .object({ userId: z.string().uuid().optional() })
      .parse(await c.req.json().catch(() => ({})));

    const targetUserId = body.userId ?? auth.userId;
    if (targetUserId !== auth.userId && !canRevokeOthers) {
      throw new AppError(403, 'FUNCTION_DENIED', 'Cannot revoke other sessions.');
    }

    const count = await revokeAllSessionsForUser(targetUserId, auth.organizationId);
    await writeAuditEntry({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      entityType: 'user_identity',
      entityId: targetUserId,
      action: 'SESSION_REVOKE_ALL',
      afterJson: { count },
    });
    return c.json({ revoked: count });
  },
);
