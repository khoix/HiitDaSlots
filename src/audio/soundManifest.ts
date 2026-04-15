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
  mainMp3: soundUrl('sounds/main.mp3'),
  uiInsertCoin: soundUrl('sounds/ui/insert_coin.webm'),
  uiSelect: soundUrl('sounds/ui/select.webm'),
  uiConfirm: soundUrl('sounds/ui/confirm.webm'),
  uiCancel: soundUrl('sounds/ui/cancel.webm'),
  slotsSpinLoop: soundUrl('sounds/slots/spin_loop.webm'),
  slotsReelStop: soundUrl('sounds/slots/reel-stop.webm'),
  slotsJackpot: soundUrl('sounds/slots/jackpot.webm'),
  workoutCountdownTick: soundUrl('sounds/workout/countdown_tick.webm'),
} as const;

/** Looped in the session bar after INSERT COIN (hidden HTML audio element). */
export const MAIN_LOOP_URL = SOUNDS.mainMp3;

/**
 * Workout shuffle playlist — add MP3s under `public/sounds/workout/` matching these names
 * (e.g. worktrack01.mp3 … worktrack12.mp3), or edit this list.
 */
export const WORKOUT_TRACK_URLS: readonly string[] = [
  soundUrl('sounds/workout/worktrack01.mp3'),
  soundUrl('sounds/workout/worktrack02.mp3'),
  soundUrl('sounds/workout/worktrack03.mp3'),
  soundUrl('sounds/workout/worktrack04.mp3'),
  soundUrl('sounds/workout/worktrack05.mp3'),
  soundUrl('sounds/workout/worktrack06.mp3'),
  soundUrl('sounds/workout/worktrack07.mp3'),
  soundUrl('sounds/workout/worktrack08.mp3'),
];

/** All URLs prefetched on the landing screen (order does not matter). */
export const PRECACHE_SOUND_URLS: readonly string[] = [
  SOUNDS.mainMp3,
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
