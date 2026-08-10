/** Stable action/verb registry for Wave 1 authorization checks. */
export const Verbs = {
  VIEW: 'VIEW',
  VIEW_CLINICAL_CONTENT: 'VIEW_CLINICAL_CONTENT',
  OPERATIONAL_QA: 'OPERATIONAL_QA',
  ROUTE_FOR_CORRECTION: 'ROUTE_FOR_CORRECTION',
  OPERATIONAL_CREATE: 'OPERATIONAL_CREATE',
  OPERATIONAL_EDIT: 'OPERATIONAL_EDIT',
  FINANCIAL_EDIT: 'FINANCIAL_EDIT',
  CLINICAL_AUTHOR: 'CLINICAL_AUTHOR',
  CLINICAL_EDIT: 'CLINICAL_EDIT',
  CLINICAL_REVIEW: 'CLINICAL_REVIEW',
  CLINICAL_APPROVE_SIGN: 'CLINICAL_APPROVE_SIGN',
  CONFIGURE: 'CONFIGURE',
  EXPORT: 'EXPORT',
  ARCHIVE_DEACTIVATE: 'ARCHIVE_DEACTIVATE',
} as const;

export type Verb = (typeof Verbs)[keyof typeof Verbs];

export const CLINICAL_VERBS: ReadonlySet<Verb> = new Set([
  Verbs.CLINICAL_AUTHOR,
  Verbs.CLINICAL_EDIT,
  Verbs.CLINICAL_REVIEW,
  Verbs.CLINICAL_APPROVE_SIGN,
]);

/** Function code → verbs it can grant (still Ceiling-gated for clinical). */
export const FUNCTION_VERBS: Record<string, Verb[]> = {
  org_admin: [
    Verbs.VIEW,
    Verbs.VIEW_CLINICAL_CONTENT,
    Verbs.OPERATIONAL_CREATE,
    Verbs.OPERATIONAL_EDIT,
    Verbs.CONFIGURE,
    Verbs.EXPORT,
    Verbs.ARCHIVE_DEACTIVATE,
    Verbs.ROUTE_FOR_CORRECTION,
    Verbs.OPERATIONAL_QA,
  ],
  scheduling: [Verbs.VIEW, Verbs.OPERATIONAL_CREATE, Verbs.OPERATIONAL_EDIT],
  intake: [
    Verbs.VIEW,
    Verbs.OPERATIONAL_CREATE,
    Verbs.OPERATIONAL_EDIT,
    Verbs.ARCHIVE_DEACTIVATE,
  ],
  insurance_pa: [Verbs.VIEW, Verbs.OPERATIONAL_CREATE, Verbs.OPERATIONAL_EDIT],
  billing: [
    Verbs.VIEW,
    Verbs.VIEW_CLINICAL_CONTENT,
    Verbs.FINANCIAL_EDIT,
    Verbs.OPERATIONAL_QA,
    Verbs.ROUTE_FOR_CORRECTION,
  ],
  hr_credentialing: [
    Verbs.VIEW,
    Verbs.OPERATIONAL_CREATE,
    Verbs.OPERATIONAL_EDIT,
    Verbs.CONFIGURE,
    Verbs.ARCHIVE_DEACTIVATE,
  ],
  payroll: [Verbs.VIEW, Verbs.FINANCIAL_EDIT],
  reporting: [Verbs.VIEW, Verbs.VIEW_CLINICAL_CONTENT, Verbs.EXPORT, Verbs.OPERATIONAL_QA],
  clinical_delivery: [
    Verbs.VIEW,
    Verbs.VIEW_CLINICAL_CONTENT,
    Verbs.CLINICAL_AUTHOR,
    Verbs.CLINICAL_EDIT,
  ],
  clinical_supervision: [
    Verbs.VIEW,
    Verbs.VIEW_CLINICAL_CONTENT,
    Verbs.CLINICAL_AUTHOR,
    Verbs.CLINICAL_EDIT,
    Verbs.CLINICAL_REVIEW,
    Verbs.CLINICAL_APPROVE_SIGN,
    Verbs.OPERATIONAL_QA,
    Verbs.ROUTE_FOR_CORRECTION,
  ],
};
