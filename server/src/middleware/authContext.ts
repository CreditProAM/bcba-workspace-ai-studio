import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  resolveSession,
  SESSION_COOKIE,
  verifyCsrf,
  type SessionTokens,
} from '../modules/auth/sessionService.js';
import type { AuthContext } from '../modules/authz/authorize.js';
import { AppError } from '../shared/errors.js';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AuthContext;
    csrfTokenHash?: string;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const optionalSessionMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const resolved = await resolveSession(token);
  if (resolved) {
    c.set('auth', resolved.ctx);
    c.set('csrfTokenHash', resolved.csrfTokenHash);
  }
  await next();
};

export const requireAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = c.get('auth');
  if (!auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  await next();
};

export const csrfGuardMiddleware: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const auth = c.get('auth');
  const csrfHash = c.get('csrfTokenHash');
  if (!auth || !csrfHash) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const envOrigins = (await import('../config/env.js')).getEnv().CORS_ORIGINS;
  const origin = c.req.header('origin');
  if (origin && !envOrigins.includes(origin)) {
    throw new AppError(403, 'ORIGIN_DENIED', 'Origin not allowed.');
  }

  const headerToken =
    c.req.header('x-csrf-token') ?? c.req.header('X-CSRF-Token') ?? undefined;
  verifyCsrf(csrfHash, headerToken);
  await next();
};

export type { SessionTokens, AuthContext };
