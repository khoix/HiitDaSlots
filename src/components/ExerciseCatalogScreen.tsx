import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, X } from "lucide-react";
import type { Exercise } from "../types";
import {
  getAllUniqueMuscles,
  parseMuscleString,
} from "../utils/parseMuscles";
import {
  loadWorkoutLibrary,
  migrateFavoriteExerciseKey,
  toggleFavoriteExercise,
} from "../storage/workoutLibraryStorage";
import {
  getResolvedCatalogRows,
  isDuplicateResolvedDisplayName,
  setOverride,
} from "../storage/catalogOverridesStorage";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import { cn } from "../lib/utils";
import CatalogExerciseCard from "./CatalogExerciseCard";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface Props {
  onBack: () => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function catalogLetter(exerciseName: string): "hash" | string {
  const trimmed = exerciseName.trim();
  if (!trimmed) return "hash";
  const ch = trimmed[0];
  if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  return "hash";
}

function anchorId(letter: string): string {
  return letter === "hash" ? "catalog-anchor-hash" : `catalog-anchor-${letter}`;
}

interface CatalogRow {
  canonicalKey: string;
  exercise: Exercise;
}

interface Section {
  letter: string;
  rows: CatalogRow[];
}

function ExerciseEditOverlay({
  canonicalKey,
  baselineExercise,
  onClose,
  onSaved,
}: {
  canonicalKey: string;
  baselineExercise: Exercise;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(baselineExercise.exercise);
  const [description, setDescription] = useState(baselineExercise.description);
  const [muscles, setMuscles] = useState(baselineExercise.muscles);
  const [demo, setDemo] = useState(baselineExercise.demo);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setName(baselineExercise.exercise);
    setDescription(baselineExercise.description);
    setMuscles(baselineExercise.muscles);
    setDemo(baselineExercise.demo);
    setSaveError(null);
  }, [baselineExercise]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nt = name.trim();
    if (!nt) {
      setSaveError("Name is required.");
      return;
    }
    if (isDuplicateResolvedDisplayName(nt, canonicalKey)) {
      setSaveError("Another exercise already uses that name.");
      return;
    }
    setSaveError(null);
    if (baselineExercise.exercise !== nt) {
      migrateFavoriteExerciseKey(baselineExercise.exercise, nt);
    }
    const next: Exercise = {
      ...baselineExercise,
      exercise: nt,
      description: description.trim(),
      muscles: muscles.trim(),
      demo: demo.trim(),
    };
    setOverride(canonicalKey, next);
    playSound(SOUNDS.uiConfirm);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-edit-title"
    >
      <div className="arcade-card rounded-xl p-6 w-full max-w-md max-h-[min(90dvh,36rem)] overflow-y-auto border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h2
            id="exercise-edit-title"
            className="text-xl font-display uppercase neon-text-primary tracking-wide"
          >
            Edit exercise
          </h2>
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiCancel);
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground p-1 shrink-0"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="ex-edit-name"
              className="text-xs uppercase font-display text-muted-foreground tracking-widest block"
            >
              Name
            </label>
            <Input
              id="ex-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background/80 border-border"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ex-edit-desc"
              className="text-xs uppercase font-display text-muted-foreground tracking-widest block"
            >
              Description
            </label>
            <Textarea
              id="ex-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="bg-background/80 border-border resize-y min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ex-edit-muscles"
              className="text-xs uppercase font-display text-muted-foreground tracking-widest block"
            >
              Targets
            </label>
            <Input
              id="ex-edit-muscles"
              value={muscles}
              onChange={(e) => setMuscles(e.target.value)}
              placeholder="Quads; glutes; core"
              className="bg-background/80 border-border"
              autoComplete="off"
            />
            <p className="text-[0.65rem] text-muted-foreground font-sans">
              Semicolon-separated muscle labels (same as catalog data).
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ex-edit-demo"
              className="text-xs uppercase font-display text-muted-foreground tracking-widest block"
            >
              Demo link
            </label>
            <Input
              id="ex-edit-demo"
              type="text"
              value={demo}
              onChange={(e) => setDemo(e.target.value)}
              placeholder="https://…"
              className="bg-background/80 border-border"
              autoComplete="off"
            />
          </div>
          {saveError ? (
            <p className="text-sm text-destructive font-sans">{saveError}</p>
          ) : null}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                playSound(SOUNDS.uiCancel);
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground font-display uppercase text-xs tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="arcade-btn-primary px-6 py-2 rounded-lg text-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function useUniformFitScale(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  deps: React.DependencyList
) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const inner = contentRef.current;
    if (!vp || !inner) return;
    const update = () => {
      const cw = vp.clientWidth;
      const ch = vp.clientHeight;
      const iw = inner.scrollWidth;
      const ih = inner.scrollHeight;
      if (cw < 2 || ch < 2 || iw < 1 || ih < 1) {
        setScale(1);
        return;
      }
      setScale(Math.min(1, cw / iw, ch / ih));
    };
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    ro.observe(inner);
    update();
    return () => ro.disconnect();
  }, deps);
  return scale;
}

