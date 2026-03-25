import React from "react";
import { cn } from "@/lib/utils";
import { rowStyle3D } from "@/lib/slotReelRow3d";

export type SlotReelStripRow = {
  label: string;
  sublabel?: string;
};

export type SlotReelViewportInteractive = {
  value: string;
  getOptionId: (modIndex: number) => string;
  availability: Record<string, boolean>;
  inactiveTitle?: (id: string) => string | undefined;
  ariaLabel?: string;
  ariaActiveDescendantId?: string;
};

export type SlotReelViewportChromeProps = {
  itemHeightPx: number;
  viewportHeightPx: number;
  focus: number;
  stripBlurPx: number;
  stripLen: number;
  cycleRows: SlotReelStripRow[];
  centerLocked: boolean;
  windowGlowLocked?: boolean;
  /** Jackpot stop flash — boosts center label contrast */
  centerFlash?: boolean;
  className?: string;
  cabinetClassName?: string;
  width?: React.CSSProperties["width"];
  perspectivePx?: number;
  /** When false, strip uses transform will-change for smoother motion */
  stripWillChangeAuto?: boolean;
  interactive?: SlotReelViewportInteractive;
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Narrow jackpot columns use slightly smaller type */
  compactRows?: boolean;
  /** Extra classes on the viewport (e.g. jackpot CSS scope) */
  viewportClassName?: string;
  showScanlines?: boolean;
};

