import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Layers, Play, Save, Trash2 } from "lucide-react";
import type { Exercise, WorkoutMode, WorkoutPlan } from "../types";
import {
  buildWorkoutPlanFromCircuitLists,
  type CustomWorkoutTimingInput,
} from "../utils/workoutGenerator";
import CircuitLoopMultiplier from "./CircuitLoopMultiplier";
import { parseMuscleString } from "../utils/parseMuscles";
import {
  addSavedWorkout,
  loadWorkoutLibrary,
  toggleFavoriteExercise,
} from "../storage/workoutLibraryStorage";
import { getResolvedCatalogRows } from "../storage/catalogOverridesStorage";
import { generateId } from "../utils/random";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import { cn } from "../lib/utils";
import CatalogExerciseCard from "./CatalogExerciseCard";
import ExerciseLibraryRolodex from "./exerciseLibrary/ExerciseLibraryRolodex";
import SaveWorkoutNameModal from "./SaveWorkoutNameModal";
import { useIsMobile } from "../hooks/use-mobile";

function libId(canonicalKey: string): string {
  return `lib|${encodeURIComponent(canonicalKey)}`;
}

function parseLibId(id: string): string | null {
  if (!id.startsWith("lib|")) return null;
  return decodeURIComponent(id.slice(4));
}

function slotId(circuitIndex: number, instanceId: string): string {
  return `q|${circuitIndex}|${instanceId}`;
}

function parseSlotId(id: string): { circuitIndex: number; instanceId: string } | null {
  if (!id.startsWith("q|")) return null;
  const parts = id.split("|");
  if (parts.length < 3) return null;
  const circuitIndex = Number(parts[1]);
  const instanceId = parts.slice(2).join("|");
  if (Number.isNaN(circuitIndex) || !instanceId) return null;
  return { circuitIndex, instanceId };
}

function dropId(circuitIndex: number): string {
  return `drop|${circuitIndex}`;
}

function parseDropId(id: string): number | null {
  if (!id.startsWith("drop|")) return null;
  const n = Number(id.slice(5));
  return Number.isNaN(n) ? null : n;
}

function dropEndId(circuitIndex: number): string {
  return `dropend|${circuitIndex}`;
}

function parseDropEndId(id: string): number | null {
  if (!id.startsWith("dropend|")) return null;
  const n = Number(id.slice(8));
  return Number.isNaN(n) ? null : n;
}

const ADD_CIRCUIT_DROP_ID = "addCircuitDrop";

function parseAddCircuitDropId(id: string): boolean {
  return id === ADD_CIRCUIT_DROP_ID;
}

interface CatalogRow {
  canonicalKey: string;
  exercise: Exercise;
}

interface QueuedItem {
  instanceId: string;
  exercise: Exercise;
}

function CircuitDropZone({
  circuitIndex,
  empty,
}: {
  circuitIndex: number;
  empty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(circuitIndex),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed px-2 py-3 transition-colors",
        empty
          ? "min-h-[4rem] border-primary/40 bg-primary/5"
          : "min-h-[2.75rem] mt-2 border-border/50 bg-black/10",
        isOver && "border-primary/60 bg-primary/10"
      )}
    >
      <p className="text-center text-xs font-sans text-muted-foreground">
        Drop exercises here
      </p>
    </div>
  );
}

function CircuitDropEndZone({ circuitIndex }: { circuitIndex: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropEndId(circuitIndex) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-3 rounded-md transition-colors shrink-0",
        isOver ? "bg-primary/20" : "bg-transparent"
      )}
      aria-hidden
    />
  );
}

function AddCircuitDropButton({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: ADD_CIRCUIT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-3 rounded-lg transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/10"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full py-2 rounded-lg border border-dashed border-primary/40 text-primary font-display text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors"
      >
        + Add circuit
      </button>
    </div>
  );
}

