# Golf Tracker — project notes for Claude

iPhone-first web app (PWA) for a parent tracking their son's junior golf in Texas: tournaments across many
tours, shot-by-shot stats during rounds, practice, and a season schedule. Live at
https://mattandkat23.github.io/Golf-App/ (GitHub Pages, deployed from `main`).

The owner is a parent, not a developer: explain things in plain language, give click-by-click steps for any
GitHub/console settings, and keep replies short.

## Stack and layout

- React 18 + TypeScript + Vite, `vite-plugin-pwa` (offline, installable), Dexie (IndexedDB). HashRouter.
- Sign-in is required (Supabase Auth, project `jcqvzumkfmbksduzdrbx`; URL + publishable key in `src/lib/supabase.ts`).
  The phone (Dexie) stays the working copy so the app works offline; `src/lib/sync.ts` uploads the backup JSON to
  `family_data` a few seconds after changes and downloads when another device saved newer. Uploads are blocked until the
  first compare with the account after sign-in/reconnect succeeds (never overwrite the account with a stale phone).
- Sign-up and password reset use 6-digit email codes (`verifyOtp`), not links: an installed iPhone PWA doesn't share
  storage with Safari. Email templates/site URL live in `supabase/auth-config.json`.
- `accounts.plan` ('free' | 'paid') is set only server-side; nothing is gated by plan yet.
- `src/lib/types.ts` data model · `src/lib/db.ts` Dexie schema + migrations · `src/lib/stats.ts` stat engine
- `src/pages/Play.tsx` per-shot play mode · `Schedule.tsx` Events tab (My schedule / Available / Past)
- `src/lib/available.ts` scraped + pasted events → schedule · `src/lib/importParse.ts` paste-in parser (no AI)
- `src/lib/schedule.ts` conflicts, deadlines, season totals · `src/lib/ics.ts` calendar export
- `src/data/tours.ts` built-in tour list · `src/data/courses.ts` starter course list (~210 courses: the
  original Texas munis/clubs by region, plus every real tournament venue nationwide found in
  `result_events` -- see Course data below)
