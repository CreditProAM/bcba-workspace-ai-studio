import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../src/db/client.js';
import { organizations } from '../src/db/schema/index.js';
import { writeAuditEntry } from '../src/modules/platform/audit.js';
import { resetEnvCache } from '../src/config/env.js';

describe('audit writer', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??=
      'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace';
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('appends an audit entry for an organization', async () => {
    const db = getDb();
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Wave0 Audit Clinic', status: 'active' })
      .returning();

    const entry = await writeAuditEntry({
      organizationId: org.id,
      entityType: 'organization',
      entityId: org.id,
      action: 'CREATE',
      afterJson: { name: org.name },
      reason: 'wave0-test',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.organizationId).toBe(org.id);
    expect(entry.action).toBe('CREATE');
    expect(entry.entityType).toBe('organization');
    // actor optional
    expect(entry.actorUserId).toBeNull();
  });
});
