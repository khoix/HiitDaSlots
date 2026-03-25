# HIIT·da·Slots

A neon “slot machine” UI that generates and runs a HIIT-style workout. Roll the reels, review your workout, then follow the workout runner as it counts down rests/exercises.

## Features

- Slot reel “spin → settle → jackpot” animation (respects `prefers-reduced-motion`)
- Workout generation with two modes:
  - `time-attack`: work/rest intervals with optional “auto-start next”
  - `rep-quest`: target reps (including hold exercises + bilateral phases)
- Exercise library features:
  - Favorite exercises
  - Save workout presets
  - Workout history + replay
  - Exercise catalog editing (name/description/targets/demo URL)
- Sound support:
  - Landing screen preloads (precaches) required SFX before showing **INSERT COIN TO PLAY**
  - Web Audio API playback with fallback to `HTMLAudioElement` if decoding fails

## Screens / flow

- Landing (`landing`): precaches SFX, then reveals the **INSERT COIN TO PLAY** button
- Setup (`setup`): choose workout mode, target muscles, and parameters
- Spinning (`spinning`): animated slot reels + SFX
- Ready (`ready`): review generated circuits/exercises, edit, save, or start
- Running (`running`): rest/exercise cards with timer + controls
- History / Saved / Favorites / Catalog: manage past runs and exercise data

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS (with custom design tokens)
- Radix UI + Lucide icons (UI components)

## Local development

1. Install dependencies
   - `npm install`
2. Start the dev server
   - `npm run dev`
3. Open the URL shown in the terminal (default Vite port is `5173`)

Other scripts:

- `npm run build` (Vite build)
- `npm run preview` (Vite preview)
- `npm run typecheck` (TypeScript typecheck)

## Deployment under a subpath (`VITE_BASE_URL`)

This app uses Vite `base` handling for assets and audio URLs. For example, if you host under `/hiitdaslots/`, set:

- `VITE_BASE_URL=/hiitdaslots/`

(See `vite.config.ts` and how `src/audio/soundManifest.ts` builds URLs using `import.meta.env.BASE_URL`.)

## Sound assets (required)

This repo currently includes the sound **mapping docs**, but not the actual `.webm` audio files. Add your own clips under:

- `public/sounds/`

The app’s single source of truth for which audio files are expected is:

- `src/audio/soundManifest.ts`

### Required sound files (by public path)

Place `.webm` files at these locations:

- `public/sounds/ui/insert_coin.webm`
- `public/sounds/ui/select.webm`
- `public/sounds/ui/confirm.webm`
- `public/sounds/ui/cancel.webm`
- `public/sounds/slots/spin_loop.webm`
- `public/sounds/slots/reel-stop.webm`
- `public/sounds/slots/jackpot.webm`
- `public/sounds/workout/countdown_tick.webm`

### Landing precache behavior

On the landing screen, the app fetches every URL in `PRECACHE_SOUND_URLS` (from `src/audio/soundManifest.ts`) and shows a progress bar. The **INSERT COIN TO PLAY** CTA only appears after all fetches succeed (or an error + retry is shown).

### Music / BGM note

There is audio “music bus” plumbing and a `localStorage` preference key for future background music, but the current UI does not expose a BGM control. The slot reel bed loop is routed directly so it is not muted by the (future) music bus (see `src/audio/playSfx.ts` and `src/context/BgmMusicContext.tsx`).

## Storage (local-only)

Workout data and customization are stored in your browser via `localStorage`:

- Workout library (history + saved workouts + favorites):
  - key: `hiitdaslots-workout-library-v1`
  - `src/storage/workoutLibraryStorage.ts`
- Catalog overrides (edited exercise metadata):
  - key: `hiitdaslots-catalog-overrides-v1`
  - `src/storage/catalogOverridesStorage.ts`

## Useful docs

- Sound asset mapping / guidance:
  - `public/sounds/SOUND_PROFILE.md`
- Sound implementation plan (notes/todos):
  - `HIIT_SOUND_PROFILE_PLAN.md`

## Notes

- Autoplay policies: audio is resumed in response to user interaction (Landing listens for `pointerdown`) to reduce blocked playback.
- The workout runner progresses through a generated plan of `exercise` and `rest` items; timers are driven from interval ticks.
