import exercisesData from '../data/exercises.json';
import { Circuit, Exercise, ExerciseWorkoutItem, RestWorkoutItem, SetupOptions, WorkoutPlan } from '../types';
import { parseMuscleString } from './parseMuscles';
import { generateId, shuffleArray } from './random';
import { parseIntervalToSeconds } from './timeUtils';

const allExercises: Exercise[] = exercisesData as Exercise[];

function filterExercisesByMuscles(muscles: string[]): Exercise[] {
  if (muscles.length === 0) return allExercises;
  const lowercaseSelected = muscles.map(m => m.toLowerCase());
  
  return allExercises.filter(ex => {
    const exMuscles = parseMuscleString(ex.muscles).map(m => m.toLowerCase());
    return exMuscles.some(m => lowercaseSelected.includes(m));
  });
}

function generateTags(muscles: string[]): string[] {
  const lowercaseMuscles = muscles.map(m => m.toLowerCase());
  const tags: string[] = [];
  
  if (lowercaseMuscles.includes('cardio')) tags.push('Cardio Crusher');
  if (lowercaseMuscles.includes('core') || lowercaseMuscles.includes('obliques')) tags.push('Core Blast');
  if (lowercaseMuscles.includes('quads') || lowercaseMuscles.includes('glutes') || lowercaseMuscles.includes('hamstrings') || lowercaseMuscles.includes('calves')) tags.push('Leg Burner');
  if (lowercaseMuscles.includes('chest') || lowercaseMuscles.includes('shoulders') || lowercaseMuscles.includes('triceps') || lowercaseMuscles.includes('biceps') || lowercaseMuscles.includes('back')) tags.push('Upper Body Hit');
  
  if (lowercaseMuscles.includes('full body') || tags.length >= 3) {
    return ['Full Body Frenzy'];
  }
  
  if (tags.length === 0) return ['Total Shred'];
  
  return tags.slice(0, 2);
}

export function generateWorkoutPlan(options: SetupOptions): WorkoutPlan {
  const availableExercises = filterExercisesByMuscles(options.muscles);
  
  // Fallback if filter is too restrictive
  const pool = availableExercises.length >= options.exercisesPerCircuit 
    ? availableExercises 
    : allExercises;

  const circuits: Circuit[] = [];
  let totalSeconds = 0;
  
  // Track last used to prevent immediate repetition if pool is small
  let lastUsedExName = "";

  for (let c = 0; c < options.circuits; c++) {
    const circuitItems: (ExerciseWorkoutItem | RestWorkoutItem)[] = [];
    const shuffledPool = shuffleArray(pool);
    
    let exercisesAdded = 0;
    for (const ex of shuffledPool) {
      if (exercisesAdded >= options.exercisesPerCircuit) break;
      if (ex.exercise === lastUsedExName && pool.length > 1) continue; // prevent immediate repeat
      
      // Calculate times
      const exerciseTime = options.mode === 'time-attack' 
        ? options.workInterval 
        : parseIntervalToSeconds(ex.interval);
        
      totalSeconds += exerciseTime;

      circuitItems.push({
        id: generateId(),
        type: 'exercise',
        exercise: ex,
        targetReps: ex.reps,
        targetTime: options.mode === 'time-attack' ? options.workInterval : undefined
      });
      
      exercisesAdded++;
      lastUsedExName = ex.exercise;

      // Add rest between exercises (except after the last one in the circuit)
      if (exercisesAdded < options.exercisesPerCircuit) {
        if (options.restBetweenExercises > 0) {
           circuitItems.push({
             id: generateId(),
             type: 'rest',
             duration: options.restBetweenExercises
           });
           totalSeconds += options.restBetweenExercises;
        }
      }
    }

    // Add rest between circuits (except after the very last circuit)
    if (c < options.circuits - 1) {
      circuitItems.push({
        id: generateId(),
        type: 'rest',
        duration: options.restBetweenCircuits,
        isCircuitRest: true
      });
      totalSeconds += options.restBetweenCircuits;
    }

    circuits.push({
      id: generateId(),
      circuitNumber: c + 1,
      items: circuitItems
    });
  }

  return {
    options,
    circuits,
    estimatedDurationSeconds: totalSeconds,
    tags: generateTags(options.muscles)
  };
}

export function rerollExercise(plan: WorkoutPlan, circuitId: string, itemId: string): WorkoutPlan {
  const newPlan = { ...plan, circuits: [...plan.circuits] };
  const circuitIndex = newPlan.circuits.findIndex(c => c.id === circuitId);
  if (circuitIndex === -1) return plan;

  const newCircuit = { ...newPlan.circuits[circuitIndex], items: [...newPlan.circuits[circuitIndex].items] };
  const itemIndex = newCircuit.items.findIndex(i => i.id === itemId);
  
  if (itemIndex === -1 || newCircuit.items[itemIndex].type !== 'exercise') return plan;

  const currentItem = newCircuit.items[itemIndex] as ExerciseWorkoutItem;
  
  // Find a new exercise from the matching pool that isn't the current one
  const pool = filterExercisesByMuscles(plan.options.muscles);
  const validPool = pool.length > 1 ? pool : allExercises;
  
  let newEx = validPool[Math.floor(Math.random() * validPool.length)];
  let attempts = 0;
  while (newEx.exercise === currentItem.exercise.exercise && attempts < 10) {
    newEx = validPool[Math.floor(Math.random() * validPool.length)];
    attempts++;
  }

  const exerciseTime = plan.options.mode === 'time-attack' 
    ? plan.options.workInterval 
    : parseIntervalToSeconds(newEx.interval);
    
  // Adjust total time approx (ignoring previous estimated duration diff for simplicity, or we recalculate fully)
  const oldTime = plan.options.mode === 'time-attack' ? plan.options.workInterval : parseIntervalToSeconds(currentItem.exercise.interval);
  newPlan.estimatedDurationSeconds = plan.estimatedDurationSeconds - oldTime + exerciseTime;

  newCircuit.items[itemIndex] = {
    id: generateId(),
    type: 'exercise',
    exercise: newEx,
    targetReps: newEx.reps,
    targetTime: plan.options.mode === 'time-attack' ? plan.options.workInterval : undefined
  };

  newPlan.circuits[circuitIndex] = newCircuit;
  return newPlan;
}
