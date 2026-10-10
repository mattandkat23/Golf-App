/**
 * Turns a schedule copied from a tour's web page into events. Runs entirely on the phone (no AI):
 * it finds dates line by line and treats the text around each date as that event's name, course
 * and city. The import screen lets the parent fix anything it gets wrong before adding.
 */

export interface ParsedEvent {
  startDate: string;
  endDate?: string;
  name: string;
  courseName?: string;
  city?: string;
  entryFee?: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const ORD = '(?:st|nd|rd|th)?';
const RE_NAMED = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})${ORD}(?:\\s*-\\s*(?:${MONTH}\\s+)?(\\d{1,2})${ORD})?(?:,?\\s+(\\d{4}))?`, 'i');
const RE_NUMERIC = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*-\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)?\b/;
const RE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const WEEKDAY = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|urday|sday)?\b\.?,?/gi;

const NOISE = /^(register|registration( open| closed)?|open|closed|full|sold out|waitlist|wait list|results?|view|details|entry list|tee times?|more info|info|sign up|enter|leaderboard|scores|cancel+ed|tbd|status|date|tournament|event|course|location|deadline)$/i;
const TIME = /^\d{1,2}(:\d{2})?\s*(am|pm)$/i;
const COURSE_WORDS = /\b(golf|club|cc|gc|course|links|ranch|country|resort|national|hills?|creek|oaks?)\b/i;
const CITY_STATE = /^([A-Za-z .'-]+),\s*(TX|Texas)$/;

interface DateHit {
  start: string;
  end?: string;
  index: number;
  length: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Picks the year for a date shown without one: this season, rolling into next year for dates long past. */
function inferYear(month: number, day: number, today: string): number {
  const y = Number(today.slice(0, 4));
  const candidate = `${y}-${pad(month)}-${pad(day)}`;
  const cutoff = new Date(new Date(today + 'T00:00:00').getTime() - 60 * 864e5).toISOString().slice(0, 10);
  return candidate < cutoff ? y + 1 : y;
}

const fullYear = (y?: string) => (y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : undefined);

function valid(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return m >= 1 && m <= 12 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function findDate(line: string, today: string): DateHit | undefined {
  let m = line.match(RE_ISO);
  if (m && valid(+m[1], +m[2], +m[3])) return { start: m[0], index: m.index!, length: m[0].length };

  m = line.match(RE_NAMED);
  if (m) {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)] ?? MONTHS[m[1].toLowerCase().slice(0, 4)];
    const day = +m[2];
    const endMonth = m[3] ? MONTHS[m[3].toLowerCase().slice(0, 3)] : month;
    const endDay = m[4] ? +m[4] : undefined;
    const year = fullYear(m[5]) ?? inferYear(month, day, today);
    if (valid(year, month, day)) {
      const start = `${year}-${pad(month)}-${pad(day)}`;
      let end: string | undefined;
      if (endDay && valid(year, endMonth, endDay)) {
        end = `${endMonth < month ? year + 1 : year}-${pad(endMonth)}-${pad(endDay)}`;
        if (end <= start) end = undefined;
      }
      return { start, end, index: m.index!, length: m[0].length };
    }
  }

  m = line.match(RE_NUMERIC);
  if (m) {
    const [month, day] = [+m[1], +m[2]];
    const year = fullYear(m[3]) ?? inferYear(month, day, today);
    if (valid(year, month, day)) {
      const start = `${year}-${pad(month)}-${pad(day)}`;
      let end: string | undefined;
      if (m[4] && m[5]) {
        const ey = fullYear(m[6]) ?? year;
        if (valid(ey, +m[4], +m[5])) end = `${ey}-${pad(+m[4])}-${pad(+m[5])}`;
        if (end && end <= start) end = undefined;
      }
      return { start, end, index: m.index!, length: m[0].length };
    }
  }
  return undefined;
}

function segments(text: string): string[] {
  return text
    .replace(WEEKDAY, ' ')
    .split(/\t|\s{2,}|\s\|\s|\s[-–—]\s|•|·/)
    .map((s) => s.trim().replace(/^[,:;\-–—|]+|[,:;\-–—|]+$/g, '').trim())
    .filter((s) => s && !NOISE.test(s) && !TIME.test(s) && !/^\d+$/.test(s));
}

export function parseSchedule(text: string, today: string, isKnownCourse: (name: string) => boolean = () => false): ParsedEvent[] {
  const lines = text
    .replace(/ /g, ' ')
    .replace(/[–—]/g, '-')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

  const blocks: { hit: DateHit; text: string[] }[] = [];
  let carry = 0; // lines after a date that still belong to it
  for (const line of lines) {
    const hit = findDate(line, today);
    if (hit) {
      const rest = line.slice(0, hit.index) + '\t' + line.slice(hit.index + hit.length);
      blocks.push({ hit, text: [rest] });
      carry = 4;
    } else if (blocks.length && carry > 0) {
      blocks.at(-1)!.text.push(line);
      carry--;
    }
  }

  const out = new Map<string, ParsedEvent>();
  for (const { hit, text: parts } of blocks) {
    let segs = parts.flatMap(segments);
    let entryFee: number | undefined;
    let city: string | undefined;
    segs = segs.filter((s) => {
      const fee = s.match(/^\$\s?(\d+(?:\.\d{2})?)$/);
      if (fee) {
        entryFee ??= Number(fee[1]);
        return false;
      }
      const cs = s.match(CITY_STATE);
      if (cs && !COURSE_WORDS.test(cs[1])) {
        city ??= cs[1].trim();
        return false;
      }
      return true;
    });
    const courseIdx = Math.max(segs.findIndex(isKnownCourse), -1);
    const ci = courseIdx >= 0 ? courseIdx : segs.findIndex((s) => COURSE_WORDS.test(s));
    let courseName = ci >= 0 ? segs[ci] : undefined;
    // "Pecan Hollow GC, Plano" → course + city
    const cm = courseName?.match(/^(.*?),\s*([A-Za-z .'-]+?)(?:,\s*(?:TX|Texas))?$/);
    if (cm && COURSE_WORDS.test(cm[1])) {
      courseName = cm[1].trim();
      city ??= cm[2].trim();
    }
    const others = segs.filter((_, i) => i !== ci);
    const name = others[0] ?? courseName;
    if (!name) continue;
    const ev: ParsedEvent = { startDate: hit.start, name, ...(hit.end && { endDate: hit.end }), ...(courseName && { courseName }), ...(city && { city }), ...(entryFee && { entryFee }) };
    const key = `${ev.startDate}|${ev.name.toLowerCase()}`;
    if (!out.has(key)) out.set(key, ev);
  }
  return [...out.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
