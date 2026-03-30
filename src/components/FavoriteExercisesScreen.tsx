import React, { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Star } from "lucide-react";
import {
  loadWorkoutLibrary,
  removeFavoriteExercise,
  resolveExerciseByKey,
  toggleFavoriteExercise,
} from "../storage/workoutLibraryStorage";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import CatalogExerciseCard from "./CatalogExerciseCard";
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
}

export default function FavoriteExercisesScreen({ onBack }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const refresh = () => setLib(loadWorkoutLibrary());

  const entries = useMemo(() => {
    return [...lib.favoriteExercises].sort((a, b) =>
      a.exerciseKey.localeCompare(b.exerciseKey)
    );
  }, [lib.favoriteExercises]);

  const previewExercise = previewKey
    ? resolveExerciseByKey(previewKey)
    : null;

  const closePreview = () => {
    playSound(SOUNDS.uiCancel);
    setPreviewKey(null);
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
        <h1 className="text-xl sm:text-2xl md:text-3xl whitespace-nowrap font-display uppercase text-accent tracking-wide sm:tracking-widest flex items-center gap-2">
          <Star className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 shrink-0" />
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
                <button
                  type="button"
                  onClick={() => {
                    playSound(SOUNDS.uiSelect);
                    setPreviewKey(fe.exerciseKey);
                  }}
                  className="min-w-0 flex-1 text-left rounded-lg -m-1 p-1 hover:bg-muted/20 transition-colors"
                >
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
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound(SOUNDS.uiSelect);
                    setDeleteConfirmKey(fe.exerciseKey);
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

      <AlertDialog
        open={!!deleteConfirmKey}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from favorites?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmKey
                ? `“${deleteConfirmKey}” will be removed from your favorite exercises. You can star it again later from a workout or the catalog.`
                : "This exercise will be removed from your favorites."}
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
                if (deleteConfirmKey) {
                  playSound(SOUNDS.uiConfirm);
                  removeFavoriteExercise(deleteConfirmKey);
                  refresh();
                  if (previewKey === deleteConfirmKey) setPreviewKey(null);
                }
                setDeleteConfirmKey(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewKey ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={previewKey ? `Exercise preview: ${previewKey}` : "Exercise preview"}
          onClick={closePreview}
        >
          <div
            className="w-full max-w-md max-h-[min(90dvh,36rem)] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {previewExercise ? (
              <CatalogExerciseCard
                exercise={previewExercise}
                isFavorite
                showEdit={false}
                showFavoriteToggle={false}
                className="border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
                onToggleFavorite={() => {
                  playSound(SOUNDS.uiSelect);
                  toggleFavoriteExercise(previewExercise.exercise);
                  refresh();
                  setPreviewKey(null);
                }}
              />
            ) : (
              <div className="arcade-card rounded-xl p-4 border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
                <div className="px-2 pb-4">
                  <h2 className="text-xl font-display uppercase neon-text-primary tracking-wide leading-tight mb-3">
                    {previewKey}
                  </h2>
                  <p className="text-sm text-destructive/90 font-sans">
                    This exercise is not in the current catalog. Remove it from
                    favorites if you no longer need it.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
