import {
  Circuit,
  Exercise,
  RestWorkoutItem,
  SetupOptions,
  WorkoutItem,
  WorkoutPlan,
} from "../types";
import { generateId } from "./random";
import { parseIntervalToSeconds } from "./timeUtils";
import {
  isBilateralHold,
  isHoldExercise,
  scaleHoldSecondsFromInterval,
} from "./repDifficulty";

export function clampLoopCount(n: number | undefined): number {
  const v = n ?? 1;
  if (!Number.isFinite(v)) return 1;
  return Math.min(9, Math.max(1, Math.floor(v)));
}

function estimatedItemSeconds(item: WorkoutItem, options: SetupOptions): number {
  if (item.type === "rest") return item.duration;
  return estimatedExerciseSeconds(item.exercise, options);
}

export function estimatedExerciseSeconds(ex: Exercise, options: SetupOptions): number {
  if (options.mode === "time-attack") {
    return options.workInterval;
  }
  if (isHoldExercise(ex)) {
    const seconds = scaleHoldSecondsFromInterval(
      ex.interval,
      options.repDifficulty ?? 50
    );
    return seconds * (isBilateralHold(ex) ? 2 : 1);
  }
  return parseIntervalToSeconds(ex.interval);
}

export function splitCircuitBodyAndRest(
  circuit: Circuit,
  hasRestBetweenNext: boolean
): { body: WorkoutItem[]; circuitRest: RestWorkoutItem | null } {
  const items = circuit.items;
  if (items.length === 0) return { body: [], circuitRest: null };
  const last = items[items.length - 1];
  if (
    hasRestBetweenNext &&
    last.type === "rest" &&
    (last as RestWorkoutItem).isCircuitRest
  ) {
    return {
      body: items.slice(0, -1),
      circuitRest: last as RestWorkoutItem,
    };
  }
  return { body: items, circuitRest: null };
}

function cloneWorkoutItemWithNewId(item: WorkoutItem): WorkoutItem {
  if (item.type === "exercise") {
    return { ...item, id: generateId() };
  }
  return { ...item, id: generateId() };
}

export function flattenPlanItemsForRunner(
  plan: WorkoutPlan
): Array<WorkoutItem & { circuitNum: number }> {
  const flat: Array<WorkoutItem & { circuitNum: number }> = [];
  const { circuits, options } = plan;
  const betweenLoopsSec = options.restBetweenCircuits;
  for (let ci = 0; ci < circuits.length; ci++) {
    const circuit = circuits[ci];
    const hasRestBetweenNext = ci < circuits.length - 1;
    const { body, circuitRest } = splitCircuitBodyAndRest(circuit, hasRestBetweenNext);
    const loops = clampLoopCount(circuit.loopCount);
    for (let r = 0; r < loops; r++) {
      for (const item of body) {
        const cloned = cloneWorkoutItemWithNewId(item);
        flat.push({ ...cloned, circuitNum: circuit.circuitNumber });
      }
      if (r < loops - 1 && betweenLoopsSec > 0) {
        const restBetweenLoops: RestWorkoutItem = {
          id: generateId(),
          type: "rest",
          duration: betweenLoopsSec,
        };
        flat.push({ ...restBetweenLoops, circuitNum: circuit.circuitNumber });
      }
    }
    if (circuitRest) {
      const cr = cloneWorkoutItemWithNewId(circuitRest) as RestWorkoutItem;
      flat.push({ ...cr, circuitNum: circuit.circuitNumber });
    }
  }
  return flat;
}

export function recalculatePlanDuration(plan: WorkoutPlan): number {
  let total = 0;
  const rb = plan.options.restBetweenCircuits;
  for (let ci = 0; ci < plan.circuits.length; ci++) {
    const c = plan.circuits[ci];
    const hasRestBetweenNext = ci < plan.circuits.length - 1;
    const { body, circuitRest } = splitCircuitBodyAndRest(c, hasRestBetweenNext);
    const loops = clampLoopCount(c.loopCount);
    for (const item of body) {
      total += estimatedItemSeconds(item, plan.options) * loops;
    }
    if (loops > 1 && rb > 0) {
      total += (loops - 1) * rb;
    }
    if (circuitRest) {
      total += circuitRest.duration;
    }
  }
  return total;
}
