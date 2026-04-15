import type { Exercise } from '../types';

/**
 * Maps difficulty 0–100 to a target rep count within each exercise's recommended range.
 * Easier → lower end of range, harder → upper end. Non-range strings are returned unchanged.
 */
export function scaleTargetRepsForDifficulty(
  recommendedReps: string,
  difficultyPercent: number
): string {
  const t = Math.min(100, Math.max(0, difficultyPercent)) / 100;
  const trimmed = recommendedReps.trim();

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)\s*(.*)$/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    const suffix = (rangeMatch[3] || '').trim();
    const n = Math.round(low + (high - low) * t);
    const clamped = Math.min(high, Math.max(low, n));
    if (!suffix) return String(clamped);
    return suffix.startsWith('/') ? `${clamped}${suffix}` : `${clamped} ${suffix}`;
  }

  if (/^\d+\s*$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

export function isHoldExercise(exercise: Exercise): boolean {
  return exercise.reps.trim().toLowerCase() === 'hold';
}

export function isBilateralRep(exercise: Exercise): boolean {
  if (isHoldExercise(exercise)) return false;
  return /\/side\b|per\s+side/i.test(exercise.reps);
}

export function isBilateralHold(exercise: Exercise): boolean {
  if (!isHoldExercise(exercise)) return false;
  return /\/side\b|per\s+side/i.test(exercise.interval);
}

/**
 * Maps difficulty 0–100 to seconds within an interval range.
 * Supports suffixes like "sec/side" by normalizing to plain "sec" first.
 */
export function scaleHoldSecondsFromInterval(
  interval: string,
  difficultyPercent: number
): number {
  const t = Math.min(100, Math.max(0, difficultyPercent)) / 100;
  const normalized = interval
    .toLowerCase()
    .replace(/\s*\/\s*side\b/g, '')
    .replace(/\bper\s+side\b/g, '')
    .trim();

  const match = normalized.match(/(\d+)(?:\s*-\s*(\d+))?\s*(sec|min)\b/i);
  if (!match) return 45;

  const low = parseInt(match[1], 10);
  const high = match[2] ? parseInt(match[2], 10) : low;
  let scaled = low + (high - low) * t;

  if (match[3].toLowerCase() === 'min') {
    scaled *= 60;
  }

  const rounded = Math.round(scaled);
  const lowBound = match[3].toLowerCase() === 'min' ? low * 60 : low;
  const highBound = match[3].toLowerCase() === 'min' ? high * 60 : high;
  return Math.min(highBound, Math.max(lowBound, rounded));
}

/** Short label for rep-quest difficulty slider (0–100). */
export function repDifficultyLabel(value: number): string {
  if (value === 0) return "Easiest";
  if (value === 100) return "Hardest";
  if (value <= 33) return "Easier";
  if (value >= 67) return "Harder";
  return "Standard";
}
