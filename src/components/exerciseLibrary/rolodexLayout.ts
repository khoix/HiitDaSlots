/** Pixels of virtual scroll per catalog index (tune feel of scrub). */
export const STEP_PX = 52;

/** Collapsed card height on the wheel (px), before scale. */
export const STRIP_HEIGHT = 34;

/** Expanded focused card target min height (px). */
export const EXPANDED_MIN = 84;

/** Radians of arc per catalog index (smaller = tighter wheel along the rim). */
export const FERRIS_ANGLE_PER_INDEX = 0.1;

/** Depth along −Z: `translateZPx = -RIM_DEPTH_RZ_PX * (1 - cos(theta))` on the vertical rim. */
export const RIM_DEPTH_RZ_PX = 56;

/** Near-focus band in **index units** (fractional), converted to radians via `FERRIS_ANGLE_PER_INDEX`. */
const NEAR_FOCUS_INDEX = 0.55;

/** Max |θ| from focus for index window: front hemisphere (π/2) + small margin. */
export const FERRIS_MAX_VISIBLE_RAD = Math.PI / 2 + 0.4;

/** Max cards rendered above/below fractional focus (fallback lower bound). */
export const MARGIN_INDICES = 14;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function catalogLetter(exerciseName: string): "hash" | string {
  const trimmed = exerciseName.trim();
  if (!trimmed) return "hash";
  const ch = trimmed[0];
  if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  return "hash";
}

/** First row index per letter (hash + A–Z). */
export function buildLetterStartMap(
  rows: { exercise: { exercise: string } }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const L = catalogLetter(rows[i].exercise.exercise);
    if (!map.has(L)) map.set(L, i);
  }
  return map;
}

/** Rail order: # then A–Z. */
export function railLetters(): ("hash" | string)[] {
  return ["hash", ...LETTERS];
}

export function railLabel(letter: string): string {
  return letter === "hash" ? "#" : letter;
}

export function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(i)));
}

/** Offset in [0, count·STEP) — catalog loops. */
export function wrapOffsetPx(o: number, count: number): number {
  if (count <= 0) return 0;
  const span = count * STEP_PX;
  let x = o % span;
  if (x < 0) x += span;
  return x;
}

/** Integer index in [0, count). */
export function wrapIndexLooped(k: number, count: number): number {
  if (count <= 0) return 0;
  const kk = Math.round(k);
  let x = kk % count;
  if (x < 0) x += count;
  return x;
}

/** Fractional focus in [0, count). */
export function floatIndexFromOffset(offsetPx: number, count: number): number {
  if (count <= 0) return 0;
  return wrapOffsetPx(offsetPx, count) / STEP_PX;
}

export function snapOffset(offsetPx: number, count: number): number {
  if (count <= 0) return 0;
  const o = wrapOffsetPx(offsetPx, count);
  const idx = wrapIndexLooped(Math.round(o / STEP_PX), count);
  return idx * STEP_PX;
}

/** Shortest signed distance from float focus to integer index on a circle. */
export function shortestCircularDelta(
  index: number,
  focusFloat: number,
  count: number
): number {
  if (count <= 0) return index - focusFloat;
  let d = index - focusFloat;
  d -= Math.round(d / count) * count;
  return d;
}

export function circularAbsDist(
  index: number,
  focusFloat: number,
  count: number
): number {
  return Math.abs(shortestCircularDelta(index, focusFloat, count));
}

/** Layout for one card on the ferris wheel (midway “front” — vertical column + depth). */
export interface LayerLayout {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  scale: number;
  /** Perspective push (lazy susan: front cos→1 stays at 0). */
  translateZPx: number;
  /** Subtle pitch (depth on the rim). */
  rotateXDeg: number;
  /** Slight yaw so side cars don’t read perfectly flat. */
  rotateYDeg: number;
  zIndex: number;
  opacity: number;
  isExpanded: boolean;
  /** cos θ ≥ 0 — front closed hemisphere; cos θ < 0 (back) is not rendered. */
  isFrontHalf: boolean;
}

export interface LayoutLayerOptions {
  /** When false, every row is a strip on the wheel. When true, front card can expand. */
  revealExpandedCard?: boolean;
  /** Expand this index in place (no wheel snap); mutually exclusive with midway detail in the parent. */
  poppedOutIndex?: number | null;
  /** Multiplier for vertical rim radius `ry` (e.g. 2 on mobile for a larger arc). Default 1. */
  rimRadiusScale?: number;
  /** Multiplier for expanded / pop-out card height (e.g. 2 on mobile). Default 1. */
  expandedHeightScale?: number;
}

/**
 * Midway “front” ferris: **y = sin θ** → focus at vertical center. **Fixed width/height**; size
 * comes from **transform scale** only so the stack doesn’t form a diamond from varying box widths.
 * **Front half only** (cos θ > 0): back hemisphere not rendered.
 */
