import type {
  Exercise,
  ExerciseSourceMode,
  FavoriteExerciseEntry,
  LastCompletedHint,
  SavedWorkoutEntry,
  WorkoutHistoryEntry,
  WorkoutLibraryData,
  WorkoutPlan,
} from "../types";
import { WORKOUT_LIBRARY_SCHEMA_VERSION } from "../types";
import { generateId } from "../utils/random";
import type { ExerciseWorkoutItem } from "../types";
import {
  buildExerciseByNameMap,
  getResolvedExercises,
} from "./catalogOverridesStorage";

const STORAGE_KEY = "hiitdaslots-workout-library-v1";
const MAX_HISTORY = 100;

function exerciseByNameMap(): Map<string, Exercise> {
  return buildExerciseByNameMap(getResolvedExercises());
}

function defaultLibrary(): WorkoutLibraryData {
  return {
    version: WORKOUT_LIBRARY_SCHEMA_VERSION,
    history: [],
    savedWorkouts: [],
    favoriteExercises: [],
    lastCompleted: undefined,
  };
}

export function loadWorkoutLibrary(): WorkoutLibraryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLibrary();
    const parsed = JSON.parse(raw) as Partial<WorkoutLibraryData>;
    if (!parsed || typeof parsed !== "object") return defaultLibrary();
    return {
      ...defaultLibrary(),
      ...parsed,
      version: WORKOUT_LIBRARY_SCHEMA_VERSION,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      savedWorkouts: Array.isArray(parsed.savedWorkouts) ? parsed.savedWorkouts : [],
      favoriteExercises: Array.isArray(parsed.favoriteExercises)
        ? parsed.favoriteExercises
        : [],
      lastCompleted: parsed.lastCompleted ?? undefined,
    };
  } catch {
    return defaultLibrary();
  }
}

