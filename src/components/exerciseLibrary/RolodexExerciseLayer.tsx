import React, { useRef } from "react";
import { ExternalLink, Star } from "lucide-react";
import type { Exercise } from "../../types";
import { parseMuscleString } from "../../utils/parseMuscles";
import { openDemoLink, hasDemoLink } from "../../utils/openDemo";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { useIsMobile } from "../../hooks/use-mobile";
import type { LayerLayout } from "./rolodexLayout";

const TAP_MOVE_PX = 14;

export interface RolodexExerciseLayerProps {
  exercise: Exercise;
  layout: LayerLayout;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isDraggingStack: boolean;
  isActiveFocus: boolean;
  /** Pick this exercise (short tap, any position on wheel). */
  onTapSelect?: () => void;
  onRequestCloseDetail?: () => void;
  dragHandle?: React.ReactNode;
  className?: string;
}

export default function RolodexExerciseLayer({
  exercise: ex,
  layout,
  isFavorite: starred,
  onToggleFavorite,
  isDraggingStack,
  isActiveFocus,
  onTapSelect,
  onRequestCloseDetail,
  dragHandle,
  className,
}: RolodexExerciseLayerProps) {
  const isMobile = useIsMobile();
  /** More title room on mobile wheel; star stays available when card is expanded (tapped). */
  const showFavoriteButton = !isMobile || layout.isExpanded;

  const tags = parseMuscleString(ex.muscles);
  const demoUrl = ex.demo;
  const hasDemo = hasDemoLink(demoUrl);

  const tapDownRef = useRef<{ x: number; y: number } | null>(null);

  const handleRootClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, [data-rolodex-drag-grip]")) return;
    if (layout.isExpanded) {
      onRequestCloseDetail?.();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, [data-rolodex-drag-grip]")) return;
    tapDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = tapDownRef.current;
    tapDownRef.current = null;
    if (!start || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, [data-rolodex-drag-grip]")) return;
    if (layout.isExpanded || isDraggingStack) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > TAP_MOVE_PX) return;
    onTapSelect?.();
  };

  const paneExpandedClickable = layout.isExpanded;

  return (
    <div
      className={cn(
        "rounded-xl border transition-[transform,box-shadow,opacity,width,height] duration-200 ease-out",
        "border-border/70 bg-card/95 backdrop-blur-sm",
        "shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
        layout.isExpanded &&
          "border-primary/35 shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_0_1px_hsl(var(--primary)/0.12)]",
        isDraggingStack && "shadow-[0_8px_32px_hsl(var(--primary)/0.2)]",
        isActiveFocus && "ring-1 ring-primary/25",
        !layout.isExpanded && onTapSelect && "cursor-pointer",
        layout.isExpanded && "cursor-pointer",
        className
      )}
      style={{
        width: "100%",
        height: "100%",
        willChange: "transform, opacity, width, height",
      }}
      data-no-rolodex-scrub={layout.isExpanded ? true : undefined}
      onClick={paneExpandedClickable ? handleRootClick : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div
        className={cn(
          "h-full flex flex-col overflow-hidden rounded-[inherit]",
          layout.isExpanded ? "p-3" : "px-3 py-1.5 justify-center"
        )}
      >
        <div className="flex items-start gap-2 min-h-0 min-w-0">
          {dragHandle ? (
            <div className="shrink-0 pt-0.5" data-no-rolodex-interactive>
              {dragHandle}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-display text-foreground leading-tight truncate",
                layout.isExpanded
                  ? "text-base sm:text-lg"
                  : "text-[0.7rem] sm:text-xs uppercase tracking-wide"
              )}
              title={ex.exercise}
            >
              {ex.exercise}
            </h3>
            {layout.isExpanded ? (
              <p className="text-xs text-muted-foreground font-sans leading-snug line-clamp-2 mt-1.5">
                {ex.description}
              </p>
            ) : null}
          </div>
          {showFavoriteButton ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                "p-1.5 rounded-lg shrink-0 border transition-colors",
                starred
                  ? "text-accent bg-accent/15 border-accent/40"
                  : "text-muted-foreground border-border/50 hover:text-accent"
              )}
              aria-label="Toggle favorite"
              aria-pressed={starred}
            >
              <Star size={16} className={starred ? "fill-current" : ""} />
            </button>
          ) : null}
        </div>

        {layout.isExpanded ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 gap-y-1.5 min-h-0">
            <div className="flex flex-wrap gap-1 min-w-0 flex-1">
              {tags.slice(0, 5).map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="font-sans font-normal text-[0.6rem] uppercase tracking-wide"
                >
                  {t}
                </Badge>
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDemoLink(demoUrl);
              }}
              disabled={!hasDemo}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6rem] font-display uppercase tracking-widest shrink-0",
                hasDemo
                  ? "border border-accent/40 text-accent hover:bg-accent/10"
                  : "border border-border/30 text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <ExternalLink size={12} />
              {hasDemo ? "Demo" : "No demo"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
