# Golf Tracker — project notes for Claude

iPhone-first web app (PWA) for a parent tracking their son's junior golf in Texas: tournaments across many
tours, shot-by-shot stats during rounds, practice, and a season schedule. Live at
https://mattandkat23.github.io/Golf-App/ (GitHub Pages, deployed from `main`).

The owner is a parent, not a developer: explain things in plain language, give click-by-click steps for any
GitHub/console settings, and keep replies short.

## Stack and layout

- React 18 + TypeScript + Vite, `vite-plugin-pwa` (offline, installable), Dexie (IndexedDB). HashRouter.
- All user data lives on the phone (no backend). Backup = JSON export/import (More tab).
- `src/lib/types.ts` data model · `src/lib/db.ts` Dexie schema + migrations · `src/lib/stats.ts` stat engine
- `src/pages/Play.tsx` per-shot play mode · `Schedule.tsx` Events tab (My schedule / Available / Past)
- `src/lib/available.ts` scraped + pasted events → schedule · `src/lib/importParse.ts` paste-in parser (no AI)
- `src/lib/schedule.ts` conflicts, deadlines, season totals · `src/lib/ics.ts` calendar export
- `src/data/tours.ts` built-in tour list · `src/data/courses.ts` starter Texas course list

## Rules that bite

- **Changing `SEED_TOURS`** → add a new `this.version(N).upgrade(... bulkPut(SEED_TOURS))` in `db.ts`, or
  existing phones won't see it. Never edit old versions; renamed/removed tour ids need a migration (see v5).
- **Multiple golfers** (v10): tournaments, rounds and practice carry `golferId` (a `profile` id; first golfer is
  `'me'`). Query them by golferId; use `useGolfer()` (`src/lib/golfer.tsx`) for the selected golfer, never `profile.get('me')`.
  Courses, tours and Available events are shared.
- New Dexie tables/indexes also need a new version. Add new data to `exportBackup`/`importBackup`.
- Two entry modes per round (`Round.detailed`): **Basic** (default) stores `score`/`fairway`/`gir`/`putts` on the hole;
  **Detailed** stores `shots`, which win when present. A hole counts when its last shot is `Holed` or (no shots) it has a
  `score`. GIR falls back to score − putts; putts/GIR/fairways stats only use holes that recorded them.
  Proximity/putt distance are 5 ft buckets (`leaveFt` = lower bound).
- Keep it phone-first: big tap targets, native selects, works offline.

## Tour schedule scraper (`scraper/`, `.github/workflows/scrape.yml`)

- Runs daily ~5:17am Central and on demand (Actions → "Scrape tour events", optional `tour` input).
- Renders each source in `scraper/sources.json` with headless Chromium, respects robots.txt and Crawl-delay,
  sends page text (or PDF) to Claude (`claude-opus-5-5`, structured output, low effort, `fallbacks: "default"`),
  follows suggested links up to `maxPages`, writes `public/events.json`. Page hashes in `scraper/cache.json`
  mean Claude is only called when a page changes. Needs repo secret `ANTHROPIC_API_KEY` (set).
- After it commits, `deploy.yml` redeploys via `workflow_run`.
- Bump `PROMPT_VERSION` in `scrape.ts` when changing the prompt/schema.
- Debug helpers (Actions, manual): "Peek at a page" (`scraper/peek.ts`) prints a page's text/links;
  "Check robots.txt" (`scraper/robots-check.ts`).
- Sources: US Kids Austin, Dallas, Houston, San Antonio, El Paso (all Texas fall local tours), Texas State,
  Regionals (all states), Worlds; AJGA (nationwide); TGA/Legends Junior Tour; STPGA junior site; HJGT (Texas only).
- **Do not bypass robots.txt.** NTPGA and STPGA schedules are on BlueGolf (`User-agent: * Disallow: /`);
  those are covered by the Paste importer (Events → Paste), which adds events to Available.

## Commands

```sh
npm test            # vitest: stats, schedule, ics, import parser, scraper lib, db migration
npm run build       # tsc + vite build
npx tsc -p tsconfig.scraper.json   # typecheck scraper
```

E2E checks have been done ad hoc with Playwright (global install) against `npx vite preview --port 4173`
at iPhone 13 size; Chromium is at /opt/pw-browsers in the cloud container.

## Git

Work on `claude/golf-tournament-stats-app-vw6jrj` and push the same commits to `main` (fast-forward) to
deploy. The scrape workflow commits to `main` too, so pull/rebase before pushing.

## Open ideas / not built yet

- Live sharing with coach/spouse (invites, view-only/edit) — needs a backend (e.g. Supabase free tier).
- Reading each US Kids event page for fees/age groups/city.
- Under Armour Junior Tour (uagolftour.com) and TJGT aren't scraped yet.
- Verify "Add to Calendar" (.ics) behavior on a real iPhone.
