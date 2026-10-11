/**
 * Hurricane Junior Golf Tour results (tournaments.hjgt.org). The Results page lists every event for a season;
 * each event's Scoreboard page shows a leaderboard per division (buttons switch divisions). Both are allowed
 * by robots.txt for all bots.
 */
import type { Page } from 'playwright-core';

export const HJGT_BASE = 'https://tournaments.hjgt.org';
/** Season ids from the Results page's season picker. */
export const HJGT_SEASONS: Record<string, string> = { '2024': '1005', '2025': '1068', '2026': '1164' };

export interface HjgtListed {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  city: string; // "Frisco, TX"
  course?: string;
  status: string; // "In Progress", "Final", ...
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const month = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** "October 10-11, 2026", "Oct 31 - Nov 1, 2025", "December 27, 2024" → ISO dates. */
export function parseDateRange(text: string): { start: string; end?: string } | undefined {
  const t = text.replace(/\s+/g, ' ').trim();
  let m = t.match(/^([A-Za-z]+)\.? (\d{1,2})\s*-\s*([A-Za-z]+)\.? (\d{1,2}),? (\d{4})$/);
  if (m) return { start: iso(+m[5], month(m[1]), +m[2]), end: iso(+m[5], month(m[3]), +m[4]) };
  m = t.match(/^([A-Za-z]+)\.? (\d{1,2})\s*-\s*(\d{1,2}),? (\d{4})$/);
  if (m) return { start: iso(+m[4], month(m[1]), +m[2]), end: iso(+m[4], month(m[1]), +m[3]) };
  m = t.match(/^([A-Za-z]+)\.? (\d{1,2}),? (\d{4})$/);
  if (m) return { start: iso(+m[3], month(m[1]), +m[2]) };
  return undefined;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Events in the Results page / search response HTML. */
export function parseHjgtList(html: string): HjgtListed[] {
  const out: HjgtListed[] = [];
  const parts = html.split(/<div class="tournamentcontainer tnmtresults(\d+)">/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1];
    const name = decode(body.match(/<div Class="tournamentname">([\s\S]*?)<div class="datetextresults">/i)?.[1] ?? '');
    const dates = parseDateRange(decode(body.match(/<div class="datetextresults">([\s\S]*?)<\/div>/)?.[1] ?? ''));
    const city = decode(body.match(/<div class="citystateresults">([\s\S]*?)<\/div>/)?.[1] ?? '');
    const course = decode(body.match(/<li class="toplinecoursename">([\s\S]*?)<\/li>/)?.[1] ?? '') || undefined;
    const status = decode(body.match(/tnmtstatusresults">([\s\S]*?)<\/div>/)?.[1] ?? '');
    if (!name || !dates) continue;
    out.push({ id, name, startDate: dates.start, endDate: dates.end, city, course, status });
  }
  return out;
}

export interface HjgtRow {
  position: string;
  toPar: string;
  name: string; // "Raider, Dean"
  hometown?: string;
  gradYear?: number;
  rounds: (number | null)[];
  strokes?: number;
}

/** Reads the leaderboard table currently shown (runs in the page). */
export async function readLeaderboard(page: Page): Promise<HjgtRow[]> {
  return page.$$eval('table#leaderboard', (tables) => {
    const table = tables[0];
    if (!table) return [];
    const heads = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent!.trim());
    const col = (name: string) => heads.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const roundCols = heads.map((h, i) => (/^R\d+$/i.test(h) ? i : -1)).filter((i) => i >= 0);
    const num = (s?: string) => (s && /^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
    return Array.from(table.querySelectorAll('tbody tr.fullleaderboard')).map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'));
      const text = (i: number) => (i >= 0 ? tds[i]?.textContent?.trim() ?? '' : '');
      const details = Array.from(tr.querySelectorAll('.scoreboardplayerdetails li')).map((li) => li.textContent!.trim());
      const grad = details.find((d) => /^\d{4}$/.test(d));
      return {
        position: text(col('Pos')),
        toPar: text(col('Total')),
        name: tr.querySelector('.scoreboardplayername')?.textContent?.trim() ?? '',
        hometown: details.find((d) => d.includes(',')),
        gradYear: grad ? Number(grad) : undefined,
        rounds: roundCols.map((i) => num(text(i))),
        strokes: num(text(col('Strokes'))) ?? undefined,
      };
    });
  });
}

/** Division buttons on a Scoreboard page: [label, data-id]. */
export async function divisions(page: Page): Promise<{ label: string; id: string }[]> {
  return page.$$eval('button.tournamentdivisionbutton', (bs) => bs.map((b) => ({ label: b.textContent!.trim(), id: b.getAttribute('data-id') ?? '' })));
}