- **Course data**: a course only had name/city/region until `scraper/course-data.ts` (manual/re-runnable,
  `.github/workflows/course-data.yml`) pulled phone/website/GPS/architect and, where real hole-by-hole data
  existed, one reference scorecard (par/yardage per hole, USGA rating/slope) from OpenGolfAPI
  (api.opengolfapi.org, free, no key needed, CORS open, ODbL-1.0 -- commercial use OK with attribution).
  Writes `src/data/courseDetails.json` (name+city keyed), which `courses.ts` merges into `SEED_COURSES`;
  re-run it after adding courses, or to refresh. Deliberately conservative -- only fills in a course when
  its name+city matches a single OpenGolfAPI search result (per-course `/courses/search?q=&state=`, not a
  bulk per-state fetch, so it scales nationwide) in the same city, else skips and logs it; a parent can
  still edit anything it filled in, same as before. The one scorecard it builds is a reference, not the
  age-based tee a US Kids round needs (see `courses.ts`'s own comment) -- parents still add/edit their own
  tees exactly as before, they're just not starting from nothing. The script is self-contained (duplicates
  `courseKey()`, reads the seed list from `courses.ts`'s source text) since `src/lib`/`src/data` use
  extension-less imports Node's own ESM loader can't resolve when a scraper script runs directly -- see its
  own comment before reusing this pattern elsewhere.
- **Nationwide starter list**: `result_events` (AJGA nationwide + TGA/HJGT Texas results history, see
  Results below) is the ground truth for "real junior tournament venues" -- `scraper/results/popular-courses.ts`
  (manual, `.github/workflows/popular-courses.yml`, read-only) ranks them by how often they've hosted an
  event. There wasn't enough history yet (293 rows) for a true popularity ranking -- most venues had only
  hosted once or twice -- so instead of guessing a "popular courses" list, every distinct real venue (after
  cleaning up HTML entities and TGA's inconsistent "Venue, City" formatting by hand) was added to `courses.ts`'s
  `SEEDS`, grouped as "Other Texas" or "Other"+state. `Course.state` (USPS code) drives that grouping;
  `Courses.tsx` shows Texas's named regions as flat cards and groups everything else by state in collapsible
  sections (like My tours), with search still matching across the whole list. Re-run `popular-courses.ts`
  later as more results accumulate if a real ranking becomes possible.
- **Live nationwide lookup** (`src/lib/openGolfApi.ts`, used by `CourseLookup` in `CourseForm.tsx`): the Add
  Course page can search any US course by name straight from the browser (OpenGolfAPI's CORS is open --
  checked with `scraper/check-cors.ts` / `.github/workflows/check-cors.yml`, a small reusable debug helper
  for checking any URL before wiring up a browser-side fetch). Picking a result prefills name/city/phone/
  website/GPS/architect/year and a reference scorecard, same fields and same "reference tee" caveat as the
  backfill script above; it fails silently (network hiccup, no matches, whatever) and leaves the form blank
  for manual entry, since it's optional. Region is set to "Other Texas" or "Other" from the result's state;
  a manually-added "Other"-region course has its own State field in the form.
- `src/lib/tourGroups.ts` groups tours by org (SEED_TOURS order) for My tours and the Events → Available
  "Tour"/"Series" filters — an org with more than one tour (US Kids Golf, NTPGA, STPGA, AJGA) collapses to one
  "<org> (all)" option with a second dropdown to narrow to a specific tour, instead of listing every one.
- **First-time setup** (`src/pages/Onboarding.tsx`, route `/onboarding`): a brand-new profile's `onboarded` field
  is unset, so `App.tsx`'s `Shell` redirects there (replacing the normal tab bar/routes) until it's set -- which
  Onboarding does itself the instant it mounts, not just on Finish, so stepping away mid-walkthrough never traps
  a parent in a loop. Walks through naming the golfer + age group, picking tours (embeds `MyTours`), adding a
  one-off event, requesting a missing tour, and a tab-by-tab tour. `Shell` waits for the first sync compare
  before deciding (`src/lib/sync.ts`'s `syncStatus`/`onSyncStatus`) so a returning parent's brand-new device
  doesn't flash onboarding before their real (already-onboarded) profile downloads. A **second** golfer
  (`newGolfer()`) and the `GolferProvider`/`db.ts` "always have one golfer" fallbacks all default `onboarded`
  to `true` -- only a true fresh install's `on('populate')` profile leaves it unset. v13 backfills `onboarded:
  true` for every profile that already existed, so this never surfaces for a current user. Reachable again any
  time from More → "Replay setup guide".

## Rules that bite

- **Database changes** go in a new `supabase/migrations/<timestamp>_name.sql` (never edit applied ones); every table
  needs row-level security. The "Update database" workflow applies them on push to `main` (secrets
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`). This container can't reach Supabase; test against it with the
  "Test sign-in and sync" workflow (`scripts/e2e-account.mjs`, secret `SUPABASE_SECRET_KEY`, throwaway user).
- Auth emails go through custom SMTP (the owner's Gmail with an app password, entered in the Supabase dashboard), which
  allows the 6-digit-code templates in `supabase/auth-email.json`. Before a public launch, switch to a domain sender
  (e.g. Resend). Without custom SMTP the templates can't be changed and `mailer_autoconfirm` would have to be on.

- **Changing `SEED_TOURS`** → add a new `this.version(N).upgrade(... bulkPut(SEED_TOURS))` in `db.ts`, or
  existing phones won't see it. Never edit old versions; renamed/removed tour ids need a migration that also
  remaps `profile.myTours`, `Tournament.tourId` and `ImportedEvent.tourId` (see v5, v11, v12). A tour's `org` field
  groups it in More → My tours (collapsible, one group per org) — name multi-series tours `"<Org> – <Series>"`
  (e.g. `NTPGA – Prep Tour`) so the group strips the org prefix back off for display; see v11/v12 and `sub-tours.ts`.
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
  Regionals (all states), Worlds; AJGA (nationwide, split into sub-tours -- see below); Under Armour Junior
  Tour; TGA/Legends Junior Tour; HJGT (Texas only).
- **Do not bypass robots.txt.** NTPGA's and STPGA's schedules are on BlueGolf (`User-agent: * Disallow: /`) —
  can't be scraped, so neither is in `sources.json`; both are kept current by hand. For any tour like that,
  publish its schedule by hand instead of scraping it: paste the tour's schedule text (the same thing a parent
  used to paste) to `node --experimental-strip-types scraper/publish-schedule.ts <tourId>` (reads stdin, or
  `$TEXT`) — it runs a parser (`src/lib/importParse.ts` by default; STPGA instead uses `scraper/stpga-schedule.ts`,
  a dedicated line-position parser, since its "<Series> - <Venue>" names break the generic one's course-by-keyword
  guess and single-dash splitting — see that file's comment) and the scraper's own event builder (`scraper/lib.ts`),
  replacing that tour's events in `public/events.json` same as a real scrape would. Both tours actually run
  several series under one schedule (NTPGA: AAT majors, Medalist Tour, Prep Tour; STPGA: Prestige Tour, Junior
  Tour, Junior Links, Little Linksters) — `scraper/sub-tours.ts`'s classifiers sort each event into its own
  subscribable tour (`ntpga-majors`, `stpga-junior-tour`, etc. — see `src/data/tours.ts`) by name prefix, so one
  `publish-schedule.ts ntpga`/`stpga` run fans out into several `public/events.json` sources automatically; check
  the output, since a new unrecognized name prefix falls into that org's catch-all bucket (`ntpga-majors`/
  `stpga-prestige`) instead of its own series.
- **AJGA is still scraped** (unlike NTPGA/STPGA), but one national schedule mixes Open Championships with
  Qualifiers (~45% of all events), Invitationals, the ICL Academy Junior All-Star Series, Preview events and
  Senior tournaments -- the same categories AJGA's own entry-limit rules name. `scrapeSource()` in `scrape.ts`
  runs the same `SUB_TOUR_CLASSIFIERS.ajga` classifier (by name keyword, not prefix: `Qualifier - ` prefix,
  then `Invitational`/`Junior All-Star`/`Preview`/`Senior` keywords, else the `ajga-open` catch-all; a name with
  both "Invitational" and "Junior All-Star" -- it happens -- resolves to Invitational) right after extraction,
  so one `ajga` source in `sources.json` fans out into `ajga-open`/`ajga-qualifier`/`ajga-invitational`/
  `ajga-allstar`/`ajga-preview`/`ajga-senior` sources in `events.json`, same idea as the NTPGA/STPGA fan-out above.
  Commit and push to deploy. Parents hit "Tour not listed here?"
  (Events → Available) to request a tour; requests land in the `tour_requests` table. "Check tour requests"
  (daily, `scraper/check-tour-requests.ts`, `.github/workflows/check-tour-requests.yml`) flags new ones by
  deliberately failing the job (so a failed-scheduled-run email goes out) and listing them in the run log;
  `scraper/tour-requests-seen.json` is its checkpoint, committed back each time there's something new.

## Results (`scraper/results/`, `.github/workflows/results.yml`, migration `*_results.sql`)

- Daily "Collect results" reads finished events into `result_events`/`results` (secret key): HJGT (Texas), TGA
  junior events (Golf Genius results pages; past seasons' event links come from Internet Archive copies of
  txga.org/ljt-landing/ listed in `TGA_LIST_PAGES`, since TGA removes old seasons), and AJGA (nationwide;
  `scraper/results/ajga.ts`, plain fetch, no browser needed -- only picks up events already on AJGA's own
  completed-events list, so an event isn't collected until the day after it ends).
  Tables have RLS with no policies: the app reads only via `search_results(key)` (signed in, full name, ≤200 rows)
  and `result_holes(id)`. Names are matched with `scraper/results/names.ts` (shared by app and collector).
- **AJGA hole-by-hole, opt-in only** (`ajga_hole_requests` table, `collectAjgaLive()` in `scraper/results/collect.ts`,
  button on the Tournament detail page for AJGA events that haven't finished yet). AJGA only publishes
  scorecards (par/yardage/score per hole, one tab per round) while an event is in progress -- clicking a
  player's name on `/tournaments/<id>/leaderboard` calls `/api/scorecard?event_id=&tournament_id=&aggregate_id=&member_id=`,
  a plain unauthenticated GET (no browser/click needed -- all four ids are already in the leaderboard page's
  HTML: `data-scorecard-endpoint` per division, `data-aggregate-id`/`data-member-ids` per row). Once the event
  is archived, the same endpoint asks for an AJGA account login instead (confirmed: a finished event 404s the
  modal's data; a live one doesn't). So instead of scraping every kid nationwide, a parent opts in per
  golfer+event; `collectAjgaLive()` runs daily (same `ajga` step as the regular collector, before it) reading
  every opt-in row, matching the golfer's name on that tournament's leaderboard, and writing `results.holes`.
  `collectAjga()`'s own overwrite (once the event is finished and shows up on AJGA's completed list) carries
  over any `holes` already collected live, so it isn't lost when the final row replaces the preliminary one.
  US Kids and NTPGA/STPGA don't have this: US Kids' is disallowed by robots.txt (same as its full results --
  asked at tournaments@uskidsgolf.com, nothing to build until they say yes); NTPGA/STPGA parents already track
  their own rounds hole-by-hole live in Play mode, so there's no separate feature needed there.
- Every browser request goes through `scraper/polite.ts`, which aborts anything robots.txt disallows. **US Kids results
  (TourCaddiePro `/plugins/links/admin/`) are disallowed**: covered by Paste results on an event
  (`src/lib/resultsPaste.ts`) until US Kids gives permission (asked at tournaments@uskidsgolf.com).
- Imported/pasted rounds store `Round.total`/`par`; stats use them until every hole is filled in (`hasScore`, `usesTotal`).
- Debug: "Save page layouts" (`scraper/dump.ts`) commits full HTML + background requests to the `page-dumps` branch.

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

- Live sharing with coach/spouse (invites, view-only/edit) on top of the accounts.
- More results sources: Drive Chip & Putt, US Kids championship PDFs; free vs paid split.
- "Is this Ford?" auto-matching of new results for claimed golfers.
- Reading each US Kids event page for fees/age groups/city.
- TJGT isn't scraped yet (site was down when checked).
- Verify "Add to Calendar" (.ics) behavior on a real iPhone.
