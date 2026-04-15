import {
  Circuit,
  Exercise,
  ExerciseWorkoutItem,
  RestWorkoutItem,
  SetupOptions,
  WorkoutMode,
  WorkoutPlan,
} from "../types";
import {
  buildExerciseByNameMap,
  getResolvedExercises,
} from "../storage/catalogOverridesStorage";
import { getUniqueMusclesFromExercises, parseMuscleString } from "./parseMuscles";
import { generateId } from "./random";
import {
  isBilateralHold,
  isHoldExercise,
  scaleHoldSecondsFromInterval,
  scaleTargetRepsForDifficulty,
} from "./repDifficulty";
import {
  clampLoopCount,
  estimatedExerciseSeconds,
} from "./workoutPlanRuntime";

function targetRepsForMode(ex: Exercise, options: SetupOptions): string {
  if (options.mode !== "rep-quest") return ex.reps;
  const pct = options.repDifficulty ?? 50;
  return scaleTargetRepsForDifficulty(ex.reps, pct);
}

function targetTimeForMode(ex: Exercise, options: SetupOptions): number | undefined {
  if (options.mode === "time-attack") {
    return options.workInterval;
  }
  if (options.mode === "rep-quest" && isHoldExercise(ex)) {
    return scaleHoldSecondsFromInterval(ex.interval, options.repDifficulty ?? 50);
  }
  return undefined;
}


/** Filter `sourcePool` by selected muscle labels (empty selection = entire pool). */
export function filterExercisesByMusclesFromSource(
  muscles: string[],
  sourcePool: Exercise[]
): Exercise[] {
  if (muscles.length === 0) return [...sourcePool];
  const lowercaseSelected = muscles.map((m) => m.toLowerCase());

  return sourcePool.filter((ex) => {
    const exMuscles = parseMuscleString(ex.muscles).map((m) => m.toLowerCase());
    return exMuscles.some((m) => lowercaseSelected.includes(m));
  });
}

function pickNextExercise(pool: Exercise[], lastUsedExName: string): Exercise {
  if (pool.length === 0) {
    throw new Error("Exercise pool is empty");
  }
  const candidates = pool.filter(
    (ex) => pool.length <= 1 || ex.exercise !== lastUsedExName
  );
  const pickFrom = candidates.length > 0 ? candidates : pool;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}

function generateTags(muscles: string[]): string[] {
  if (muscles.length === 0) return ["Total Shred"];
  const lowercaseMuscles = muscles.map((m) => m.toLowerCase());
  const tags: string[] = [];

  if (lowercaseMuscles.includes("cardio")) tags.push("Cardio Crusher");
  if (lowercaseMuscles.includes("core") || lowercaseMuscles.includes("obliques"))
    tags.push("Core Blast");
  if (
    lowercaseMuscles.includes("quads") ||
    lowercaseMuscles.includes("glutes") ||
    lowercaseMuscles.includes("hamstrings") ||
    lowercaseMuscles.includes("calves")
  )
    tags.push("Leg Burner");
  if (
    lowercaseMuscles.includes("chest") ||
    lowercaseMuscles.includes("shoulders") ||
    lowercaseMuscles.includes("triceps") ||
    lowercaseMuscles.includes("biceps") ||
    lowercaseMuscles.includes("back")
  )
    tags.push("Upper Body Hit");

  if (lowercaseMuscles.includes("full body") || tags.length >= 3) {
    return ["Full Body Frenzy"];
  }

  if (tags.length === 0) return ["Total Shred"];

  return tags.slice(0, 2);
}

function isStrictSource(options: SetupOptions): boolean {
  const mode = options.exerciseSourceMode ?? "catalog";
  return mode !== "catalog";
}

/**
 * @param strictBasePool Required when `options.exerciseSourceMode` is not `catalog`.
 */
