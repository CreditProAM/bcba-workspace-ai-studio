import { AppError } from './errors.js';

/** Optimistic concurrency helper — Wave 1+ modules use this pattern. */
export function assertRowVersionMatch(
  expected: number,
  actual: number | null | undefined,
  entityLabel = 'record',
): void {
  if (actual == null || actual !== expected) {
    throw new AppError(
      409,
      'VERSION_CONFLICT',
      `${entityLabel} was modified by another request (row_version mismatch).`,
    );
  }
}

export function nextRowVersion(current: number): number {
  return current + 1;
}
