import { isApiDomain } from './cutover';
import type { ClinicalCeiling, User } from '../types';

export type ClinicalMutationAction = 'author' | 'edit' | 'review' | 'approve';

export function canLocalClinicalMutation(
  user: User | null | undefined,
  action: ClinicalMutationAction,
  opts?: { authorUserId?: string },
): boolean {
  if (!user) return false;
  if (!isApiDomain('auth')) return true;

  const ceiling: ClinicalCeiling = user.clinicalCeiling ?? 'NONE';
  const authorUserId = opts?.authorUserId;
  const isOwn = !authorUserId || authorUserId === user.id;

  switch (ceiling) {
    case 'NONE':
      return false;
    case 'RBT':
      return action === 'author' && isOwn;
    case 'BCABA':
      if (action === 'review' || action === 'approve') return false;
      return (action === 'author' || action === 'edit') && isOwn;
    case 'BCBA':
      if (action === 'review' || action === 'approve') return true;
      return action === 'author' || action === 'edit';
    default:
      return false;
  }
}

export function assertCanLocalClinicalMutation(
  user: User | null | undefined,
  action: ClinicalMutationAction,
  opts?: { authorUserId?: string },
): void {
  if (!canLocalClinicalMutation(user, action, opts)) {
    throw new Error('Your clinical authority does not permit this action.');
  }
}
