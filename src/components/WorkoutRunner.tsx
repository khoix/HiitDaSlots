import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkoutPlan, WorkoutItem, ExerciseWorkoutItem, RestWorkoutItem } from '../types';
import { useSessionMedia } from '@/context/SessionMediaContext';
import { formatSeconds } from '../utils/timeUtils';
import { openDemoLink, hasDemoLink } from '../utils/openDemo';
import { Play, Pause, FastForward, CheckCircle, Trophy, ExternalLink, Star } from 'lucide-react';
import { isFavoriteExercise, toggleFavoriteExercise } from '../storage/workoutLibraryStorage';
import { cn } from '../lib/utils';
import { playSound } from '../audio/playSfx';
import { SOUNDS } from '../audio/soundManifest';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { isBilateralHold, isBilateralRep, isHoldExercise } from '../utils/repDifficulty';
import { flattenPlanItemsForRunner } from '../utils/workoutPlanRuntime';

const AUTO_START_STORAGE_KEY = 'hiitdaslots-auto-start-interval';
type BilateralPhase = 'first' | 'transition' | 'second' | null;

/** Drives the session HUD workout bar (not music). */
function computeWorkoutHudProgressPct(
  flatLen: number,
  currentIndex: number,
  isDone: boolean,
  currentItem: WorkoutItem | undefined,
  timeLeft: number | null,
  inTransition: boolean
): number {
  if (isDone) return 100;
  if (flatLen <= 0) return 0;
  const n = flatLen;
  let base = (currentIndex / n) * 100;
  const seg = 100 / n;

  if (currentItem?.type === 'rest' && timeLeft !== null && currentItem.duration > 0) {
    base += ((currentItem.duration - timeLeft) / currentItem.duration) * seg;
  } else if (
    currentItem?.type === 'exercise' &&
    timeLeft !== null &&
    !inTransition &&
    currentItem.targetTime != null &&
    currentItem.targetTime > 0
  ) {
    base += ((currentItem.targetTime - timeLeft) / currentItem.targetTime) * seg;
  } else if (
    currentItem?.type === 'exercise' &&
    inTransition &&
    timeLeft !== null
  ) {
    const td = 5;
    const clamped = Math.min(td, Math.max(0, timeLeft));
    base += ((td - clamped) / td) * seg;
  }

  return Math.min(100, Math.max(0, base));
}

interface Props {
  plan: WorkoutPlan;
  onFinish: () => void;
  onQuit: () => void;
}

