import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  Trash2,
  Play,
  BookmarkPlus,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import {
  loadWorkoutLibrary,
  updateHistoryMetadata,
  removeHistoryEntry,
  addSavedWorkout,
} from "../storage/workoutLibraryStorage";
import type { WorkoutHistoryEntry } from "../types";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import SaveWorkoutNameModal from "./SaveWorkoutNameModal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface Props {
  onBack: () => void;
  onReplay: (entry: WorkoutHistoryEntry) => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function summarizeWorkout(entry: WorkoutHistoryEntry): string {
  const { plan } = entry;
  const modeLabel = plan.options.mode === "time-attack" ? "Time Attack" : "Rep Quest";
  const exerciseCount = plan.circuits.reduce(
    (sum, c) => sum + c.items.filter((item) => item.type === "exercise").length,
    0
  );
  const focus =
    plan.options.muscles.slice(0, 2).join(" + ") ||
    plan.tags[0] ||
    "Full Body";
  return `${modeLabel} ${focus} (${exerciseCount} exercises)`;
}

export default function WorkoutHistoryScreen({ onBack, onReplay }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveEntry, setSaveEntry] = useState<WorkoutHistoryEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<WorkoutHistoryEntry | null>(null);

  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(
    () =>
      [...lib.history].sort((a, b) =>
        b.completedAtIso.localeCompare(a.completedAtIso)
      ),
    [lib.history]
  );

  const deleteEntry = entries.find((e) => e.id === deleteConfirmId);

  const formatCompletedAt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const stopRowOpen: React.MouseEventHandler<HTMLElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
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
        <h1 className="text-3xl font-display uppercase neon-text-primary tracking-widest">
          History
        </h1>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground font-sans text-center py-12">
          No completed workouts yet. Finish a run to build your history.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="arcade-card rounded-xl p-4 border border-border/80 cursor-pointer"
              onClick={() => {
                playSound(SOUNDS.uiSelect);
                setDetailEntry(entry);
              }}
            >
              <div className="mb-3 space-y-2">
                <div className="flex flex-row items-center gap-2">
                  <input
                    onClick={stopRowOpen}
                    className="min-w-0 flex-1 rounded border border-border bg-background/80 px-2 py-1 font-display text-foreground"
                    value={(entry.title ?? "").trim() || summarizeWorkout(entry)}
                    onChange={(e) => {
                      updateHistoryMetadata(entry.id, {
                        title: e.target.value,
                      });
                      refresh();
                    }}
                    placeholder="Title"
                  />
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSound(SOUNDS.uiConfirm);
                        onReplay(entry);
                      }}
                      className="p-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                      title="Replay"
                      aria-label="Replay workout"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSound(SOUNDS.uiSelect);
                        setSaveEntry(entry);
                        setSaveModalOpen(true);
                      }}
                      className="p-2 rounded-lg border border-accent/50 text-accent hover:bg-accent/10 shrink-0"
                      title="Save as preset"
                      aria-label="Save as workout preset"
                    >
                      <BookmarkPlus size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSound(SOUNDS.uiSelect);
                        setDeleteConfirmId(entry.id);
                      }}
                      className="p-2 text-destructive/80 hover:text-destructive rounded-lg border border-destructive/30 shrink-0"
                      title="Delete"
                      aria-label="Delete from history"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <Collapsible defaultOpen={Boolean(entry.notes?.trim())}>
                <CollapsibleTrigger
                  onClick={stopRowOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-2 text-left font-display text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180"
                >
                  <span>Notes</span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-muted-foreground transition-transform duration-200"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <textarea
                    onClick={stopRowOpen}
                    className="w-full bg-background/80 border border-border rounded px-2 py-2 font-sans text-sm text-foreground min-h-[72px]"
                    value={entry.notes ?? ""}
                    onChange={(e) => {
                      updateHistoryMetadata(entry.id, {
                        notes: e.target.value,
                      });
                      refresh();
                    }}
                    placeholder="Notes"
                  />
                </CollapsibleContent>
              </Collapsible>
              <p className="mt-3 min-w-0 overflow-x-auto text-right text-xs text-muted-foreground font-sans whitespace-nowrap">
                {formatCompletedAt(entry.completedAtIso)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete from history?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEntry
                ? `Remove “${(deleteEntry.title ?? "").trim() || "Untitled"}” (${formatCompletedAt(deleteEntry.completedAtIso)}) from your history. This cannot be undone.`
                : "This entry will be removed from your history. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => playSound(SOUNDS.uiCancel)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) {
                  playSound(SOUNDS.uiConfirm);
                  removeHistoryEntry(deleteConfirmId);
                  refresh();
                }
                setDeleteConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SaveWorkoutNameModal
        open={saveModalOpen}
        title="Save as workout preset"
        hint="Saved presets appear under Saved workouts."
        initialName={saveEntry ? (saveEntry.title ?? "").trim() || summarizeWorkout(saveEntry) : ""}
        onClose={() => {
          setSaveModalOpen(false);
          setSaveEntry(null);
        }}
        onConfirm={(name) => {
          if (saveEntry) {
            try {
              addSavedWorkout(name, saveEntry.plan);
            } catch {
              /* ignore */
            }
          }
          refresh();
        }}
      />

      {detailEntry ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Workout details"
          onClick={() => setDetailEntry(null)}
        >
          <div
            className="w-full max-w-xl max-h-[min(90dvh,42rem)] overflow-y-auto my-auto arcade-card rounded-xl border border-primary/30 p-4 sm:p-5 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-display uppercase neon-text-primary tracking-wide leading-tight">
              {(detailEntry.title ?? "").trim() || summarizeWorkout(detailEntry)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground font-sans">
              {formatCompletedAt(detailEntry.completedAtIso)}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-sans">
              <p className="text-muted-foreground">Mode</p>
              <p className="text-right text-foreground">
                {detailEntry.plan.options.mode === "time-attack" ? "Time Attack" : "Rep Quest"}
              </p>
              <p className="text-muted-foreground">Estimated Duration</p>
              <p className="text-right text-foreground">
                {formatDuration(detailEntry.plan.estimatedDurationSeconds)}
              </p>
              <p className="text-muted-foreground">Circuits</p>
              <p className="text-right text-foreground">
                {detailEntry.plan.circuits.length}
              </p>
              <p className="text-muted-foreground">Focus</p>
              <p className="text-right text-foreground truncate">
                {detailEntry.plan.options.muscles.join(", ") || "Any"}
              </p>
              <p className="text-muted-foreground">Rest</p>
              <p className="text-right text-foreground whitespace-pre-line leading-tight">
                {detailEntry.plan.options.restBetweenExercises}s b/t Exercises{"\n"}
                {detailEntry.plan.options.restBetweenCircuits}s b/t Circuits
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {detailEntry.plan.circuits.map((circuit) => {
                const exerciseNames = circuit.items
                  .filter((item) => item.type === "exercise")
                  .map((item) => item.exercise.exercise);

                return (
                  <div
                    key={circuit.id}
                    className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-xs uppercase tracking-widest text-accent">
                        Circuit {circuit.circuitNumber}
                      </p>
                      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                        x{circuit.loopCount ?? 1}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-y-1.5 text-sm font-sans text-foreground leading-relaxed">
                      {exerciseNames.length > 0 ? (
                        exerciseNames.map((name, idx) => (
                          <React.Fragment key={`${circuit.id}-${name}-${idx}`}>
                            <span className="max-w-[8.5rem] rounded border border-primary/25 bg-primary/5 px-2 py-0.5 text-center whitespace-normal break-words leading-tight">
                              {name}
                            </span>
                            {idx < exerciseNames.length - 1 ? (
                              <ArrowRight
                                size={11}
                                className="mx-1 shrink-0 text-accent/80"
                                aria-hidden
                              />
                            ) : null}
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No exercises listed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
