import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { credentialDefinitions, userCredentials } from '../../db/schema/index.js';
import { Verbs, type Verb } from './verbs.js';

export type ClinicalCeiling = 'NONE' | 'RBT' | 'BCABA' | 'BCBA';

const CEILING_RANK: Record<ClinicalCeiling, number> = {
  NONE: 0,
  RBT: 1,
  BCABA: 2,
  BCBA: 3,
};

function codeToCeiling(code: string): ClinicalCeiling {
  const c = code.trim().toUpperCase();
  if (c === 'RBT' || c.includes('RBT')) return 'RBT';
  if (c === 'BCABA' || c.includes('BCABA')) return 'BCABA';
  if (c === 'BCBA' || c.includes('BCBA')) return 'BCBA';
  return 'NONE';
}

export async function resolveClinicalCeiling(
  organizationId: string,
  userId: string,
  at: Date = new Date(),
): Promise<ClinicalCeiling> {
  const db = getDb();
  const rows = await db
    .select({
      code: credentialDefinitions.code,
      status: userCredentials.status,
      expiresOn: userCredentials.expiresOn,
    })
    .from(userCredentials)
    .innerJoin(
      credentialDefinitions,
      and(
        eq(credentialDefinitions.id, userCredentials.credentialDefinitionId),
        eq(credentialDefinitions.organizationId, userCredentials.organizationId),
      ),
    )
    .where(
      and(
        eq(userCredentials.organizationId, organizationId),
        eq(userCredentials.userId, userId),
        eq(userCredentials.status, 'active'),
      ),
    );

  let best: ClinicalCeiling = 'NONE';
  for (const row of rows) {
    if (row.status !== 'active') continue;
    if (row.expiresOn && new Date(row.expiresOn) < at) continue;
    const ceiling = codeToCeiling(row.code);
    if (CEILING_RANK[ceiling] > CEILING_RANK[best]) best = ceiling;
  }
  return best;
}

/** Whether Ceiling permits a clinical verb (Function must ALSO allow). */
export function ceilingAllows(ceiling: ClinicalCeiling, verb: Verb): boolean {
  if (ceiling === 'NONE') return false;
  if (verb === Verbs.CLINICAL_AUTHOR) {
    return ceiling === 'RBT' || ceiling === 'BCABA' || ceiling === 'BCBA';
  }
  if (verb === Verbs.CLINICAL_EDIT) {
    return ceiling === 'BCABA' || ceiling === 'BCBA';
  }
  if (verb === Verbs.CLINICAL_REVIEW || verb === Verbs.CLINICAL_APPROVE_SIGN) {
    return ceiling === 'BCBA';
  }
  return false;
}
