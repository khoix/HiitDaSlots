import raw from '../data/exercises.json';
import type { Exercise } from '../types';

/** Supports legacy top-level array or `{ exercises: [...] }` bundle shape. */
export const ALL_EXERCISES: Exercise[] = Array.isArray(raw)
  ? (raw as Exercise[])
  : Array.isArray((raw as { exercises?: Exercise[] }).exercises)
    ? (raw as { exercises: Exercise[] }).exercises
    : [];
