import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Play } from "lucide-react";
import {
  loadWorkoutLibrary,
  updateSavedWorkoutMetadata,
  removeSavedWorkout,
} from "../storage/workoutLibraryStorage";
import type { SavedWorkoutEntry } from "../types";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import SaveWorkoutNameModal from "./SaveWorkoutNameModal";

interface Props {
  onBack: () => void;
  onReplay: (entry: SavedWorkoutEntry) => void;
}

export default function SavedWorkoutsScreen({ onBack, onReplay }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [renameId, setRenameId] = useState<string | null>(null);

  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(
    () =>
      [...lib.savedWorkouts].sort((a, b) =>
        b.addedAtIso.localeCompare(a.addedAtIso)
      ),
    [lib.savedWorkouts]
  );

  const renameEntry = entries.find((e) => e.id === renameId);

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
        <h1 className="text-3xl font-display uppercase neon-text-secondary tracking-widest">
          Saved workouts
        </h1>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground font-sans text-center py-12">
          No saved presets yet. Save one from the workout ready screen or from
          history.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="arcade-card rounded-xl p-4 border border-border/80 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-display text-lg text-foreground truncate">
                  {entry.name}
                </p>
                <p className="text-xs text-muted-foreground font-sans">
                  {new Date(entry.addedAtIso).toLocaleString()} ·{" "}
                  {entry.plan.options.mode} · {entry.plan.circuits.length}{" "}
                  circuits
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiSelect);
                    setRenameId(entry.id);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiConfirm);
                    onReplay(entry);
                  }}
                  className="arcade-btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <Play size={14} /> Play
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiCancel);
                    removeSavedWorkout(entry.id);
                    refresh();
                  }}
                  className="p-2 text-destructive/80 hover:text-destructive rounded-lg border border-destructive/30"
                  aria-label="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
