/**
 * Single source of truth for public sound URLs. Add new shipped clips to
 * PRECACHE_SOUND_URLS so the landing page warms the HTTP cache before play.
 *
 * Paths must respect Vite `base` (e.g. `/hiitdaslots/` in production) so fetches
 * and Audio() hit real files under `public/sounds/`, not the site root.
 */
const base = import.meta.env.BASE_URL;

function soundUrl(pathFromPublicRoot: string): string {
  const p = pathFromPublicRoot.replace(/^\//, '');
  return `${base}${p}`;
}

export const SOUNDS = {
  uiInsertCoin: soundUrl('sounds/ui/insert_coin.webm'),
  uiSelect: soundUrl('sounds/ui/select.webm'),
  uiConfirm: soundUrl('sounds/ui/confirm.webm'),
  uiCancel: soundUrl('sounds/ui/cancel.webm'),
  slotsSpinLoop: soundUrl('sounds/slots/spin_loop.webm'),
  slotsReelStop: soundUrl('sounds/slots/reel-stop.webm'),
  slotsJackpot: soundUrl('sounds/slots/jackpot.webm'),
  workoutCountdownTick: soundUrl('sounds/workout/countdown_tick.webm'),
} as const;

/** All URLs prefetched on the landing screen (order does not matter). */
export const PRECACHE_SOUND_URLS: readonly string[] = [
  SOUNDS.uiInsertCoin,
  SOUNDS.uiSelect,
  SOUNDS.uiConfirm,
  SOUNDS.uiCancel,
  SOUNDS.slotsSpinLoop,
  SOUNDS.slotsReelStop,
  SOUNDS.slotsJackpot,
  SOUNDS.workoutCountdownTick,
];

/** Played on INSERT COIN (same gesture). */
export const INSERT_COIN_SOUND_URLS: readonly string[] = [SOUNDS.uiInsertCoin];
