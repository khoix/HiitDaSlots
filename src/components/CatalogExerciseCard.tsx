import React from "react";
import { ExternalLink, Star, Wrench } from "lucide-react";
import type { Exercise } from "../types";
import { parseMuscleString } from "../utils/parseMuscles";
import { openDemoLink, hasDemoLink } from "../utils/openDemo";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export interface CatalogExerciseCardProps {
  exercise: Exercise;
  /** Optional DOM id for A–Z anchor (first card in a letter section). */
  anchorId?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit?: () => void;
  /** When false, hides the catalog edit (wrench) control. */
  showEdit?: boolean;
  className?: string;
  /** Optional drag affordance (e.g. dnd-kit listeners on a handle or whole card). */
  dragProps?: React.HTMLAttributes<HTMLElement>;
  dragRef?: React.Ref<HTMLElement>;
  dragStyle?: React.CSSProperties;
}

export default function CatalogExerciseCard({
  exercise: ex,
  anchorId,
  isFavorite: starred,
  onToggleFavorite,
  onEdit,
  showEdit = true,
  className,
  dragProps,
  dragRef,
  dragStyle,
}: CatalogExerciseCardProps) {
  const tags = parseMuscleString(ex.muscles);
  const demoUrl = ex.demo;
  const hasDemo = hasDemoLink(demoUrl);

  return (
    <article
      ref={dragRef as React.Ref<HTMLDivElement>}
      id={anchorId}
      style={dragStyle}
      className={cn(
        "arcade-card rounded-xl p-4 border border-border/80",
        className
      )}
      {...dragProps}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="font-display text-foreground text-lg leading-tight min-w-0">
          {ex.exercise}
        </h2>
        <div className="flex shrink-0 items-start gap-1">
          {showEdit && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg transition-colors border text-muted-foreground hover:text-accent border-border/60 hover:border-accent/30"
              title="Edit exercise"
              aria-label="Edit exercise"
            >
              <Wrench size={20} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "p-2 rounded-lg shrink-0 transition-colors border",
              starred
                ? "text-accent bg-accent/15 border-accent/40"
                : "text-muted-foreground hover:text-accent border-border/60 hover:border-accent/30"
            )}
            title={starred ? "Remove from favorites" : "Favorite exercise"}
            aria-label="Toggle favorite"
            aria-pressed={starred}
          >
            <Star size={20} className={starred ? "fill-current" : ""} />
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground font-sans leading-relaxed mb-3">
        {ex.description}
      </p>
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
          {tags.map((t) => (
            <Badge
              key={t}
              variant="secondary"
              className="font-sans font-normal text-[0.65rem] uppercase tracking-wide"
            >
              {t}
            </Badge>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openDemoLink(demoUrl)}
          disabled={!hasDemo}
          title={hasDemo ? "Open demo in browser" : "No demo available"}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[0.65rem] font-display uppercase tracking-widest transition-colors shrink-0",
            hasDemo
              ? "border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent"
              : "border border-border/20 text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          <ExternalLink size={13} />
          {hasDemo ? "Demo" : "No demo"}
        </button>
      </div>
    </article>
  );
}
