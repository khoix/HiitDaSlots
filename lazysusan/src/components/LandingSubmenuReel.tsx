import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const DRAG_PX_PER_STEP = 120;
const LAZY_SUSAN_WINDOW = 8;

/** Middots evenly spaced along each arc between two menu labels (slot index gap of 1). */
const MIDDOTS_PER_GAP = 13;

/** Slow continuous rotation (slot indices per second) while idle; off if `prefers-reduced-motion`. */
const IDLE_DRIFT_SLOTS_PER_SEC = 0.055;

/** Tap → activate only when clearly a tap; ambiguous → snap only (plan §Safeguards). */
const TAP_MAX_TRAVEL_PX = 10;
const TAP_MAX_VELOCITY = 400;
const TAP_MAX_DURATION_MS = 500;

export type LandingSubmenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
};

function nearestSlot(focus: number): number {
  return Math.round(focus);
}

function slotForIndexNear(optionMod: number, near: number, n: number): number {
  const rounded = Math.round(near);
  let best = rounded;
  let bestDist = Infinity;
  for (let s = rounded - 48; s <= rounded + 48; s++) {
    const mod = ((s % n) + n) % n;
    if (mod !== optionMod) continue;
    const dist = Math.abs(s - near);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

type Phase = "idle" | "drag" | "coast" | "snap";

function lazySusanStyles(
  dist: number,
  n: number,
  radiusPx: number,
  zDepth: number,
  blurExtra: number
): {
  transform: string;
  opacity: number;
  outerFilter: string;
  zIndex: number;
} {
  const theta = dist * ((2 * Math.PI) / n);
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const x = sinT * radiusPx;
  const translateZ = (1 - Math.max(-0.35, cosT)) * zDepth;
  const rotateYDeg = (-theta * 180) / Math.PI * 0.82;

  const ad = Math.abs(dist);
  const scale = Math.max(0.66, 1 - Math.min(ad * 0.062, 0.34));
  let opacity = Math.max(0.2, 1 - Math.min(ad * 0.13, 0.58));

  const backFade =
    cosT < -0.12 ? Math.max(0.08, 0.35 + (0.65 * (1 + cosT)) / 0.88) : 1;
  opacity *= backFade;

  const blurPx = Math.min(2.4, ad * 0.32 + blurExtra * 0.55);
  const brightness = 1 - Math.min(ad * 0.065, 0.28);

  const outerFilter =
    ad < 0.52
      ? `brightness(${brightness})`
      : `blur(${blurPx}px) brightness(${brightness})`;

  const zIndex = Math.round(50 + cosT * 50);

  return {
    transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${translateZ}px) rotateY(${rotateYDeg}deg) scale(${scale})`,
    opacity,
    outerFilter,
    zIndex,
  };
}

type Props = {
  items: LandingSubmenuItem[];
  className?: string;
};

export default function LandingSubmenuReel({ items, className }: Props) {
  const n = items.length;
  const stripLen = n * 20;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const initialSlot = useMemo(() => {
    const base = Math.floor(stripLen / 2);
    return slotForIndexNear(0, base, n);
  }, [n, stripLen]);

  const focusRef = useRef(initialSlot);
  const velocityRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartFocusRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const lastMoveTRef = useRef(0);
  const pointerDownTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const idleRafRef = useRef<number | null>(null);
  const lastIdleTRef = useRef<number | null>(null);
  const forcedSnapTargetRef = useRef<number | null>(null);

  const [focus, setFocus] = useState(initialSlot);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stripBlurPx, setStripBlurPx] = useState(0);
  const [lockedIn, setLockedIn] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const radiusPx = Math.max(72, viewportWidth * 0.4);
  const zDepth = Math.max(24, viewportWidth * 0.12);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopIdleDrift = useCallback(() => {
    if (idleRafRef.current != null) {
      cancelAnimationFrame(idleRafRef.current);
      idleRafRef.current = null;
    }
    lastIdleTRef.current = null;
  }, []);

  const rebaseIfNeeded = useCallback(() => {
    let f = focusRef.current;
    const margin = n * 4;
    if (f < margin) {
      const add = n * 8;
      f += add;
      focusRef.current = f;
      setFocus(f);
    } else if (f > stripLen - margin) {
      const sub = n * 8;
      f -= sub;
      focusRef.current = f;
      setFocus(f);
    }
  }, [n, stripLen]);

  const physicsLoop = useCallback(() => {
    if (reducedMotion) {
      rafRef.current = null;
      return;
    }
    const H = DRAG_PX_PER_STEP;
    const dt = 1 / 60;
    let f = focusRef.current;
    let v = velocityRef.current;
    const ph = phaseRef.current;

    if (ph === "coast") {
      const friction = 0.97;
      const minV = 95;
      v *= Math.pow(friction, dt * 60);
      f += (v * dt) / H;
      if (Math.abs(v) < minV) {
        phaseRef.current = "snap";
        setPhase("snap");
        v = 0;
      }
    } else if (ph === "snap") {
      const targetSlot =
        forcedSnapTargetRef.current != null
          ? forcedSnapTargetRef.current
          : nearestSlot(f);
      const k = 58;
      const d = 9;
      const diff = targetSlot - f;
      const a = k * diff - d * v;
      v += a * dt;
      f += v * dt;
      if (Math.abs(targetSlot - f) < 0.012 && Math.abs(v) < 0.12) {
        f = targetSlot;
        v = 0;
        forcedSnapTargetRef.current = null;
        phaseRef.current = "idle";
        setPhase("idle");
        setLockedIn(true);
        setStripBlurPx(0);
        focusRef.current = f;
        setFocus(f);
        velocityRef.current = 0;
        rebaseIfNeeded();
        rafRef.current = null;
        return;
      }
    } else if (ph === "idle" || ph === "drag") {
      rafRef.current = null;
      return;
    }

    focusRef.current = f;
    velocityRef.current = v;
    setFocus(f);

    const blur = Math.min(2.8, Math.abs(v) / 920);
    setStripBlurPx(blur);

    if (ph === "coast" || ph === "snap") {
      setLockedIn(false);
    }

    rebaseIfNeeded();
    rafRef.current = requestAnimationFrame(physicsLoop);
  }, [reducedMotion, rebaseIfNeeded]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null || reducedMotion) return;
    rafRef.current = requestAnimationFrame(physicsLoop);
  }, [physicsLoop, reducedMotion]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  useEffect(() => {
    if (reducedMotion || n <= 1 || phase !== "idle" || !lockedIn) {
      stopIdleDrift();
      return;
    }

    const tick = (now: number) => {
      if (phaseRef.current !== "idle") {
        idleRafRef.current = null;
        return;
      }

      const last = lastIdleTRef.current ?? now;
      lastIdleTRef.current = now;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));

      let f = focusRef.current;
      f += IDLE_DRIFT_SLOTS_PER_SEC * dt;
      focusRef.current = f;
      setFocus(f);
      rebaseIfNeeded();

      idleRafRef.current = requestAnimationFrame(tick);
    };

    idleRafRef.current = requestAnimationFrame(tick);
    return () => stopIdleDrift();
  }, [phase, lockedIn, reducedMotion, n, rebaseIfNeeded, stopIdleDrift]);

  const activateCenter = useCallback(() => {
    const mod = ((Math.round(focusRef.current) % n) + n) % n;
    items[mod]?.onSelect();
  }, [items, n]);

  const onPointerDown = (e: React.PointerEvent) => {
    forcedSnapTargetRef.current = null;
    stopIdleDrift();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    stopLoop();
    phaseRef.current = "drag";
    setPhase("drag");
    setLockedIn(false);
    dragStartXRef.current = e.clientX;
    dragStartFocusRef.current = focusRef.current;
    lastMoveXRef.current = e.clientX;
    lastMoveTRef.current = performance.now();
    pointerDownTRef.current = lastMoveTRef.current;
    velocityRef.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "drag" || e.pointerId !== pointerIdRef.current)
      return;
    if (n <= 1) return;

    const dx = e.clientX - dragStartXRef.current;
    const next = dragStartFocusRef.current - dx / DRAG_PX_PER_STEP;
    focusRef.current = next;
    setFocus(next);

    const now = performance.now();
    const dt = Math.max(1, now - lastMoveTRef.current) / 1000;
    const vx = (e.clientX - lastMoveXRef.current) / dt;
    lastMoveXRef.current = e.clientX;
    lastMoveTRef.current = now;
    velocityRef.current = -vx;

    const blur = reducedMotion ? 0 : Math.min(1.6, Math.abs(vx) / 1400);
    setStripBlurPx(blur);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    if (phaseRef.current !== "drag") return;

    const totalDx = Math.abs(e.clientX - dragStartXRef.current);
    const now = performance.now();
    const duration = now - pointerDownTRef.current;
    const vel = Math.abs(velocityRef.current);

    const isClearTap =
      totalDx < TAP_MAX_TRAVEL_PX &&
      vel < TAP_MAX_VELOCITY &&
      duration < TAP_MAX_DURATION_MS;

    if (isClearTap) {
      const target = nearestSlot(focusRef.current);
      focusRef.current = target;
      setFocus(target);
      phaseRef.current = "idle";
      setPhase("idle");
      setLockedIn(true);
      setStripBlurPx(0);
      activateCenter();
      return;
    }

    if (n <= 1) {
      phaseRef.current = "idle";
      setPhase("idle");
      setLockedIn(true);
      setStripBlurPx(0);
      return;
    }

    if (reducedMotion) {
      const target = nearestSlot(focusRef.current);
      focusRef.current = target;
      setFocus(target);
      phaseRef.current = "idle";
      setPhase("idle");
      setLockedIn(true);
      setStripBlurPx(0);
      return;
    }

    stopIdleDrift();
    if (vel > 420) {
      phaseRef.current = "coast";
      setPhase("coast");
      startLoop();
    } else {
      phaseRef.current = "snap";
      setPhase("snap");
      velocityRef.current = 0;
      startLoop();
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const step = (delta: number) => {
      stopLoop();
      stopIdleDrift();
      const target = nearestSlot(Math.round(focusRef.current) + delta);
      if (reducedMotion || n <= 1) {
        focusRef.current = target;
        setFocus(target);
        setPhase("idle");
        setLockedIn(true);
        return;
      }
      forcedSnapTargetRef.current = target;
      velocityRef.current = delta * 1500;
      phaseRef.current = "coast";
      setPhase("coast");
      setLockedIn(false);
      startLoop();
    };

    if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
      ev.preventDefault();
      if (n > 1) step(-1);
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (n > 1) step(1);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      stopLoop();
      stopIdleDrift();
      const slot = slotForIndexNear(0, focusRef.current, n);
      if (reducedMotion) {
        focusRef.current = slot;
        setFocus(slot);
        phaseRef.current = "idle";
        setPhase("idle");
        setLockedIn(true);
        return;
      }
      forcedSnapTargetRef.current = slot;
      velocityRef.current = 0;
      phaseRef.current = "snap";
      setPhase("snap");
      setLockedIn(false);
      startLoop();
    } else if (ev.key === "End") {
      ev.preventDefault();
      stopLoop();
      stopIdleDrift();
      const slot = slotForIndexNear(n - 1, focusRef.current, n);
      if (reducedMotion) {
        focusRef.current = slot;
        setFocus(slot);
        phaseRef.current = "idle";
        setPhase("idle");
        setLockedIn(true);
        return;
      }
      forcedSnapTargetRef.current = slot;
      velocityRef.current = 0;
      phaseRef.current = "snap";
      setPhase("snap");
      setLockedIn(false);
      startLoop();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      activateCenter();
    }
  };

  const settled = lockedIn && phase === "idle";
  const animating = phase !== "idle" || !lockedIn;

  const activeMod = ((Math.round(focus) % n) + n) % n;
  const activeItem = items[activeMod];

  type VisibleRow =
    | { kind: "item"; i: number; dist: number; mod: number; cosT: number }
    | {
        kind: "dot";
        i: number;
        dist: number;
        cosT: number;
        segLo: number;
        segJ: number;
      };

  const visibleItems = useMemo(() => {
    const f = focus;
    const lo = Math.floor(f) - LAZY_SUSAN_WINDOW;
    const hi = Math.ceil(f) + LAZY_SUSAN_WINDOW;
    const rows: VisibleRow[] = [];

    for (let ii = lo; ii <= hi; ii++) {
      const dist = ii - f;
      const theta = dist * ((2 * Math.PI) / n);
      const cosT = Math.cos(theta);
      rows.push({
        kind: "item",
        i: ii,
        dist,
        mod: ((ii % n) + n) % n,
        cosT,
      });
    }
    const step = MIDDOTS_PER_GAP + 1;
    for (let ii = lo; ii < hi; ii++) {
      for (let j = 1; j <= MIDDOTS_PER_GAP; j++) {
        const pos = ii + j / step;
        const dist = pos - f;
        const theta = dist * ((2 * Math.PI) / n);
        const cosT = Math.cos(theta);
        rows.push({
          kind: "dot",
          i: pos,
          dist,
          cosT,
          segLo: ii,
          segJ: j,
        });
      }
    }
    rows.sort((a, b) => a.cosT - b.cosT);
    return rows;
  }, [focus, n]);

  if (n === 0) return null;

  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
      <div
        ref={viewportRef}
        role="listbox"
        tabIndex={0}
        aria-label="Quick navigation"
        aria-activedescendant={
          activeItem ? `landing-submenu-${activeItem.key}` : undefined
        }
        aria-multiselectable={false}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          /* overflow-visible: overflow-hidden clips 3D-transformed labels to nothing */
          "relative w-4/5 mx-auto overflow-visible rounded-lg outline-none select-none touch-none",
          /* 3× line box — same font/leading as labels (`lh` = used line-height) */
          "text-[0.65rem] leading-tight min-h-[3lh] h-[3lh] cursor-grab active:cursor-grabbing",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "bg-transparent [touch-action:none]"
        )}
        style={
          {
            perspective: "min(900px, 110vw)",
            perspectiveOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            touchAction: "none",
          } as React.CSSProperties
        }
      >
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          {visibleItems.map((row) => {
            if (row.kind === "dot") {
              const { dist, segLo, segJ } = row;
              const { transform, opacity, outerFilter, zIndex } =
                lazySusanStyles(dist, n, radiusPx, zDepth, stripBlurPx);
              return (
                <span
                  key={`dot-${segLo}-${segJ}`}
                  aria-hidden
                  className="absolute left-1/2 top-1/2 whitespace-nowrap font-display pointer-events-none leading-tight text-[0.65rem] tracking-widest text-muted-foreground"
                  style={{
                    transform,
                    opacity,
                    filter: outerFilter,
                    zIndex,
                    willChange: animating ? "transform, opacity, filter" : undefined,
                  }}
                >
                  ·
                </span>
              );
            }

            const { i, dist, mod } = row;
            const menuItem = items[mod];
            const { transform, opacity, outerFilter, zIndex } =
              lazySusanStyles(dist, n, radiusPx, zDepth, stripBlurPx);
            const isCenter = i === Math.round(focus);
            const glowT =
              Math.max(0, 1 - Math.abs(focus - i)) * (settled ? 1 : 0.58);
            const glow =
              glowT > 0.08
                ? `0 0 ${10 * glowT}px hsl(var(--primary) / 0.45), 0 0 ${22 * glowT}px hsl(var(--primary) / 0.22)`
                : undefined;

            return (
              <span
                key={`${menuItem.key}-${i}`}
                id={isCenter ? `landing-submenu-${menuItem.key}` : undefined}
                role="option"
                aria-selected={isCenter}
                aria-hidden={!isCenter}
                className={cn(
                  "absolute left-1/2 top-1/2 whitespace-nowrap font-display uppercase tracking-widest pointer-events-none leading-tight",
                  isCenter ? "text-foreground" : "text-muted-foreground"
                )}
                style={{
                  transform,
                  opacity,
                  filter: outerFilter,
                  zIndex,
                  willChange: animating ? "transform, opacity, filter" : undefined,
                }}
              >
                <span className="relative inline-block" style={{ textShadow: glow }}>
                  {menuItem.label}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
