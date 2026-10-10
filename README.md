# Golf Tracker

An iPhone-friendly web app for tracking a junior golfer's US Kids tournaments, practice and per-shot stats.
It installs to the home screen, works offline on the course, and keeps all data on the phone.

## Features

- **Tours**: pick the tours your golfer plays (US Kids Austin/Dallas/Houston/San Antonio, NTPGA, STPGA,
  AJGA, Under Armour, HJGT, TGA/Legends, TJGT) or add your own. Events are filed under a tour and can be
  filtered by tour on the Events and Stats tabs.
- **Events**: tournaments (Local / State / Regional / World) with tour, course, dates, tee time, age group,
  registration deadline, fee, finish position and qualification. Links to each tour's schedule page.
- **Play mode**: fast shot-by-shot entry during a round. For each shot: lie, shot type, club, result,
  miss direction (left/right/short/long), distance to hole in 5 ft buckets, and contact (center/heel/toe/fat/thin).
  Putts are one tap (made, or how far it was left). Pars are set as you play and saved to the course scorecard.
- **Stats**: score to par, fairways (with left/right misses), greens in regulation, putts, 3-putts,
  scrambling, sand saves, penalties, approach proximity and miss pattern, putting make % by distance,
  contact quality overall and by club, scoring by par, and a trend chart. Filter by last 5/10, season,
  or tour level.
- **Schedule**: My schedule (list or month calendar, color-coded by tour), date-conflict warnings,
  registration-deadline reminders on Home, a season table of events and entry fees per tour, and
  "Add to Calendar" (.ics) for one event or the whole schedule.
- **Available events**: tour schedules collected daily by the scraper. Families see events from the tours
  they subscribe to (More → My tours), can browse other tours, and add an event as Interested or Registered.
- **Paste a schedule**: for tours the scraper can't read (e.g. NTPGA on BlueGolf, whose robots.txt
  blocks bots), copy the schedule page and paste it; the app finds dates, names and courses on the phone,
  and you review and edit before adding.
- **Rounds**: every round is listed under More → All rounds; open one and tap Card → Delete round to remove it.
- **Practice log**: time by area, drills with scores, notes, and 30-day breakdown.
- **Courses**: Austin, Dallas–Fort Worth, Waco (Ridgewood CC, Cottonwood Creek), Hill Country,
  San Antonio and Houston courses pre-loaded; add any course and its tees/pars/yardages.
- **Bag**: clubs and carry distances (clubs show up in play mode).
- **Backup**: export/import a JSON file through the iPhone share sheet.

## Install on iPhone

1. Open the site in Safari.
2. Tap Share → **Add to Home Screen**.
3. Open it once while online; after that it works offline.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # stats unit tests
npm run build    # production build in dist/
```

Built with React, TypeScript, Vite, Dexie (IndexedDB) and vite-plugin-pwa.

## Tour schedule scraper

`.github/workflows/scrape.yml` runs `scraper/scrape.ts` daily (and on demand from the Actions tab).
For each tour in `scraper/sources.json` it opens the tour's pages in headless Chromium, respects
robots.txt, asks Claude to extract the events, follows the links Claude suggests, and writes
`public/events.json`. Page text is hashed in `scraper/cache.json`, so Claude is only called when a page
changes. Requires an `ANTHROPIC_API_KEY` repository secret. To add a tour, add an entry to
`sources.json` with the tour id from `src/data/tours.ts`, a start URL and a short hint.

## Hosting

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`.
Enable it once under **Settings → Pages → Source: GitHub Actions**.
