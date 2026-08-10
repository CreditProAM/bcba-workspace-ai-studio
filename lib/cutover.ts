/**
 * Domain cutover registry — authoritative LOCAL | API ownership per domain.
 * Wave 1: auth, clients, staff resolve from VITE_CUTOVER_* env vars.
 */

export type CutoverMode = 'LOCAL' | 'API';

export type CutoverDomain =
  | 'auth'
  | 'clients'
  | 'staff'
  | 'configuration'
  | 'events'
  | 'clinicalPlans'
  | 'clinicalData'
  | 'documents'
  | 'insurance'
  | 'authorization'
  | 'billing'
  | 'compensation'
  | 'attention'
  | 'activity'
  | 'files'
  | 'ai';

const WAVE1_ENV_KEYS: Partial<Record<CutoverDomain, string>> = {
  auth: 'VITE_CUTOVER_AUTH',
  clients: 'VITE_CUTOVER_CLIENTS',
  staff: 'VITE_CUTOVER_STAFF',
};

/** Explicit per-domain ownership for domains not yet env-driven. */
const DOMAIN_MODE: Record<CutoverDomain, CutoverMode> = {
  auth: 'LOCAL',
  clients: 'LOCAL',
  staff: 'LOCAL',
  configuration: 'LOCAL',
  events: 'LOCAL',
  clinicalPlans: 'LOCAL',
  clinicalData: 'LOCAL',
  documents: 'LOCAL',
  insurance: 'LOCAL',
  authorization: 'LOCAL',
  billing: 'LOCAL',
  compensation: 'LOCAL',
  attention: 'LOCAL',
  activity: 'LOCAL',
  files: 'LOCAL',
  ai: 'LOCAL',
};

function parseCutoverEnv(raw: string | undefined): CutoverMode | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'api') return 'API';
  if (normalized === 'local') return 'LOCAL';
  return null;
}

function resolveWave1Mode(domain: CutoverDomain): CutoverMode | null {
  const envKey = WAVE1_ENV_KEYS[domain];
  if (!envKey) return null;
  return parseCutoverEnv(import.meta.env[envKey] as string | undefined);
}

export function getDomainMode(domain: CutoverDomain): CutoverMode {
  const fromEnv = resolveWave1Mode(domain);
  if (fromEnv) return fromEnv;
  return DOMAIN_MODE[domain];
}

export function isApiDomain(domain: CutoverDomain): boolean {
  return getDomainMode(domain) === 'API';
}

export function isLocalDomain(domain: CutoverDomain): boolean {
  return getDomainMode(domain) === 'LOCAL';
}

/** Exposed for tests / future cutover tooling — do not mutate at runtime in UI. */
export function getCutoverRegistry(): Readonly<Record<CutoverDomain, CutoverMode>> {
  const registry = { ...DOMAIN_MODE };
  for (const domain of Object.keys(WAVE1_ENV_KEYS) as CutoverDomain[]) {
    registry[domain] = getDomainMode(domain);
  }
  return registry;
}
