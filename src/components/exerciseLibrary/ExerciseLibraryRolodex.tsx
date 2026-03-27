import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { Search } from "lucide-react";
import type { Exercise } from "../../types";
import { cn } from "../../lib/utils";
import AlphabetJumpRail from "./AlphabetJumpRail";
import RolodexExerciseLayer from "./RolodexExerciseLayer";
import {
  MARGIN_INDICES,
  buildLetterStartMap,
  catalogLetter,
  circularAbsDist,
  layoutLayer,
  visibleIndicesAroundFocus,
} from "./rolodexLayout";
import { useIsMobile } from "../../hooks/use-mobile";
import { useRolodexController } from "./useRolodexController";

export interface RolodexCatalogRow {
  canonicalKey: string;
  exercise: Exercise;
}

function libDragId(canonicalKey: string): string {
  return `lib|${encodeURIComponent(canonicalKey)}`;
}

function RolodexLibraryRow({
  row,
  index,
  layout,
  starred,
  isDraggingStack,
  isFocusCard,
  mobileAllowVerticalPan,
  onToggleFavorite,
  onTapSelect,
  onRequestCloseDetail,
  fixedToViewport,
  cardRotateZDeg = 0,
}: {
  row: RolodexCatalogRow;
  index: number;
  layout: ReturnType<typeof layoutLayer>;
  starred: boolean;
  isDraggingStack: boolean;
  isFocusCard: boolean;
  /** Mobile: allow vertical scroll gestures; desktop wheel keeps full pointer capture. */
  mobileAllowVerticalPan: boolean;
  onToggleFavorite: () => void;
  onTapSelect?: () => void;
  onRequestCloseDetail: () => void;
  /** Escape overflow: render as `position: fixed` using live viewport rect (mobile expanded). */
  fixedToViewport?: { left: number; top: number } | null;
  /** Extra in-plane spin on the card (mobile diamond look); wheel layout unchanged. */
  cardRotateZDeg?: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: libDragId(row.canonicalKey),
    data: { type: "library" as const, exercise: row.exercise },
  });

  const baseTransform = `translate3d(-50%, -50%, ${layout.translateZPx}px) rotateY(${layout.rotateYDeg}deg) rotateX(${layout.rotateXDeg}deg) scale(${layout.scale})${
    cardRotateZDeg !== 0 ? ` rotateZ(${cardRotateZDeg}deg)` : ""
  }`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-rolodex-card
      data-rolodex-index={String(index)}
      className={fixedToViewport ? "fixed" : "absolute"}
      style={
        fixedToViewport
          ? {
              left: fixedToViewport.left + layout.centerX,
              top: fixedToViewport.top + layout.centerY,
              width: layout.width,
              height: layout.height,
              zIndex: 6000 + layout.zIndex + (isDragging ? 450 : 0),
              opacity: isDragging ? 0.22 : layout.opacity,
              transform: baseTransform,
              transformOrigin: "center center",
              transformStyle: "preserve-3d",
              touchAction: mobileAllowVerticalPan ? "pan-y" : "none",
            }
          : {
              left: layout.centerX,
              top: layout.centerY,
              width: layout.width,
              height: layout.height,
              zIndex: layout.zIndex + (isDragging ? 450 : 0),
              opacity: isDragging ? 0.22 : layout.opacity,
              transform: baseTransform,
              transformOrigin: "center center",
              transformStyle: "preserve-3d",
              touchAction: mobileAllowVerticalPan ? "pan-y" : "none",
            }
      }
    >
      <RolodexExerciseLayer
        exercise={row.exercise}
        layout={layout}
        isFavorite={starred}
        onToggleFavorite={onToggleFavorite}
        isDraggingStack={isDraggingStack}
        isActiveFocus={isFocusCard}
        onTapSelect={onTapSelect}
        onRequestCloseDetail={onRequestCloseDetail}
      />
    </div>
  );
}

interface Props {
  rows: RolodexCatalogRow[];
  favoriteKeys: Set<string>;
  onToggleFavorite: (exerciseKey: string) => void;
  className?: string;
  scrollLocked?: boolean;
}

