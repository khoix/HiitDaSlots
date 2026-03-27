import React, { useCallback, useRef, useState } from "react";
import { Repeat } from "lucide-react";
import { cn } from "../lib/utils";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";
import { clampLoopCount } from "../utils/workoutGenerator";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const ITEM_H = 30;
const DRAG_PX = 10;
const LONG_PRESS_MS = 480;
const TAP_MAX_MS = 420;

export interface CircuitLoopMultiplierProps {
  value: number;
  onChange: (n: number) => void;
  /** e.g. "Circuit 2" for aria-label */
  circuitLabel: string;
  className?: string;
}

function snapOffsetToValue(offsetPx: number): number {
  const idx = Math.round(-offsetPx / ITEM_H);
  const clamped = Math.max(0, Math.min(VALUES.length - 1, idx));
  return VALUES[clamped];
}

function offsetForValue(val: number): number {
  const n = clampLoopCount(val);
  return -(n - 1) * ITEM_H;
}

function clampOffset(offsetPx: number): number {
  const minO = -(VALUES.length - 1) * ITEM_H;
  const maxO = 0;
  return Math.min(maxO, Math.max(minO, offsetPx));
}

export default function CircuitLoopMultiplier({
  value,
  onChange,
  circuitLabel,
  className,
}: CircuitLoopMultiplierProps) {
  const v = clampLoopCount(value);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubOffset, setScrubOffset] = useState(() => offsetForValue(v));

  const downAtYRef = useRef(0);
  const downTimeRef = useRef(0);
  const lastClientYRef = useRef(0);
  const scrubStartYRef = useRef(0);
  const scrubBaseOffsetRef = useRef(0);
  const inScrubRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string>("");

  const clearLongPress = () => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const enterScrub = useCallback(
    (clientY: number) => {
      clearLongPress();
      inScrubRef.current = true;
      scrubStartYRef.current = clientY;
      scrubBaseOffsetRef.current = offsetForValue(v);
      const o = clampOffset(scrubBaseOffsetRef.current);
      setScrubOffset(o);
      setScrubbing(true);
      playSound(SOUNDS.uiSelect);
    },
    [v]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerTypeRef.current = e.pointerType;
    pointerIdRef.current = e.pointerId;
    downAtYRef.current = e.clientY;
    lastClientYRef.current = e.clientY;
    downTimeRef.current = performance.now();
    inScrubRef.current = false;
    setScrubbing(false);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const isTouch = e.pointerType === "touch";
    if (isTouch) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (!inScrubRef.current) {
          enterScrub(lastClientYRef.current);
        }
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    lastClientYRef.current = e.clientY;

    if (!inScrubRef.current) {
      const dy = e.clientY - downAtYRef.current;
      if (Math.abs(dy) > DRAG_PX) {
        if (pointerTypeRef.current === "touch") clearLongPress();
        enterScrub(e.clientY);
      }
      return;
    }

    const raw =
      scrubBaseOffsetRef.current + (e.clientY - scrubStartYRef.current);
    setScrubOffset(clampOffset(raw));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    clearLongPress();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (inScrubRef.current) {
      const raw =
        scrubBaseOffsetRef.current + (e.clientY - scrubStartYRef.current);
      const next = snapOffsetToValue(clampOffset(raw));
      inScrubRef.current = false;
      setScrubbing(false);
      if (next !== v) {
        onChange(next);
        playSound(SOUNDS.uiConfirm);
      }
      return;
    }

    const dist = Math.abs(e.clientY - downAtYRef.current);
    const dt = performance.now() - downTimeRef.current;
    if (dist <= DRAG_PX && dt < TAP_MAX_MS) {
      const next = v >= 9 ? 1 : v + 1;
      onChange(next);
      playSound(SOUNDS.uiSelect);
    }
  };

  const onPointerCancel = () => {
    pointerIdRef.current = null;
    clearLongPress();
    inScrubRef.current = false;
    setScrubbing(false);
  };

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md border border-accent/35 bg-accent/8 px-1.5 py-0.5",
          "font-mono text-[0.65rem] leading-none text-accent/90 tabular-nums",
          "touch-manipulation select-none",
          scrubbing && "ring-1 ring-primary/50 border-primary/40"
        )}
        style={{ touchAction: "none" }}
        aria-label={`${circuitLabel} loops, ${v} times`}
        aria-valuenow={v}
        aria-valuemin={1}
        aria-valuemax={9}
        role="spinbutton"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <Repeat size={11} className="opacity-70" aria-hidden />
        <span>×{v}</span>
      </button>

      {scrubbing ? (
        <div
          className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 overflow-hidden rounded-md border border-border bg-background shadow-lg"
          style={{ height: ITEM_H, width: 44 }}
          aria-hidden
        >
          <div
            className="flex flex-col transition-none"
            style={{
              transform: `translateY(${ITEM_H / 2 + scrubOffset}px)`,
              marginTop: -ITEM_H / 2,
            }}
          >
            {VALUES.map((n) => (
              <div
                key={n}
                className="flex items-center justify-center font-mono text-sm tabular-nums text-foreground"
                style={{ height: ITEM_H, minHeight: ITEM_H }}
              >
                ×{n}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
