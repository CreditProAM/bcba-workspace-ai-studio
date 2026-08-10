import { and, eq, gt, gte, isNull, lte, or } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  clientAssignments,
  functionGrants,
  operationalFunctions,
  organizationMemberships,
} from '../../db/schema/index.js';
import { AppError } from '../../shared/errors.js';
import { grantsForCapability, type Capability } from './capabilities.js';
import { ceilingAllows, resolveClinicalCeiling, type ClinicalCeiling } from './ceiling.js';
import { CLINICAL_VERBS, type Verb } from './verbs.js';

export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  membershipId: string;
  membershipStatus: string;
  employmentType: string;
  sessionId: string;
  functionCodes: string[];
  grants: { code: string; scopeMode: string }[];
  ceiling: ClinicalCeiling;
};

export async function loadAuthzContext(
  userId: string,
  organizationId: string,
  sessionId: string,
  profile: { email: string; displayName: string },
): Promise<AuthContext> {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership || membership.status === 'terminated') {
    throw new AppError(403, 'MEMBERSHIP_DENIED', 'No active organization membership.');
  }
  if (membership.status !== 'active') {
    throw new AppError(403, 'MEMBERSHIP_INACTIVE', 'Membership is not active.');
  }

  const now = new Date();
  const grants = await db
    .select({
      code: operationalFunctions.code,
      scopeMode: functionGrants.scopeMode,
    })
    .from(functionGrants)
    .innerJoin(operationalFunctions, eq(operationalFunctions.id, functionGrants.functionId))
    .where(
      and(
        eq(functionGrants.organizationId, organizationId),
        eq(functionGrants.membershipId, membership.id),
        lte(functionGrants.effectiveFrom, now),
        or(isNull(functionGrants.effectiveTo), gt(functionGrants.effectiveTo, now)),
      ),
    );

  const activeGrants = grants.map((g) => ({ code: g.code, scopeMode: g.scopeMode }));
  const ceiling = await resolveClinicalCeiling(organizationId, userId, now);

  return {
    userId,
    email: profile.email,
    displayName: profile.displayName,
    organizationId,
    membershipId: membership.id,
    membershipStatus: membership.status,
    employmentType: membership.employmentType,
    sessionId,
    functionCodes: [...new Set(activeGrants.map((g) => g.code))],
    grants: activeGrants,
    ceiling,
  };
}

export type AuthorizeCapabilityInput = {
  ctx: AuthContext;
  capability: Capability;
  clientId?: string;
  allowUnscopedList?: boolean;
  /** Optional clinical verb check layered on capability. */
  clinicalVerb?: Verb;
  subjectAuthorUserId?: string;
};

/**
 * Domain-qualified authorization. Scope is derived only from grants that
 * match the requested capability — never from unrelated ORGANIZATION grants.
 */
export async function authorizeCapability(input: AuthorizeCapabilityInput): Promise<void> {
  const { ctx, capability, clientId, allowUnscopedList, clinicalVerb, subjectAuthorUserId } =
    input;

  const matching = grantsForCapability(ctx.grants, capability);
  if (matching.length === 0) {
    throw new AppError(
      403,
      'CAPABILITY_DENIED',
      `No Function grant allows capability ${capability}.`,
    );
  }

  if (clinicalVerb && CLINICAL_VERBS.has(clinicalVerb)) {
    if (!ceilingAllows(ctx.ceiling, clinicalVerb)) {
      throw new AppError(
        403,
        'CLINICAL_CEILING_DENIED',
        `Clinical authority ceiling (${ctx.ceiling}) does not allow ${clinicalVerb}.`,
      );
    }
    if (
      (clinicalVerb === 'CLINICAL_EDIT' || clinicalVerb === 'CLINICAL_AUTHOR') &&
      subjectAuthorUserId &&
      subjectAuthorUserId !== ctx.userId &&
      ctx.ceiling !== 'BCBA'
    ) {
      throw new AppError(
        403,
        'CLINICAL_CEILING_DENIED',
        "Cannot clinically edit another provider's work at this ceiling.",
      );
    }
  }

  const hasOrgScope = matching.some((g) => g.scopeMode === 'ORGANIZATION');
  const needsClientScope = matching.every((g) => g.scopeMode === 'ASSIGNED_CLIENTS');

  if (!hasOrgScope && needsClientScope) {
    if (!clientId) {
      if (allowUnscopedList) return;
      throw new AppError(403, 'CLIENT_SCOPE_REQUIRED', 'Client assignment scope required.');
    }
    const ok = await hasActiveClientAssignment(ctx.organizationId, ctx.userId, clientId);
    if (!ok) {
      throw new AppError(
        403,
        'CLIENT_SCOPE_DENIED',
        'No active client assignment for this resource.',
      );
    }
  } else if (!hasOrgScope && clientId) {
    const ok = await hasActiveClientAssignment(ctx.organizationId, ctx.userId, clientId);
    if (!ok) {
      throw new AppError(
        403,
        'CLIENT_SCOPE_DENIED',
        'No active client assignment for this resource.',
      );
    }
  }
}