export function layoutLayer(
  index: number,
  focusFloat: number,
  viewportWidth: number,
  viewportHeight: number,
  count: number,
  opts?: LayoutLayerOptions
): LayerLayout {
  if (count <= 0 || viewportHeight < 8) {
    return {
      centerX: viewportWidth / 2,
      centerY: viewportHeight / 2,
      width: Math.max(120, viewportWidth - 24),
      height: STRIP_HEIGHT,
      scale: 1,
      translateZPx: 0,
      rotateXDeg: 0,
      rotateYDeg: 0,
      zIndex: 0,
      opacity: 0,
      isExpanded: false,
      isFrontHalf: false,
    };
  }

  const w = viewportWidth;
  const h = viewportHeight;
  const padY = 12;
  const cx = w * 0.5;
  const cy = h * 0.5;
  /** Vertical radius — hub at center, rim reaches top/bottom padding. */
  const ryBase = Math.max(72, h * 0.5 - padY);
  const ry = ryBase * (opts?.rimRadiusScale ?? 1);

  const delta = shortestCircularDelta(index, focusFloat, count);
  const theta = delta * FERRIS_ANGLE_PER_INDEX;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const baseCardW = Math.min(w - 20, 360);

  /** Back hemisphere only (cos θ < 0). cos θ = 0 keeps rim endpoints at top/bottom of the arc. */
  if (cosT < 0) {
    return {
      centerX: cx,
      centerY: cy,
      width: baseCardW,
      height: STRIP_HEIGHT,
      scale: 0,
      translateZPx: 0,
      rotateXDeg: 0,
      rotateYDeg: 0,
      zIndex: 0,
      opacity: 0,
      isExpanded: false,
      isFrontHalf: false,
    };
  }

  /** Single column — width/height stay fixed; only `scale` shrinks ends (avoids diamond silhouette). */
  const x = cx;
  const y = cy + ry * sinT;

  // One rim angle `theta` drives Y (via sin), depth (via 1−cos), tilt, scale, and opacity — vertical circle / cylinder.
  const translateZPx = -RIM_DEPTH_RZ_PX * (1 - cosT);
  const rotateXDeg = Math.max(
    -52,
    Math.min(52, (-theta * 180) / Math.PI)
  );
  const scale = Math.max(0.82, 1 - 0.18 * (1 - cosT));
  const opacity = Math.max(0.28, 1 - 0.72 * (1 - cosT));

  const rotateYDeg = 0;

  const absTheta = Math.abs(theta);
  const thetaNearFocus = NEAR_FOCUS_INDEX * FERRIS_ANGLE_PER_INDEX;

  const width = baseCardW;
  const heightStrip = STRIP_HEIGHT;

  const zIndex = 40 + Math.round(50 + cosT * 50);

  const absD = circularAbsDist(index, focusFloat, count);
  const wheelExpanded =
    opts?.revealExpandedCard === true && absTheta < thetaNearFocus;
  const isPopout = opts?.poppedOutIndex === index;

  if (wheelExpanded || isPopout) {
    const t = isPopout ? 0 : Math.min(1, absTheta / thetaNearFocus);
    const hScale = opts?.expandedHeightScale ?? 1;
    const expandedH =
      (EXPANDED_MIN +
        Math.max(0, h - EXPANDED_MIN - 32) * 0.2 * (1 - t) +
        (STRIP_HEIGHT - EXPANDED_MIN) * t) *
      hScale;
    const height = Math.max(STRIP_HEIGHT * hScale, expandedH);
    const scaleExpanded = isPopout ? scale * 1.06 : scale * (1 - t * 0.04);
    // Expansion brings the card forward (closer to the camera) while keeping
    // the new base lazy-susan distance curve intact.
    const zFrontBoost = isPopout ? 44 : 30;
    return {
      centerX: x,
      centerY: y,
      width,
      height,
      scale: scaleExpanded,
      // Keep rotateX/rotateY derived from the lazy-susan curve; only translateZ/scale
      // get a small “front boost” for the expanded card.
      translateZPx: translateZPx + zFrontBoost * (isPopout ? 1 : 1 - t * 0.35),
      rotateXDeg,
      rotateYDeg,
      zIndex: zIndex + (isPopout ? 220 : 120),
      opacity: 1,
      isExpanded: isPopout || t < 0.48,
      isFrontHalf: true,
    };
  }

  return {
    centerX: x,
    centerY: y,
    width,
    height: heightStrip,
    scale,
    translateZPx,
    rotateXDeg,
    rotateYDeg,
    zIndex,
    opacity,
    isExpanded: false,
    isFrontHalf: true,
  };
}

/** Unique catalog indices near focus, wrapping past 0 / count−1. */
export function visibleIndicesAroundFocus(
  focusFloat: number,
  count: number,
  margin: number = MARGIN_INDICES
): number[] {
  if (count <= 0) return [];
  const angleSteps = Math.ceil(FERRIS_MAX_VISIBLE_RAD / FERRIS_ANGLE_PER_INDEX) + 2;
  const m = Math.max(margin, angleSteps);
  const center = wrapIndexLooped(Math.round(focusFloat), count);
  const set = new Set<number>();
  for (let d = -m; d <= m; d++) {
    set.add(wrapIndexLooped(center + d, count));
  }
  return Array.from(set).sort((a, b) => a - b);
}
