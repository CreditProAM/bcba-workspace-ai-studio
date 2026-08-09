import { MeasurementType, SessionProgramData, ObjectiveMasteryCriteria } from '../types';

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

/**
 * Objective Mastery Criteria V1 -- deterministic evaluation only.
 *
 * Deliberately built on top of buildProgramSeries()/normalizeProgramValue()
 * rather than a second interpretation of session data: an objective's
 * criterion is evaluated against the same program-linked, already-normalized
 * session series used everywhere else (the chart, the sidebar "Latest
 * Value"). Individual objectives do not currently have their own captured
 * session data (DataCollection.tsx records one value per program per
 * session, not per objective), so criterion evaluation is intentionally
 * scoped to the program's session series, matching how objectives are
 * actually tracked today.
 *
 * This module never touches ProgramStatus/ProgramObjective.status. Whether a
 * criterion is "achieved" is informational only -- the BCBA decides mastery.
 */

/** A single normalized value meets a criterion's target/direction. */
export const meetsCriterion = (value: number, criteria: ObjectiveMasteryCriteria): boolean =>
  criteria.comparison === 'at_least' ? value >= criteria.targetValue : value <= criteria.targetValue;

export interface ObjectiveCriterionProgress {
  /** Most recent recorded (normalized) session value, or null if no session data exists yet. */
  currentValue: number | null;
  /** Consecutive qualifying sessions counting back from the most recent, capped at requiredStreak for display. */
  currentStreak: number;
  /** criteria.consecutiveSessions, echoed back for convenient display. */
  requiredStreak: number;
  /** True once the raw (uncapped) consecutive streak meets or exceeds requiredStreak. Never mutates any stored status. */
  achieved: boolean;
}

/**
 * Walks a chronological program value series backward from the most recent
 * session, counting consecutive sessions that meet the criterion. The streak
 * resets the moment a session fails to meet it -- a single non-qualifying
 * session breaks the run, matching how consecutive-session mastery criteria
 * are clinically defined.
 */
export const evaluateObjectiveCriterion = (
  series: { date: string; value: number }[],
  criteria: ObjectiveMasteryCriteria
): ObjectiveCriterionProgress => {
  const requiredStreak = criteria.consecutiveSessions;

  if (series.length === 0) {
    return { currentValue: null, currentStreak: 0, requiredStreak, achieved: false };
  }

  let rawStreak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (meetsCriterion(series[i].value, criteria)) {
      rawStreak++;
    } else {
      break;
    }
  }

  return {
    currentValue: series[series.length - 1].value,
    currentStreak: Math.min(rawStreak, requiredStreak),
    requiredStreak,
    achieved: rawStreak >= requiredStreak,
  };
};

/** Short unit noun for a measurement type, used to label the target-value input. */
export const getMeasurementUnitLabel = (measurementType: MeasurementType): string => {
  switch (measurementType) {
    case 'frequency': return 'occurrences';
    case 'duration': return 'minutes';
    case 'percentage': return '%';
    case 'intensity': return 'level';
    case 'task_analysis': return '% independent';
    default: return '';
  }
};

/** Human-readable criterion sentence, e.g. "≥ 80% for 3 consecutive sessions". */
export const formatCriteriaLabel = (criteria: ObjectiveMasteryCriteria, measurementType: MeasurementType): string => {
  const symbol = criteria.comparison === 'at_least' ? '≥' : '≤';
  let valueLabel: string;
  switch (measurementType) {
    case 'percentage':
      valueLabel = `${criteria.targetValue}%`;
      break;
    case 'task_analysis':
      valueLabel = `${criteria.targetValue}% independent`;
      break;
    case 'duration':
      valueLabel = `${criteria.targetValue} minutes`;
      break;
    case 'intensity':
      valueLabel = `level ${criteria.targetValue}`;
      break;
    case 'frequency':
    default:
      valueLabel = `${criteria.targetValue} occurrences`;
  }
  const sessionsLabel = `${criteria.consecutiveSessions} consecutive session${criteria.consecutiveSessions === 1 ? '' : 's'}`;
  return `${symbol} ${valueLabel} for ${sessionsLabel}`;
};
