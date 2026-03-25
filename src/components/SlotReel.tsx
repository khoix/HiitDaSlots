import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkoutPlan } from "../types";
import { SOUNDS } from "@/audio/soundManifest";
import { playSound, startSlotsSpinLoop, stopSlotsSpinLoop } from "@/audio/playSfx";
import {
  SlotReelViewportChrome,
  type SlotReelStripRow,
} from "@/components/SlotReelViewportChrome";

interface Props {
  plan: WorkoutPlan;
  onComplete: () => void;
}

type ReelState = "spinning" | "settling" | "settled";

/** When each reel switches to settling (stagger). */
const STOP_DELAYS = [1300, 2350, 3400];

const REEL_SETTLE_ANIM_MS = 480;
const EXIT_TO_READY_MS = 720;
const STRIP_REPEAT = 20;
const SPIN_SPEED = 13;
const ITEM_H = 80;
const VIEWPORT_H = ITEM_H * 2;

const BASE_URL = import.meta.env.BASE_URL ?? "/";

function baseAssetUrl(relativePath: string): string {
  return `${BASE_URL.replace(/\/?$/, "/")}${relativePath}`;
}

function rebaseStripFocus(f: number, stripLen: number, n: number): number {
  const margin = n * 4;
  let x = f;
  if (x < margin) x += n * 8;
  else if (x > stripLen - margin) x -= n * 8;
  return x;
}

