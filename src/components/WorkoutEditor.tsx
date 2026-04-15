import React, { useEffect, useRef, useState } from 'react';
import { WorkoutPlan } from '../types';
import { Save, X, RefreshCw } from 'lucide-react';
import { rerollExercise } from '../utils/workoutGenerator';
import { clampLoopCount } from '../utils/workoutPlanRuntime';
import { playSound } from '../audio/playSfx';
import { SOUNDS } from '../audio/soundManifest';
import { isBilateralHold, isHoldExercise } from '../utils/repDifficulty';

interface Props {
  plan: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => void;
  onCancel: () => void;
}

export default function WorkoutEditor({ plan: initialPlan, onSave, onCancel }: Props) {
  const [draftPlan, setDraftPlan] = useState<WorkoutPlan>(initialPlan);
  const [draggedItem, setDraggedItem] = useState<{ circuitId: string; itemId: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<
    | { kind: 'between'; circuitId: string; insertAt: number }
    | { kind: 'exercise'; circuitId: string; itemId: string }
    | null
  >(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);

  const formatTargetLabel = (exItem: any) => {
    if (draftPlan.options.mode === 'time-attack') {
      return `${exItem.targetTime}s`;
    }
    if (isHoldExercise(exItem.exercise) && exItem.targetTime) {
      return isBilateralHold(exItem.exercise)
        ? `${exItem.targetTime}s / side`
        : `${exItem.targetTime}s`;
    }
    return `${exItem.targetReps} reps`;
  };

  const handleReroll = (circuitId: string, itemId: string) => {
    playSound(SOUNDS.uiSelect);
    setDraftPlan(rerollExercise(draftPlan, circuitId, itemId));
  };

  const getCircuitTailInsertIndex = (items: WorkoutPlan['circuits'][number]['items']) => {
    const circuitRestIndex = items.findIndex((item) => item.type === 'rest' && item.isCircuitRest);
    return circuitRestIndex >= 0 ? circuitRestIndex : items.length;
  };

  const getItemInsertIndexFromExerciseSlot = (
    items: WorkoutPlan['circuits'][number]['items'],
    insertAt: number
  ) => {
    const exerciseIndices = items.reduce<number[]>((acc, item, idx) => {
      if (item.type === 'exercise') acc.push(idx);
      return acc;
    }, []);

    if (exerciseIndices.length === 0) return getCircuitTailInsertIndex(items);
    if (insertAt <= 0) return exerciseIndices[0];
    if (insertAt >= exerciseIndices.length) return getCircuitTailInsertIndex(items);
    return exerciseIndices[insertAt];
  };

  const handleDropExercise = (targetCircuitId: string, insertAt: number) => {
    if (!draggedItem) return;

    setDraftPlan((prev) => {
      const next: WorkoutPlan = {
        ...prev,
        circuits: prev.circuits.map((circuit) => ({ ...circuit, items: [...circuit.items] })),
      };

      const sourceCircuit = next.circuits.find((c) => c.id === draggedItem.circuitId);
      const targetCircuit = next.circuits.find((c) => c.id === targetCircuitId);
      if (!sourceCircuit || !targetCircuit) return prev;

      const sourceIndex = sourceCircuit.items.findIndex((item) => item.id === draggedItem.itemId);
      if (sourceIndex < 0) return prev;
      const sourceExerciseOrder = sourceCircuit.items
        .slice(0, sourceIndex)
        .filter((item) => item.type === 'exercise').length;

      const [movedItem] = sourceCircuit.items.splice(sourceIndex, 1);
      if (!movedItem || movedItem.type !== 'exercise') return prev;

      let adjustedInsertAt = insertAt;
      if (sourceCircuit.id === targetCircuit.id && sourceExerciseOrder < insertAt) {
        adjustedInsertAt -= 1;
      }

      const targetIndex = getItemInsertIndexFromExerciseSlot(targetCircuit.items, adjustedInsertAt);

      targetCircuit.items.splice(targetIndex, 0, movedItem);
      return next;
    });

    setDragOverTarget(null);
  };

  const handleSwapExercises = (targetCircuitId: string, targetItemId: string) => {
    if (!draggedItem) return;
    if (draggedItem.circuitId === targetCircuitId && draggedItem.itemId === targetItemId) {
      setDragOverTarget(null);
      return;
    }

    setDraftPlan((prev) => {
      const next: WorkoutPlan = {
        ...prev,
        circuits: prev.circuits.map((circuit) => ({ ...circuit, items: [...circuit.items] })),
      };

      const sourceCircuit = next.circuits.find((c) => c.id === draggedItem.circuitId);
      const targetCircuit = next.circuits.find((c) => c.id === targetCircuitId);
      if (!sourceCircuit || !targetCircuit) return prev;

      const sourceIndex = sourceCircuit.items.findIndex((item) => item.id === draggedItem.itemId);
      const targetIndex = targetCircuit.items.findIndex((item) => item.id === targetItemId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const sourceItem = sourceCircuit.items[sourceIndex];
      const targetItem = targetCircuit.items[targetIndex];
      if (sourceItem.type !== 'exercise' || targetItem.type !== 'exercise') return prev;

      sourceCircuit.items[sourceIndex] = targetItem;
      targetCircuit.items[targetIndex] = sourceItem;
      return next;
    });

    setDragOverTarget(null);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const beginTouchDrag = (circuitId: string, itemId: string) => {
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setDraggedItem({ circuitId, itemId });
      setIsTouchDragging(true);
    }, 300);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    if (!isTouchDragging) {
      if (touchStartPointRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPointRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPointRef.current.y);
        if (dx > 14 || dy > 14) {
          clearLongPressTimer();
        }
      }
      return;
    }

    event.preventDefault();
    const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const dropEl = target?.closest('[data-drop-kind]') as HTMLElement | null;
    if (!dropEl) return;

    const kind = dropEl.dataset.dropKind;
    if (kind === 'exercise') {
      const circuitId = dropEl.dataset.circuitId;
      const itemId = dropEl.dataset.itemId;
      if (!circuitId || !itemId) return;
      setDragOverTarget({ kind: 'exercise', circuitId, itemId });
      return;
    }

    if (kind === 'between') {
      const circuitId = dropEl.dataset.circuitId;
      const insertAtRaw = dropEl.dataset.insertAt;
      if (!circuitId || insertAtRaw == null) return;
      const insertAt = Number(insertAtRaw);
      if (Number.isNaN(insertAt)) return;
      setDragOverTarget({ kind: 'between', circuitId, insertAt });
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    touchStartPointRef.current = null;

    if (isTouchDragging && dragOverTarget) {
      if (dragOverTarget.kind === 'exercise') {
        handleSwapExercises(dragOverTarget.circuitId, dragOverTarget.itemId);
      } else {
        handleDropExercise(dragOverTarget.circuitId, dragOverTarget.insertAt);
      }
    }

    setIsTouchDragging(false);
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  useEffect(() => {
    if (!isTouchDragging) return;

    const { style } = document.body;
    const htmlStyle = document.documentElement.style;
    const previousOverflow = style.overflow;
    const previousUserSelect = style.userSelect;
    const previousWebkitUserSelect = style.webkitUserSelect;
    const previousTouchAction = style.touchAction;
    const previousOverscrollBehavior = style.overscrollBehavior;
    const previousHtmlOverscrollBehavior = htmlStyle.overscrollBehavior;

    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };

    style.overflow = 'hidden';
    style.userSelect = 'none';
    style.webkitUserSelect = 'none';
    style.touchAction = 'none';
    style.overscrollBehavior = 'none';
    htmlStyle.overscrollBehavior = 'none';
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventTouchScroll);
      style.overflow = previousOverflow;
      style.userSelect = previousUserSelect;
      style.webkitUserSelect = previousWebkitUserSelect;
      style.touchAction = previousTouchAction;
      style.overscrollBehavior = previousOverscrollBehavior;
      htmlStyle.overscrollBehavior = previousHtmlOverscrollBehavior;
    };
  }, [isTouchDragging]);

  return (
    <div className="flex flex-1 flex-col min-h-0 py-12 px-4 max-w-4xl mx-auto pb-32 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display neon-text-secondary uppercase">Edit Mode</h1>
          <p className="text-muted-foreground mt-1">Swap out exercises you don't like.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="p-3 text-muted-foreground hover:text-destructive transition-colors">
            <X size={24} />
          </button>
          <button onClick={() => onSave(draftPlan)} className="arcade-btn-primary px-6 py-2 rounded flex items-center gap-2">
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {draftPlan.circuits.map((circuit) => (
          <div key={circuit.id} className="arcade-card p-6 rounded-xl border-secondary/30">
            <h3 className="text-xl font-display text-secondary mb-4 uppercase tracking-widest flex items-center gap-2 flex-wrap">
              Circuit {circuit.circuitNumber}
              {clampLoopCount(circuit.loopCount) > 1 ? (
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  ×{clampLoopCount(circuit.loopCount)}
                </span>
              ) : null}
            </h3>
            
            <div className="space-y-2">
              {circuit.items
                .filter((item) => item.type === 'exercise')
                .map((item, exerciseIdx) => {
                  const exItem = item as any;
                  const exName = exItem.exercise.exercise;

                  return (
                    <React.Fragment key={item.id}>
                      <div
                        data-drop-kind="between"
                        data-circuit-id={circuit.id}
                        data-insert-at={exerciseIdx}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverTarget({ kind: 'between', circuitId: circuit.id, insertAt: exerciseIdx });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (
                            dragOverTarget?.kind === 'between' &&
                            dragOverTarget.circuitId === circuit.id &&
                            dragOverTarget.insertAt === exerciseIdx
                          ) {
                            handleDropExercise(circuit.id, exerciseIdx);
                          }
                        }}
                        className="h-3 flex items-center"
                      >
                        <hr
                          className={`w-full border-0 transition-all ${
                            dragOverTarget?.kind === 'between' &&
                            dragOverTarget.circuitId === circuit.id &&
                            dragOverTarget.insertAt === exerciseIdx
                              ? 'h-0.5 bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_12px_rgba(58,175,255,0.45)]'
                              : 'h-px bg-transparent'
                          }`}
                        />
                      </div>
                      <div
                        data-drop-kind="exercise"
                        data-circuit-id={circuit.id}
                        data-item-id={item.id}
                        draggable
                        onDragStart={() => setDraggedItem({ circuitId: circuit.id, itemId: item.id })}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverTarget(null);
                        }}
                        onTouchStart={(event) => {
                          const touch = event.touches[0];
                          if (!touch) return;
                          touchStartPointRef.current = { x: touch.clientX, y: touch.clientY };
                          beginTouchDrag(circuit.id, item.id);
                        }}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverTarget({ kind: 'exercise', circuitId: circuit.id, itemId: item.id });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (
                            dragOverTarget?.kind === 'exercise' &&
                            dragOverTarget.circuitId === circuit.id &&
                            dragOverTarget.itemId === item.id
                          ) {
                            handleSwapExercises(circuit.id, item.id);
                          }
                        }}
                        className={`bg-background border p-3 rounded-lg flex items-center justify-between group transition-colors gap-2 cursor-move select-none [webkit-touch-callout:none] [webkit-user-select:none] ${
                          dragOverTarget?.kind === 'exercise' &&
                          dragOverTarget.circuitId === circuit.id &&
                          dragOverTarget.itemId === item.id
                            ? 'border-primary ring-1 ring-primary/40'
                            : 'border-border hover:border-primary/50'
                        }`}
                        style={{
                          WebkitTapHighlightColor: 'transparent',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                        }}
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display text-lg truncate">{exName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {exItem.exercise.muscles} • {formatTargetLabel(exItem)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReroll(circuit.id, item.id)}
                            className="p-3 text-primary bg-primary/10 rounded hover:bg-primary hover:text-primary-foreground transition-colors group-hover:animate-pulse"
                            title="Reroll Exercise"
                          >
                            <RefreshCw size={20} />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              <div
                data-drop-kind="between"
                data-circuit-id={circuit.id}
                data-insert-at={circuit.items.filter((item) => item.type === 'exercise').length}
                onDragOver={(event) => {
                  event.preventDefault();
                  const exerciseCount = circuit.items.filter((item) => item.type === 'exercise').length;
                  setDragOverTarget({ kind: 'between', circuitId: circuit.id, insertAt: exerciseCount });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const exerciseCount = circuit.items.filter((item) => item.type === 'exercise').length;
                  if (
                    dragOverTarget?.kind === 'between' &&
                    dragOverTarget.circuitId === circuit.id &&
                    dragOverTarget.insertAt === exerciseCount
                  ) {
                    handleDropExercise(circuit.id, exerciseCount);
                  }
                }}
                className="h-3 flex items-center"
              >
                <hr
                  className={`w-full border-0 transition-all ${
                    dragOverTarget?.kind === 'between' &&
                    dragOverTarget.circuitId === circuit.id &&
                    dragOverTarget.insertAt === circuit.items.filter((item) => item.type === 'exercise').length
                      ? 'h-0.5 bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_12px_rgba(58,175,255,0.45)]'
                      : 'h-px bg-transparent'
                  }`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