/** @deprecated Prefer authorizeCapability for Wave 1.1+ domain checks. */
export type AuthorizeInput = {
  ctx: AuthContext;
  verb: Verb;
  clientId?: string;
  subjectAuthorUserId?: string;
  allowUnscopedList?: boolean;
};

export async function authorize(input: AuthorizeInput): Promise<void> {
  // Legacy verb path kept for clinical unit tests; no domain mapping.
  const { ctx, verb, clientId, subjectAuthorUserId, allowUnscopedList } = input;
  const { FUNCTION_VERBS } = await import('./verbs.js');
  const matchingGrants = ctx.grants.filter((g) =>
    (FUNCTION_VERBS[g.code] ?? []).includes(verb),
  );
  if (matchingGrants.length === 0) {
    throw new AppError(403, 'FUNCTION_DENIED', `Function grant does not allow ${verb}.`);
  }
  if (CLINICAL_VERBS.has(verb)) {
    if (!ceilingAllows(ctx.ceiling, verb)) {
      throw new AppError(
        403,
        'CLINICAL_CEILING_DENIED',
        `Clinical authority ceiling (${ctx.ceiling}) does not allow ${verb}.`,
      );
    }
    if (
      (verb === 'CLINICAL_EDIT' || verb === 'CLINICAL_AUTHOR') &&
      subjectAuthorUserId &&
      subjectAuthorUserId !== ctx.userId &&
      ctx.ceiling !== 'BCBA'
    ) {
      throw new AppError(
        403,
        'CLINICAL_CEILING_DENIED',
        "Cannot clinically edit another provider's work at this ceiling.",
      );
    }
  }
  const hasOrgScope = matchingGrants.some((g) => g.scopeMode === 'ORGANIZATION');
  const needsClientScope = matchingGrants.every((g) => g.scopeMode === 'ASSIGNED_CLIENTS');
  if (!hasOrgScope && needsClientScope) {
    if (!clientId) {
      if (allowUnscopedList) return;
      throw new AppError(403, 'CLIENT_SCOPE_REQUIRED', 'Client assignment scope required.');
    }
    const ok = await hasActiveClientAssignment(ctx.organizationId, ctx.userId, clientId);
    if (!ok) {
      throw new AppError(403, 'CLIENT_SCOPE_DENIED', 'No active client assignment.');
    }
  }
  void gte;
}

async function hasActiveClientAssignment(
  organizationId: string,
  userId: string,
  clientId: string,
): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ id: clientAssignments.id })
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.organizationId, organizationId),
        eq(clientAssignments.userId, userId),
        eq(clientAssignments.clientId, clientId),
        eq(clientAssignments.status, 'active'),
        or(isNull(clientAssignments.effectiveTo), gt(clientAssignments.effectiveTo, now)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function assertAuthorized(input: AuthorizeInput): Promise<boolean> {
  await authorize(input);
  return true;
}

export async function assertCapability(input: AuthorizeCapabilityInput): Promise<boolean> {
  await authorizeCapability(input);
  return true;
}
