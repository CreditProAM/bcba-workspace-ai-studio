import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    /** Comma-separated allowlist. Never use * with credentials. */
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    /** @deprecated use CORS_ORIGINS */
    CORS_ORIGIN: z.string().optional(),
    SESSION_SECRET: z.string().min(16).optional(),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DEV_SEED_PASSWORD: z.string().optional(),
  })
  .transform((data) => {
    const originsRaw = data.CORS_ORIGINS || data.CORS_ORIGIN || 'http://localhost:3000';
    const corsOrigins = originsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const cookieSecure =
      data.COOKIE_SECURE ??
      (data.NODE_ENV === 'production' || data.COOKIE_SAMESITE === 'none');
    return {
      PORT: data.PORT,
      DATABASE_URL: data.DATABASE_URL,
      CORS_ORIGINS: corsOrigins,
      SESSION_SECRET:
        data.SESSION_SECRET ??
        (data.NODE_ENV === 'production'
          ? undefined
          : 'dev-only-session-secret-change-me'),
      COOKIE_SECURE: cookieSecure,
      COOKIE_SAMESITE: data.COOKIE_SAMESITE,
      NODE_ENV: data.NODE_ENV,
      DEV_SEED_PASSWORD: data.DEV_SEED_PASSWORD ?? 'DevOnlyPass123!',
    };
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.SESSION_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SESSION_SECRET is required in production',
        path: ['SESSION_SECRET'],
      });
    }
    if (data.COOKIE_SAMESITE === 'none' && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COOKIE_SECURE must be true when SameSite=None',
        path: ['COOKIE_SECURE'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(overrides?: Partial<Record<string, string>>): Env {
  if (cached && !overrides) return cached;

  const source = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  if (!overrides) cached = parsed.data;
  return parsed.data;
}

export function resetEnvCache(): void {
  cached = null;
}
