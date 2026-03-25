import type { CSSProperties } from "react";

/** 3D carousel row styling shared by exercise pool reel and jackpot reels. */
export function rowStyle3D(
  dist: number,
  locked: boolean,
  available: boolean
): CSSProperties {
  const ad = Math.abs(dist);
  const rotateX = Math.max(-52, Math.min(52, dist * -13));
  const scale = Math.max(0.82, 1 - Math.min(ad * 0.065, 0.16));
  const opacity = available
    ? Math.max(0.28, 1 - Math.min(ad * 0.22, 0.62))
    : Math.max(0.18, 0.35 - Math.min(ad * 0.12, 0.2));
  const translateZ = -Math.min(ad * 22, 56);
  const brightness = locked && ad < 0.08 ? 1.12 : 1 - Math.min(ad * 0.08, 0.22);
  return {
    transform: `translate3d(0, 0, ${translateZ}px) rotateX(${rotateX}deg) scale3d(${scale}, ${scale}, 1)`,
    opacity,
    filter: available
      ? `brightness(${brightness})`
      : `brightness(${brightness * 0.75}) grayscale(0.35)`,
  };
}
