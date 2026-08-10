import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb, getSql } from '../src/db/client.js';
import { ensureTestEnv } from './helpers.js';

describe('health and ready', () => {
  beforeAll(() => {
    ensureTestEnv();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /api/v1/health is liveness-only (no db field)', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      version: string;
      db?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('bcba-workspace-api');
    expect(body.version).toBe('0.1.0');
    expect(body.db).toBeUndefined();
  });

  it('GET /api/v1/ready reflects postgres connectivity', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/ready');
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      version: string;
      db: string;
    };

    await getSql()`select 1`;
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
  });
});
