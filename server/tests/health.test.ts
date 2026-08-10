import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb, getSql } from '../src/db/client.js';
import { resetEnvCache } from '../src/config/env.js';

describe('health and ready', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??=
      'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace';
    process.env.CORS_ORIGIN ??= 'http://localhost:3000';
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /api/v1/health returns ok with db status', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('bcba-workspace-api');
    expect(body.version).toBe('0.0.0');
    expect(['up', 'down']).toContain(body.db);
  });

  it('GET /api/v1/ready reflects postgres connectivity', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/ready');
    const body = await res.json();

    // Confirm DB is actually reachable in this environment
    await getSql()`select 1`;
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
  });
});
