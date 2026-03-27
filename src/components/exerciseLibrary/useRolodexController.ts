import { useCallback, useEffect, useRef, useState } from "react";
import {
  STEP_PX,
  floatIndexFromOffset,
  snapOffset,
  wrapIndexLooped,
  wrapOffsetPx,
} from "./rolodexLayout";

const FRICTION = 0.92;
const WHEEL_SCALE = 0.55;
const WHEEL_VEL_SCALE = 0.06;
const SNAP_VEL = 0.65;
const SPRING_K = 0.14;
const SPRING_DAMP = 0.82;
const EPS = 0.35;

/** Move along the scrub axis must dominate before we steal the gesture from dnd-kit / clicks. */
const CARD_SCRUB_AXIS_PX = 10;
const CARD_SCRUB_DOMINANCE = 1.18;
/** If pointer moves this far without committing to vertical scrub, release for drag/click. */
const CARD_GESTURE_DEADZONE = 9;

export interface UseRolodexControllerOptions {
  count: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Map pointer/wheel along X so the wheel can be shown rotated −90° on small screens. */
  horizontalScrub?: boolean;
  /** Temporarily disables wheel/pointer input while external drag is active. */
  inputLocked?: boolean;
}

export interface UseRolodexControllerResult {
  offsetPx: number;
  focusFloat: number;
  focusIndex: number;
  isDragging: boolean;
  isSettling: boolean;
  jumpToIndex: (index: number) => void;
  /** For rail: letter → first row index */
  setJumpTarget: (index: number) => void;
  /** Nudge scroll offset (px), e.g. mobile alphabet rail touchpad. Same physics as wheel. */
  applyOffsetDelta: (deltaPx: number) => void;
}

