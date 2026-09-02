# video — Remotion Video Production

**Parent:** `../AGENTS.md`

## OVERVIEW

Promotional/intro videos built with Remotion (React). Three compositions: `KronTermIntro` (90s, 9:16 vertical), `KronTermPromo` (~62s), `FieldGuideVideo`. Scene-by-scene breakdowns in `README.md`.

## STRUCTURE

- `src/Root.tsx` — composition registry
- `src/PromoVideo.tsx`, `IntroVideo.tsx`, `FieldGuideVideo.tsx` — compositions
- `src/scenes/` — per-scene components; `theme.ts` holds COLORS and scene timing constants
- `public/` — assets; screen recordings under `public/promo/`

## COMMANDS

Render scripts live in `package.json` (e.g. `npm run build:intro`) — check existing scripts before adding new render targets.

## NOTES

- Compositions load footage by path from `public/` — asset filenames must match exactly or the render fails.
- `kronterm-logo.svg` in the website assets still carries Wave branding; prefer the icon + text lockup built in-scene.
