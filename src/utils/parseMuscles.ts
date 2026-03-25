import type { Exercise } from '../types';
import { getResolvedExercises } from '../storage/catalogOverridesStorage';

export function parseMuscleString(muscleString: string): string[] {
  return muscleString
    .split(/[;,]/)
    .map(m => m.trim())
    .filter(m => m.length > 0)
    .map(m => {
      // Capitalize first letter
      return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    });
}

export function getAllUniqueMuscles(): string[] {
  const muscleSet = new Set<string>();
  getResolvedExercises().forEach((ex) => {
    const parsed = parseMuscleString(ex.muscles);
    parsed.forEach((m) => muscleSet.add(m));
  });
  return Array.from(muscleSet).sort();
}

/** Unique muscle labels from a subset of exercises (for scoped target chips). */
export function getUniqueMusclesFromExercises(exercises: Exercise[]): string[] {
  const muscleSet = new Set<string>();
  exercises.forEach((ex) => {
    parseMuscleString(ex.muscles).forEach((m) => muscleSet.add(m));
  });
  return Array.from(muscleSet).sort();
}
