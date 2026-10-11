/**
 * Dedicated parser for STPGA's "<Series> - <Venue>" schedule table (pasted from the tour's site).
 * The generic paste parser (src/lib/importParse.ts) splits a name on " - " and guesses the course
 * by keyword, which breaks here: every STPGA event name repeats the venue (often with "Country
 * Club"/"GC"/"CC"), so the keyword guess routinely swaps the name and the course. This parser
 * instead uses the table's fixed line order: date, name, course, city, then optional deadline/fee
 * chrome -- and strips the deadline text ("Closes Tue Oct 13", "Opens 12/07/2026") and the stray
 * "favorite" column code (e.g. "RRGC") that would otherwise read as their own bogus events.
 */
import type { ParsedEvent } from '../src/lib/importParse.ts';

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const DATE_CROSS = /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2})$/;
const DATE_SINGLE = /^([A-Za-z]{3,9})\s+(\d{1,2})(?:-(\d{1,2}))?$/;

/** Picks the year for a date shown without one, rolling into next year for dates long past (see importParse.ts). */
function yearFor(month: number, day: number, today: string): number {
  const y = Number(today.slice(0, 4));
  const candidate = `${y}-${pad(month)}-${pad(day)}`;
  const cutoff = new Date(new Date(today + 'T00:00:00').getTime() - 60 * 864e5).toISOString().slice(0, 10);
  return candidate < cutoff ? y + 1 : y;
}

function parseDateLine(line: string, today: string): { start: string; end?: string } | undefined {
  let m = line.match(DATE_CROSS);
  if (m) {
    const m1 = MONTHS[m[1].toLowerCase().slice(0, 3)];
    const m2 = MONTHS[m[3].toLowerCase().slice(0, 3)];
    if (m1 && m2) {
      const y1 = yearFor(m1, +m[2], today);
      return { start: iso(y1, m1, +m[2]), end: iso(m2 < m1 ? y1 + 1 : y1, m2, +m[4]) };
    }
  }
  m = line.match(DATE_SINGLE);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo) {
      const y = yearFor(mo, +m[2], today);
      return { start: iso(y, mo, +m[2]), ...(m[3] && { end: iso(y, mo, +m[3]) }) };
    }
  }
  return undefined;
}

export function parseStpgaSchedule(text: string, today: string): ParsedEvent[] {
  let t = text;
  t = t.replace(/\s*•\s*Closes\b.*$/gim, '');
  t = t.replace(/\bOpens\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '');

  const lines = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^[A-Z0-9-]{2,10}$/.test(l)); // stray favorite-column codes (e.g. "RRGC", "JCC")

  const boundaries: { idx: number; date: { start: string; end?: string } }[] = [];
  lines.forEach((l, idx) => {
    const d = parseDateLine(l, today);
    if (d) boundaries.push({ idx, date: d });
  });

  const events: ParsedEvent[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const { idx, date } = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1].idx : lines.length;
    const content = lines.slice(idx + 1, end);
    if (content.length < 3) continue; // malformed block, skip rather than guess

    const name = content[0].replace(/\s{2,}About\s*$/, '').trim();
    const courseName =
      content[1]
        .replace(/\t.*$/, '')
        .replace(/\s*·\s*$/, '')
        .trim() || undefined;
    const cityRaw = content[2].replace(/,\s*(TX|Texas|LA|Louisiana)\s*$/i, '').trim();
    const city = cityRaw && cityRaw !== content[2] ? cityRaw : undefined;
    const feeLine = content.slice(3).find((l) => /^\$\d+(?:\.\d{2})?/.test(l));
    const entryFee = feeLine ? Number(feeLine.match(/^\$(\d+(?:\.\d{2})?)/)![1]) : undefined;

    events.push({
      startDate: date.start,
      ...(date.end && { endDate: date.end }),
      name,
      ...(courseName && { courseName }),
      ...(city && { city }),
      ...(entryFee && { entryFee }),
    });
  }
  return events;
}