export function generateWorkoutPlan(
  options: SetupOptions,
  strictBasePool?: Exercise[]
): WorkoutPlan {
  const resolvedCatalog = getResolvedExercises();
  const strict = isStrictSource(options);
  const basePool = strict
    ? strictBasePool ?? []
    : resolvedCatalog;

  if (strict && basePool.length === 0) {
    throw new Error("Strict exercise pool is empty");
  }

  let pool: Exercise[];
  if (strict) {
    pool = filterExercisesByMusclesFromSource(options.muscles, basePool);
    if (pool.length === 0) {
      throw new Error("No exercises match the selected targets in your library");
    }
  } else {
    const available = filterExercisesByMusclesFromSource(
      options.muscles,
      resolvedCatalog
    );
    pool =
      available.length >= options.exercisesPerCircuit
        ? available
        : resolvedCatalog;
  }

  const circuits: Circuit[] = [];
  let totalSeconds = 0;
  let lastUsedExName = "";

  for (let c = 0; c < options.circuits; c++) {
    const circuitItems: (ExerciseWorkoutItem | RestWorkoutItem)[] = [];

    for (let e = 0; e < options.exercisesPerCircuit; e++) {
      const ex = pickNextExercise(pool, lastUsedExName);
      const exerciseTime = estimatedExerciseSeconds(ex, options);
      const targetTime = targetTimeForMode(ex, options);
      totalSeconds += exerciseTime;

      circuitItems.push({
        id: generateId(),
        type: "exercise",
        exercise: ex,
        targetReps: targetRepsForMode(ex, options),
        targetTime,
      });

      lastUsedExName = ex.exercise;

      if (e < options.exercisesPerCircuit - 1) {
        if (options.restBetweenExercises > 0) {
          circuitItems.push({
            id: generateId(),
            type: "rest",
            duration: options.restBetweenExercises,
          });
          totalSeconds += options.restBetweenExercises;
        }
      }
    }

    if (c < options.circuits - 1) {
      circuitItems.push({
        id: generateId(),
        type: "rest",
        duration: options.restBetweenCircuits,
        isCircuitRest: true,
      });
      totalSeconds += options.restBetweenCircuits;
    }

    circuits.push({
      id: generateId(),
      circuitNumber: c + 1,
      items: circuitItems,
      loopCount: 1,
    });
  }

  const plan: WorkoutPlan = {
    options,
    circuits,
    estimatedDurationSeconds: totalSeconds,
    tags: generateTags(options.muscles),
  };

  if (strict && basePool.length > 0) {
    plan.strictPoolExerciseKeys = basePool.map((ex) => ex.exercise);
  }

  return plan;
}

/** Timing fields for custom-built workouts (builder UI). */
export interface CustomWorkoutTimingInput {
  mode: WorkoutMode;
  workInterval: number;
  restBetweenExercises: number;
  restBetweenCircuits: number;
  repDifficulty?: number;
}

export interface BuildCircuitListsOptions {
  /** Same indices as `circuitLists` (empty slots ignored when building). */
  circuitLoopCounts?: number[];
}


/**
 * Build a plan from ordered exercise lists per circuit (empty circuits are skipped).
 */
export function buildWorkoutPlanFromCircuitLists(
  circuitLists: Exercise[][],
  timing: CustomWorkoutTimingInput,
  opts?: BuildCircuitListsOptions
): WorkoutPlan {
  const nonEmpty: Exercise[][] = [];
  const loopCountsAligned: number[] = [];
  for (let i = 0; i < circuitLists.length; i++) {
    if (circuitLists[i].length > 0) {
      nonEmpty.push(circuitLists[i]);
      loopCountsAligned.push(clampLoopCount(opts?.circuitLoopCounts?.[i]));
    }
  }
  if (nonEmpty.length === 0) {
    throw new Error("Add at least one exercise to your workout.");
  }
  const flatExercises = nonEmpty.flat();
  const muscles = getUniqueMusclesFromExercises(flatExercises);
  const maxPerCircuit = Math.max(...nonEmpty.map((c) => c.length));

  const options: SetupOptions = {
    mode: timing.mode,
    muscles,
    circuits: nonEmpty.length,
    exercisesPerCircuit: maxPerCircuit,
    workInterval: timing.workInterval,
    restBetweenExercises: timing.restBetweenExercises,
    restBetweenCircuits: timing.restBetweenCircuits,
    repDifficulty: timing.repDifficulty ?? 50,
    exerciseSourceMode: "catalog",
  };

  const circuits: Circuit[] = [];
  let totalSeconds = 0;

  for (let c = 0; c < nonEmpty.length; c++) {
    const list = nonEmpty[c];
    const loopN = loopCountsAligned[c] ?? 1;
    const circuitItems: (ExerciseWorkoutItem | RestWorkoutItem)[] = [];
    let circuitBodySeconds = 0;
    for (let e = 0; e < list.length; e++) {
      const ex = list[e];
      circuitBodySeconds += estimatedExerciseSeconds(ex, options);
      circuitItems.push({
        id: generateId(),
        type: "exercise",
        exercise: ex,
        targetReps: targetRepsForMode(ex, options),
        targetTime: targetTimeForMode(ex, options),
      });
      if (e < list.length - 1 && options.restBetweenExercises > 0) {
        circuitItems.push({
          id: generateId(),
          type: "rest",
          duration: options.restBetweenExercises,
        });
        circuitBodySeconds += options.restBetweenExercises;
      }
    }
    let circuitRestSeconds = 0;
    if (c < nonEmpty.length - 1) {
      circuitRestSeconds = options.restBetweenCircuits;
      circuitItems.push({
        id: generateId(),
        type: "rest",
        duration: options.restBetweenCircuits,
        isCircuitRest: true,
      });
    }
    const betweenLoopRestSeconds =
      loopN > 1 && options.restBetweenCircuits > 0
        ? (loopN - 1) * options.restBetweenCircuits
        : 0;
    totalSeconds +=
      circuitBodySeconds * loopN + betweenLoopRestSeconds + circuitRestSeconds;
    circuits.push({
      id: generateId(),
      circuitNumber: c + 1,
      items: circuitItems,
      loopCount: loopN,
    });
  }

  const strictKeys = [...new Set(flatExercises.map((e) => e.exercise))];

  return {
    options,
    circuits,
    estimatedDurationSeconds: totalSeconds,
    tags: generateTags(options.muscles),
    strictPoolExerciseKeys: strictKeys,
  };
}

