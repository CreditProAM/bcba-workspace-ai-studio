/**
 * Wave 1 domain-qualified capabilities.
 * Verbs remain; capabilities prevent cross-domain privilege bleed.
 */

export const Capabilities = {
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_LIFECYCLE: 'clients.lifecycle',
  STAFF_VIEW: 'staff.view',
  STAFF_EDIT: 'staff.edit',
  STAFF_LIFECYCLE: 'staff.lifecycle',
  CREDENTIALS_MANAGE: 'credentials.manage',
  FUNCTIONS_MANAGE: 'functions.manage',
  ASSIGNMENTS_MANAGE: 'assignments.manage',
} as const;

export type Capability = (typeof Capabilities)[keyof typeof Capabilities];

/** Capability → Operational Function codes that grant it. */
export const CAPABILITY_FUNCTIONS: Record<Capability, readonly string[]> = {
  [Capabilities.CLIENTS_VIEW]: [
    'org_admin',
    'intake',
    'scheduling',
    'insurance_pa',
    'billing',
    'reporting',
    'clinical_delivery',
    'clinical_supervision',
  ],
  [Capabilities.CLIENTS_CREATE]: ['org_admin', 'intake'],
  [Capabilities.CLIENTS_EDIT]: ['org_admin', 'intake'],
  [Capabilities.CLIENTS_LIFECYCLE]: ['org_admin', 'intake'],
  [Capabilities.STAFF_VIEW]: ['org_admin', 'hr_credentialing', 'payroll'],
  [Capabilities.STAFF_EDIT]: ['org_admin', 'hr_credentialing'],
  [Capabilities.STAFF_LIFECYCLE]: ['org_admin', 'hr_credentialing'],
  [Capabilities.CREDENTIALS_MANAGE]: ['org_admin', 'hr_credentialing'],
  [Capabilities.FUNCTIONS_MANAGE]: ['org_admin', 'hr_credentialing'],
  [Capabilities.ASSIGNMENTS_MANAGE]: ['org_admin', 'hr_credentialing', 'scheduling'],
};

export function grantsForCapability(
  grants: { code: string; scopeMode: string }[],
  capability: Capability,
): { code: string; scopeMode: string }[] {
  const allowed = new Set(CAPABILITY_FUNCTIONS[capability]);
  return grants.filter((g) => allowed.has(g.code));
}
