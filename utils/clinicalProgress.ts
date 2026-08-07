import { MeasurementType, SessionProgramData } from '../types';

/**
 * Shared aggregation/formatting helpers for turning raw SessionProgramData
 * entries into displayable progress values. Deliberately small -- this is
 * not a general analytics framework, just the handful of pure functions
 * that were previously duplicated across ClinicalProgress.tsx and
 * ClientProfilePanel.tsx (three separate copies of the same percentage/
 * task-analysis math).
 */

export interface ProgramDataSource {
  date: string;
  programData?: SessionProgramData[];
}

/**
 * Normalizes a single program data point into a plain number suitable for
 * charting/sorting, regardless of measurement type.
 */
export const normalizeProgramValue = (
  pData: Pick<SessionProgramData, 'measurementType' | 'value'>
): number => {
  const { measurementType, value } = pData;

  if (measurementType === 'frequency' || measurementType === 'duration' || measurementType === 'intensity') {
    return Number(value) || 0;
  }

  if (measurementType === 'percentage') {
    const correct = Number(value?.correct) || 0;
    const total = Number(value?.total) || 0;
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  if (measurementType === 'task_analysis') {
    const steps = Object.values(value || {});
    const totalSteps = steps.length;
    const independentSteps = steps.filter(s => s === 'independent').length;
    return totalSteps > 0 ? Math.round((independentSteps / totalSteps) * 100) : 0;
  }

  return 0;
};

export const isPercentageMeasurement = (measurementType: MeasurementType): boolean =>
  measurementType === 'percentage' || measurementType === 'task_analysis';

/**
 * Formats a normalized value for display, adding the correct unit suffix
 * per measurement type (%, min, etc).
 */
export const formatProgramValue = (value: number, measurementType: MeasurementType): string => {
  if (isPercentageMeasurement(measurementType)) return `${value}%`;
  if (measurementType === 'duration') return `${value} min`;
  return `${value}`;
};

/**
 * Finds the most recent recorded data point for a given program across a
 * set of session notes (or any date+programData source).
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
 * Builds a chronological { date, value } series for a program, suitable
 * for feeding directly into a Recharts line/bar chart.
 */
export const buildProgramSeries = (
  notes: ProgramDataSource[],
  programId: string
): { date: string; value: number }[] => {
  return [...notes]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(note => {
      const pd = note.programData?.find(p => p.programId === programId);
      if (!pd) return null;
      return { date: note.date, value: normalizeProgramValue(pd) };
    })
    .filter((d): d is { date: string; value: number } => d !== null);
};
