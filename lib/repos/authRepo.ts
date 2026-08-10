import { apiFetch, setCsrfToken } from '../api/client';
import { isApiDomain } from '../cutover';
import { ClinicalCeiling, User } from '../../types';

const STORAGE_KEY_USERS = 'bcba_users_v1';

export type AuthMeResponse = {
  user: { id: string; email: string; name: string };
  organizationId: string;
  membershipId: string;
  employmentType?: string;
  functions?: { code: string; name?: string; scopeMode: string }[];
  clinicalCeiling?: ClinicalCeiling;
};

type LoginResponse = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
  membershipId: string;
  csrfToken: string;
  functions?: { code: string; name?: string; scopeMode: string }[];
  clinicalCeiling?: ClinicalCeiling;
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function roleFromCeiling(ceiling?: ClinicalCeiling): User['role'] {
  switch (ceiling) {
    case 'BCBA':
      return 'BCBA';
    case 'BCABA':
      return 'BCaBA';
    case 'RBT':
      return 'RBT';
    case 'NONE':
      return 'Admin';
    default:
      return 'Admin';
  }
}

function mapApiUser(
  apiUser: { id: string; email: string; name: string },
  functions?: { code: string; name?: string; scopeMode: string }[],
  clinicalCeiling?: ClinicalCeiling,
): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    role: roleFromCeiling(clinicalCeiling),
    avatar: initials(apiUser.name),
    functions,
    clinicalCeiling,
  };
}

function localLogin(email: string, password: string): User {
  const storedUsersStr = localStorage.getItem(STORAGE_KEY_USERS);
  const storedUsers: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
  const user = storedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) {
    throw new Error('Invalid username or password.');
  }
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  if (!isApiDomain('auth')) {
    return localLogin(email, password);
  }

  const res = await apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setCsrfToken(res.csrfToken);
  return mapApiUser(res.user, res.functions, res.clinicalCeiling);
}

export async function logout(): Promise<void> {
  if (!isApiDomain('auth')) {
    return;
  }
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST', body: {} as Record<string, never> });
  } catch {
    // Session may already be gone; clear local CSRF regardless.
  }
  setCsrfToken(null);
}

export async function me(): Promise<User | null> {
  if (!isApiDomain('auth')) {
    return null;
  }
  try {
    const res = await apiFetch<AuthMeResponse>('/api/v1/auth/me');
    return mapApiUser(res.user, res.functions, res.clinicalCeiling);
  } catch {
    setCsrfToken(null);
    return null;
  }
}

export async function refreshCsrf(): Promise<void> {
  if (!isApiDomain('auth')) return;
  try {
    const res = await apiFetch<{ csrfToken: string }>('/api/v1/auth/csrf');
    setCsrfToken(res.csrfToken);
  } catch {
    // Caller handles unauthenticated state.
  }
}

export function persistLocalUser(user: User): void {
  if (isApiDomain('auth')) return;
  localStorage.setItem('bcba_current_user_v1', JSON.stringify(user));
}

export function clearLocalUser(): void {
  if (isApiDomain('auth')) return;
  localStorage.removeItem('bcba_current_user_v1');
}

export function loadLocalUser(): User | null {
  if (isApiDomain('auth')) return null;
  try {
    const saved = localStorage.getItem('bcba_current_user_v1');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
