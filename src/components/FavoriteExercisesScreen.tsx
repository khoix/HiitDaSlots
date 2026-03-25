import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Star } from "lucide-react";
import {
  loadWorkoutLibrary,
  removeFavoriteExercise,
  resolveExerciseByKey,
} from "../storage/workoutLibraryStorage";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";

interface Props {
  onBack: () => void;
}

export default function FavoriteExercisesScreen({ onBack }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(() => {
    return [...lib.favoriteExercises].sort((a, b) =>
      a.exerciseKey.localeCompare(b.exerciseKey)
    );
  }, [lib.favoriteExercises]);

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
        <h1 className="text-3xl font-display uppercase text-accent tracking-widest flex items-center gap-2">
          <Star className="w-8 h-8" />
          Favorite exercises
        </h1>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground font-sans text-center py-12">
          Star exercises during a workout or in the editor to list them here.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((fe) => {
            const ex = resolveExerciseByKey(fe.exerciseKey);
            return (
              <li
                key={fe.exerciseKey}
                className="arcade-card rounded-xl p-4 border border-border/80 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-display text-foreground">{fe.exerciseKey}</p>
                  {ex ? (
                    <p className="text-xs text-muted-foreground font-sans mt-1 line-clamp-2">
                      {ex.muscles}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive/80 font-sans mt-1">
                      Not in current catalog
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiCancel);
                    removeFavoriteExercise(fe.exerciseKey);
                    refresh();
                  }}
                  className="p-2 text-destructive/80 hover:text-destructive rounded-lg border border-destructive/30 shrink-0"
                  aria-label="Remove favorite"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
