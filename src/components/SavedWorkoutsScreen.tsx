import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Play, Pencil, ArrowRight } from "lucide-react";
import {
  loadWorkoutLibrary,
  updateSavedWorkoutMetadata,
  removeSavedWorkout,
} from "../storage/workoutLibraryStorage";
import type { SavedWorkoutEntry } from "../types";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import SaveWorkoutNameModal from "./SaveWorkoutNameModal";
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
  onReplay: (entry: SavedWorkoutEntry) => void;
  onOpenBuilder?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function estimateLineWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if ("ilIjtfr".includes(ch)) {
      width += 0.55;
    } else if ("mwMW@#%&".includes(ch)) {
      width += 1.35;
    } else if (ch === " ") {
      width += 0.35;
    } else {
      width += 1;
    }
  }
  return width;
}

function buildLineLayouts(tokens: string[], lineCount: number): string[][] {
  const results: string[][] = [];
  if (lineCount <= 0 || lineCount > tokens.length) return results;

  const split = (start: number, linesLeft: number, built: string[]) => {
    if (linesLeft === 1) {
      built.push(tokens.slice(start).join(" "));
      results.push([...built]);
      built.pop();
      return;
    }
    const maxEnd = tokens.length - linesLeft;
    for (let end = start; end <= maxEnd; end++) {
      built.push(tokens.slice(start, end + 1).join(" "));
      split(end + 1, linesLeft - 1, built);
      built.pop();
    }
  };

  split(0, lineCount, []);
  return results;
}

function scoreLayout(lines: string[]): { maxWidth: number; variance: number } {
  const widths = lines.map(estimateLineWidth);
  const maxWidth = Math.max(...widths);
  const minWidth = Math.min(...widths);
  return { maxWidth, variance: maxWidth - minWidth };
}

function maybeCompactPairs(words: string[]): string[][] {
  const out: string[][] = [words];
  const compactable = new Set([
    "knee drive",
    "toe touch",
    "high knee",
    "side plank",
  ]);
  for (let i = 0; i < words.length - 1; i++) {
    const key = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
    if (!compactable.has(key)) continue;
    const compacted = [
      ...words.slice(0, i),
      `${words[i]}${words[i + 1]}`,
      ...words.slice(i + 2),
    ];
    out.push(compacted);
  }
  return out;
}

function formatExerciseChipLabel(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const words = trimmed.split(" ").filter(Boolean);
  if (words.length <= 1) return trimmed;
  if (words.length === 2) return `${words[0]}\n${words[1]}`;

  const variants = maybeCompactPairs(words);
  let bestChoice: {
    lines: string[];
    maxWidth: number;
    lineCount: number;
    variance: number;
  } | null = null;

  for (const tokens of variants) {
    const twoLineLayouts = buildLineLayouts(tokens, 2);
    for (const lines of twoLineLayouts) {
      const score = scoreLayout(lines);
      const candidate = {
        lines,
        maxWidth: score.maxWidth,
        lineCount: 2,
        variance: score.variance,
      };
      if (
        !bestChoice ||
        candidate.maxWidth < bestChoice.maxWidth ||
        (candidate.maxWidth === bestChoice.maxWidth &&
          (candidate.lineCount < bestChoice.lineCount ||
            (candidate.lineCount === bestChoice.lineCount &&
              candidate.variance < bestChoice.variance)))
      ) {
        bestChoice = candidate;
      }
    }

    if (tokens.length >= 5) {
      const threeLineLayouts = buildLineLayouts(tokens, 3);
      for (const lines of threeLineLayouts) {
        const score = scoreLayout(lines);
        const candidate = {
          lines,
          maxWidth: score.maxWidth,
          lineCount: 3,
          variance: score.variance,
        };
        if (
          !bestChoice ||
          candidate.maxWidth + 0.9 < bestChoice.maxWidth ||
          (candidate.maxWidth === bestChoice.maxWidth &&
            candidate.lineCount < bestChoice.lineCount)
        ) {
          bestChoice = candidate;
        }
      }
    }
  }

  return bestChoice ? bestChoice.lines.join("\n") : trimmed;
}

