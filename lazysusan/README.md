# Lazy susan landing submenu (archived)

This folder holds the **lazy susan** implementation for the Catalog / History / Workouts / Favorites row under INSERT COIN, saved for recovery without using git.

## Restore into the project

1. Copy files back over the app tree (from repo root):

   - `lazysusan/src/components/LandingSubmenuReel.tsx` → `src/components/LandingSubmenuReel.tsx`
   - `lazysusan/src/components/LandingScreen.tsx` → `src/components/LandingScreen.tsx`

2. Optional CSS: if you use the longer slot-reel comment, replace the `/* Slot-style reel ... */` line in `src/index.css` with the contents of `lazysusan/src/index-css-slot-reel-comment.txt` (or keep the shorter original comment).

3. Run `npm run build` and fix any path/import issues.

## Contents

| Path here | Restores |
|-----------|----------|
| `src/components/LandingSubmenuReel.tsx` | Full lazy susan component |
| `src/components/LandingScreen.tsx` | Landing screen wired to the reel |
| `src/index-css-slot-reel-comment.txt` | Alternate `index.css` comment (optional) |
