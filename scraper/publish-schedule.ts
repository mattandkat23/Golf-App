/**
 * Admin tool: publishes a tour's schedule — pasted from the tour's own site — to public/events.json
 * for every family, the same way the daily scraper does. For tours that can't be scraped automatically
 * (NTPGA, or any schedule that lives on a BlueGolf page robots.txt disallows). Reuses the phone's own
 * paste-a-schedule parser (src/lib/importParse.ts), so behavior matches what a parent used to see when
 * pasting into the app, and the scraper's own event builder (scraper/lib.ts), so ids and merging match
 * exactly what a real scrape would have produced — including replacing that tour's old events wholesale,
 * not just adding to them, so cancelled/renamed events don't linger.
 *
 * Usage: node --experimental-strip-types scraper/publish-schedule.ts <tourId> < schedule.txt
 *    or: TOUR=ntpga TEXT="$(cat schedule.txt)" node --experimental-strip-types scraper/publish-schedule.ts
 */
import fs from 'node:fs';
import { parseSchedule } from '../src/lib/importParse.ts';
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
const parsed = parseSchedule(text, today);
const events = normalizeEvents(tourId, parsed, today);
if (!events.length) {
  throw new Error('No events found in that text. Make sure it reads like a schedule (one date + name per event) — the same text a parent would paste in the app.');
}

const previous = fs.existsSync(EVENTS_PATH) ? (JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8')) as EventsFile) : undefined;
const merged = mergeEventsFile(previous, [{ tourId, ok: true, events }], new Date().toISOString());
fs.writeFileSync(EVENTS_PATH, JSON.stringify(merged, null, 1) + '\n');

console.log(`\n${tourId}: published ${events.length} event${events.length === 1 ? '' : 's'}`);
for (const e of events) console.log(`  ${e.startDate}${e.endDate ? `–${e.endDate}` : ''}  ${e.name}${e.courseName ? ` — ${e.courseName}` : ''}`);
console.log(`\nWrote ${EVENTS_PATH}. Commit and push to main to deploy.`);