function saveWorkoutLibrary(data: WorkoutLibraryData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function clonePlan(plan: WorkoutPlan): WorkoutPlan {
  return JSON.parse(JSON.stringify(plan)) as WorkoutPlan;
}

/** Exercises referenced in a plan snapshot (deduped by name). */
export function collectExercisesFromPlan(plan: WorkoutPlan): Exercise[] {
  const map = new Map<string, Exercise>();
  for (const c of plan.circuits) {
    for (const item of c.items) {
      if (item.type === "exercise") {
        const ex = (item as ExerciseWorkoutItem).exercise;
        map.set(ex.exercise, ex);
      }
    }
  }
  return [...map.values()];
}

export function resolveExerciseByKey(exerciseKey: string): Exercise | undefined {
  return exerciseByNameMap().get(exerciseKey);
}

export function resolveStrictExercisePool(
  mode: Exclude<ExerciseSourceMode, "catalog">
): Exercise[] {
  const lib = loadWorkoutLibrary();
  const catalogByName = exerciseByNameMap();
  const fromFavorites = (): Exercise[] => {
    const out: Exercise[] = [];
    for (const fe of lib.favoriteExercises) {
      const ex = catalogByName.get(fe.exerciseKey);
      if (ex) out.push(ex);
    }
    return out;
  };
  const fromSaved = (): Exercise[] => {
    const byName = new Map<string, Exercise>();
    for (const sw of lib.savedWorkouts) {
      for (const ex of collectExercisesFromPlan(sw.plan)) {
        byName.set(ex.exercise, ex);
      }
    }
    return [...byName.values()];
  };

  if (mode === "favorite_exercises") return fromFavorites();
  if (mode === "saved_workouts") return fromSaved();
  const merged = new Map<string, Exercise>();
  for (const ex of fromFavorites()) merged.set(ex.exercise, ex);
  for (const ex of fromSaved()) merged.set(ex.exercise, ex);
  return [...merged.values()];
}

export function appendHistoryFromPlan(plan: WorkoutPlan): WorkoutHistoryEntry {
  const lib = loadWorkoutLibrary();
  const entry: WorkoutHistoryEntry = {
    id: generateId(),
    completedAtIso: new Date().toISOString(),
    plan: clonePlan(plan),
    title: new Date().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
  lib.history = [entry, ...lib.history].slice(0, MAX_HISTORY);
  saveWorkoutLibrary(lib);
  return entry;
}

export function setLastCompletedFromPlan(plan: WorkoutPlan): void {
  const lib = loadWorkoutLibrary();
  const hint: LastCompletedHint = {
    completedAtIso: new Date().toISOString(),
    musclesLower: plan.options.muscles.map((m) => m.toLowerCase()),
  };
  lib.lastCompleted = hint;
  saveWorkoutLibrary(lib);
}

export function getLastCompletedMusclesLower(): string[] {
  return loadWorkoutLibrary().lastCompleted?.musclesLower ?? [];
}

export function updateHistoryMetadata(
  id: string,
  patch: { title?: string; notes?: string }
): void {
  const lib = loadWorkoutLibrary();
  lib.history = lib.history.map((h) =>
    h.id === id ? { ...h, ...patch } : h
  );
  saveWorkoutLibrary(lib);
}

export function removeHistoryEntry(id: string): void {
  const lib = loadWorkoutLibrary();
  lib.history = lib.history.filter((h) => h.id !== id);
  saveWorkoutLibrary(lib);
}

export function addSavedWorkout(name: string, plan: WorkoutPlan): SavedWorkoutEntry {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  const lib = loadWorkoutLibrary();
  const entry: SavedWorkoutEntry = {
    id: generateId(),
    addedAtIso: new Date().toISOString(),
    name: trimmed,
    plan: clonePlan(plan),
  };
  lib.savedWorkouts = [entry, ...lib.savedWorkouts];
  saveWorkoutLibrary(lib);
  return entry;
}

export function updateSavedWorkoutMetadata(
  id: string,
  patch: { name: string }
): void {
  const trimmed = patch.name.trim();
  if (!trimmed) throw new Error("Name required");
  const lib = loadWorkoutLibrary();
  lib.savedWorkouts = lib.savedWorkouts.map((s) =>
    s.id === id ? { ...s, name: trimmed } : s
  );
  saveWorkoutLibrary(lib);
}

export function removeSavedWorkout(id: string): void {
  const lib = loadWorkoutLibrary();
  lib.savedWorkouts = lib.savedWorkouts.filter((s) => s.id !== id);
  saveWorkoutLibrary(lib);
}

export function migrateFavoriteExerciseKey(
  oldName: string,
  newName: string
): void {
  if (oldName === newName) return;
  const lib = loadWorkoutLibrary();
  const seen = new Set<string>();
  const out: FavoriteExerciseEntry[] = [];
  for (const f of lib.favoriteExercises) {
    const key = f.exerciseKey === oldName ? newName : f.exerciseKey;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key === f.exerciseKey ? f : { ...f, exerciseKey: newName });
  }
  lib.favoriteExercises = out;
  saveWorkoutLibrary(lib);
}

export function toggleFavoriteExercise(exerciseKey: string): boolean {
  if (!exerciseByNameMap().has(exerciseKey)) return false;
  const lib = loadWorkoutLibrary();
  const idx = lib.favoriteExercises.findIndex((f) => f.exerciseKey === exerciseKey);
  if (idx >= 0) {
    lib.favoriteExercises = lib.favoriteExercises.filter((_, i) => i !== idx);
    saveWorkoutLibrary(lib);
    return false;
  }
  const next: FavoriteExerciseEntry = {
    exerciseKey,
    addedAtIso: new Date().toISOString(),
  };
  lib.favoriteExercises = [...lib.favoriteExercises, next].slice(-200);
  saveWorkoutLibrary(lib);
  return true;
}

export function isFavoriteExercise(exerciseKey: string): boolean {
  return loadWorkoutLibrary().favoriteExercises.some(
    (f) => f.exerciseKey === exerciseKey
  );
}

export function removeFavoriteExercise(exerciseKey: string): void {
  const lib = loadWorkoutLibrary();
  lib.favoriteExercises = lib.favoriteExercises.filter(
    (f) => f.exerciseKey !== exerciseKey
  );
  saveWorkoutLibrary(lib);
}

export function listFavoriteExerciseEntries(): FavoriteExerciseEntry[] {
  return [...loadWorkoutLibrary().favoriteExercises].sort((a, b) =>
    a.exerciseKey.localeCompare(b.exerciseKey)
  );
}
