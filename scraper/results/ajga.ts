/**
 * AJGA (American Junior Golf Association) results, nationwide. Both the completed-events list and each
 * event's leaderboard are fully server-rendered (www.ajga.org), so a plain fetch() works for both — no
 * browser needed. The completed-events page paginates through a query parameter named after the page's own
 * content id (printed in its `data-page-parameter` attribute, stable across requests); each later page goes
 * further back into the season, most recently finished first.
 */
import { USER_AGENT, allowed } from '../polite.ts';

export interface AjgaListed {
  id: string; // '2026135', or '2026127q' for a qualifier
  name: string;
  startDate: string;
  endDate: string;
  course?: string;
  city?: string; // 'Ponte Vedra Beach, FL'
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;|&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Rows from a www.ajga.org/schedule/<year>/completed page (any page of its pagination). */
export function parseAjgaScheduleList(html: string): AjgaListed[] {
  const rows = html.match(/<tr class="ScheduleRow"[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const out: AjgaListed[] = [];
  for (const row of rows) {
    if (!/ScheduleRow-results/.test(row)) continue; // no leaderboard link yet
    const dates = row.match(/range-start="(\d{4}-\d{2}-\d{2})[^"]*"\s+range-end="(\d{4}-\d{2}-\d{2})/);
    const link = row.match(/\/tournaments\/(\w+)" data-cms-ai="0">([^<]+)<\/a>/);
    if (!dates || !link) continue;
    const course = decode(row.match(/ScheduleRow-description">([\s\S]*?)<\/div>/)?.[1] ?? '') || undefined;
    const city = decode(row.match(/ScheduleRow-location">([\s\S]*?)<\/td>/)?.[1] ?? '') || undefined;
    out.push({ id: link[1], name: decode(link[2]), startDate: dates[1], endDate: dates[2], course, city });
  }
  return out;
}

/** The query parameter name this completed-events page paginates with (its own content id), if any. */
export function pageParameter(html: string): string | undefined {
  return html.match(/data-page-parameter="([^"]+)"/)?.[1];
}

export interface AjgaRow {
  division: string;
  position: string;
  name: string;
  hometown?: string;
  gradYear?: number;
  toPar: string;
  rounds: number[];
  total?: number;
}

/** Every division's leaderboard table on a www.ajga.org/tournaments/<id>/leaderboard page. */
export function readAjgaLeaderboard(html: string): AjgaRow[] {
  const labels = new Map<string, string>();
  for (const m of html.matchAll(/BottomBorderTabs-tab" href="#(\w+)"[^>]*>([^<]+)</g)) labels.set(m[1], decode(m[2]));

  const panelStarts = [...html.matchAll(/<div class="BottomBorderTabs-panel" id="(\w+)"[^>]*>/g)];
  const out: AjgaRow[] = [];
  for (let i = 0; i < panelStarts.length; i++) {
    const division = labels.get(panelStarts[i][1]) ?? panelStarts[i][1];
    const panel = html.slice(panelStarts[i].index! + panelStarts[i][0].length, panelStarts[i + 1]?.index ?? html.length);
    for (const row of panel.match(/<tr class="aggregate-row[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
      const name = row.match(/<a class="Link" href="\/tournaments2\/details\/\d+"[^>]*>([^<]+)<\/a>/)?.[1];
      if (!name) continue;
      const aff = decode(row.match(/<div class="affiliation">([^<]*)<\/div>/)?.[1] ?? '');
      const grad = aff.match(/\((\d{4})\)\s*$/)?.[1];
      const total = decode(row.match(/<td class="[^"]*\btotal\b[^"]*"[^>]*>([^<]*)<\/td>/)?.[1] ?? '');
      out.push({
        division,
        position: decode(row.match(/<td class="pos"[^>]*>([^<]*)<\/td>/)?.[1] ?? ''),
        name: decode(name).replace(/\s*\(a\)$/i, ''),
        hometown: (grad ? aff.replace(/\s*\(\d{4}\)\s*$/, '') : aff) || undefined,
        gradYear: grad ? Number(grad) : undefined,
        toPar: decode(row.match(/<td class="[^"]*\bscore\b[^"]*"[^>]*>([^<]*)<\/td>/)?.[1] ?? ''),
        rounds: [...row.matchAll(/score_to_print">(\d+)<\/div>/g)].map((m) => Number(m[1])),
        total: /^\d+$/.test(total) ? Number(total) : undefined,
      });
    }
  }
  return out;
}

/** Fetches a page respecting robots.txt; returns undefined (and logs) if disallowed or unreachable. */
export async function politeFetch(url: string): Promise<string | undefined> {
  if (!(await allowed(url))) {
    console.log(`  robots.txt disallows ${url}, skipped`);
    return undefined;
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } }).catch(() => undefined);
  if (!res?.ok) {
    console.log(`  couldn't read ${url} (${res?.status ?? 'network error'})`);
    return undefined;
  }
  return res.text();
}
