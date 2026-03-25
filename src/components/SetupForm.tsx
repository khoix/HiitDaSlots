import React, { useMemo, useEffect, useState } from "react";
import {
  WorkoutMode,
  SetupOptions,
  ExerciseSourceMode,
} from "../types";
import { getAllUniqueMuscles, getUniqueMusclesFromExercises } from "../utils/parseMuscles";
import { filterExercisesByMusclesFromSource } from "../utils/workoutGenerator";
import {
  resolveStrictExercisePool,
  getLastCompletedMusclesLower,
} from "../storage/workoutLibraryStorage";
import { ChevronRight, Target, Clock, Zap, Settings2, Library } from "lucide-react";
import { cn } from "../lib/utils";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import ExercisePoolReel from "./ExercisePoolReel";

interface Props {
  onComplete: (options: SetupOptions) => void;
  onCancel?: () => void;
}

function repDifficultyLabel(value: number): string {
  if (value === 0) return "Easiest";
  if (value === 100) return "Hardest";
  if (value <= 33) return "Easier";
  if (value >= 67) return "Harder";
  return "Standard";
}

function isCatalogMode(mode: ExerciseSourceMode): mode is "catalog" {
  return mode === "catalog";
}

function isExercisePoolOptionAvailable(id: ExerciseSourceMode): boolean {
  if (id === "catalog") return true;
  return resolveStrictExercisePool(id).length > 0;
}

function unavailablePoolTitle(id: ExerciseSourceMode): string | undefined {
  switch (id) {
    case "favorite_exercises":
      return "No favorite exercises yet — star some during a workout or in edit mode.";
    case "saved_workouts":
      return "No saved workouts yet — save a preset from the ready screen or history.";
    case "favorites_and_saved":
      return "Add starred exercises and/or saved workout presets to use this pool.";
    default:
      return undefined;
  }
}

const SOURCE_OPTIONS: {
  id: ExerciseSourceMode;
  label: string;
  description: string;
}[] = [
  {
    id: "catalog",
    label: "Full catalog",
    description: "All exercises; targets show every muscle group.",
  },
  {
    id: "favorite_exercises",
    label: "Favorite exercises",
    description: "Only exercises you’ve starred.",
  },
  {
    id: "saved_workouts",
    label: "Saved workouts",
    description: "Union of exercises from your saved workout presets.",
  },
  {
    id: "favorites_and_saved",
    label: "Favorites + saved",
    description: "Combine starred exercises and saved workout moves.",
  },
];

