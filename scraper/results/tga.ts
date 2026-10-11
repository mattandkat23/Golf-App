/**
 * Texas Golf Association junior events (Legends Junior Tour and TGA junior championships). The txga.org junior
 * page lists the season's events with a RESULTS link to a Golf Genius page; that page's results widget has one
 * expandable leaderboard per division. TGA removes past seasons from its site, so earlier seasons' event lists
 * come from Internet Archive copies of the same page (only to find the links; results are read from Golf Genius).
 */
import type { Frame, Page } from 'playwright-core';
import { parseDateRange } from './hjgt.ts';

/** The live season page plus archived copies covering earlier seasons (Dec 2024, Jun and Oct 2025). */
export const TGA_LIST_PAGES = [
  'https://txga.org/ljt-landing/',
  'https://web.archive.org/web/20251009172713id_/https://txga.org/ljt-landing/',
  'https://web.archive.org/web/20250614141651id_/https://txga.org/ljt-landing/',
  'https://web.archive.org/web/20241206201022id_/https://txga.org/ljt-landing/',
];

export interface TgaListed {
  pageId: string; // Golf Genius /pages/<id>
  name: string;
  startDate: string;
  endDate?: string;
  course?: string;
  city?: string;
}

const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;|&#039;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "Jan. 31 - Feb 1, 2026", "June 29- July 1, 2026", "Feb. 28 - Mar. 1" (year from the season). */
export function parseTgaDates(raw: string, seasonYear: number) {
  let t = raw.replace(/\./g, '').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();
  if (!/\d{4}$/.test(t)) t = `${t}, ${seasonYear}`;
  return parseDateRange(t.replace(/^(\w+) (\d+) - (\d+),/, '$1 $2-$3,'));
}

/** Event rows with a Golf Genius results link from the TGA junior page (live or archived). */
export function parseTgaList(html: string): TgaListed[] {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const parsed = rows.map((r) => ({
    cells: (r.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(text),
    link: r.match(/golfgenius\.com\/pages\/(\d+)/)?.[1],
  }));
  // Rows without a year ("Feb. 28 - Mar. 1") take the year most rows on the page use.
  const years = parsed.flatMap((p) => p.cells.join(' ').match(/\b20\d\d\b/g) ?? []).map(Number);
  const seasonYear = years.sort((a, b) => years.filter((y) => y === b).length - years.filter((y) => y === a).length)[0] ?? new Date().getFullYear();
  const out: TgaListed[] = [];
  for (const { cells, link } of parsed) {
    if (!link || cells.length < 3) continue;
    const dates = parseTgaDates(cells[1], seasonYear);
    if (!dates) continue;
    const name = cells[0].replace(/\s+RESCHEDULE\b/i, '').replace(/\s*[–-]\s*(Open|Major|Invitational)\s*$/i, '').trim();
    // Course and city are separate cells on some pages and "Course | City" or "Course, City" in one on others.
    const [course, cityPart] = cells[2].split(/\s*\|\s*/);
    const city = cityPart ?? (cells.length > 4 && !/results|closed|register|invitation/i.test(cells[3]) ? cells[3] : undefined);
    out.push({ pageId: link, name, startDate: dates.start, endDate: dates.end, course: course || undefined, city: city || undefined });
  }
  return out;
}

export interface TgaRow {
  division: string;
  position: string;
  name: string;
  hometown?: string;
  gradYear?: number;
  toPar: string;
  rounds: number[];
  total?: number;
}

/** The Golf Genius results widget frame on a results page. */
export function resultsFrame(page: Page): Frame | undefined {
  return page.frames().find((f) => f.url().includes('/widgets/tournament_results'));
}

/** Expands every division (final round) in the widget and reads each leaderboard. */
export async function readTgaResults(frame: Frame, expand = true): Promise<TgaRow[]> {
  const count = expand ? await frame.locator('a.expand-tournament').count() : 0;
  for (let i = 0; i < count; i++) {
    await frame.locator('a.expand-tournament').nth(i).click({ timeout: 10_000 }).catch(() => undefined);
    await frame.waitForTimeout(2500);
  }
  return frame.evaluate(() => {
    const rows: {
      division: string;
      position: string;
      name: string;
      hometown?: string;
      gradYear?: number;
      toPar: string;
      rounds: number[];
      total?: number;
    }[] = [];
    const clean = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
    Array.from(document.querySelectorAll('a.expand-tournament')).forEach((a) => {
      const division = clean(a.textContent).replace(/\s*Division$/i, '');
      // Each division's heading and leaderboard share a container.
      const block = a.closest('.tournament_container')?.querySelector('.v2tournament-event');
      if (!block) return;
      Array.from(block.querySelectorAll('tr.aggregate-row')).forEach((tr) => {
        const aff = clean(tr.querySelector('.affiliation')?.textContent);
        const grad = aff.match(/,\s*(\d{4})$/)?.[1];
        const total = clean(tr.querySelector('td.total')?.textContent);
        rows.push({
          division,
          position: clean(tr.querySelector('td.pos')?.textContent),
          name: clean((tr.querySelector('a.open-aggregate-details') ?? tr.querySelector('.player'))?.textContent).replace(/\s*\(a\)$/i, ''),
          hometown: grad ? aff.replace(/,\s*\d{4}$/, '') : aff || undefined,
          gradYear: grad ? Number(grad) : undefined,
          toPar: clean(tr.querySelector('td.score')?.textContent),
          rounds: Array.from(tr.querySelectorAll('td.past_round_total'))
            .map((td) => clean(td.textContent))
            .filter((s) => /^\d+$/.test(s))
            .map(Number),
          total: /^\d+$/.test(total) ? Number(total) : undefined,
        });
      });
    });
    return rows;
  });
}
