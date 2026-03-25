import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Play, BookmarkPlus } from "lucide-react";
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

interface Props {
  onBack: () => void;
  onReplay: (entry: WorkoutHistoryEntry) => void;
}

export default function WorkoutHistoryScreen({ onBack, onReplay }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveEntry, setSaveEntry] = useState<WorkoutHistoryEntry | null>(null);

  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(
    () =>
      [...lib.history].sort((a, b) =>
        b.completedAtIso.localeCompare(a.completedAtIso)
      ),
    [lib.history]
  );

  const formatCompletedAt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

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
              className="arcade-card rounded-xl p-4 border border-border/80"
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="order-2 flex min-w-0 flex-1 flex-col sm:order-1">
                  <input
                    className="mb-1 w-full rounded border border-border bg-background/80 px-2 py-1 font-display text-foreground"
                    value={entry.title ?? ""}
                    onChange={(e) => {
                      updateHistoryMetadata(entry.id, {
                        title: e.target.value,
                      });
                      refresh();
                    }}
                    placeholder="Title"
                  />
                  <p className="min-w-0 overflow-x-auto text-xs text-muted-foreground font-sans whitespace-nowrap">
                    {formatCompletedAt(entry.completedAtIso)}
                  </p>
                </div>
                <div className="order-1 flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:order-2 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSound(SOUNDS.uiConfirm);
                      onReplay(entry);
                    }}
                    className="arcade-btn-primary flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] leading-tight"
                  >
                    <Play size={12} /> Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound(SOUNDS.uiSelect);
                      setSaveEntry(entry);
                      setSaveModalOpen(true);
                    }}
                    className="flex items-center gap-0.5 rounded-lg border border-accent/50 px-2 py-1 text-[11px] leading-tight text-accent hover:bg-accent/10"
                  >
                    <BookmarkPlus size={12} /> Save as preset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound(SOUNDS.uiCancel);
                      removeHistoryEntry(entry.id);
                      refresh();
                    }}
                    className="rounded-lg border border-destructive/30 p-1.5 text-destructive/80 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <textarea
                className="w-full bg-background/80 border border-border rounded px-2 py-2 font-sans text-sm text-foreground min-h-[72px]"
                value={entry.notes ?? ""}
                onChange={(e) => {
                  updateHistoryMetadata(entry.id, { notes: e.target.value });
                  refresh();
                }}
                placeholder="Notes"
              />
            </li>
          ))}
        </ul>
      )}

      <SaveWorkoutNameModal
        open={saveModalOpen}
        title="Save as workout preset"
        hint="Saved presets appear under Saved workouts."
        initialName={saveEntry?.title ?? ""}
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
    </div>
  );
}
