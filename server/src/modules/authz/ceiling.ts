import { and, eq, lte, or, isNull, gte } from 'drizzle-orm';
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

const VALID: ReadonlySet<string> = new Set(['NONE', 'RBT', 'BCABA', 'BCBA']);

function authorityToCeiling(authority: string | null | undefined): ClinicalCeiling {
  const a = (authority ?? 'NONE').trim().toUpperCase();
  if (VALID.has(a)) return a as ClinicalCeiling;
  return 'NONE';
}

/** Calendar date YYYY-MM-DD in UTC for effective_on / expires_on checks. */
export function utcDateString(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export async function resolveClinicalCeiling(
  organizationId: string,
  userId: string,
  at: Date = new Date(),
): Promise<ClinicalCeiling> {
  const db = getDb();
  const today = utcDateString(at);
  const rows = await db
    .select({
      clinicalAuthority: credentialDefinitions.clinicalAuthority,
      status: userCredentials.status,
      effectiveOn: userCredentials.effectiveOn,
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
        or(isNull(userCredentials.effectiveOn), lte(userCredentials.effectiveOn, today)),
        or(isNull(userCredentials.expiresOn), gte(userCredentials.expiresOn, today)),
      ),
    );

  let best: ClinicalCeiling = 'NONE';
  for (const row of rows) {
    const ceiling = authorityToCeiling(row.clinicalAuthority);
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