function jackpotTargetSlot(
  targetLabel: string,
  cycleLabels: string[],
  near: number
): number {
  const n = Math.max(cycleLabels.length, 1);
  const ti = cycleLabels.findIndex((l) => l === targetLabel);
  const tm = ti >= 0 ? ti : 0;
  const rounded = Math.round(near);
  let best = rounded;
  let bestDist = Infinity;
  for (let s = rounded - 80; s <= rounded + 80; s++) {
    const mod = ((s % n) + n) % n;
    if (mod !== tm) continue;
    const dist = Math.abs(s - near);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

export default function SlotReel({ plan, onComplete }: Props) {
  const exerciseNames = useMemo(
    () =>
      plan.circuits.flatMap((c) =>
        c.items
          .filter((i) => i.type === "exercise")
          .map(
            (i) =>
              (i as { exercise: { exercise: string } }).exercise.exercise
          )
      ),
    [plan]
  );

  const targets = useMemo(
    () => [
      exerciseNames[0] ?? "Exercise 1",
      exerciseNames[1] ?? "Exercise 2",
      exerciseNames.length === 2
        ? "LET'S GOOO!"
        : exerciseNames[2] ?? "Exercise 3",
    ],
    [exerciseNames]
  );

  const buildStrip = (reelIdx: number): string[] => {
    const out: string[] = [];
    const m = Math.max(exerciseNames.length, 1);
    for (let i = 0; i < 8; i++) {
      out.push(
        exerciseNames[(i * 2 + reelIdx * 3) % m] ?? `Exercise ${i + 1}`
      );
    }
    return out;
  };

  const cycles: SlotReelStripRow[][] = useMemo(
    () =>
      [0, 1, 2].map((reelIdx) => {
        if (reelIdx === 2 && exerciseNames.length === 2) {
          const a = exerciseNames[0] ?? "Exercise 1";
          const b = exerciseNames[1] ?? "Exercise 2";
          return [
            { label: a },
            { label: b },
            { label: a },
            { label: b },
            { label: "LET'S GOOO!" },
            { label: a },
            { label: b },
            { label: a },
          ];
        }
        return buildStrip(reelIdx).map((label) => ({ label }));
      }),
    [exerciseNames]
  );

  const n = Math.max(cycles[0]?.length ?? 8, 1);
  const stripLen = n * STRIP_REPEAT;

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const focusRef = useRef<[number, number, number]>([0, 0, 0]);
  const blurRef = useRef<[number, number, number]>([0, 0, 0]);
  const settleMetaRef = useRef<
    ({ start: number; from: number; target: number } | null)[]
  >([null, null, null]);
  const settleTargetsRef = useRef<[number, number, number]>([0, 0, 0]);
  const reelStatesRef = useRef<ReelState[]>([
    "spinning",
    "spinning",
    "spinning",
  ]);
  const prevRsRef = useRef<ReelState[] | null>(null);
  const nRef = useRef(n);
  const stripLenRef = useRef(stripLen);
  nRef.current = n;
  stripLenRef.current = stripLen;

  const [reelStates, setReelStates] = useState<ReelState[]>([
    "spinning",
    "spinning",
    "spinning",
  ]);
  const [jackpot, setJackpot] = useState(false);
  const [flashReel, setFlashReel] = useState<number | null>(null);
  const [exiting, setExiting] = useState(false);
  const [, setTick] = useState(0);

  useLayoutEffect(() => {
    const sl = stripLen;
    const nn = n;
    const base = Math.floor(sl / 2);
    focusRef.current = [0, 1, 2].map((reelIdx) => {
      return base - (base % nn) + ((reelIdx * 3) % nn);
    }) as [number, number, number];
  }, [stripLen, n, exerciseNames]);

  reelStatesRef.current = reelStates;

  useEffect(() => {
    if (prevRsRef.current === null) {
      prevRsRef.current = [...reelStates];
      return;
    }
    let needRepaint = false;
    for (let i = 0; i < 3; i++) {
      const s = reelStates[i];
      const prev = prevRsRef.current[i];
      if (s === "settling" && prev !== "settling") {
        needRepaint = true;
        const labels = cycles[i].map((r) => r.label);
        const target = jackpotTargetSlot(
          targets[i],
          labels,
          focusRef.current[i]
        );
        settleTargetsRef.current[i] = target;
        if (reduceMotion) {
          focusRef.current[i] = target;
          settleMetaRef.current[i] = null;
        } else {
          settleMetaRef.current[i] = {
            start: performance.now(),
            from: focusRef.current[i],
            target,
          };
        }
      }
      if (s === "settled" && prev !== "settled") {
        needRepaint = true;
        settleMetaRef.current[i] = null;
        focusRef.current[i] = settleTargetsRef.current[i];
      }
    }
    prevRsRef.current = [...reelStates];
    if (needRepaint) setTick((t) => t + 1);
  }, [reelStates, cycles, targets, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    let last = performance.now();
    let cancelled = false;

    const loop = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.066, (now - last) / 1000);
      last = now;
      const rs = reelStatesRef.current;
      const nn = nRef.current;
      const sl = stripLenRef.current;
      let paint = false;
      for (let i = 0; i < 3; i++) {
        if (rs[i] === "spinning") {
          paint = true;
          focusRef.current[i] = rebaseStripFocus(
            focusRef.current[i] + SPIN_SPEED * dt,
            sl,
            nn
          );
          blurRef.current[i] = 2.2;
        } else if (rs[i] === "settling") {
          paint = true;
          const m = settleMetaRef.current[i];
          if (m) {
            const elapsed = now - m.start;
            const t = Math.min(1, elapsed / REEL_SETTLE_ANIM_MS);
            const eased = 1 - (1 - t) ** 3;
            focusRef.current[i] = m.from + (m.target - m.from) * eased;
            blurRef.current[i] = 2.4 * (1 - t);
          }
        } else {
          blurRef.current[i] = 0;
          focusRef.current[i] = settleTargetsRef.current[i];
        }
      }
      if (paint) setTick((x) => x + 1);
      if (rs.some((s) => s === "spinning" || s === "settling")) {
        raf = requestAnimationFrame(loop);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (jackpot) {
      stopSlotsSpinLoop();
      return;
    }
    void startSlotsSpinLoop(SOUNDS.slotsSpinLoop);
    return () => stopSlotsSpinLoop();
  }, [jackpot]);

  useEffect(() => {
    if (!jackpot) return;
    playSound(SOUNDS.slotsJackpot);
  }, [jackpot]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reduceMotionLocal = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    STOP_DELAYS.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          setReelStates((s) => {
            const next = [...s];
            next[i] = "settling";
            return next;
          });
        }, delay)
      );

      timers.push(
        setTimeout(() => {
          setReelStates((s) => {
            const next = [...s];
            next[i] = "settled";
            return next;
          });
          setFlashReel(i);
          playSound(SOUNDS.slotsReelStop);
          setTimeout(() => setFlashReel(null), 350);
        }, delay + REEL_SETTLE_ANIM_MS)
      );
    });

    const lastStop = STOP_DELAYS[2] + REEL_SETTLE_ANIM_MS;
    timers.push(setTimeout(() => setJackpot(true), lastStop + 80));
    timers.push(
      setTimeout(() => {
        if (reduceMotionLocal) {
          onComplete();
          return;
        }
        setExiting(true);
        timers.push(setTimeout(() => onComplete(), EXIT_TO_READY_MS));
      }, lastStop + 900 + 2000)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const f = focusRef.current;
  const b = blurRef.current;

  return (
    <div
      className={`slot-reel-stage flex flex-1 flex-col items-center justify-center p-4 relative isolate overflow-hidden min-h-0${
        exiting ? " slot-reel-exit-active" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${baseAssetUrl("images/arcade-bg.png")}")`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            opacity: 0.22,
          }}
        />
      </div>

      {exiting && (
        <div
          className="slot-payout-burst pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-secondary/8 blur-[100px]" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[60px] transition-all duration-700"
          style={{
            background: jackpot
              ? "radial-gradient(circle, hsl(var(--secondary)/0.4), transparent 70%)"
              : "radial-gradient(circle, hsl(var(--primary)/0.12), transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-20 mb-8 sm:mb-12 text-center">
        <h2
          className="font-display uppercase tracking-widest transition-all duration-400"
          style={{
            fontSize: "clamp(1.6rem, 7vw, 3.5rem)",
            color: jackpot ? "hsl(var(--secondary))" : "hsl(var(--primary))",
            textShadow: jackpot
              ? "0 0 10px hsl(var(--secondary)/0.8), 0 0 30px hsl(var(--secondary)/0.5)"
              : "0 0 8px hsl(var(--primary)/0.6), 0 0 20px hsl(var(--primary)/0.3)",
            transform: jackpot ? "scale(1.06)" : "scale(1)",
          }}
        >
          {jackpot ? (
            <span className="inline-flex items-center gap-2 sm:gap-3">
              <img
                src={baseAssetUrl("images/hds.png")}
                alt=""
                aria-hidden="true"
                className="h-[1.875em] sm:h-[1.25em] w-auto object-contain"
              />
              <span>JACKPOT!</span>
            </span>
          ) : (
            "ROLLING…"
          )}
        </h2>
        {!jackpot && (
          <div className="mt-2 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    reelStates[i] === "settled"
                      ? "hsl(var(--accent))"
                      : reelStates[i] === "settling"
                        ? "hsl(var(--secondary))"
                        : "hsl(var(--border))",
                  boxShadow:
                    reelStates[i] === "settled"
                      ? "0 0 6px hsl(var(--accent))"
                      : "none",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="relative z-20 rounded-2xl p-4 sm:p-6 border-2"
        style={{
          background: "rgba(0,0,0,0.7)",
          borderColor: jackpot
            ? "hsl(var(--secondary))"
            : "hsl(var(--secondary)/0.5)",
          boxShadow: jackpot
            ? "0 0 60px hsl(var(--secondary)/0.5), inset 0 0 30px rgba(0,0,0,0.8)"
            : "0 0 30px hsl(var(--secondary)/0.2), inset 0 0 30px rgba(0,0,0,0.8)",
          transition: "all 0.4s ease",
        }}
      >
        <div className="slot-scanlines pointer-events-none absolute inset-0 rounded-2xl overflow-hidden" />

        <div className="flex gap-3 sm:gap-5 justify-center items-stretch relative z-10">
          {[0, 1, 2].map((reelIdx) => {
            const state = reelStates[reelIdx];
            return (
              <div
                key={reelIdx}
                className="flex flex-col items-center gap-3 shrink-0"
              >
                <SlotReelViewportChrome
                  compactRows
                  showScanlines={false}
                  viewportClassName="jackpot-reel-viewport"
                  width="clamp(88px, 20vw, 148px)"
                  itemHeightPx={ITEM_H}
                  viewportHeightPx={VIEWPORT_H}
                  focus={f[reelIdx]}
                  stripBlurPx={b[reelIdx]}
                  stripLen={stripLen}
                  cycleRows={cycles[reelIdx]}
                  centerLocked={state === "settled"}
                  windowGlowLocked={state === "settled"}
                  centerFlash={flashReel === reelIdx}
                  stripWillChangeAuto={state === "settled"}
                  perspectivePx={720}
                  cabinetClassName="w-full"
                />

                <div
                  className="w-2 h-2 rounded-full transition-all duration-400"
                  style={{
                    background:
                      state === "settled"
                        ? "hsl(var(--accent))"
                        : state === "settling"
                          ? "hsl(var(--secondary))"
                          : "hsl(var(--border))",
                    boxShadow:
                      state === "settled"
                        ? "0 0 8px hsl(var(--accent))"
                        : state === "settling"
                          ? "0 0 6px hsl(var(--secondary))"
                          : "none",
                  }}
                />
              </div>
            );
          })}
        </div>

        <p
          className="mt-5 text-center font-display uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: "0.65rem" }}
        >
          {plan.circuits.length} Circuits · {exerciseNames.length} Exercises
        </p>
      </div>
    </div>
  );
}
