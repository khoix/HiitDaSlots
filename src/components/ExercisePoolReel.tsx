import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExerciseSourceMode } from "../types";
import { playSound } from "@/audio/playSfx";
import { SOUNDS } from "@/audio/soundManifest";
import { SlotReelViewportChrome } from "@/components/SlotReelViewportChrome";

/** Row height (px); must match `--slot-reel-item-h` in `index.css`. */
export const EXERCISE_POOL_REEL_ROW_PX = 100;

export type ExercisePoolOption = {
  id: ExerciseSourceMode;
  label: string;
  description: string;
};

type SlotReelOption<T extends string = string> = {
  id: T;
  label: string;
  description: string;
};

type SlotReelProps<T extends string> = {
  value: T;
  onChange: (id: T) => void;
  options: SlotReelOption<T>[];
  availability: Record<T, boolean>;
  inactiveTitle?: (id: T) => string | undefined;
  /** Row height in px (default EXERCISE_POOL_REEL_ROW_PX). */
  itemHeightPx?: number;
  /** Viewport height in px (default 3 × row height). */
  viewportHeightPx?: number;
};

function nearestAvailableIndex<T extends string>(
  index: number,
  opts: SlotReelOption<T>[],
  availability: Record<T, boolean>
): number {
  const n = opts.length;
  const clamped = Math.max(0, Math.min(n - 1, index));
  if (availability[opts[clamped].id]) return clamped;
  for (let d = 1; d < n; d++) {
    const hi = clamped + d;
    if (hi < n && availability[opts[hi].id]) return hi;
    const lo = clamped - d;
    if (lo >= 0 && availability[opts[lo].id]) return lo;
  }
  return 0;
}

function firstAvailableIndex<T extends string>(
  opts: SlotReelOption<T>[],
  availability: Record<T, boolean>
): number {
  const i = opts.findIndex((o) => availability[o.id]);
  return i >= 0 ? i : 0;
}

function lastAvailableIndex<T extends string>(
  opts: SlotReelOption<T>[],
  availability: Record<T, boolean>
): number {
  for (let i = opts.length - 1; i >= 0; i--) {
    if (availability[opts[i].id]) return i;
  }
  return 0;
}

/** Nearest integer slot to `focus` whose option (i mod n) is available. */
function nearestAvailableSlot<T extends string>(
  focus: number,
  opts: SlotReelOption<T>[],
  availability: Record<T, boolean>
): number {
  const rounded = Math.round(focus);
  const n = opts.length;
  for (let d = 0; d < 120; d++) {
    const tries = d === 0 ? [rounded] : [rounded + d, rounded - d];
    for (const tryIdx of tries) {
      const mod = ((tryIdx % n) + n) % n;
      if (availability[opts[mod].id]) return tryIdx;
    }
  }
  return rounded;
}

function optionIndexForValue<T extends string>(
  id: T,
  opts: SlotReelOption<T>[]
): number {
  const i = opts.findIndex((o) => o.id === id);
  return i >= 0 ? i : 0;
}

