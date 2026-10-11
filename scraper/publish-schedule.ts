/**
 * Admin tool: publishes a tour's schedule — pasted from the tour's own site — to public/events.json
 * for every family, the same way the daily scraper does. For tours that can't be scraped automatically
 * (NTPGA/STPGA, or any schedule that lives on a BlueGolf page robots.txt disallows). Reuses the phone's
 * own paste-a-schedule parser (src/lib/importParse.ts) by default, so behavior matches what a parent
 * used to see when pasting into the app (STPGA instead uses its own parser, see stpga-schedule.ts: its
 * "<Series> - <Venue>" names break the generic one), and the scraper's own event builder
 * (scraper/lib.ts), so ids and merging match exactly what a real scrape would have produced —
 * including replacing that tour's old events wholesale, not just adding to them, so cancelled/renamed
 * events don't linger. NTPGA and STPGA each run several series under one schedule (AAT/Medalist/Prep;
 * Prestige Tour/Junior Tour/Junior Links/Little Linksters) -- sub-tours.ts sorts each event into its
 * own subscribable tour (ntpga-majors, stpga-junior-tour, etc. — see src/data/tours.ts) so a parent
 * isn't swamped with every age group's events.
 *
 * Usage: node --experimental-strip-types scraper/publish-schedule.ts <tourId> < schedule.txt
 *    or: TOUR=ntpga TEXT="$(cat schedule.txt)" node --experimental-strip-types scraper/publish-schedule.ts
 */
import fs from 'node:fs';
import { parseSchedule, type ParsedEvent } from '../src/lib/importParse.ts';
import { parseStpgaSchedule } from './stpga-schedule.ts';
import { SUB_TOUR_CLASSIFIERS } from './sub-tours.ts';
import { mergeEventsFile, normalizeEvents, type EventsFile } from './lib.ts';

const EVENTS_PATH = process.env.SCRAPER_EVENTS_PATH ?? 'public/events.json';
const tourId = process.argv[2] ?? process.env.TOUR;
const text = process.env.TEXT ?? (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8'));

if (!tourId) {
  throw new Error('Usage: node --experimental-strip-types scraper/publish-schedule.ts <tourId>  (schedule text on stdin, or $TEXT)');
}
if (!text.trim()) {
  throw new Error('No schedule text given — pipe it in on stdin or set $TEXT.');
}
// tourId should match an id in src/data/tours.ts (so parents can subscribe to it) — not checked here
// to avoid pulling the app's bundler-resolved source into the scraper's stricter Node/ESM build.

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const parse: (text: string, today: string) => ParsedEvent[] = tourId === 'stpga' ? parseStpgaSchedule : parseSchedule;
const parsed = parse(text, today);
if (!parsed.length) {
  throw new Error('No events found in that text. Make sure it reads like a schedule (one date + name per event) — the same text a parent would paste in the app.');
}

const classify = SUB_TOUR_CLASSIFIERS[tourId];
const buckets = new Map<string, ParsedEvent[]>();
for (const ev of parsed) {
  const id = classify ? classify(ev.name) : tourId;
  buckets.set(id, [...(buckets.get(id) ?? []), ev]);
}
const results = [...buckets.entries()].map(([id, evs]) => ({ tourId: id, ok: true, events: normalizeEvents(id, evs, today) }));

const previous = fs.existsSync(EVENTS_PATH) ? (JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8')) as EventsFile) : undefined;
const merged = mergeEventsFile(previous, results, new Date().toISOString());
fs.writeFileSync(EVENTS_PATH, JSON.stringify(merged, null, 1) + '\n');

for (const { tourId: id, events } of results) {
  console.log(`\n${id}: published ${events.length} event${events.length === 1 ? '' : 's'}`);
  for (const e of events) console.log(`  ${e.startDate}${e.endDate ? `–${e.endDate}` : ''}  ${e.name}${e.courseName ? ` — ${e.courseName}` : ''}`);
}
console.log(`\nWrote ${EVENTS_PATH}. Commit and push to main to deploy.`);