export default function WorkoutRunner({ plan, onFinish, onQuit }: Props) {
  const { setWorkoutHudProgress } = useSessionMedia();
  const flatItems = useMemo(() => flattenPlanItemsForRunner(plan), [plan]);
  const firstExerciseIndex = flatItems.findIndex((item) => item.type === 'exercise');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [bilateralPhase, setBilateralPhase] = useState<BilateralPhase>(null);
  const [autoStartNext, setAutoStartNext] = useState(() => {
    try {
      return localStorage.getItem(AUTO_START_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const autoStartNextRef = useRef(autoStartNext);
  autoStartNextRef.current = autoStartNext;
  const hasPlayedFiveSecondTick = useRef(false);
  const [favoriteTick, setFavoriteTick] = useState(0);
  /** Latest segment-completion handler for interval tick (avoids stale closures). */
  const segmentCompleteRef = useRef<() => void>(() => {});

  const currentItem = flatItems[currentIndex] as any;
  const isDone = currentIndex >= flatItems.length;
  const isExerciseItem = !isDone && currentItem?.type === 'exercise';
  const currentExercise = isExerciseItem ? (currentItem as ExerciseWorkoutItem).exercise : null;

  const exerciseFavorite = useMemo(() => {
    void favoriteTick;
    if (!currentExercise) return false;
    return isFavoriteExercise(currentExercise.exercise);
  }, [currentExercise, favoriteTick]);
  const currentIsHold = !!currentExercise && isHoldExercise(currentExercise);
  const currentIsBilateralHold = !!currentExercise && isBilateralHold(currentExercise);
  const currentIsBilateralRep =
    !!currentExercise &&
    plan.options.mode === 'rep-quest' &&
    isBilateralRep(currentExercise);
  const currentIsTimedExercise =
    isExerciseItem &&
    (plan.options.mode === 'time-attack' ||
      (plan.options.mode === 'rep-quest' && currentIsHold));
  const sideDuration = currentItem?.targetTime ?? null;
  const inTransition = bilateralPhase === 'transition';

  // Initialize timer when item changes
  useEffect(() => {
    if (isDone) return;
    
    if (currentItem.type === 'rest') {
      setBilateralPhase(null);
      setTimeLeft(currentItem.duration);
      setIsRunning(true);
    } else if (currentItem.type === 'exercise') {
      const isHold = isHoldExercise(currentItem.exercise);
      const isBilateral = isBilateralHold(currentItem.exercise);
      const isFirstWorkoutExercise =
        firstExerciseIndex >= 0 && currentIndex === firstExerciseIndex;
      const shouldAutoStart =
        plan.options.mode === 'time-attack' &&
        autoStartNextRef.current &&
        !isFirstWorkoutExercise;
      if (plan.options.mode === 'time-attack' || (plan.options.mode === 'rep-quest' && isHold)) {
        setTimeLeft(currentItem.targetTime ?? null);
        setBilateralPhase(isBilateral ? 'first' : null);
        setIsRunning(shouldAutoStart);
      } else {
        setBilateralPhase(currentIsBilateralRep ? 'first' : null);
        setTimeLeft(null);
        setIsRunning(false);
      }
    } else {
      setBilateralPhase(null);
      setTimeLeft(null); // Rep quest exercise
      setIsRunning(false);
    }
  }, [currentIndex, isDone, currentItem?.id, currentIsBilateralRep]);

  useEffect(() => {
    hasPlayedFiveSecondTick.current = false;
  }, [currentIndex, bilateralPhase]);

  useEffect(() => {
    if (
      !isRunning ||
      timeLeft === null ||
      // Timer should be 1Hz integer steps, but guard against any drift.
      Math.round(timeLeft) !== 5
    ) {
      return;
    }
    if (hasPlayedFiveSecondTick.current) return;
    hasPlayedFiveSecondTick.current = true;
    playSound(SOUNDS.workoutCountdownTick);
  }, [timeLeft, isRunning]);

  const handleNext = () => {
    if (currentIndex < flatItems.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setIsRunning(false);
      setCurrentIndex(flatItems.length); // Trigger done state
    }
  };

  const completeCurrentTimedSegment = () => {
    if (!isExerciseItem || !currentIsTimedExercise) {
      handleNext();
      return;
    }
    if (!currentIsBilateralHold) {
      handleNext();
      return;
    }
    if (sideDuration === null) {
      handleNext();
      return;
    }
    if (bilateralPhase === 'first') {
      if (plan.options.mode === 'time-attack' && autoStartNextRef.current) {
        setBilateralPhase('transition');
        setTimeLeft(5);
        setIsRunning(true);
      } else {
        setBilateralPhase('transition');
        setTimeLeft(null);
        setIsRunning(false);
      }
      return;
    }
    if (bilateralPhase === 'transition') {
      setBilateralPhase('second');
      setTimeLeft(sideDuration);
      setIsRunning(plan.options.mode === 'time-attack' ? autoStartNextRef.current : false);
      return;
    }
    handleNext();
  };

  segmentCompleteRef.current = completeCurrentTimedSegment;

  // Tick timer: completion runs only from the interval when 1 -> 0 (never from a passive effect on timeLeft===0,
  // which could double-fire with a stale snapshot after index changes).
  useEffect(() => {
    if (!isRunning || isDone) return;
    const intervalId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return prev;
        if (prev <= 1) {
          queueMicrotask(() => segmentCompleteRef.current());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isRunning, currentIndex, currentItem?.id, bilateralPhase]);

  const workoutHudPct = useMemo(
    () =>
      computeWorkoutHudProgressPct(
        flatItems.length,
        currentIndex,
        isDone,
        currentItem as WorkoutItem | undefined,
        timeLeft,
        inTransition
      ),
    [
      flatItems.length,
      currentIndex,
      isDone,
      currentItem,
      timeLeft,
      inTransition,
    ]
  );

  useEffect(() => {
    setWorkoutHudProgress(workoutHudPct);
  }, [workoutHudPct, setWorkoutHudProgress]);

  useEffect(() => {
    return () => setWorkoutHudProgress(null);
  }, [setWorkoutHudProgress]);

  const toggleTimer = () => {
    if (inTransition && timeLeft === null) {
      if (sideDuration === null) return;
      setBilateralPhase('second');
      setTimeLeft(sideDuration);
      setIsRunning(true);
      return;
    }
    setIsRunning(!isRunning);
  };

  const handleRepDone = () => {
    if (!isExerciseItem || currentIsTimedExercise || !currentIsBilateralRep) {
      handleNext();
      return;
    }
    if (bilateralPhase === 'first') {
      setBilateralPhase('second');
      return;
    }
    handleNext();
  };

  const persistAutoStart = (value: boolean) => {
    try {
      localStorage.setItem(AUTO_START_STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  if (isDone) {
    return (
      <div className="flex flex-1 flex-col min-h-0 items-center justify-center p-6 text-center">
        <Trophy className="w-32 h-32 text-primary mb-8 animate-bounce" />
        <h1 className="text-6xl font-display neon-text-primary uppercase mb-4">Workout Complete!</h1>
        <p className="text-xl text-muted-foreground mb-12">You crushed {plan.circuits.length} circuits.</p>
        <button
          type="button"
          onClick={() => {
            playSound(SOUNDS.uiConfirm);
            onFinish();
          }}
          className="arcade-btn-primary px-12 py-4 text-xl rounded"
        >
          CLAIM REWARD
        </button>
      </div>
    );
  }

  const showTimedControls = currentIsTimedExercise;
  const sideLabel =
    bilateralPhase === 'first'
      ? 'Side 1'
      : bilateralPhase === 'second'
      ? 'Side 2'
      : null;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background relative overflow-hidden">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="text-muted-foreground text-sm uppercase tracking-widest font-bold mb-4">
          Circuit {currentItem.circuitNum} of {plan.circuits.length}
        </div>

        {currentItem.type === 'rest' ? (
          // REST VIEW
          <div className="w-full max-w-md arcade-card p-10 rounded-2xl flex flex-col items-center text-center border-secondary/50">
            <h2 className="text-4xl font-display text-secondary uppercase mb-6 neon-text-secondary">Rest</h2>
            <div className="text-8xl font-display font-mono text-white mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              {formatSeconds(timeLeft || 0)}
            </div>
            
            {/* Next up preview */}
            {currentIndex < flatItems.length - 1 && flatItems[currentIndex + 1].type === 'exercise' && (
              <div className="mt-4 p-4 bg-background/50 rounded-lg w-full border border-border">
                <p className="text-xs text-muted-foreground uppercase mb-1">Up Next</p>
                <p className="text-lg font-display text-primary truncate">
                  {(flatItems[currentIndex + 1] as ExerciseWorkoutItem).exercise.exercise}
                </p>
              </div>
            )}
          </div>
        ) : (
          // EXERCISE VIEW
          <div className={cn(
            "w-full max-w-lg arcade-card p-8 md:p-12 rounded-2xl flex flex-col items-center text-center transition-all duration-500",
            isRunning ? "border-primary shadow-[0_0_30px_hsl(var(--primary)_/_0.2)]" : "border-border"
          )}>
            <div className="flex items-start justify-center gap-3 w-full max-w-xl mb-8">
              <h2 className="text-4xl md:text-5xl font-display text-white uppercase leading-tight flex-1 text-center">
                {currentItem.exercise.exercise}
              </h2>
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiSelect);
                  toggleFavoriteExercise(currentItem.exercise.exercise);
                  setFavoriteTick((t) => t + 1);
                }}
                className={cn(
                  'flex-shrink-0 p-2 rounded-full border transition-colors mt-1',
                  exerciseFavorite
                    ? 'border-accent text-accent bg-accent/15'
                    : 'border-border text-muted-foreground hover:border-accent/50 hover:text-accent'
                )}
                title={
                  exerciseFavorite
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
                aria-label="Toggle favorite exercise"
              >
                <Star
                  size={22}
                  className={exerciseFavorite ? 'fill-current' : ''}
                />
              </button>
            </div>
            
            {showTimedControls ? (
              <div className="flex flex-col items-center">
                {inTransition && (
                  <div className="text-sm font-display uppercase tracking-widest text-secondary mb-4">
                    Switch Sides
                  </div>
                )}
                {sideLabel && (
                  <div className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-3">
                    {sideLabel}
                  </div>
                )}
                {timeLeft !== null ? (
                  <div className={cn(
                    "text-8xl font-display font-mono mb-8 transition-colors",
                    timeLeft <= 5 ? "text-destructive neon-text-destructive" : "text-primary neon-text-primary"
                  )}>
                    {formatSeconds(timeLeft)}
                  </div>
                ) : (
                  <div className="text-5xl font-display text-primary neon-text-primary mb-8">
                    READY
                  </div>
                )}
                
                <div className="flex gap-4">
                  <button onClick={toggleTimer} className="w-20 h-20 rounded-full border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                    {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-2" />}
                  </button>
                  <button onClick={handleNext} className="w-20 h-20 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center hover:border-foreground hover:text-foreground transition-colors">
                    <FastForward size={32} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="text-7xl font-display text-secondary neon-text-secondary mb-12">
                  {currentItem.targetReps}
                </div>
                {sideLabel && (
                  <div className="text-sm font-display uppercase tracking-widest text-muted-foreground mb-6">
                    {sideLabel}
                  </div>
                )}
                
                <button onClick={handleRepDone} className="arcade-btn-secondary px-10 py-5 rounded-xl text-2xl flex items-center gap-3">
                  <CheckCircle size={28} /> DONE
                </button>
              </div>
            )}
            
            <div className="mt-8 text-sm text-muted-foreground max-w-xs font-sans">
              {currentItem.exercise.description}
            </div>

            {/* Next up preview when there's no rest card between exercises */}
            {(() => {
              const nextItem = flatItems[currentIndex + 1];
              if (!nextItem || nextItem.type !== "exercise") return null;
              return (
                <div className="mt-4 p-4 bg-background/50 rounded-lg w-full border border-border">
                  <p className="text-xs text-muted-foreground uppercase mb-1">
                    Up Next
                  </p>
                  <p className="text-lg font-display text-primary truncate">
                    {(nextItem as ExerciseWorkoutItem).exercise.exercise}
                  </p>
                </div>
              );
            })()}

            {/* Demo link */}
            {(() => {
              const demoUrl = currentItem.exercise.demo;
              const hasDemo = hasDemoLink(demoUrl);
              return (
                <button
                  onClick={() => openDemoLink(demoUrl)}
                  disabled={!hasDemo}
                  title={hasDemo ? 'Open demo in browser' : 'No demo available'}
                  className={cn(
                    'mt-5 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-display uppercase tracking-widest transition-colors',
                    hasDemo
                      ? 'border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent'
                      : 'border border-border/20 text-muted-foreground/30 cursor-not-allowed'
                  )}
                >
                  <ExternalLink size={13} />
                  {hasDemo ? 'Demo' : 'No demo'}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          playSound(SOUNDS.uiCancel);
          onQuit();
        }}
        className="absolute top-[calc(1rem+50px)] right-4 z-30 text-muted-foreground hover:text-destructive font-display uppercase tracking-widest text-xs sm:top-4 sm:right-6"
      >
        Quit
      </button>

      {plan.options.mode === 'time-attack' && (
        <div className="absolute bottom-5 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-2 shadow-sm backdrop-blur-sm">
            <Label
              htmlFor="auto-start-interval"
              className="cursor-pointer text-[11px] font-display uppercase tracking-wider text-muted-foreground"
            >
              Auto-start
            </Label>
            <Switch
              id="auto-start-interval"
              checked={autoStartNext}
              onCheckedChange={(checked) => {
                setAutoStartNext(checked);
                persistAutoStart(checked);
                const onFirstExercise =
                  firstExerciseIndex >= 0 && currentIndex === firstExerciseIndex;
                if (
                  checked &&
                  !onFirstExercise &&
                  currentItem?.type === 'exercise' &&
                  timeLeft !== null &&
                  timeLeft > 0 &&
                  !isRunning
                ) {
                  setIsRunning(true);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