export default function SetupForm({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<WorkoutMode>("time-attack");
  const [exerciseSourceMode, setExerciseSourceMode] =
    useState<ExerciseSourceMode>("catalog");
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [circuits, setCircuits] = useState(3);
  const [exercisesPerCircuit, setExercisesPerCircuit] = useState(4);
  const [workInterval, setWorkInterval] = useState(45);
  const [restBetweenExercises, setRestBetweenExercises] = useState(15);
  const [restBetweenCircuits, setRestBetweenCircuits] = useState(60);
  const [repDifficulty, setRepDifficulty] = useState(50);

  const lastWorkedLower = useMemo(() => getLastCompletedMusclesLower(), []);

  /** Re-evaluate when returning to step 1 so pool availability stays in sync with the library. */
  const poolOptionAvailability = useMemo(
    (): Record<ExerciseSourceMode, boolean> => ({
      catalog: true,
      favorite_exercises: isExercisePoolOptionAvailable("favorite_exercises"),
      saved_workouts: isExercisePoolOptionAvailable("saved_workouts"),
      favorites_and_saved: isExercisePoolOptionAvailable("favorites_and_saved"),
    }),
    [step]
  );

  useEffect(() => {
    if (step !== 1) return;
    if (!poolOptionAvailability[exerciseSourceMode]) {
      setExerciseSourceMode("catalog");
    }
  }, [step, exerciseSourceMode, poolOptionAvailability]);

  const strictPool = useMemo(() => {
    if (isCatalogMode(exerciseSourceMode)) return [];
    return resolveStrictExercisePool(exerciseSourceMode);
  }, [exerciseSourceMode]);

  const allMuscles = useMemo(() => {
    if (isCatalogMode(exerciseSourceMode)) {
      return getAllUniqueMuscles();
    }
    return getUniqueMusclesFromExercises(strictPool);
  }, [exerciseSourceMode, strictPool]);

  useEffect(() => {
    setSelectedMuscles((prev) => prev.filter((m) => allMuscles.includes(m)));
  }, [allMuscles]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const validateStrictFilter = (): boolean => {
    if (isCatalogMode(exerciseSourceMode)) return true;
    if (strictPool.length === 0) return false;
    const filtered = filterExercisesByMusclesFromSource(
      selectedMuscles,
      strictPool
    );
    if (selectedMuscles.length > 0 && filtered.length === 0) {
      alert(
        "No exercises in your library match the selected targets. Change targets or exercise source."
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!isCatalogMode(exerciseSourceMode) && strictPool.length === 0) {
        alert(
          "Add favorite exercises or save a workout first to use this exercise source."
        );
        return;
      }
    }
    if (step === 2 && !validateStrictFilter()) return;
    playSound(SOUNDS.uiConfirm);
    setStep((s) => s + 1);
  };

  const handleFinish = () => {
    if (!validateStrictFilter()) return;
    playSound(SOUNDS.uiConfirm);
    onComplete({
      mode,
      muscles: selectedMuscles,
      circuits,
      exercisesPerCircuit,
      workInterval,
      restBetweenExercises,
      restBetweenCircuits,
      exerciseSourceMode,
      ...(mode === "rep-quest" ? { repDifficulty } : {}),
    });
  };

  const toggleMuscle = (m: string) => {
    playSound(SOUNDS.uiSelect);
    if (selectedMuscles.includes(m)) {
      setSelectedMuscles(selectedMuscles.filter((x) => x !== m));
    } else {
      setSelectedMuscles([...selectedMuscles, m]);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 min-h-0">
      <div className="w-full max-w-2xl arcade-card p-6 md:p-10 rounded-xl relative overflow-hidden">
        <div className="flex justify-between mb-8 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-display border-2 transition-all duration-300",
                  step >= i
                    ? "border-primary bg-background neon-text-primary shadow-[0_0_10px_hsl(var(--primary))]"
                    : "border-border text-muted-foreground bg-background"
                )}
              >
                {i}
              </div>
              <span className="text-xs mt-2 uppercase tracking-widest text-muted-foreground hidden sm:block">
                {i === 1 ? "Mode" : i === 2 ? "Target" : "Params"}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-10 right-10 h-[2px] bg-border z-0">
            <div
              className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_hsl(var(--primary))]"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-6 text-center text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
              <Settings2 className="text-secondary" /> Select Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiSelect);
                  setMode("time-attack");
                }}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all",
                  mode === "time-attack"
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)_/_0.3)]"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Clock
                  className={cn(
                    "w-10 h-10 mb-4",
                    mode === "time-attack" ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <h3 className="text-2xl font-display mb-2">Time Attack</h3>
                <p className="text-sm text-foreground/70 font-sans">
                  Work against the clock. Intervals of work and rest.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiSelect);
                  setMode("rep-quest");
                }}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all",
                  mode === "rep-quest"
                    ? "border-secondary bg-secondary/10 shadow-[0_0_15px_hsl(var(--secondary)_/_0.3)]"
                    : "border-border hover:border-secondary/50"
                )}
              >
                <Zap
                  className={cn(
                    "w-10 h-10 mb-4",
                    mode === "rep-quest" ? "text-secondary" : "text-muted-foreground"
                  )}
                />
                <h3 className="text-2xl font-display mb-2">Rep Quest</h3>
                <p className="text-sm text-foreground/70 font-sans">
                  Complete the target reps at your own pace.
                </p>
              </button>
            </div>

            <h3 className="text-lg font-display mt-10 mb-3 text-center uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2">
              <Library className="w-5 h-5 text-accent" />
              Exercise pool
            </h3>
            <ExercisePoolReel
              value={exerciseSourceMode}
              onChange={setExerciseSourceMode}
              options={SOURCE_OPTIONS}
              availability={poolOptionAvailability}
              inactiveTitle={unavailablePoolTitle}
            />

            <div className="mt-10 flex justify-between">
              {onCancel ? (
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiCancel);
                    onCancel();
                  }}
                  className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest transition-colors"
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleNext}
                className="arcade-btn-primary px-8 py-3 rounded flex items-center gap-2"
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-2 text-center text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
              <Target className="text-accent" /> Target Areas
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-6 font-sans max-w-md mx-auto">
              {selectedMuscles.length === 0
                ? "None selected (Surprise Me!)"
                : "Build workout around selected muscle group(s)."}
            </p>
            {!isCatalogMode(exerciseSourceMode) && allMuscles.length === 0 ? (
              <p className="text-center text-destructive text-sm mb-8">
                No muscle tags found in your library. Add exercises with muscle data.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {allMuscles.map((m) => {
                  const isSelected = selectedMuscles.includes(m);
                  const isLastWorked =
                    !isSelected &&
                    lastWorkedLower.includes(m.toLowerCase());
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMuscle(m)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-all",
                        isSelected
                          ? "border-accent bg-accent/20 text-accent shadow-[0_0_10px_hsl(var(--accent)_/_0.4)]"
                          : cn(
                              "border-border text-foreground/60 hover:border-accent/50 hover:text-foreground",
                              isLastWorked &&
                                "ring-1 ring-primary/30 text-foreground/80"
                            )
                      )}
                      title={
                        isLastWorked ? "Worked last session" : undefined
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between mt-10">
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiCancel);
                  setStep(1);
                }}
                className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="arcade-btn-primary px-8 py-3 rounded flex items-center gap-2"
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-8 text-center text-foreground uppercase tracking-widest">
              Game Settings
            </h2>

            <div className="space-y-6 max-w-md mx-auto">
              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-primary mb-2">
                  <span>Circuits</span>
                  <span className="text-foreground">{circuits}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={circuits}
                  onChange={(e) => setCircuits(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-primary mb-2">
                  <span>Exercises Per Circuit</span>
                  <span className="text-foreground">{exercisesPerCircuit}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={exercisesPerCircuit}
                  onChange={(e) =>
                    setExercisesPerCircuit(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {mode === "time-attack" && (
                <div>
                  <label className="flex justify-between text-sm uppercase font-bold text-secondary mb-2">
                    <span>Work Interval (sec)</span>
                    <span className="text-foreground">{workInterval}s</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="5"
                    value={workInterval}
                    onChange={(e) => setWorkInterval(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {mode === "rep-quest" && (
                <div>
                  <label className="flex justify-between text-sm uppercase font-bold text-secondary mb-2">
                    <span>Difficulty (target reps)</span>
                    <span className="text-foreground tabular-nums">
                      {repDifficultyLabel(repDifficulty)}
                    </span>
                  </label>
                  <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    <span>Fewer reps</span>
                    <span>More reps</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={repDifficulty}
                    onChange={(e) =>
                      setRepDifficulty(parseInt(e.target.value, 10))
                    }
                    className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-secondary"
                  />
                </div>
              )}

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-secondary mb-2">
                  <span>Rest Between Exercises (sec)</span>
                  <span className="text-foreground">{restBetweenExercises}s</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={restBetweenExercises}
                  onChange={(e) =>
                    setRestBetweenExercises(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-accent mb-2">
                  <span>Rest Between Circuits (sec)</span>
                  <span className="text-foreground">{restBetweenCircuits}s</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="15"
                  value={restBetweenCircuits}
                  onChange={(e) =>
                    setRestBetweenCircuits(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-between mt-12">
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiCancel);
                  setStep(2);
                }}
                className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="arcade-btn-secondary px-8 py-3 rounded flex items-center gap-2"
              >
                Generate Workout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
