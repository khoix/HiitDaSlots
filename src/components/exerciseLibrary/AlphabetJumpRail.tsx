import React, { useCallback, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { railLabel, railLetters } from "./rolodexLayout";

export interface AlphabetJumpRailProps {
  letterStart: Map<string, number>;
  activeLetter: string | null;
  onJumpToLetter: (letter: string) => void;
  className?: string;
  /**
   * Mobile: vertical drag acts as a scroll wheel for the rolodex (no letter jumps).
   * `onTouchpadDelta` receives pixel delta per move (same sign convention as wheel).
   */
  touchpadMode?: boolean;
  onTouchpadDelta?: (deltaPx: number) => void;
}

export default function AlphabetJumpRail({
  letterStart,
  activeLetter,
  onJumpToLetter,
  className,
  touchpadMode = false,
  onTouchpadDelta,
}: AlphabetJumpRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [previewLetter, setPreviewLetter] = useState<string | null>(null);
  const letters = railLetters();
  const lastYRef = useRef(0);

  const letterAtClientY = useCallback(
    (clientY: number): string | null => {
      const el = railRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (clientY < r.top || clientY > r.bottom) return null;
      const t = (clientY - r.top) / Math.max(1, r.height);
      const idx = Math.min(
        letters.length - 1,
        Math.max(0, Math.floor(t * letters.length))
      );
      return letters[idx] ?? null;
    },
    [letters]
  );

  const lastFiredLetterRef = useRef<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (touchpadMode) {
      lastYRef.current = e.clientY;
      railRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    lastFiredLetterRef.current = null;
    const L = letterAtClientY(e.clientY);
    if (L && letterStart.has(L)) {
      setPreviewLetter(L);
      lastFiredLetterRef.current = L;
      onJumpToLetter(L);
    }
    railRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!railRef.current?.hasPointerCapture(e.pointerId)) return;
    if (touchpadMode) {
      const dy = e.clientY - lastYRef.current;
      lastYRef.current = e.clientY;
      // Match wheel: finger/trackpad down → positive deltaY → advance offset.
      if (dy !== 0) onTouchpadDelta?.(dy);
      return;
    }
    const L = letterAtClientY(e.clientY);
    setPreviewLetter(L);
    if (L && letterStart.has(L) && L !== lastFiredLetterRef.current) {
      lastFiredLetterRef.current = L;
      onJumpToLetter(L);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      railRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    lastFiredLetterRef.current = null;
    setPreviewLetter(null);
  };

  const showLetter = previewLetter ?? activeLetter;

  return (
    <nav
      ref={railRef}
      data-rail-touchpad={touchpadMode ? true : undefined}
      className={cn(
        "flex flex-col min-h-0 w-9 sm:w-10 shrink-0 self-stretch",
        "rounded-lg border border-border/50 bg-background/90 backdrop-blur-sm",
        "py-1 px-0.5 select-none",
        "touch-none",
        className
      )}
      aria-label={touchpadMode ? "Scroll exercise wheel" : "Jump to letter"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {touchpadMode ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-0.5 pointer-events-none">
          <span className="text-[0.5rem] font-display uppercase tracking-widest text-muted-foreground/90 text-center leading-tight">
            Scroll
          </span>
          <div
            className="w-full flex-1 min-h-[120px] rounded-md bg-gradient-to-b from-primary/15 via-muted/20 to-primary/15 border border-border/40"
            aria-hidden
          />
        </div>
      ) : (
        letters.map((L) => {
          const enabled = letterStart.has(L);
          const label = railLabel(L);
          const isHot = showLetter === L && enabled;
          return (
            <div
              key={L}
              data-rail-letter
              className={cn(
                "flex-1 min-h-[1.1rem] flex items-center justify-center rounded-md pointer-events-none",
                "text-[0.6rem] sm:text-[0.65rem] font-display uppercase tracking-wide transition-all duration-150",
                !enabled && "text-muted-foreground/20",
                enabled && !isHot && "text-muted-foreground",
                isHot &&
                  "text-primary bg-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.35)] scale-[1.08] font-semibold"
              )}
              aria-hidden
            >
              {label}
            </div>
          );
        })
      )}
    </nav>
  );
}
