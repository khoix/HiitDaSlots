import React, { useState } from 'react';
import { ExerciseWorkoutItem, WorkoutPlan } from '../types';
import { formatSeconds } from '../utils/timeUtils';
import { openDemoLink, hasDemoLink } from '../utils/openDemo';
import { Play, Edit2, RotateCcw, Clock, Zap, ExternalLink, Home, BookmarkPlus, Star } from 'lucide-react';
import WorkoutEditor from './WorkoutEditor';
import SaveWorkoutNameModal from './SaveWorkoutNameModal';
import { addSavedWorkout, isFavoriteExercise, toggleFavoriteExercise } from '../storage/workoutLibraryStorage';
import { playSound } from '../audio/playSfx';
import { SOUNDS } from '../audio/soundManifest';
import { isBilateralHold, isHoldExercise } from '../utils/repDifficulty';
import CircuitLoopMultiplier from './CircuitLoopMultiplier';
import { clampLoopCount, recalculatePlanDuration } from '../utils/workoutGenerator';

interface Props {
  plan: WorkoutPlan;
  onStart: () => void;
  onRegenerate: () => void;
  onUpdatePlan: (newPlan: WorkoutPlan) => void;
  onStartOver: () => void;
}

export default function WorkoutReadyScreen({ plan, onStart, onRegenerate, onUpdatePlan, onStartOver }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWorkoutItem | null>(null);
  const [favoriteTick, setFavoriteTick] = useState(0);
  const selectedIsFavorite = React.useMemo(
    () => (selectedExercise ? isFavoriteExercise(selectedExercise.exercise.exercise) : false),
    [selectedExercise, favoriteTick]
  );

  const closeExerciseModal = () => {
    playSound(SOUNDS.uiCancel);
    setSelectedExercise(null);
  };

  const updateCircuitLoop = (circuitId: string, loopCount: number) => {
    const nextCircuits = plan.circuits.map((c) =>
      c.id === circuitId ? { ...c, loopCount: clampLoopCount(loopCount) } : c
    );
    const nextPlan = {
      ...plan,
      circuits: nextCircuits,
      estimatedDurationSeconds: recalculatePlanDuration({
        ...plan,
        circuits: nextCircuits,
      }),
    };
    onUpdatePlan(nextPlan);
  };

  const formatTargetLabel = (exItem: any) => {
    if (plan.options.mode === 'time-attack') {
      return `${exItem.targetTime}s`;
    }
    if (isHoldExercise(exItem.exercise) && exItem.targetTime) {
      return isBilateralHold(exItem.exercise)
        ? `${exItem.targetTime}s / side`
        : `${exItem.targetTime}s`;
    }
    return `${exItem.targetReps} reps`;
  };

  if (isEditing) {
    return (
      <WorkoutEditor
        plan={plan}
        onSave={newPlan => { onUpdatePlan(newPlan); setIsEditing(false); }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full max-w-2xl mx-auto">
      <div className="workout-ready-enter flex-1 min-h-0 px-4 pt-8 pb-40 w-full">

      {/* ── Summary card ───────────────────────────────────────────── */}
      <div
        className="arcade-card rounded-2xl mb-6 relative overflow-hidden"
        style={{ padding: 'clamp(1.25rem, 5vw, 2rem)' }}
      >
        {/* BG icon watermark */}
        <div
          className="absolute -right-6 -top-6 pointer-events-none"
          style={{ color: 'hsl(var(--primary)/0.08)' }}
          aria-hidden="true"
        >
          {plan.options.mode === 'time-attack' ? <Clock size={160} /> : <Zap size={160} />}
        </div>

        <div className="relative z-10">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {plan.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full font-display uppercase text-secondary border border-secondary/50"
                style={{ fontSize: '0.65rem', letterSpacing: '0.1em', background: 'hsl(var(--secondary)/0.12)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          <h1
            className="font-display uppercase neon-text-primary mb-5 leading-none"
            style={{ fontSize: 'clamp(1.8rem, 8vw, 3rem)' }}
          >
            Workout Ready
          </h1>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-muted-foreground uppercase font-display mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.12em' }}>Mode</p>
              <p className="text-foreground flex items-center gap-1.5 font-sans text-sm">
                {plan.options.mode === 'time-attack'
                  ? <><Clock size={14} className="text-primary flex-shrink-0" /> Time Attack</>
                  : <><Zap size={14} className="text-secondary flex-shrink-0" /> Rep Quest</>}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase font-display mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.12em' }}>Duration</p>
              <p className="text-foreground font-mono text-sm">{formatSeconds(plan.estimatedDurationSeconds)}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase font-display mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.12em' }}>Circuits</p>
              <p className="text-foreground font-sans text-sm">{plan.circuits.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase font-display mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.12em' }}>Targets</p>
              <p className="text-foreground font-sans text-sm truncate" title={plan.options.muscles.join(', ')}>
                {plan.options.muscles.length > 0 ? plan.options.muscles.join(', ') : 'Full Body'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Circuit list ────────────────────────────────────────────── */}
      <div className="space-y-8">
        {plan.circuits.map(circuit => (
          <div key={circuit.id}>
            {/* Circuit heading */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-px flex-1"
                style={{ background: 'linear-gradient(to right, transparent, hsl(var(--accent)/0.5))' }}
              />
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="font-display uppercase text-accent"
                  style={{ fontSize: 'clamp(0.8rem, 3vw, 1rem)', letterSpacing: '0.12em' }}
                >
                  Circuit {circuit.circuitNumber}
                </span>
                <CircuitLoopMultiplier
                  value={clampLoopCount(circuit.loopCount)}
                  onChange={(n) => updateCircuitLoop(circuit.id, n)}
                  circuitLabel={`Circuit ${circuit.circuitNumber}`}
                />
              </div>
              <div
                className="h-px flex-1"
                style={{ background: 'linear-gradient(to left, transparent, hsl(var(--accent)/0.5))' }}
              />
            </div>

            {/* Exercise cards — single column on mobile */}
            <div className="flex flex-col gap-3">
              {circuit.items.filter(i => i.type === 'exercise').map((item, idx) => {
                const exItem = item as ExerciseWorkoutItem;
                const demoUrl = exItem.exercise.demo;
                const hasDemo = hasDemoLink(demoUrl);
                return (
                  <div
                    key={item.id}
                    className="arcade-card rounded-xl flex items-center gap-3"
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      playSound(SOUNDS.uiSelect);
                      setSelectedExercise(exItem);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        playSound(SOUNDS.uiSelect);
                        setSelectedExercise(exItem);
                      }
                    }}
                  >
                    {/* Index bubble */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-display text-base"
                      style={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--primary)/0.35)',
                        color: 'hsl(var(--primary)/0.8)',
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Name + target */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display tracking-wide truncate text-foreground" style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1rem)' }}>
                        {exItem.exercise.exercise}
                      </h4>
                      <p className="text-muted-foreground font-sans mt-0.5" style={{ fontSize: '0.75rem' }}>
                        {formatTargetLabel(exItem)}
                      </p>
                    </div>

                    {/* Demo button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDemoLink(demoUrl);
                      }}
                      disabled={!hasDemo}
                      title={hasDemo ? 'Open demo' : 'No demo'}
                      className="flex-shrink-0 flex items-center gap-1 rounded-md transition-colors"
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-display)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        border: hasDemo ? '1px solid hsl(var(--accent)/0.5)' : '1px solid hsl(var(--border)/0.4)',
                        color: hasDemo ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground)/0.35)',
                        cursor: hasDemo ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <ExternalLink size={11} />
                      {hasDemo ? 'Demo' : 'None'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      </div>

      {/* ── Fixed bottom action bar (sibling: no transform ancestor) ── */}
      <div className="workout-ready-actions workout-ready-bar-enter">
        {/* Secondary row — tight on narrow viewports so all actions stay in-bounds */}
        <div className="flex items-center justify-between sm:justify-center gap-0.5 sm:gap-2 mb-3 w-full min-w-0">
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiCancel);
              onStartOver();
            }}
            className="workout-action-ghost flex flex-1 min-w-0 sm:flex-initial items-center justify-center gap-1 sm:gap-1.5"
          >
            <Home className="size-3 shrink-0 sm:size-3.5" aria-hidden />
            <span className="text-center leading-tight">Home</span>
          </button>

          <div className="workout-action-divider hidden sm:block" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiConfirm);
              onRegenerate();
            }}
            className="workout-action-ghost flex flex-1 min-w-0 sm:flex-initial items-center justify-center gap-1 sm:gap-1.5"
          >
            <RotateCcw className="size-3 shrink-0 sm:size-3.5" aria-hidden />
            <span className="text-center leading-tight">Re-Spin</span>
          </button>

          <div className="workout-action-divider hidden sm:block" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiSelect);
              setSaveModalOpen(true);
            }}
            className="workout-action-ghost flex flex-1 min-w-0 sm:flex-initial items-center justify-center gap-1 sm:gap-1.5"
          >
            <BookmarkPlus className="size-3 shrink-0 sm:size-3.5" aria-hidden />
            <span className="text-center leading-tight">Save</span>
          </button>

          <div className="workout-action-divider hidden sm:block" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiConfirm);
              setIsEditing(true);
            }}
            className="workout-action-ghost flex flex-1 min-w-0 sm:flex-initial items-center justify-center gap-1 sm:gap-1.5"
          >
            <Edit2 className="size-3 shrink-0 sm:size-3.5" aria-hidden />
            <span className="text-center leading-tight">Edit</span>
          </button>
        </div>

        {/* Primary CTA — full width */}
        <button
          type="button"
          onClick={() => {
            playSound(SOUNDS.uiConfirm);
            onStart();
          }}
          className="arcade-btn-primary w-full rounded-xl flex items-center justify-center gap-3 workout-action-primary"
        >
          <Play size={18} className="fill-current flex-shrink-0" />
          START WORKOUT
        </button>
      </div>

      <SaveWorkoutNameModal
        open={saveModalOpen}
        title="Save workout preset"
        hint="Named presets appear under Saved on the home screen."
        onClose={() => setSaveModalOpen(false)}
        onConfirm={(name) => {
          try {
            addSavedWorkout(name, plan);
          } catch {
            /* ignore */
          }
        }}
      />

      {selectedExercise ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exercise-detail-title"
          onClick={closeExerciseModal}
        >
          <div
            className="arcade-card rounded-xl p-6 w-full max-w-md border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <h2
                id="exercise-detail-title"
                className="text-xl font-display uppercase neon-text-primary tracking-wide leading-tight"
              >
                {selectedExercise.exercise.exercise}
              </h2>
              <button
                type="button"
                onClick={() => {
                  playSound(SOUNDS.uiSelect);
                  toggleFavoriteExercise(selectedExercise.exercise.exercise);
                  setFavoriteTick((t) => t + 1);
                }}
                className={
                  selectedIsFavorite
                    ? 'p-3 rounded transition-colors text-accent bg-accent/15 border border-accent/40'
                    : 'p-3 rounded transition-colors text-muted-foreground hover:text-accent border border-transparent'
                }
                title={selectedIsFavorite ? 'Remove from favorites' : 'Favorite exercise'}
                aria-label="Toggle favorite"
                aria-pressed={selectedIsFavorite}
              >
                <Star size={20} className={selectedIsFavorite ? 'fill-current' : ''} />
              </button>
            </div>

            <p className="text-xs uppercase font-display text-muted-foreground tracking-widest mb-2">
              Exercise description
            </p>
            <p className="text-sm text-foreground font-sans leading-relaxed">
              {selectedExercise.exercise.description?.trim() || 'No description available for this exercise yet.'}
            </p>

            <div className="flex gap-3 justify-end pt-6">
              <button
                type="button"
                onClick={closeExerciseModal}
                className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground font-display uppercase text-xs tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
