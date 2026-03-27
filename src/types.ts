export type WorkoutMode = "time-attack" | "rep-quest";

export type ExerciseSourceMode =
  | "catalog"
  | "favorite_exercises"
  | "saved_workouts"
  | "favorites_and_saved";

export interface Exercise {
  exercise: string;
  description: string;
  muscles: string;
  reps: string;
  interval: string;
  demo: string;
}

export interface SetupOptions {
  mode: WorkoutMode;
  muscles: string[];
  circuits: number;
  exercisesPerCircuit: number;
  workInterval: number; // For time-attack
  restBetweenExercises: number;
  restBetweenCircuits: number;
  /** Rep Quest: 0 = easiest (min of recommended range), 100 = hardest (max). */
  repDifficulty?: number;
  /** Where to draw exercises from; default treated as `catalog` when omitted. */
  exerciseSourceMode?: ExerciseSourceMode;
}

export type WorkoutItemType = "exercise" | "rest";

export interface WorkoutItemBase {
  id: string;
  type: WorkoutItemType;
}

export interface ExerciseWorkoutItem extends WorkoutItemBase {
  type: "exercise";
  exercise: Exercise;
  targetReps?: string; // Used for non-hold rep-quest exercises.
  targetTime?: number; // Time-attack seconds, and rep-quest seconds when reps === "hold" (per-side for bilateral holds).
  isCompleted?: boolean; // for runner state
}

export interface RestWorkoutItem extends WorkoutItemBase {
  type: "rest";
  duration: number;
  isCircuitRest?: boolean;
}

export type WorkoutItem = ExerciseWorkoutItem | RestWorkoutItem;

export interface Circuit {
  id: string;
  circuitNumber: number;
  items: WorkoutItem[];
  /** Times to repeat this circuit’s body before inter-circuit rest; 1–9, default 1. */
  loopCount?: number;
}

export interface WorkoutPlan {
  options: SetupOptions;
  circuits: Circuit[];
  estimatedDurationSeconds: number;
  tags: string[];
  /** When set, rerolls / strict generation are limited to these catalog exercise names. */
  strictPoolExerciseKeys?: string[];
}

export type AppState =
  | "landing"
  | "setup"
  | "spinning"
  | "ready"
  | "editing"
  | "running"
  | "complete"
  | "history"
  | "savedWorkouts"
  | "favoriteExercises"
  | "exerciseCatalog"
  | "workoutBuilder";

/** Completed session log entry */
export interface WorkoutHistoryEntry {
  id: string;
  completedAtIso: string;
  plan: WorkoutPlan;
  title?: string;
  notes?: string;
}

/** User-named saved workout preset (full plan snapshot) */
export interface SavedWorkoutEntry {
  id: string;
  addedAtIso: string;
  plan: WorkoutPlan;
  name: string;
}

export interface FavoriteExerciseEntry {
  exerciseKey: string;
  addedAtIso: string;
}

export interface LastCompletedHint {
  completedAtIso: string;
  musclesLower: string[];
}

export const WORKOUT_LIBRARY_SCHEMA_VERSION = 1;

export interface WorkoutLibraryData {
  version: number;
  history: WorkoutHistoryEntry[];
  savedWorkouts: SavedWorkoutEntry[];
  favoriteExercises: FavoriteExerciseEntry[];
  lastCompleted?: LastCompletedHint;
}
