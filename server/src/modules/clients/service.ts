import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { caregivers, clients, legacyIdMaps } from '../../db/schema/index.js';
import { writeAuditEntry } from '../platform/audit.js';

export type CreateClientInput = {
  organizationId: string;
  actorUserId: string;
  legalName: string;
  preferredName?: string;
  status?: 'active' | 'inactive' | 'discharged';
  operationalStage?: 'onboarding' | 'maintenance' | 'standard' | null;
  ageYears?: number | null;
  authorizedHoursWeekly?: number | null;
  color?: string;
  borderColor?: string;
  textColor?: string;
  avatar?: string;
  diagnosisText?: string;
  guardianName?: string;
  guardianContact?: string;
  legacyId?: string;
};

export function mapClient(row: typeof clients.$inferSelect) {
  return {
    id: row.id,
    name: row.preferredName || row.legalName,
    legalName: row.legalName,
    preferredName: row.preferredName,
    status: row.status,
    operationalStage: row.operationalStage,
    age: row.ageYears,
    authorizedHours: row.authorizedHoursWeekly
      ? Number(row.authorizedHoursWeekly)
      : undefined,
    color: row.color,
    borderColor: row.borderColor,
    textColor: row.textColor,
    avatar: row.avatar,
    diagnosis: row.diagnosisText,
    rowVersion: row.rowVersion,
  };
}

export async function createOrImportClient(input: CreateClientInput) {
  const db = getDb();

  if (input.legacyId) {
    const [mapped] = await db
      .select()
      .from(legacyIdMaps)
      .where(
        and(
          eq(legacyIdMaps.organizationId, input.organizationId),
          eq(legacyIdMaps.entityType, 'client'),
          eq(legacyIdMaps.legacyId, input.legacyId),
        ),
      )
      .limit(1);
    if (mapped) {
      const [existing] = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, input.organizationId),
            eq(clients.id, mapped.postgresId),
          ),
        )
        .limit(1);
      if (existing) {
        return { client: existing, imported: true as const };
      }
    }
  }

  const [row] = await db
    .insert(clients)
    .values({
      organizationId: input.organizationId,
      legalName: input.legalName,
      preferredName: input.preferredName,
      status: input.status ?? 'active',
      operationalStage: input.operationalStage ?? null,
      ageYears: input.ageYears ?? null,
      authorizedHoursWeekly:
        input.authorizedHoursWeekly != null ? String(input.authorizedHoursWeekly) : null,
      color: input.color,
      borderColor: input.borderColor,
      textColor: input.textColor,
      avatar: input.avatar,
      diagnosisText: input.diagnosisText,
    })
    .returning();

  if (input.guardianName) {
    await db.insert(caregivers).values({
      organizationId: input.organizationId,
      clientId: row.id,
      name: input.guardianName,
      phone: input.guardianContact,
      relationship: 'guardian_contact',
      isEmergencyContact: false,
      isAuthorizedPickup: false,
    });
  }

  if (input.legacyId) {
    await db.insert(legacyIdMaps).values({
      organizationId: input.organizationId,
      entityType: 'client',
      legacyId: input.legacyId,
      postgresId: row.id,
    });
  }

  await writeAuditEntry({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: 'client',
    entityId: row.id,
    action: 'CREATE',
    afterJson: { legalName: row.legalName, legacyId: input.legacyId ?? null },
  });

  return { client: row, imported: false as const };
}
