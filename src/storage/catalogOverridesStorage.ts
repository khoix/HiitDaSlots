import type { Exercise } from "../types";
import { ALL_EXERCISES } from "../utils/allExercises";

const STORAGE_KEY = "hiitdaslots-catalog-overrides-v1";

export type CatalogOverrides = Record<string, Exercise>;

function isExerciseShape(x: unknown): x is Exercise {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.exercise === "string" &&
    typeof o.description === "string" &&
    typeof o.muscles === "string" &&
    typeof o.reps === "string" &&
    typeof o.interval === "string" &&
    typeof o.demo === "string"
  );
}

export function loadOverrides(): CatalogOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: CatalogOverrides = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && isExerciseShape(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: CatalogOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore quota */
  }
}

export function setOverride(canonicalKey: string, exercise: Exercise): void {
  const o = loadOverrides();
  o[canonicalKey] = exercise;
  saveOverrides(o);
}

export function clearOverride(canonicalKey: string): void {
  const o = loadOverrides();
  delete o[canonicalKey];
  saveOverrides(o);
}

export function getResolvedExercises(): Exercise[] {
  const overrides = loadOverrides();
  return ALL_EXERCISES.map((base) => overrides[base.exercise] ?? base);
}

export function buildExerciseByNameMap(
  exercises: Exercise[]
): Map<string, Exercise> {
  return new Map(exercises.map((ex) => [ex.exercise, ex]));
}

export function getResolvedCatalogRows(): {
  canonicalKey: string;
  exercise: Exercise;
}[] {
  const overrides = loadOverrides();
  return ALL_EXERCISES.map((base) => ({
    canonicalKey: base.exercise,
    exercise: overrides[base.exercise] ?? base,
  }));
}

/** Another row (different canonical key) already uses this display name. */
export function isDuplicateResolvedDisplayName(
  displayName: string,
  excludeCanonicalKey: string
): boolean {
  const trimmed = displayName.trim();
  if (!trimmed) return true;
  for (const { canonicalKey, exercise } of getResolvedCatalogRows()) {
    if (canonicalKey === excludeCanonicalKey) continue;
    if (exercise.exercise.trim() === trimmed) return true;
  }
  return false;
}