function CatalogTargetFilterDesktop({
  allTargets,
  selectedTargets,
  toggleTarget,
}: {
  allTargets: string[];
  selectedTargets: string[];
  toggleTarget: (muscle: string) => void;
}) {
  const filterViewportRef = useRef<HTMLDivElement>(null);
  const filterContentRef = useRef<HTMLDivElement>(null);
  const filterScale = useUniformFitScale(
    filterViewportRef,
    filterContentRef,
    [allTargets, selectedTargets]
  );

  return (
    <div
      ref={filterViewportRef}
      className="relative h-[min(26dvh,9.75rem)] w-full overflow-hidden rounded-lg border border-border/50 bg-black/20"
      role="group"
      aria-label="Target filters"
    >
      <div
        ref={filterContentRef}
        className="absolute left-0 top-0 w-full origin-top-left px-2 py-2"
        style={{ transform: `scale(${filterScale})` }}
      >
        <div className="flex flex-wrap gap-1.5">
          {allTargets.map((muscle) => {
            const on = selectedTargets.includes(muscle);
            return (
              <button
                key={muscle}
                type="button"
                onClick={() => toggleTarget(muscle)}
                aria-pressed={on}
                className={cn(
                  "rounded-md border px-2 py-1 font-sans text-[0.65rem] uppercase tracking-wide transition-colors",
                  on
                    ? "border-primary/60 bg-primary/20 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.25)]"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {muscle}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CatalogTargetFilterMobile({
  allTargets,
  selectedTargets,
  toggleTarget,
}: {
  allTargets: string[];
  selectedTargets: string[];
  toggleTarget: (muscle: string) => void;
}) {
  const summary =
    selectedTargets.length === 0
      ? "All targets"
      : `${selectedTargets.length} selected`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-black/20 px-3 text-left font-sans shadow-sm ring-offset-background transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Open target filter menu"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[0.6rem] uppercase tracking-[0.15em] text-muted-foreground">
              Targets
            </span>
            <span className="block truncate text-sm text-foreground">{summary}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "max-h-[min(60dvh,22rem)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto rounded-xl p-1.5",
          "border border-border/80 bg-card/90 text-foreground shadow-[0_6px_28px_rgba(0,0,0,0.45)] backdrop-blur-md",
          "ring-1 ring-primary/15"
        )}
      >
        <DropdownMenuLabel className="border-b border-border/50 px-2 pb-2 pt-1 font-display text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          Filter by target (A–Z)
        </DropdownMenuLabel>
        {allTargets.map((muscle) => (
          <DropdownMenuCheckboxItem
            key={muscle}
            checked={selectedTargets.includes(muscle)}
            onCheckedChange={() => toggleTarget(muscle)}
            onSelect={(e) => e.preventDefault()}
            className="font-sans text-xs uppercase tracking-wide data-[highlighted]:bg-primary/12 data-[highlighted]:text-foreground data-[state=checked]:bg-primary/10"
          >
            {muscle}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ExerciseCatalogScreen({ onBack }: Props) {
  const [lib, setLib] = useState(() => loadWorkoutLibrary());
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const refresh = () => setLib(loadWorkoutLibrary());

  const favoriteSet = useMemo(
    () => new Set(lib.favoriteExercises.map((f) => f.exerciseKey)),
    [lib.favoriteExercises]
  );

  const allTargets = useMemo(
    () => getAllUniqueMuscles(),
    [catalogRevision]
  );

  const filteredRows = useMemo(() => {
    let rows = getResolvedCatalogRows();
    if (selectedTargets.length > 0) {
      const sel = new Set(selectedTargets);
      rows = rows.filter((r) =>
        parseMuscleString(r.exercise.muscles).some((m) => sel.has(m))
      );
    }
    return [...rows].sort((a, b) =>
      a.exercise.exercise.localeCompare(b.exercise.exercise)
    );
  }, [selectedTargets, catalogRevision]);

  const sections = useMemo((): Section[] => {
    const byLetter = new Map<string, CatalogRow[]>();
    for (const row of filteredRows) {
      const L = catalogLetter(row.exercise.exercise);
      const list = byLetter.get(L) ?? [];
      list.push(row);
      byLetter.set(L, list);
    }
    const out: Section[] = [];
    if (byLetter.has("hash")) {
      out.push({ letter: "hash", rows: byLetter.get("hash")! });
    }
    for (const L of LETTERS) {
      const list = byLetter.get(L);
      if (list?.length) out.push({ letter: L, rows: list });
    }
    return out;
  }, [filteredRows]);

  const lettersPresent = useMemo(() => {
    const s = new Set<string>();
    for (const sec of sections) s.add(sec.letter);
    return s;
  }, [sections]);

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(anchorId(letter));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleTarget = (muscle: string) => {
    playSound(SOUNDS.uiSelect);
    setSelectedTargets((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const clearTargets = () => {
    playSound(SOUNDS.uiSelect);
    setSelectedTargets([]);
  };

  const letterViewportRef = useRef<HTMLDivElement>(null);
  const letterContentRef = useRef<HTMLDivElement>(null);
  const letterScale = useUniformFitScale(letterViewportRef, letterContentRef, [
    sections,
  ]);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full max-w-3xl mx-auto flex-col overflow-hidden px-3 sm:px-4 pt-8 pb-4 box-border">
      {editing ? (
        <ExerciseEditOverlay
          canonicalKey={editing.canonicalKey}
          baselineExercise={editing.exercise}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setCatalogRevision((r) => r + 1);
            refresh();
          }}
        />
      ) : null}

      <div className="flex items-center gap-4 mb-4 shrink-0">
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
        <h1 className="text-2xl sm:text-3xl font-display uppercase text-primary tracking-widest neon-text-primary">
          Exercise Catalog
        </h1>
      </div>

      <div className="mb-3 shrink-0 space-y-2">
        <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 md:justify-between">
          <p className="hidden font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground md:block">
            Filter by target
          </p>
          {selectedTargets.length > 0 ? (
            <button
              type="button"
              onClick={clearTargets}
              className="font-display text-[0.6rem] uppercase tracking-widest text-primary/80 hover:text-primary transition-colors"
            >
              Clear ({selectedTargets.length})
            </button>
          ) : null}
        </div>
        <div className="md:hidden">
          <CatalogTargetFilterMobile
            allTargets={allTargets}
            selectedTargets={selectedTargets}
            toggleTarget={toggleTarget}
          />
        </div>
        <div className="hidden md:block">
          <CatalogTargetFilterDesktop
            allTargets={allTargets}
            selectedTargets={selectedTargets}
            toggleTarget={toggleTarget}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2 sm:gap-3">
        <div className="min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-y-contain pb-8 space-y-3 [scrollbar-gutter:stable]">
          {filteredRows.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground font-sans">
              No exercises match the selected targets. Clear filters or pick
              different targets.
            </p>
          ) : null}
          {sections.map((sec) =>
            sec.rows.map((row, idx) => {
              const isFirst = idx === 0;
              const { canonicalKey, exercise: ex } = row;
              const starred = favoriteSet.has(ex.exercise);

              return (
                <CatalogExerciseCard
                  key={canonicalKey}
                  exercise={ex}
                  anchorId={isFirst ? anchorId(sec.letter) : undefined}
                  isFavorite={starred}
                  onToggleFavorite={() => {
                    playSound(SOUNDS.uiSelect);
                    toggleFavoriteExercise(ex.exercise);
                    refresh();
                  }}
                  onEdit={() => {
                    playSound(SOUNDS.uiSelect);
                    setEditing({
                      canonicalKey,
                      exercise: { ...ex },
                    });
                  }}
                />
              );
            })
          )}
        </div>

        <nav
          className="relative min-h-0 w-7 shrink-0 self-stretch overflow-hidden border-l border-border/40 bg-background/95 py-1 pl-1.5 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 sm:w-8 sm:pl-2"
          aria-label="Jump to letter"
        >
          <div
            ref={letterViewportRef}
            className="absolute inset-0 overflow-hidden"
          >
            <div
              ref={letterContentRef}
              className="absolute left-1/2 top-1/2 flex min-w-0 flex-col items-stretch gap-0.5"
              style={{
                transform: `translate(-50%, -50%) scale(${letterScale})`,
              }}
            >
              {lettersPresent.has("hash") ? (
                <button
                  type="button"
                  onClick={() => scrollToLetter("hash")}
                  className="w-full min-w-[1.25rem] text-[0.65rem] font-display uppercase leading-none py-0.5 rounded text-center text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Jump to symbols and numbers"
                >
                  #
                </button>
              ) : null}
              {LETTERS.map((L) => {
                const enabled = lettersPresent.has(L);
                return (
                  <button
                    key={L}
                    type="button"
                    disabled={!enabled}
                    onClick={() => enabled && scrollToLetter(L)}
                    className={cn(
                      "w-full min-w-[1.25rem] text-[0.65rem] font-display uppercase leading-none py-0.5 rounded text-center transition-colors",
                      enabled
                        ? "text-muted-foreground hover:text-primary cursor-pointer"
                        : "text-muted-foreground/25 cursor-default"
                    )}
                    aria-label={`Jump to letter ${L}`}
                    aria-disabled={!enabled}
                  >
                    {L}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