export function SlotReelViewportChrome({
  itemHeightPx,
  viewportHeightPx,
  focus,
  stripBlurPx,
  stripLen,
  cycleRows,
  centerLocked,
  windowGlowLocked = false,
  centerFlash = false,
  className,
  cabinetClassName,
  width,
  perspectivePx = 820,
  stripWillChangeAuto = false,
  interactive,
  viewportRef,
  viewportProps,
  compactRows = false,
  viewportClassName,
  showScanlines = true,
}: SlotReelViewportChromeProps) {
  const n = cycleRows.length;
  const translateY =
    viewportHeightPx / 2 - itemHeightPx / 2 - focus * itemHeightPx;

  const {
    className: vpClassName,
    style: vpStyle,
    ...restVp
  } = viewportProps ?? {};

  const centerDist = (i: number) => i - focus;

  return (
    <div
      className={cn(
        "slot-reel-cabinet relative z-0 select-none",
        cabinetClassName,
        className
      )}
      style={{
        width,
        touchAction: viewportProps?.onPointerDown ? "none" : undefined,
      }}
    >
      <div
        className="slot-reel-bezel rounded-2xl p-[10px] sm:p-[12px] border border-border/60"
        style={{
          background: `linear-gradient(
            148deg,
            hsl(var(--secondary) / 0.22) 0%,
            hsl(var(--card)) 38%,
            hsl(var(--muted)) 72%,
            hsl(var(--background)) 100%
          )`,
          boxShadow: `
            0 0 0 1px hsl(var(--border) / 0.5) inset,
            0 2px 4px rgba(0,0,0,0.45),
            0 12px 36px rgba(0,0,0,0.55),
            0 0 28px hsl(var(--primary) / 0.08),
            0 0 20px hsl(var(--secondary) / 0.1)
          `,
        }}
      >
        <div
          className="pointer-events-none absolute inset-[10px] sm:inset-[12px] rounded-xl z-30 slot-reel-gloss"
          aria-hidden
        />
        <div
          ref={viewportRef}
          className={cn(
            "slot-reel-viewport relative overflow-hidden rounded-xl outline-none",
            viewportProps?.onPointerDown &&
              "cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            viewportClassName,
            vpClassName
          )}
          style={{
            height: viewportHeightPx,
            perspective: `${perspectivePx}px`,
            perspectiveOrigin: "50% 50%",
            boxShadow: `
              inset 0 10px 28px rgba(0,0,0,0.75),
              inset 0 -8px 22px rgba(0,0,0,0.55),
              inset 0 0 0 1px rgba(0,0,0,0.4)
            `,
            background:
              "radial-gradient(ellipse 120% 80% at 50% 45%, hsl(220 15% 12%) 0%, hsl(220 18% 5%) 100%)",
            ["--slot-reel-item-h" as string]: `${itemHeightPx}px`,
            ...vpStyle,
          }}
          {...restVp}
        >
          <div
            className="pointer-events-none absolute inset-0 z-20 rounded-xl slot-reel-vignette"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[22%] z-25 slot-reel-fade-top"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] z-25 slot-reel-fade-bottom"
            aria-hidden
          />

          <div
            className={cn(
              "slot-reel-window-glow pointer-events-none absolute left-1/2 -translate-x-1/2 z-18 rounded-md",
              windowGlowLocked && "slot-reel-window-glow--locked"
            )}
            style={{
              top: "50%",
              width: "92%",
              height: itemHeightPx + 10,
              marginTop: -(itemHeightPx + 10) / 2,
              transition: "opacity 0.35s ease, box-shadow 0.45s ease",
            }}
            aria-hidden
          />

          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-22 rounded-md border slot-reel-selection-bracket"
            style={{
              top: "50%",
              width: "90%",
              height: itemHeightPx + 6,
              marginTop: -(itemHeightPx + 6) / 2,
            }}
            aria-hidden
          />

          <div
            className="slot-reel-strip-wrap absolute left-0 right-0 top-0"
            style={{
              transformStyle: "preserve-3d",
              height: stripLen * itemHeightPx,
              willChange: stripWillChangeAuto ? "auto" : "transform",
              transform: `translate3d(0, ${translateY}px, 0)`,
              filter:
                stripBlurPx > 0.05
                  ? `blur(${stripBlurPx.toFixed(2)}px)`
                  : undefined,
              transition: undefined,
            }}
          >
            {Array.from({ length: stripLen }, (_, i) => {
              const row = cycleRows[i % n];
              const dist = centerDist(i);
              const mod = i % n;
              const avail = interactive
                ? Boolean(
                    interactive.availability[interactive.getOptionId(mod)]
                  )
                : true;
              const isCenter = Math.abs(dist) < 0.5;
              const locked = centerLocked && isCenter;
              const optId = interactive?.getOptionId(mod);
              return (
                <div
                  key={i}
                  id={
                    interactive && optId !== undefined && isCenter
                      ? `exercise-pool-option-${optId}`
                      : `slot-row-${i}`
                  }
                  role={interactive ? "option" : undefined}
                  aria-selected={
                    interactive && optId !== undefined
                      ? interactive.value === optId && isCenter
                      : undefined
                  }
                  aria-hidden={interactive ? !isCenter : undefined}
                  aria-disabled={
                    interactive && optId !== undefined ? !avail : undefined
                  }
                  title={
                    interactive && optId !== undefined && !avail
                      ? interactive.inactiveTitle?.(optId)
                      : undefined
                  }
                  className={cn(
                    "slot-reel-row absolute left-0 right-0 flex flex-col items-center justify-center text-center preserve-3d border-b border-white/[0.04]",
                    compactRows ? "px-2 sm:px-3" : "px-4",
                    locked && "slot-reel-row--locked"
                  )}
                  style={{
                    top: i * itemHeightPx,
                    height: itemHeightPx,
                    transformStyle: "preserve-3d",
                    ...rowStyle3D(dist, locked, avail),
                  }}
                >
                  <span
                    className={cn(
                      "font-display uppercase tracking-wide mb-0.5 transition-[text-shadow,color] duration-200 line-clamp-2 leading-tight",
                      compactRows
                        ? "text-xs sm:text-sm"
                        : "text-sm sm:text-base",
                      avail ? "text-foreground" : "text-muted-foreground",
                      centerFlash && isCenter && "text-white"
                    )}
                    style={
                      centerFlash && isCenter
                        ? { textShadow: "0 0 12px hsl(var(--primary)/0.9)" }
                        : undefined
                    }
                  >
                    {row.label}
                  </span>
                  {row.sublabel ? (
                    <span
                      className={cn(
                        "font-sans leading-snug text-muted-foreground/90 line-clamp-2",
                        compactRows
                          ? "text-[10px] sm:text-[11px]"
                          : "text-[11px] sm:text-xs"
                      )}
                    >
                      {row.sublabel}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {showScanlines ? (
        <div
          className="slot-scanlines pointer-events-none absolute inset-0 rounded-2xl overflow-hidden opacity-[0.35]"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
