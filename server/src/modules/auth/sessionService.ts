import { and, eq, isNull, sql } from 'drizzle-orm';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import { userIdentities, userSessions } from '../../db/schema/index.js';
import { hashToken, randomToken, safeEqualHex } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';
import { loadAuthzContext, type AuthContext } from '../authz/authorize.js';

export const SESSION_COOKIE = 'bcba_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type SessionTokens = {
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
  sessionId: string;
};

export async function createSession(input: {
  userId: string;
  organizationId: string;
  deviceMeta?: Record<string, unknown>;
}): Promise<SessionTokens> {
  const db = getDb();
  const sessionToken = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [row] = await db
    .insert(userSessions)
    .values({
      userId: input.userId,
      organizationId: input.organizationId,
      tokenHash: hashToken(sessionToken),
      csrfTokenHash: hashToken(csrfToken),
      expiresAt,
      lastSeenAt: new Date(),
      deviceMeta: input.deviceMeta ?? null,
    })
    .returning();

  return {
    sessionToken,
    csrfToken,
    expiresAt,
    sessionId: row.id,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}

export async function revokeAllSessionsForUser(
  userId: string,
  organizationId?: string,
): Promise<number> {
  const db = getDb();
  const conditions = [eq(userSessions.userId, userId), isNull(userSessions.revokedAt)];
  if (organizationId) {
    conditions.push(eq(userSessions.organizationId, organizationId));
  }
  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: userSessions.id });
  return rows.length;
}

export async function resolveSession(
  rawSessionToken: string | undefined,
): Promise<{ ctx: AuthContext; csrfTokenHash: string } | null> {
  if (!rawSessionToken) return null;
  const db = getDb();
  const tokenHash = hashToken(rawSessionToken);
  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.tokenHash, tokenHash))
    .limit(1);

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.organizationId) return null;

  const [user] = await db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.id, session.userId))
    .limit(1);
  if (!user || user.status !== 'active') return null;

  await db
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, session.id));

  const ctx = await loadAuthzContext(user.id, session.organizationId, session.id, {
    email: user.email,
    displayName: user.displayName,
  });

  return { ctx, csrfTokenHash: session.csrfTokenHash };
}

export function verifyCsrf(sessionCsrfHash: string, provided: string | undefined): void {
  if (!provided) {
    throw new AppError(403, 'CSRF_MISSING', 'CSRF token required.');
  }
  const providedHash = hashToken(provided);
  if (!safeEqualHex(sessionCsrfHash, providedHash)) {
    throw new AppError(403, 'CSRF_INVALID', 'CSRF token invalid.');
  }
}

export function cookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true as const,
    path: '/',
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    expires: new Date(Date.now() + SESSION_TTL_MS),
  };
}