export function useRolodexController({
  count,
  viewportRef,
  horizontalScrub = false,
  inputLocked = false,
}: UseRolodexControllerOptions): UseRolodexControllerResult {
  const [offsetPx, setOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerStartYRef = useRef(0);
  const pointerStartXRef = useRef(0);
  const pointerStartOffsetRef = useRef(0);
  const lastMoveYRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const lastMoveTRef = useRef(0);
  const pointerVelRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const springTargetRef = useRef<number | null>(null);
  const springVelRef = useRef(0);

  offsetRef.current = offsetPx;

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const focusFloat = floatIndexFromOffset(offsetPx, count);
  const focusIndex = wrapIndexLooped(Math.round(offsetPx / STEP_PX), count);

  const tick = useCallback(() => {
    const n = count;
    if (n <= 0) {
      rafRef.current = null;
      setIsSettling(false);
      return;
    }

    let o = offsetRef.current;
    let v = velocityRef.current;
    const springTarget = springTargetRef.current;

    if (springTarget != null) {
      const f = springTarget - o;
      v = v * SPRING_DAMP + f * SPRING_K;
      o += v;
      if (Math.abs(f) < EPS && Math.abs(v) < EPS) {
        o = springTarget;
        v = 0;
        springTargetRef.current = null;
        springVelRef.current = 0;
        offsetRef.current = o;
        velocityRef.current = 0;
        setOffsetPx(o);
        rafRef.current = null;
        setIsSettling(false);
        return;
      }
      offsetRef.current = o;
      velocityRef.current = v;
      setOffsetPx(o);
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (draggingRef.current) {
      rafRef.current = null;
      setIsSettling(false);
      return;
    }

    v *= FRICTION;
    o += v;
    o = wrapOffsetPx(o, n);

    if (Math.abs(v) < SNAP_VEL) {
      v = 0;
      const snapped = snapOffset(o, n);
      if (Math.abs(snapped - o) > 0.5) {
        springTargetRef.current = snapped;
        springVelRef.current = v;
        rafRef.current = requestAnimationFrame(tick);
        setIsSettling(true);
        return;
      }
      o = snapped;
    }

    offsetRef.current = o;
    velocityRef.current = v;
    setOffsetPx(o);

    if (Math.abs(v) > 0.02 || springTargetRef.current != null) {
      rafRef.current = requestAnimationFrame(tick);
      setIsSettling(Math.abs(v) > 0.02);
    } else {
      rafRef.current = null;
      setIsSettling(false);
    }
  }, [count]);

  const ensureRaf = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const jumpToIndex = useCallback(
    (index: number) => {
      if (count <= 0) return;
      const i = wrapIndexLooped(index, count);
      const target = i * STEP_PX;
      springTargetRef.current = target;
      velocityRef.current = 0;
      springVelRef.current = 0;
      setIsSettling(true);
      ensureRaf();
    },
    [count, ensureRaf]
  );

  const setJumpTarget = jumpToIndex;

  const applyOffsetDelta = useCallback(
    (deltaPx: number) => {
      if (count <= 0) return;
      springTargetRef.current = null;
      velocityRef.current += deltaPx * WHEEL_VEL_SCALE;
      const next = wrapOffsetPx(
        offsetRef.current + deltaPx * WHEEL_SCALE,
        count
      );
      offsetRef.current = next;
      setOffsetPx(next);
      setIsSettling(true);
      ensureRaf();
    },
    [count, ensureRaf]
  );

  useEffect(() => {
    setOffsetPx((o) => wrapOffsetPx(o, count));
  }, [count]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (inputLocked) return;

    const onWheel = (e: WheelEvent) => {
      if (count <= 0) return;
      e.preventDefault();
      springTargetRef.current = null;
      const delta = horizontalScrub
        ? Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY
        : e.deltaY;
      // On mobile the wheel is visually rotated; flip the sign so "right" and "left"
      // feel consistent with the rotated UI.
      const effectiveDelta = horizontalScrub ? -delta : delta;
      velocityRef.current += effectiveDelta * WHEEL_VEL_SCALE;
      const next = wrapOffsetPx(
        offsetRef.current + effectiveDelta * WHEEL_SCALE,
        count
      );
      offsetRef.current = next;
      setOffsetPx(next);
      setIsSettling(true);
      ensureRaf();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [count, ensureRaf, horizontalScrub, inputLocked, viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (inputLocked) return;

    type Pending = { pointerId: number; x0: number; y0: number };
    let pending: Pending | null = null;

    const startScrub = (e: PointerEvent) => {
      springTargetRef.current = null;
      draggingRef.current = true;
      setIsDragging(true);
      pointerStartYRef.current = e.clientY;
      pointerStartXRef.current = e.clientX;
      pointerStartOffsetRef.current = offsetRef.current;
      lastMoveYRef.current = e.clientY;
      lastMoveXRef.current = e.clientX;
      lastMoveTRef.current = performance.now();
      pointerVelRef.current = 0;
      velocityRef.current = 0;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-rail-letter]")) return;
      if (target.closest("[data-rail-touchpad]")) return;
      if (target.closest("button, a, [data-no-rolodex-interactive]")) return;
      if (target.closest("[data-no-rolodex-scrub]")) return;

      const card = target.closest("[data-rolodex-card]");
      if (card) {
        pending = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY };
        return;
      }

      // Rotated mobile wheel: empty viewport — wait for axis so vertical pan can scroll the page.
      if (horizontalScrub) {
        pending = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY };
        return;
      }

      startScrub(e);
    };

    const onPointerMoveCapture = (e: PointerEvent) => {
      if (!pending || e.pointerId !== pending.pointerId) return;
      if (draggingRef.current) return;

      const dx = e.clientX - pending.x0;
      const dy = e.clientY - pending.y0;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (horizontalScrub) {
        if (ady > CARD_SCRUB_AXIS_PX && ady > adx * CARD_SCRUB_DOMINANCE) {
          pending = null;
          return;
        }
      }

      const axisOk = horizontalScrub
        ? adx > CARD_SCRUB_AXIS_PX && adx > ady * CARD_SCRUB_DOMINANCE
        : ady > CARD_SCRUB_AXIS_PX && ady > adx * CARD_SCRUB_DOMINANCE;
      if (axisOk) {
        pending = null;
        startScrub(e);
        return;
      }

      if (adx > CARD_GESTURE_DEADZONE || ady > CARD_GESTURE_DEADZONE) {
        pending = null;
      }
    };

    const clearPendingOnUp = (e: PointerEvent) => {
      if (pending && e.pointerId === pending.pointerId) pending = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const t = performance.now();
      const dt = Math.max(1, t - lastMoveTRef.current);
      if (horizontalScrub) {
        const vx = (e.clientX - lastMoveXRef.current) / dt;
        lastMoveXRef.current = e.clientX;
        lastMoveTRef.current = t;
        pointerVelRef.current = -vx * 22;

        const dx = e.clientX - pointerStartXRef.current;
        const next = wrapOffsetPx(pointerStartOffsetRef.current - dx, count);
        offsetRef.current = next;
        setOffsetPx(next);
      } else {
        const vy = (e.clientY - lastMoveYRef.current) / dt;
        lastMoveYRef.current = e.clientY;
        lastMoveTRef.current = t;
        pointerVelRef.current = -vy * 22;

        const dy = e.clientY - pointerStartYRef.current;
        const next = wrapOffsetPx(pointerStartOffsetRef.current - dy, count);
        offsetRef.current = next;
        setOffsetPx(next);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      clearPendingOnUp(e);
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      velocityRef.current = Math.max(
        -56,
        Math.min(56, pointerVelRef.current)
      );
      setIsSettling(true);
      ensureRaf();
    };

    el.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("pointermove", onPointerMoveCapture, true);
    window.addEventListener("pointerup", clearPendingOnUp, true);
    window.addEventListener("pointercancel", clearPendingOnUp, true);

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("pointermove", onPointerMoveCapture, true);
      window.removeEventListener("pointerup", clearPendingOnUp, true);
      window.removeEventListener("pointercancel", clearPendingOnUp, true);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [count, ensureRaf, horizontalScrub, inputLocked, viewportRef]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  return {
    offsetPx,
    focusFloat,
    focusIndex,
    isDragging,
    isSettling,
    jumpToIndex,
    setJumpTarget,
    applyOffsetDelta,
  };
}
