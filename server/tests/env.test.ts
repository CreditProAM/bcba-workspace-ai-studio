import { afterEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache } from '../src/config/env.js';

describe('environment validation', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('accepts valid development env', () => {
    const env = getEnv({
      DATABASE_URL: 'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace',
      PORT: '8787',
      CORS_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'test',
    });
    expect(env.PORT).toBe(8787);
    expect(env.DATABASE_URL).toContain('bcba_workspace');
  });

  it('rejects missing DATABASE_URL', () => {
    resetEnvCache();
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() =>
      getEnv({
        DATABASE_URL: '',
        NODE_ENV: 'test',
      }),
    ).toThrow(/DATABASE_URL/);
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  });
});
