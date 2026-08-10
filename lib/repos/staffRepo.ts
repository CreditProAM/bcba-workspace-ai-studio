import { apiFetch } from '../api/client';
import { isApiDomain } from '../cutover';

export type StaffMember = {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  employmentType: string;
  status: string;
  jobTitle?: string | null;
  hireDate?: string | null;
  terminatedAt?: string | null;
  rowVersion?: number;
};

export type StaffFunction = {
  id: string;
  code: string;
  name: string;
  scopeMode: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type StaffCredential = {
  id: string;
  number?: string | null;
  issuingBody?: string | null;
  status: string;
  effectiveOn?: string | null;
  expiresOn?: string | null;
  code: string;
  name: string;
  rowVersion?: number;
};

export type StaffDetail = {
  staff: StaffMember;
  functions: StaffFunction[];
  credentials: StaffCredential[];
};

export async function listStaff(): Promise<StaffMember[]> {
  if (!isApiDomain('staff')) {
    return [];
  }
  const res = await apiFetch<{ staff: StaffMember[] }>('/api/v1/staff');
  return res.staff;
}

export async function getStaff(membershipId: string): Promise<StaffDetail | null> {
  if (!isApiDomain('staff')) {
    return null;
  }
  const res = await apiFetch<StaffDetail>(`/api/v1/staff/${membershipId}`);
  return res;
}

export async function createStaff(input: {
  email: string;
  name: string;
  password: string;
  employmentType: 'employee' | 'contractor';
  jobTitle?: string;
}): Promise<StaffMember> {
  const res = await apiFetch<{ staff: StaffMember }>('/api/v1/staff', {
    method: 'POST',
    body: input,
  });
  return res.staff;
}

export async function patchStaff(
  membershipId: string,
  input: { employmentType?: 'employee' | 'contractor'; jobTitle?: string | null; rowVersion: number },
): Promise<StaffMember> {
  const res = await apiFetch<{ membership: StaffMember }>(`/api/v1/staff/${membershipId}`, {
    method: 'PATCH',
    body: input,
  });
  return res.membership;
}

export async function lifecycleStaff(
  membershipId: string,
  input: { status: 'active' | 'inactive' | 'terminated'; rowVersion: number; reason?: string },
): Promise<StaffMember> {
  const res = await apiFetch<{ membership: StaffMember }>(
    `/api/v1/staff/${membershipId}/lifecycle`,
    { method: 'POST', body: input },
  );
  return res.membership;
}

export async function grantFunction(
  membershipId: string,
  input: { functionCode: string; scopeMode: 'ORGANIZATION' | 'ASSIGNED_CLIENTS' },
): Promise<unknown> {
  const res = await apiFetch(`/api/v1/staff/${membershipId}/functions`, {
    method: 'POST',
    body: input,
  });
  return res;
}

export async function addCredential(
  membershipId: string,
  input: {
    credentialCode: string;
    number?: string;
    issuingBody?: string;
    effectiveOn?: string;
    expiresOn?: string;
    status?: 'active' | 'expired' | 'suspended' | 'revoked';
  },
): Promise<StaffCredential> {
  const res = await apiFetch<{ credential: StaffCredential }>(
    `/api/v1/staff/${membershipId}/credentials`,
    { method: 'POST', body: input },
  );
  return res.credential;
}
