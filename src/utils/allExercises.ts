import type { Exercise } from "../types";

let cachedAllExercises: Exercise[] | null = null;
let loadingPromise: Promise<Exercise[]> | null = null;

function normalizeExerciseBundle(raw: unknown): Exercise[] {
  if (Array.isArray(raw)) {
    return raw as Exercise[];
  }
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { exercises?: Exercise[] }).exercises)
  ) {
    return (raw as { exercises: Exercise[] }).exercises;
  }
  return [];
}

export async function loadAllExercises(): Promise<Exercise[]> {
  if (cachedAllExercises) return cachedAllExercises;
  if (!loadingPromise) {
    loadingPromise = import("../data/exercises.json")
      .then((mod) => {
        const normalized = normalizeExerciseBundle(mod.default);
        cachedAllExercises = normalized;
        return normalized;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

export function getAllExercisesSync(): Exercise[] {
  if (!cachedAllExercises) {
    throw new Error("Exercise catalog not loaded yet");
  }
  return cachedAllExercises;
}
