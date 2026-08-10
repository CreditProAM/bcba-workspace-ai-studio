/**
 * Domain cutover registry — authoritative LOCAL | API ownership per domain.
 * Wave 0: all domains LOCAL. Do not switch screens to API in this wave.
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

/** Explicit per-domain ownership. Authoritative when set. */
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

/**
 * Emergency/default override from env. Only applied when a domain has not
 * been explicitly flipped in DOMAIN_MODE during a cutover wave.
 * Domain registry remains the migration mechanism — not this global switch.
 */
function emergencyDefault(): CutoverMode | null {
  const raw = import.meta.env.VITE_DATA_MODE as string | undefined;
  if (raw === 'api') return 'API';
  if (raw === 'local') return 'LOCAL';
  return null;
}

/** Wave 0: always LOCAL (registry all LOCAL). Future waves flip DOMAIN_MODE. */
export function getDomainMode(domain: CutoverDomain): CutoverMode {
  const registered = DOMAIN_MODE[domain];
  // While all registry entries are LOCAL, ignore emergency API default to
  // keep AI Studio / offline frontend safe until a domain intentionally cuts over.
  if (registered === 'LOCAL') return 'LOCAL';
  return registered;
}

export function isApiDomain(domain: CutoverDomain): boolean {
  return getDomainMode(domain) === 'API';
}

export function isLocalDomain(domain: CutoverDomain): boolean {
  return getDomainMode(domain) === 'LOCAL';
}

/** Exposed for tests / future cutover tooling — do not mutate at runtime in UI. */
export function getCutoverRegistry(): Readonly<Record<CutoverDomain, CutoverMode>> {
  return { ...DOMAIN_MODE };
}

// Reference emergencyDefault so env is documented / tree-shaken safely later.
void emergencyDefault;
