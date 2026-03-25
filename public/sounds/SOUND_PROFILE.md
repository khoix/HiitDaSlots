# HIIT Da Slots — sound assets

**Drop files under `public/sounds/`.** At runtime, URLs are **`import.meta.env.BASE_URL` + path** (e.g. `/hiitdaslots/sounds/...` when the app `base` is `/hiitdaslots/`). See `src/audio/soundManifest.ts`.

## Landing / precache

- **`PRECACHE_SOUND_URLS`** in `src/audio/soundManifest.ts` lists every file prefetched on the landing screen before **INSERT COIN TO PLAY** appears.
- **Add new shipped `.webm` files to that array** so they are cached before play.
- **INSERT COIN** plays **`/sounds/main.webm`** and **`/sounds/ui/insert_coin.webm`** in parallel (same click). Not gated by the **Music** menu toggle.

## Music toggle (BGM only)

- **Menu → Music** persists with `localStorage` key **`hiitda-music-enabled`** (default **on**).
- This switch is **only** for future **background music**. It does **not** mute SFX, landing sounds, slots, or workout cues.
- Use `useBgmMusicPreference()` from `src/context/BgmMusicContext.tsx` when a BGM loop is added.

## Layout (suggested)

```text
public/sounds/
  main.webm
  ui/
    insert_coin.webm
    confirm.webm
    cancel.webm
  music/          # future BGM (Music toggle applies here only)
  slots/
  workout/
```

## Format

Prefer **`.webm`** (Opus). Keep SFX short; normalize loudness across clips.

## Event IDs (reference)

| ID | File (relative to `public/sounds/`) |
|----|-------------------------------------|
| `landing.insert_coin` | `main.webm` |
| `ui.insert_coin` | `ui/insert_coin.webm` |
| `ui.navigate` | `ui/confirm.webm` |
| `ui.back` | `ui/cancel.webm` |
| `slots.spin_loop` | `slots/spin_loop.webm` |
| `slots.jackpot` | `slots/jackpot.webm` |
| `workout.countdown_warning` | `workout/countdown_tick.webm` |
