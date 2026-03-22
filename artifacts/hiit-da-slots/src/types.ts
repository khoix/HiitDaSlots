export type WorkoutMode = "time-attack" | "rep-quest";

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
}

export type WorkoutItemType = 'exercise' | 'rest';

export interface WorkoutItemBase {
  id: string;
  type: WorkoutItemType;
}

export interface ExerciseWorkoutItem extends WorkoutItemBase {
  type: 'exercise';
  exercise: Exercise;
  targetReps?: string; // used in rep-quest
  targetTime?: number; // used in time-attack
  isCompleted?: boolean; // for runner state
}

export interface RestWorkoutItem extends WorkoutItemBase {
  type: 'rest';
  duration: number;
  isCircuitRest?: boolean;
}

export type WorkoutItem = ExerciseWorkoutItem | RestWorkoutItem;

export interface Circuit {
  id: string;
  circuitNumber: number;
  items: WorkoutItem[];
}

export interface WorkoutPlan {
  options: SetupOptions;
  circuits: Circuit[];
  estimatedDurationSeconds: number;
  tags: string[];
}

export type AppState = 'landing' | 'setup' | 'spinning' | 'ready' | 'editing' | 'running' | 'complete';
