import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getSql } from '../src/db/client.js';
import { resetEnvCache } from '../src/config/env.js';

/**
 * Proves organization-consistent composite FK enforcement without
 * polluting the permanent production schema.
 */
describe('tenant-aware composite FK isolation', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgres://bcba:bcba_dev_only@localhost:5432/bcba_workspace';
    process.env.NODE_ENV = 'test';
    resetEnvCache();

    const sql = getSql();
    await sql`DROP SCHEMA IF EXISTS tenant_fk_proof CASCADE`;
    await sql`CREATE SCHEMA tenant_fk_proof`;
    await sql`
      CREATE TABLE tenant_fk_proof.parents (
        organization_id uuid NOT NULL,
        id uuid NOT NULL,
        PRIMARY KEY (id),
        UNIQUE (organization_id, id)
      )
    `;
    await sql`
      CREATE TABLE tenant_fk_proof.children (
        organization_id uuid NOT NULL,
        id uuid NOT NULL,
        parent_id uuid NOT NULL,
        PRIMARY KEY (id),
        UNIQUE (organization_id, id),
        FOREIGN KEY (organization_id, parent_id)
          REFERENCES tenant_fk_proof.parents (organization_id, id)
      )
    `;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`DROP SCHEMA IF EXISTS tenant_fk_proof CASCADE`;
    await closeDb();
  });

  it('rejects a child in Org A referencing a parent that belongs to Org B', async () => {
    const sql = getSql();
    const orgA = randomUUID();
    const orgB = randomUUID();
    const parentB = randomUUID();
    const childA = randomUUID();

    await sql`
      INSERT INTO tenant_fk_proof.parents (organization_id, id)
      VALUES (${orgB}, ${parentB})
    `;

    let rejected = false;
    try {
      await sql`
        INSERT INTO tenant_fk_proof.children (organization_id, id, parent_id)
        VALUES (${orgA}, ${childA}, ${parentB})
      `;
    } catch (err) {
      rejected = true;
      const message = err instanceof Error ? err.message : String(err);
      expect(message.toLowerCase()).toMatch(/foreign key|violates/);
    }

    expect(rejected).toBe(true);
  });

  it('allows a child when organization_id matches the parent', async () => {
    const sql = getSql();
    const orgA = randomUUID();
    const parentA = randomUUID();
    const childA = randomUUID();

    await sql`
      INSERT INTO tenant_fk_proof.parents (organization_id, id)
      VALUES (${orgA}, ${parentA})
    `;
    await sql`
      INSERT INTO tenant_fk_proof.children (organization_id, id, parent_id)
      VALUES (${orgA}, ${childA}, ${parentA})
    `;

    const rows = await sql`
      SELECT id FROM tenant_fk_proof.children WHERE id = ${childA}
    `;
    expect(rows.length).toBe(1);
  });
});