function SortableQueueRow({
  id,
  exercise,
  onRemove,
}: {
  id: string;
  exercise: Exercise;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  const tags = parseMuscleString(exercise.muscles).slice(0, 4);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-2 rounded-lg border border-border/60 bg-black/20 p-2"
    >
      <button
        type="button"
        className="self-center p-1.5 rounded-md border border-border/50 text-muted-foreground hover:text-primary cursor-grab active:cursor-grabbing shrink-0 touch-manipulation"
        aria-label="Drag to reorder"
        {...listeners}
        {...attributes}
      >
        <GripVertical size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm text-foreground leading-tight truncate">
          {exercise.exercise}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[0.6rem] uppercase tracking-wide text-muted-foreground font-sans"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          playSound(SOUNDS.uiCancel);
          onRemove();
        }}
        className="self-start p-2 rounded-lg text-destructive/80 hover:text-destructive border border-destructive/20 shrink-0"
        aria-label="Remove exercise"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

interface Props {
  onBack: () => void;
  onPlayPlan: (plan: WorkoutPlan) => void;
}

export default function WorkoutBuilderScreen({ onBack, onPlayPlan }: Props) {
  const isMobile = useIsMobile();
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [circuits, setCircuits] = useState<QueuedItem[][]>(() => [[]]);
  const [circuitLoopCounts, setCircuitLoopCounts] = useState<number[]>(() => [1]);
  const [mode, setMode] = useState<WorkoutMode>("time-attack");
  const [workInterval, setWorkInterval] = useState(45);
  const [restBetweenExercises, setRestBetweenExercises] = useState(15);
  const [restBetweenCircuits, setRestBetweenCircuits] = useState(60);
  const [repDifficulty, setRepDifficulty] = useState(50);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobileDragActive, setIsMobileDragActive] = useState(false);

  const refresh = () => setLib(loadWorkoutLibrary());

  const favoriteSet = useMemo(
    () => new Set(lib.favoriteExercises.map((f) => f.exerciseKey)),
    [lib.favoriteExercises]
  );

  const catalogRows = useMemo((): CatalogRow[] => {
    return [...getResolvedCatalogRows()].sort((a, b) =>
      a.exercise.exercise.localeCompare(b.exercise.exercise)
    );
  }, []);

  const timing = useMemo(
    (): CustomWorkoutTimingInput => ({
      mode,
      workInterval,
      restBetweenExercises,
      restBetweenCircuits,
      repDifficulty,
    }),
    [
      mode,
      workInterval,
      restBetweenExercises,
      restBetweenCircuits,
      repDifficulty,
    ]
  );

  const hasAnyExercise = useMemo(
    () => circuits.some((c) => c.length > 0),
    [circuits]
  );

  const buildPlan = useCallback((): WorkoutPlan => {
    return buildWorkoutPlanFromCircuitLists(
      circuits.map((c) => c.map((q) => q.exercise)),
      timing,
      { circuitLoopCounts }
    );
  }, [circuits, timing, circuitLoopCounts]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 260, tolerance: 10 }
        : { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Library cards only count as “over” a target when the pointer is inside it (not closest slot). */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (String(args.active.id).startsWith("lib|")) {
      return pointerWithin(args);
    }
    return closestCorners(args);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setIsMobileDragActive(true);
    playSound(SOUNDS.uiSelect);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsMobileDragActive(false);
    if (!over) return;

    const aid = String(active.id);
    const oid = String(over.id);

    const appendItem = (circuitIndex: number, item: QueuedItem) => {
      setCircuits((prev) => {
        const next = prev.map((c) => [...c]);
        if (!next[circuitIndex]) return prev;
        next[circuitIndex] = [...next[circuitIndex], item];
        return next;
      });
    };

    const insertBefore = (
      circuitIndex: number,
      beforeInstanceId: string,
      item: QueuedItem
    ) => {
      setCircuits((prev) => {
        const next = prev.map((c) => [...c]);
        const list = next[circuitIndex];
        if (!list) return prev;
        const idx = list.findIndex((x) => x.instanceId === beforeInstanceId);
        if (idx === -1) return prev;
        next[circuitIndex] = [
          ...list.slice(0, idx),
          item,
          ...list.slice(idx),
        ];
        return next;
      });
    };

    const insertAtEnd = (circuitIndex: number, item: QueuedItem) => {
      appendItem(circuitIndex, item);
    };

    /** Drag from library — only explicit drop zones (not queue rows / strip). */
    if (aid.startsWith("lib|")) {
      const key = parseLibId(aid);
      if (!key) return;
      const row = catalogRows.find((r) => r.canonicalKey === key);
      if (!row) return;
      const newItem: QueuedItem = {
        instanceId: generateId(),
        exercise: { ...row.exercise },
      };

      if (parseAddCircuitDropId(oid)) {
        setCircuits((prev) => [...prev, [newItem]]);
        setCircuitLoopCounts((prev) => [...prev, 1]);
        playSound(SOUNDS.uiConfirm);
        return;
      }

      const dropCi = parseDropId(oid);
      if (dropCi !== null) {
        insertAtEnd(dropCi, newItem);
        playSound(SOUNDS.uiConfirm);
        return;
      }
      return;
    }

    /** Reorder / move queue items */
    const from = parseSlotId(aid);
    if (!from) return;

    setCircuits((prev) => {
      const next = prev.map((c) => c.map((q) => ({ ...q })));
      const fromList = next[from.circuitIndex];
      const fromIdx = fromList.findIndex((x) => x.instanceId === from.instanceId);
      if (fromIdx === -1) return prev;
      const [moved] = fromList.splice(fromIdx, 1);

      const dropCi = parseDropId(oid);
      if (dropCi !== null) {
        next[dropCi].push(moved);
        return next;
      }
      const dropEndCi = parseDropEndId(oid);
      if (dropEndCi !== null) {
        next[dropEndCi].push(moved);
        return next;
      }
      const overSlot = parseSlotId(oid);
      if (overSlot) {
        if (
          overSlot.circuitIndex === from.circuitIndex &&
          overSlot.instanceId === from.instanceId
        ) {
          fromList.splice(fromIdx, 0, moved);
          return prev;
        }
        const destList = next[overSlot.circuitIndex];
        const destIdx = destList.findIndex((x) => x.instanceId === overSlot.instanceId);
        if (destIdx === -1) {
          fromList.splice(fromIdx, 0, moved);
          return prev;
        }
        destList.splice(destIdx, 0, moved);
        return next;
      }
      fromList.splice(fromIdx, 0, moved);
      return prev;
    });
    playSound(SOUNDS.uiConfirm);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setIsMobileDragActive(false);
    playSound(SOUNDS.uiCancel);
  };

  /** Same-circuit reorder using arrayMove when both ids are slots in one circuit */
  const handleDragEndWrapper = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      handleDragCancel();
      return;
    }
    const aid = String(active.id);
    const oid = String(over.id);
    const a = parseSlotId(aid);
    const b = parseSlotId(oid);
    if (
      a &&
      b &&
      a.circuitIndex === b.circuitIndex &&
      aid.startsWith("q|") &&
      oid.startsWith("q|")
    ) {
      setCircuits((prev) => {
        const ci = a.circuitIndex;
        const list = prev[ci];
        const oldIndex = list.findIndex((x) => x.instanceId === a.instanceId);
        const newIndex = list.findIndex((x) => x.instanceId === b.instanceId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return prev;
        }
        const next = [...prev];
        next[ci] = arrayMove(list, oldIndex, newIndex);
        return next;
      });
      setActiveId(null);
      setIsMobileDragActive(false);
      playSound(SOUNDS.uiConfirm);
      return;
    }
    handleDragEnd(event);
    setActiveId(null);
    setIsMobileDragActive(false);
  };

  const removeItem = (circuitIndex: number, instanceId: string) => {
    setCircuits((prev) => {
      const next = prev.map((c) => c.filter((q) => q.instanceId !== instanceId));
      return next;
    });
  };

  const addCircuit = () => {
    playSound(SOUNDS.uiSelect);
    setCircuits((prev) => [...prev, []]);
    setCircuitLoopCounts((prev) => [...prev, 1]);
  };

  const removeCircuit = (circuitIndex: number) => {
    if (circuits.length <= 1) return;
    if (circuits[circuitIndex].length > 0) {
      const ok = window.confirm(
        "Remove this circuit and all exercises in it?"
      );
      if (!ok) return;
    }
    playSound(SOUNDS.uiCancel);
    setCircuits((prev) => prev.filter((_, i) => i !== circuitIndex));
    setCircuitLoopCounts((prev) => prev.filter((_, i) => i !== circuitIndex));
  };

  const activeLibraryExercise: Exercise | null = useMemo(() => {
    if (!activeId?.startsWith("lib|")) return null;
    const key = parseLibId(activeId);
    if (!key) return null;
    const row = catalogRows.find((r) => r.canonicalKey === key);
    return row?.exercise ?? null;
  }, [activeId, catalogRows]);

  const mobileDragLockScroll = isMobile && isMobileDragActive;

  useEffect(() => {
    if (!mobileDragLockScroll) return;
    const scrollY = window.scrollY;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const prevDocOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      document.body.style.width = prevBodyWidth;
      document.documentElement.style.overscrollBehavior = prevDocOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [mobileDragLockScroll]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndWrapper}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 w-full max-w-6xl mx-auto flex-col px-3 sm:px-4 pt-6 pb-4 box-border md:h-dvh md:max-h-dvh md:overflow-hidden max-md:min-h-dvh max-md:h-auto max-md:overflow-x-hidden max-md:select-none">
        <SaveWorkoutNameModal
          open={saveModalOpen}
          title="Save workout"
          hint="This preset appears in Saved Workouts."
          confirmLabel="Save"
          onClose={() => setSaveModalOpen(false)}
          onConfirm={(name) => {
            try {
              addSavedWorkout(name, buildPlan());
              playSound(SOUNDS.uiConfirm);
            } catch {
              /* ignore */
            }
          }}
        />

        <div className="mb-4 flex shrink-0 items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiCancel);
              onBack();
            }}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base sm:text-2xl font-display uppercase text-primary tracking-[0.12em] sm:tracking-widest neon-text-primary">
            Workout Builder
          </h1>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={!hasAnyExercise}
              onClick={() => {
                playSound(SOUNDS.uiSelect);
                setSaveModalOpen(true);
              }}
              className="arcade-btn-secondary rounded-lg px-2.5 py-2 sm:px-4 text-xs font-display uppercase tracking-widest disabled:opacity-40"
              aria-label="Save workout"
            >
              <span className="sm:hidden" aria-hidden>
                <Save size={14} />
              </span>
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              type="button"
              disabled={!hasAnyExercise}
              onClick={() => {
                playSound(SOUNDS.uiConfirm);
                onPlayPlan(buildPlan());
              }}
              className="arcade-btn-primary rounded-lg px-2.5 py-2 sm:px-4 text-xs font-display uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-40"
              aria-label="Play workout"
            >
              <Play size={14} />
              <span className="hidden sm:inline">Play</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row gap-3 md:gap-4 max-md:flex-none">
          {/* Workout queue (~2/3 on md+) */}
          <div className="order-2 md:order-1 flex-[2] min-h-0 min-w-0 flex flex-col gap-3 overflow-hidden">
            <div className="arcade-card rounded-xl p-3 border border-border/80 shrink-0">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <Layers size={16} /> Circuits
              </h2>
              <p className="hidden md:block text-xs font-sans text-muted-foreground mb-3">
                Drop library cards on “Drop exercises here” to add to a circuit, or on “+ Add
                circuit” to create a new circuit with that exercise. Reorder queue items with the
                grip handle.
              </p>
              <div className="space-y-3 max-h-[min(50dvh,24rem)] overflow-y-auto pr-1">
                {circuits.map((circuit, ci) => (
                  <div
                    key={ci}
                    className="rounded-xl border border-border/60 bg-black/15 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-display text-xs uppercase tracking-widest text-primary">
                          Circuit {ci + 1}
                        </span>
                        <CircuitLoopMultiplier
                          value={circuitLoopCounts[ci] ?? 1}
                          onChange={(n) => {
                            setCircuitLoopCounts((prev) => {
                              const next = [...prev];
                              while (next.length < circuits.length) next.push(1);
                              next[ci] = n;
                              return next;
                            });
                          }}
                          circuitLabel={`Circuit ${ci + 1}`}
                        />
                      </div>
                      {circuits.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeCircuit(ci)}
                          className="text-[0.65rem] font-display uppercase tracking-widest text-destructive/80 hover:text-destructive"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {circuit.length === 0 ? (
                      <CircuitDropZone circuitIndex={ci} empty />
                    ) : (
                      <SortableContext
                        items={circuit.map((q) => slotId(ci, q.instanceId))}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {circuit.map((q) => (
                            <SortableQueueRow
                              key={q.instanceId}
                              id={slotId(ci, q.instanceId)}
                              exercise={q.exercise}
                              onRemove={() => removeItem(ci, q.instanceId)}
                            />
                          ))}
                          <CircuitDropEndZone circuitIndex={ci} />
                          <CircuitDropZone circuitIndex={ci} empty={false} />
                        </div>
                      </SortableContext>
                    )}
                  </div>
                ))}
              </div>
              <AddCircuitDropButton onClick={addCircuit} />
            </div>

            <div className="arcade-card rounded-xl p-4 border border-border/80 shrink-0 space-y-3">
              <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                Workout details
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiSelect);
                    setMode("time-attack");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-widest border",
                    mode === "time-attack"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  Time attack
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiSelect);
                    setMode("rep-quest");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-widest border",
                    mode === "rep-quest"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  Rep quest
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-sans">
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase font-display text-muted-foreground">
                    Work (sec)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={workInterval}
                    onChange={(e) =>
                      setWorkInterval(Number(e.target.value) || 45)
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase font-display text-muted-foreground">
                    Rest between moves (sec)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={restBetweenExercises}
                    onChange={(e) =>
                      setRestBetweenExercises(Number(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase font-display text-muted-foreground">
                    Rest between circuits (sec)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={restBetweenCircuits}
                    onChange={(e) =>
                      setRestBetweenCircuits(Number(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                </label>
                {mode === "rep-quest" ? (
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[0.65rem] uppercase font-display text-muted-foreground">
                      Rep difficulty (0–100)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={repDifficulty}
                      onChange={(e) =>
                        setRepDifficulty(
                          Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        )
                      }
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          {/* Exercise library (~1/3 on md+) */}
          <div className="order-1 md:order-2 flex-1 min-h-0 min-w-0 flex flex-col md:overflow-hidden md:max-w-[34%]">
            <div className="arcade-card rounded-xl border border-border/80 flex flex-col min-h-0 flex-1 overflow-hidden p-3">
              <ExerciseLibraryRolodex
                className="min-h-0"
                rows={catalogRows}
                favoriteKeys={favoriteSet}
                scrollLocked={mobileDragLockScroll}
                onToggleFavorite={(exerciseKey) => {
                  playSound(SOUNDS.uiSelect);
                  toggleFavoriteExercise(exerciseKey);
                  refresh();
                }}
              />
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLibraryExercise ? (
            <div className="w-[280px] opacity-90 pointer-events-none">
              <CatalogExerciseCard
                exercise={activeLibraryExercise}
                isFavorite={false}
                showEdit={false}
                onToggleFavorite={() => {}}
                className="shadow-lg"
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
