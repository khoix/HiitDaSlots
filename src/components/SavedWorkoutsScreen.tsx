import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Play, Pencil } from "lucide-react";
import {
  loadWorkoutLibrary,
  updateSavedWorkoutMetadata,
  removeSavedWorkout,
} from "../storage/workoutLibraryStorage";
import type { SavedWorkoutEntry } from "../types";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import SaveWorkoutNameModal from "./SaveWorkoutNameModal";
import { clampLoopCount } from "../utils/workoutGenerator";
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

function formatCircuitRoundsLine(entry: SavedWorkoutEntry): string {
  const parts = entry.plan.circuits.map(
    (c, i) => `C${i + 1} ×${clampLoopCount(c.loopCount)}`
  );
  return parts.join(" · ");
}

export default function SavedWorkoutsScreen({
  onBack,
  onReplay,
  onOpenBuilder,
}: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
        {onOpenBuilder ? (
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiSelect);
              onOpenBuilder();
            }}
            className="arcade-btn-secondary px-4 py-2 rounded-lg text-xs font-display uppercase tracking-widest w-full sm:w-auto"
          >
            Build a workout
          </button>
        ) : null}
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
              className="arcade-card rounded-xl p-4 border border-border/80 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-foreground truncate">
                  {entry.name}
                </p>
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  {new Date(entry.addedAtIso).toLocaleString()} ·{" "}
                  {entry.plan.options.mode} · {entry.plan.circuits.length}{" "}
                  circuits
                </p>
                <p className="text-xs text-muted-foreground/90 font-sans mt-1">
                  {formatCircuitRoundsLine(entry)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
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
                  onClick={() => {
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
                  onClick={() => {
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
    </div>
  );
}
