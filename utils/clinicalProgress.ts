/**
 * Shared clinical-progress calculation utilities.
 *
 * Extracted from duplicated inline logic that previously existed separately in
 * components/data/ClinicalProgress.tsx and components/ClientProfilePanel.tsx --
 * both computed the same percentage/task-analysis formulas by hand, with no
 * shared source of truth. This file is that shared source.
 *
 * Deliberately small: a handful of pure functions over SessionProgramData, not
 * a general analytics framework. If a future need doesn't fit here cleanly,
 * that's a signal to design it separately rather than growing this file.
 */

import { MeasurementType, SessionProgramData } from '../types';

/** The minimal shape these utilities need from a session note -- lets callers
 * pass a real SessionNote without this file needing to import it. */
export interface ProgramDataSource {
  date: string;
  programData?: SessionProgramData[];
}

/**
 * Normalizes a single SessionProgramData entry into a plain number, regardless
 * of measurement type:
 *  - frequency / duration / intensity -> the raw numeric value entered
 *  - percentage                        -> correct/total as a rounded 0-100 percentage
 *  - task_analysis                     -> % of steps marked 'independent', rounded 0-100
 *
 * Never throws. Missing or malformed values (wrong shape, non-numeric, division
 * by zero) normalize to 0 rather than crashing a chart or a summary card.
 */
export const normalizeProgramValue = (pData: Pick<SessionProgramData, 'measurementType' | 'value'>): number => {
  const { measurementType, value } = pData;
  switch (measurementType) {
    case 'frequency':
    case 'duration':
    case 'intensity':
      return Number(value) || 0;
    case 'percentage': {
      const correct = Number(value?.correct) || 0;
      const total = Number(value?.total) || 0;
      return total > 0 ? Math.round((correct / total) * 100) : 0;
    }
    case 'task_analysis': {
      const steps = Object.values(value || {});
      const total = steps.length;
      const independent = steps.filter(s => s === 'independent').length;
      return total > 0 ? Math.round((independent / total) * 100) : 0;
    }
    default:
      return 0;
  }
};

/** True for measurement types whose normalized value is a 0-100 percentage. */
export const isPercentageMeasurement = (measurementType: MeasurementType): boolean =>
  measurementType === 'percentage' || measurementType === 'task_analysis';

/**
 * Formats an already-normalized value with the correct unit for display:
 * "%" for percentage/task_analysis, "min" for duration, bare number otherwise
 * (frequency, intensity -- intensity is a configured level, not a unit).
 */
export const formatProgramValue = (value: number, measurementType: MeasurementType): string => {
  if (isPercentageMeasurement(measurementType)) return `${value}%`;
  if (measurementType === 'duration') return `${value} min`;
  return `${value}`;
};

/**
 * Finds the most recent SessionProgramData recorded for a given program across
 * a client's session notes (sorted chronologically internally). Returns null if
 * the program has no data yet. Safe against legacy notes with no programData.
 */
export const getLatestProgramData = (
  notes: ProgramDataSource[],
  programId: string
): SessionProgramData | null => {
  const sorted = [...notes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = sorted.length - 1; i >= 0; i--) {
    const pd = sorted[i].programData?.find(p => p.programId === programId);
    if (pd) return pd;
  }
  return null;
};

/**
 * Builds a chronological, chart-ready series of { date, value } points for one
 * program from a client's session notes. Skips notes with no data for this
 * program (including legacy notes with no programData at all); never throws on
 * malformed data (see normalizeProgramValue).
 */
export const buildProgramSeries = (
  notes: ProgramDataSource[],
  programId: string
): { date: string; value: number }[] => {
  const sorted = [...notes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const series: { date: string; value: number }[] = [];

  for (const note of sorted) {
    const pData = note.programData?.find(p => p.programId === programId);
    if (!pData) continue;
    series.push({
      date: new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: normalizeProgramValue(pData),
    });
  }

  return series;
};