export function buildWorkoutPlanFromOrderedExercises(
  ordered: Exercise[],
  timing: CustomWorkoutTimingInput
): WorkoutPlan {
  return buildWorkoutPlanFromCircuitLists([ordered], timing);
}

/**
 * Re-apply mode-derived exercise targets from plan options.
 * Useful when loading older saved/history plans with stale targetReps/targetTime values.
 */
export function reapplyPlanExerciseTargets(plan: WorkoutPlan): WorkoutPlan {
  return {
    ...plan,
    circuits: plan.circuits.map((circuit) => ({
      ...circuit,
      items: circuit.items.map((item) => {
        if (item.type !== "exercise") return item;
        return {
          ...item,
          targetReps: targetRepsForMode(item.exercise, plan.options),
          targetTime: targetTimeForMode(item.exercise, plan.options),
        };
      }),
    })),
  };
}

function exercisesFromStrictKeys(keys: string[] | undefined): Exercise[] {
  if (!keys?.length) return [];
  const map = buildExerciseByNameMap(getResolvedExercises());
  const out: Exercise[] = [];
  for (const k of keys) {
    const ex = map.get(k);
    if (ex) out.push(ex);
  }
  return out;
}

export function rerollExercise(
  plan: WorkoutPlan,
  circuitId: string,
  itemId: string
): WorkoutPlan {
  const newPlan = { ...plan, circuits: [...plan.circuits] };
  const circuitIndex = newPlan.circuits.findIndex((c) => c.id === circuitId);
  if (circuitIndex === -1) return plan;

  const newCircuit = {
    ...newPlan.circuits[circuitIndex],
    items: [...newPlan.circuits[circuitIndex].items],
  };
  const itemIndex = newCircuit.items.findIndex((i) => i.id === itemId);

  if (itemIndex === -1 || newCircuit.items[itemIndex].type !== "exercise")
    return plan;

  const currentItem = newCircuit.items[itemIndex] as ExerciseWorkoutItem;

  const strictBase = exercisesFromStrictKeys(plan.strictPoolExerciseKeys);
  const isStrict = strictBase.length > 0;
  const resolvedCatalog = getResolvedExercises();

  const universe = isStrict ? strictBase : resolvedCatalog;
  let pool = filterExercisesByMusclesFromSource(plan.options.muscles, universe);

  if (!isStrict) {
    const wide = filterExercisesByMusclesFromSource(
      plan.options.muscles,
      resolvedCatalog
    );
    if (pool.length <= 1) pool = wide.length > 1 ? wide : resolvedCatalog;
  } else {
    if (pool.length === 0) pool = strictBase;
  }

  if (pool.length === 0) return plan;

  let newEx = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (newEx.exercise === currentItem.exercise.exercise && attempts < 12) {
    newEx = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }

  const exerciseTime = estimatedExerciseSeconds(newEx, plan.options);

  const oldTime = estimatedExerciseSeconds(currentItem.exercise, plan.options);
  newPlan.estimatedDurationSeconds =
    plan.estimatedDurationSeconds - oldTime + exerciseTime;

  newCircuit.items[itemIndex] = {
    id: generateId(),
    type: "exercise",
    exercise: newEx,
    targetReps: targetRepsForMode(newEx, plan.options),
    targetTime: targetTimeForMode(newEx, plan.options),
  };

  newPlan.circuits[circuitIndex] = newCircuit;
  return newPlan;
}