export default function ExerciseLibraryRolodex({
  rows,
  favoriteKeys,
  onToggleFavorite,
  className,
  scrollLocked = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 320, h: 400 });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const ex = r.exercise;
      const blob = [ex.exercise, ex.description, ex.muscles].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchQuery]);

  const count = filteredRows.length;

  const letterStart = useMemo(() => buildLetterStartMap(filteredRows), [filteredRows]);

  const isMobileWheel = useIsMobile();

  const [detailOpen, setDetailOpen] = useState(false);
  const [poppedOutIndex, setPoppedOutIndex] = useState<number | null>(null);

  /** Horizontal scrub + −90° wheel only when no card detail/pop-out is open; tap opens upright layout. */
  const mobileRotatedWheel =
    isMobileWheel && !detailOpen && poppedOutIndex === null;

  const {
    focusFloat,
    focusIndex,
    isDragging,
    isSettling,
    jumpToIndex,
    applyOffsetDelta,
  } = useRolodexController({
    count,
    viewportRef,
    horizontalScrub: mobileRotatedWheel,
    inputLocked: scrollLocked,
  });

  /** Expanded / pop-out cards portal to `body` so they are not clipped by `overflow-hidden`. */
  const mobilePortalExpanded =
    isMobileWheel && (detailOpen || poppedOutIndex !== null);

  const [viewportOrigin, setViewportOrigin] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewportOrigin({ left: r.left, top: r.top });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    setDetailOpen(false);
    setPoppedOutIndex(null);
  }, [focusIndex]);

  useEffect(() => {
    setDetailOpen(false);
    setPoppedOutIndex(null);
  }, [searchQuery]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const activeLetter =
    count > 0 && focusIndex >= 0 && focusIndex < count
      ? catalogLetter(filteredRows[focusIndex].exercise.exercise)
      : null;

  const handleJumpLetter = (letter: string) => {
    const idx = letterStart.get(letter);
    if (idx != null) jumpToIndex(idx);
  };

  /** On mobile, rotated wheel uses swapped width/height; detail/pop-out uses natural viewport. */
  const layoutW = mobileRotatedWheel ? viewportSize.h : viewportSize.w;
  const layoutH = mobileRotatedWheel ? viewportSize.w : viewportSize.h;

  const layerEntries = useMemo(() => {
    const idxs = visibleIndicesAroundFocus(focusFloat, count, MARGIN_INDICES);
    const out: {
      index: number;
      layout: ReturnType<typeof layoutLayer>;
    }[] = [];
    for (const i of idxs) {
      const layout = layoutLayer(
        i,
        focusFloat,
        layoutW,
        layoutH,
        count,
        {
          revealExpandedCard: detailOpen,
          poppedOutIndex,
          rimRadiusScale: isMobileWheel ? 2 : 1,
          expandedHeightScale: isMobileWheel ? 2 : 1,
        }
      );
      if (!layout.isFrontHalf) continue;
      out.push({ index: i, layout });
    }
    return out.sort((a, b) => a.layout.zIndex - b.layout.zIndex);
  }, [
    focusFloat,
    layoutW,
    layoutH,
    count,
    detailOpen,
    poppedOutIndex,
    isMobileWheel,
  ]);

  /** Matches layout “near focus” band so the primary ring only tracks the front card, not pop-outs. */
  const MIDWAY_FOCUS_DIST = 0.52;

  const handleCardTap = (i: number) => {
    // Only the midway/focused card opens full details.
    // Any other card should pop out in place without snapping the wheel.
    if (i === focusIndex) {
      setPoppedOutIndex(null);
      setDetailOpen(true);
      return;
    }
    setDetailOpen(false);
    setPoppedOutIndex(i);
  };

  const closeDetailOverlay = () => {
    setDetailOpen(false);
    setPoppedOutIndex(null);
  };

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/10 p-6",
          className
        )}
      >
        <p className="text-sm text-muted-foreground font-sans text-center">
          No exercises in the catalog.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col flex-1 min-h-0 min-w-0",
        isMobileWheel
          ? "max-md:overflow-visible md:h-full md:overflow-y-auto md:overflow-hidden"
          : "h-full overflow-hidden",
        className
      )}
    >
      <div className="shrink-0 mb-2 space-y-0.5">
        <h2 className="font-display text-sm uppercase tracking-widest text-secondary">
          Exercise library
        </h2>
        <p className="text-[0.65rem] font-sans text-muted-foreground leading-snug">
          Drag-and-Drop exercise cards to build your workout.
        </p>
      </div>

      <div className="shrink-0 mb-2">
        <label className="sr-only" htmlFor="rolodex-quick-search">
          Search exercises
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="rolodex-quick-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Quick search…"
            autoComplete="off"
            className="w-full rounded-lg border border-border/60 bg-background/80 py-2 pl-9 pr-3 font-sans text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {count === 0 ? (
        <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/10 px-4 py-10">
          <p className="text-center font-sans text-sm text-muted-foreground">
            {`No exercises match "${searchQuery.trim()}".`}
          </p>
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 gap-2 sm:gap-2.5">
        <div
          ref={viewportRef}
          className={cn(
            "relative flex-1 min-h-0 min-w-0 overflow-hidden rounded-xl",
            "border border-border/40 bg-gradient-to-b from-black/25 to-black/40",
            "shadow-[inset_0_1px_0_hsl(var(--primary)/0.08)]",
            (isDragging || isSettling) && "border-primary/20"
          )}
          style={{
            // Mobile: allow vertical page/region scroll; desktop: wheel captures all panning.
            touchAction: isMobileWheel ? "pan-y" : "none",
            // Match slot reel perspective more closely so the rolodex depth curve reads clearly.
            perspective: "min(720px, 100vw)",
            perspectiveOrigin: "50% 50%",
          }}
          onPointerUp={(e) => {
            if (!(detailOpen || poppedOutIndex !== null)) return;
            if (isDragging || isSettling) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            // Only close when the user taps outside any rolodex card.
            if (target.closest("[data-rolodex-card]")) return;
            closeDetailOverlay();
          }}
        >
          <div
            className="absolute"
            style={
              mobileRotatedWheel
                ? {
                    width: viewportSize.h,
                    height: viewportSize.w,
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%) rotate(-90deg)",
                    transformOrigin: "center center",
                  }
                : { inset: 0 }
            }
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.06) 50%, transparent 100%), radial-gradient(ellipse 55% 88% at 50% 50%, hsl(var(--primary)/0.1), transparent 65%)",
              }}
              aria-hidden
            />
            {layerEntries.map(({ index: i, layout }) => {
              const row = filteredRows[i];
              const starred = favoriteKeys.has(row.exercise.exercise);
              const isFocusCard =
                layout.isExpanded &&
                circularAbsDist(i, focusFloat, count) < MIDWAY_FOCUS_DIST;

              const portalExpanded =
                mobilePortalExpanded &&
                layout.isExpanded &&
                viewportOrigin != null;

              const rowEl = (
                <RolodexLibraryRow
                  row={row}
                  index={i}
                  layout={layout}
                  starred={starred}
                  isDraggingStack={isDragging}
                  isFocusCard={isFocusCard}
                  mobileAllowVerticalPan={isMobileWheel}
                  onToggleFavorite={() => onToggleFavorite(row.exercise.exercise)}
                  onTapSelect={!layout.isExpanded ? () => handleCardTap(i) : undefined}
                  onRequestCloseDetail={closeDetailOverlay}
                  fixedToViewport={portalExpanded ? viewportOrigin : undefined}
                  cardRotateZDeg={
                    isMobileWheel ? (layout.isExpanded ? 0 : 45) : 0
                  }
                />
              );

              if (portalExpanded) {
                return (
                  <React.Fragment key={row.canonicalKey}>
                    {createPortal(rowEl, document.body)}
                  </React.Fragment>
                );
              }

              return <React.Fragment key={row.canonicalKey}>{rowEl}</React.Fragment>;
            })}
          </div>
        </div>

        <AlphabetJumpRail
          letterStart={letterStart}
          activeLetter={activeLetter}
          onJumpToLetter={handleJumpLetter}
          touchpadMode={isMobileWheel}
          onTouchpadDelta={(d) => applyOffsetDelta(d * 9)}
        />
      </div>
      )}
    </div>
  );
}

export { libDragId };
