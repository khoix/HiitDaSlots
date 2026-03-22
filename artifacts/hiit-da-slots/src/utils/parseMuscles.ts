import exercisesData from '../data/exercises.json';
import { Exercise } from '../types';

const exercises: Exercise[] = exercisesData as Exercise[];

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
  exercises.forEach(ex => {
    const parsed = parseMuscleString(ex.muscles);
    parsed.forEach(m => muscleSet.add(m));
  });
  return Array.from(muscleSet).sort();
}