export default function SavedWorkoutsScreen({
  onBack,
  onReplay,
  onOpenBuilder,
}: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<SavedWorkoutEntry | null>(null);

  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(
    () =>
      [...lib.savedWorkouts].sort((a, b) =>
        b.addedAtIso.localeCompare(a.addedAtIso)
      ),
    [lib.savedWorkouts]
  );

  const renameEntry = entries.find((e) => e.id === renameId);
  const deleteEntry = entries.find((e) => e.id === deleteConfirmId);

  const iconBtnClass =
    "p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border shrink-0";

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="flex flex-wrap items-center gap-4 mb-8 justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiCancel);
              onBack();
            }}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-display uppercase neon-text-secondary tracking-widest">
            Saved workouts
          </h1>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground font-sans">
            No saved presets yet. Save one from the workout ready screen, from
            history, or build your own in the Workout Builder.
          </p>
          {onOpenBuilder ? (
            <button
              type="button"
              onClick={() => {
                playSound(SOUNDS.uiSelect);
                onOpenBuilder();
              }}
              className="arcade-btn-primary px-6 py-2 rounded-lg text-sm font-display uppercase tracking-widest"
            >
              Build a workout
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="arcade-card rounded-xl p-4 border border-border/80 flex flex-col gap-2 cursor-pointer"
              onClick={() => {
                playSound(SOUNDS.uiSelect);
                setDetailEntry(entry);
              }}
            >
              <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-foreground truncate">
                  {entry.name}
                </p>
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  {entry.plan.options.mode} · {entry.plan.circuits.length}{" "}
                  circuits
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound(SOUNDS.uiConfirm);
                    onReplay(entry);
                  }}
                  className="p-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                  title="Play"
                  aria-label="Play workout"
                >
                  <Play size={18} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound(SOUNDS.uiSelect);
                    setRenameId(entry.id);
                  }}
                  className={iconBtnClass}
                  title="Rename"
                  aria-label="Rename workout"
                >
                  <Pencil size={18} />
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
                  aria-label="Delete workout"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              </div>
              <p className="text-xs text-muted-foreground font-sans text-right mt-auto pt-1">
                {new Date(entry.addedAtIso).toLocaleString()}
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
            <AlertDialogTitle>Delete saved workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEntry
                ? `“${deleteEntry.name}” will be removed from your saved presets. This cannot be undone.`
                : "This preset will be removed. This cannot be undone."}
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
                  removeSavedWorkout(deleteConfirmId);
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
        open={!!renameEntry}
        title="Rename workout"
        initialName={renameEntry?.name ?? ""}
        confirmLabel="Save"
        onClose={() => setRenameId(null)}
        onConfirm={(name) => {
          if (renameId) {
            try {
              updateSavedWorkoutMetadata(renameId, { name });
            } catch {
              /* ignore */
            }
            refresh();
          }
          setRenameId(null);
        }}
      />
      {detailEntry ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Saved workout details"
          onClick={() => setDetailEntry(null)}
        >
          <div
            className="w-full max-w-xl max-h-[min(90dvh,42rem)] overflow-y-auto my-auto arcade-card rounded-xl border border-secondary/40 p-4 sm:p-5 shadow-[0_0_30px_hsl(var(--secondary)/0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-display uppercase neon-text-secondary tracking-wide leading-tight">
              {detailEntry.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground font-sans">
              Saved {new Date(detailEntry.addedAtIso).toLocaleString()}
            </p>

            <div className="relative mt-4 grid grid-cols-2 gap-3 text-xs font-sans">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-border/90 to-transparent"
                aria-hidden
              />
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground">Mode</p>
                  <p className="text-right text-foreground">
                    {detailEntry.plan.options.mode === "time-attack"
                      ? "Time Attack"
                      : "Rep Quest"}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground">Est. Duration</p>
                  <p className="text-right text-foreground">
                    {formatDuration(detailEntry.plan.estimatedDurationSeconds)}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground">Circuits</p>
                  <p className="text-right text-foreground">
                    {detailEntry.plan.circuits.length}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground">Focus</p>
                  <p className="text-right text-foreground">
                    {detailEntry.plan.options.muscles.join(", ") || "Any"}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground">Rest</p>
                  <p className="text-right text-foreground whitespace-pre-line leading-tight">
                    {detailEntry.plan.options.restBetweenExercises}s b/t Exercises{"\n"}
                    {detailEntry.plan.options.restBetweenCircuits}s b/t Circuits
                  </p>
                </div>
              </div>
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
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5 text-sm font-sans text-foreground leading-relaxed">
                      {exerciseNames.length > 0 ? (
                        exerciseNames.map((name, idx) => (
                          <React.Fragment key={`${circuit.id}-${name}-${idx}`}>
                            <span className="max-w-[7.25rem] rounded border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-center whitespace-pre-line break-normal leading-tight">
                              {formatExerciseChipLabel(name)}
                            </span>
                            {idx < exerciseNames.length - 1 ? (
                              <ArrowRight
                                size={11}
                                className="mx-0 sm:mx-1 shrink-0 text-accent/80"
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
