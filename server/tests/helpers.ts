import { getEnv, resetEnvCache } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { seedDevPersonas } from '../src/db/seedDev.js';

export function ensureTestEnv() {
  process.env.DATABASE_URL ??=
    'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace';
  process.env.CORS_ORIGINS ??= 'http://localhost:3000,http://localhost:5173';
  process.env.NODE_ENV = 'test';
  process.env.DEV_SEED_PASSWORD ??= 'DevOnlyPass123!';
  process.env.SESSION_SECRET ??= 'test-session-secret-16+';
  process.env.COOKIE_SECURE = 'false';
  resetEnvCache();
  return getEnv();
}

export async function seedAndApp() {
  ensureTestEnv();
  const seeded = await seedDevPersonas();
  const app = createApp();
  return { app, seeded };
}

export function parseSetCookie(res: Response): string {
  // undici/hono may expose getSetCookie
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean) as string[];
  return list
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

export async function loginAs(
  app: ReturnType<typeof createApp>,
  email: string,
  password = 'DevOnlyPass123!',
  origin = 'http://localhost:3000',
) {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as {
    csrfToken?: string;
    user?: { id: string; email: string };
    clinicalCeiling?: string;
    functions?: { code: string; scopeMode: string }[];
    error?: { code: string; message: string };
  };
  const cookie = parseSetCookie(res);
  return { res, body, cookie, csrfToken: body.csrfToken ?? '' };
}

export function authedHeaders(cookie: string, csrfToken: string, origin = 'http://localhost:3000') {
  return {
    'content-type': 'application/json',
    cookie,
    'x-csrf-token': csrfToken,
    origin,
  };
}
