import { getDb } from '../../db/client.js';
import { auditEntries } from '../../db/schema/index.js';

export type WriteAuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  reason?: string | null;
};

/** Append-only AuditEntry writer. */
export async function writeAuditEntry(input: WriteAuditInput) {
  const db = getDb();
  const [row] = await db
    .insert(auditEntries)
    .values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: input.beforeJson ?? null,
      afterJson: input.afterJson ?? null,
      reason: input.reason ?? null,
    })
    .returning();

  return row;
}