/** Pick strip slot near `near` that shows `optionMod` and is available. */
function slotForValueNear<T extends string>(
  optionMod: number,
  near: number,
  opts: SlotReelOption<T>[],
  availability: Record<T, boolean>
): number {
  const n = opts.length;
  const rounded = Math.round(near);
  let best = rounded;
  let bestDist = Infinity;
  for (let s = rounded - 48; s <= rounded + 48; s++) {
    const mod = ((s % n) + n) % n;
    if (mod !== optionMod) continue;
    if (!availability[opts[mod].id]) continue;
    const dist = Math.abs(s - near);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  if (bestDist === Infinity) {
    for (let s = rounded - 48; s <= rounded + 48; s++) {
      const mod = ((s % n) + n) % n;
      if (mod !== optionMod) continue;
      const dist = Math.abs(s - near);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
  }
  return best;
}

type Phase = "idle" | "drag" | "coast" | "snap";

export function SlotReel<T extends string>({
  value,
  onChange,
  options,
  availability,
  inactiveTitle,
  itemHeightPx = EXERCISE_POOL_REEL_ROW_PX,
  viewportHeightPx = EXERCISE_POOL_REEL_ROW_PX * 3,
}: SlotReelProps<T>) {
  const n = options.length;
  const stripLen = n * 20;

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const initialSlot = useMemo(() => {
    const vi = optionIndexForValue(value, options);
    const base = Math.floor(stripLen / 2);
    const aligned = base - (base % n) + vi;
    return slotForValueNear(vi, aligned, options, availability);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount alignment only

  const focusRef = useRef(initialSlot);
  const velocityRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const pointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartFocusRef = useRef(0);
  const lastMoveYRef = useRef(0);
  const lastMoveTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const forcedSnapTargetRef = useRef<number | null>(null);

  const [focus, setFocus] = useState(initialSlot);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stripBlurPx, setStripBlurPx] = useState(0);
  const [lockedIn, setLockedIn] = useState(true);

  const viewportRef = useRef<HTMLDivElement>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const commitIfNeeded = useCallback(
    (slotIndex: number) => {
      const mod = ((Math.round(slotIndex) % n) + n) % n;
      const id = options[mod].id;
      if (!availability[id]) return;
      if (id !== valueRef.current) {
        valueRef.current = id;
        onChange(id);
        playSound(SOUNDS.uiSelect);
      }
    },
    [availability, n, onChange, options]
  );

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
    const H = itemHeightPx;
    const dt = 1 / 60;
    let f = focusRef.current;
    let v = velocityRef.current;
    const ph = phaseRef.current;

    if (ph === "coast") {
      const friction = reducedMotion ? 0.78 : 0.965;
      const minV = reducedMotion ? 800 : 95;
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
          : nearestAvailableSlot(f, options, availability);
      const k = reducedMotion ? 95 : 58;
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
        commitIfNeeded(f);
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

    const blur = reducedMotion
      ? 0
      : Math.min(2.8, Math.abs(v) / 920);
    setStripBlurPx(blur);

    if (ph === "coast" || ph === "snap") {
      setLockedIn(false);
    }

    rebaseIfNeeded();
    rafRef.current = requestAnimationFrame(physicsLoop);
  }, [
    availability,
    commitIfNeeded,
    itemHeightPx,
    options,
    reducedMotion,
    rebaseIfNeeded,
  ]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(physicsLoop);
  }, [physicsLoop]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  /** External value → spring reel to matching slot. */
  useEffect(() => {
    const vi = optionIndexForValue(value, options);
    const target = slotForValueNear(vi, focusRef.current, options, availability);
    if (Math.abs(target - focusRef.current) < 0.02) return;

    stopLoop(); /* only when reel must move to match controlled value */
    if (reducedMotion) {
      focusRef.current = target;
      setFocus(target);
      velocityRef.current = 0;
      phaseRef.current = "idle";
      setPhase("idle");
      setLockedIn(true);
      setStripBlurPx(0);
      return;
    }

    forcedSnapTargetRef.current = target;
    velocityRef.current = 0;
    phaseRef.current = "snap";
    setPhase("snap");
    setLockedIn(false);
    startLoop();
  }, [value, options, availability, reducedMotion, startLoop, stopLoop]);

  const onPointerDown = (e: React.PointerEvent) => {
    forcedSnapTargetRef.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    stopLoop();
    phaseRef.current = "drag";
    setPhase("drag");
    setLockedIn(false);
    dragStartYRef.current = e.clientY;
    dragStartFocusRef.current = focusRef.current;
    lastMoveYRef.current = e.clientY;
    lastMoveTRef.current = performance.now();
    velocityRef.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "drag" || e.pointerId !== pointerIdRef.current)
      return;
    const dy = e.clientY - dragStartYRef.current;
    const next = dragStartFocusRef.current - dy / itemHeightPx;
    focusRef.current = next;
    setFocus(next);

    const now = performance.now();
    const dt = Math.max(1, now - lastMoveTRef.current) / 1000;
    const vy = (e.clientY - lastMoveYRef.current) / dt;
    lastMoveYRef.current = e.clientY;
    lastMoveTRef.current = now;
    velocityRef.current = -vy;

    const blur = reducedMotion ? 0 : Math.min(1.6, Math.abs(vy) / 1400);
    setStripBlurPx(blur);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    if (phaseRef.current !== "drag") return;

    const totalDy = e.clientY - dragStartYRef.current;
    const elapsed = performance.now() - lastMoveTRef.current;
    const tap =
      Math.abs(totalDy) < 8 && elapsed < 280 && Math.abs(velocityRef.current) < 400;

    if (tap && !reducedMotion) {
      const rect = viewportRef.current?.getBoundingClientRect();
      const localY = rect ? e.clientY - rect.top : viewportHeightPx / 2;
      const sign = localY < viewportHeightPx / 2 ? 1 : -1;
      velocityRef.current = sign * (2200 + Math.random() * 900);
      phaseRef.current = "coast";
      setPhase("coast");
      startLoop();
      return;
    }

    if (reducedMotion) {
      const target = nearestAvailableSlot(focusRef.current, options, availability);
      focusRef.current = target;
      setFocus(target);
      phaseRef.current = "idle";
      setPhase("idle");
      setLockedIn(true);
      setStripBlurPx(0);
      commitIfNeeded(target);
      return;
    }

    if (Math.abs(velocityRef.current) > 420) {
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
      const target = nearestAvailableSlot(
        Math.round(focusRef.current) + delta,
        options,
        availability
      );
      if (reducedMotion) {
        focusRef.current = target;
        setFocus(target);
        setPhase("idle");
        setLockedIn(true);
        commitIfNeeded(target);
        return;
      }
      forcedSnapTargetRef.current = target;
      velocityRef.current = delta * 1500;
      phaseRef.current = "coast";
      setPhase("coast");
      setLockedIn(false);
      startLoop();
    };

    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      step(-1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      step(1);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      stopLoop();
      const slot = slotForValueNear(
        firstAvailableIndex(options, availability),
        focusRef.current,
        options,
        availability
      );
      if (reducedMotion) {
        focusRef.current = slot;
        setFocus(slot);
        phaseRef.current = "idle";
        setPhase("idle");
        setLockedIn(true);
        commitIfNeeded(slot);
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
      const slot = slotForValueNear(
        lastAvailableIndex(options, availability),
        focusRef.current,
        options,
        availability
      );
      if (reducedMotion) {
        focusRef.current = slot;
        setFocus(slot);
        phaseRef.current = "idle";
        setPhase("idle");
        setLockedIn(true);
        commitIfNeeded(slot);
        return;
      }
      forcedSnapTargetRef.current = slot;
      velocityRef.current = 0;
      phaseRef.current = "snap";
      setPhase("snap");
      setLockedIn(false);
      startLoop();
    }
  };

  const cycleRows = useMemo(
    () =>
      options.map((o) => ({
        label: o.label,
        sublabel: o.description,
      })),
    [options]
  );

  return (
    <SlotReelViewportChrome
      cabinetClassName="mx-auto w-full max-w-lg"
      itemHeightPx={itemHeightPx}
      viewportHeightPx={viewportHeightPx}
      focus={focus}
      stripBlurPx={stripBlurPx}
      stripLen={stripLen}
      cycleRows={cycleRows}
      centerLocked={lockedIn && phase === "idle"}
      windowGlowLocked={lockedIn && phase === "idle"}
      stripWillChangeAuto={phase === "idle" && lockedIn}
      viewportRef={viewportRef}
      viewportProps={{
        role: "listbox",
        tabIndex: 0,
        "aria-label": "Exercise pool",
        "aria-activedescendant": `exercise-pool-option-${value}`,
        onKeyDown,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        className:
          "cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      }}
      interactive={{
        value: String(value),
        getOptionId: (mod) => options[mod].id as string,
        availability: availability as Record<string, boolean>,
        inactiveTitle: inactiveTitle
          ? (id) => inactiveTitle(id as T)
          : undefined,
      }}
    />
  );
}

export default function ExercisePoolReel(props: {
  value: ExerciseSourceMode;
  onChange: (id: ExerciseSourceMode) => void;
  options: ExercisePoolOption[];
  availability: Record<ExerciseSourceMode, boolean>;
  inactiveTitle?: (id: ExerciseSourceMode) => string | undefined;
}) {
  return <SlotReel {...props} />;
}
