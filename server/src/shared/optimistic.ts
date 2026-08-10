import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getDb } from '../db/client.js';
import { AppError } from './errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCol = any;

/**
 * Atomic optimistic concurrency update.
 * UPDATE … WHERE org + id + row_version = expected; bump row_version.
 */
export async function updateWithRowVersion(
  table: PgTable,
  args: {
    organizationId: string;
    id: string;
    expectedVersion: number;
    set: Record<string, unknown>;
    notFoundMessage?: string;
  },
): Promise<Record<string, unknown>> {
  const db = getDb();
  const cols = table as unknown as {
    id: AnyCol;
    organizationId: AnyCol;
    rowVersion: AnyCol;
  };

  const [row] = await db
    .update(table)
    .set({
      ...args.set,
      rowVersion: sql`${cols.rowVersion} + 1`,
    } as never)
    .where(
      and(
        eq(cols.organizationId, args.organizationId),
        eq(cols.id, args.id),
        eq(cols.rowVersion, args.expectedVersion),
      ) as SQL,
    )
    .returning();

  if (row) return row as Record<string, unknown>;

  const [existing] = await db
    .select({ id: cols.id })
    .from(table)
    .where(
      and(eq(cols.organizationId, args.organizationId), eq(cols.id, args.id)) as SQL,
    )
    .limit(1);

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', args.notFoundMessage ?? 'Record not found.');
  }
  throw new AppError(
    409,
    'VERSION_CONFLICT',
    'Record was modified by another request (row_version mismatch).',
  );
}
