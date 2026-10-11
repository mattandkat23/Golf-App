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

/** An event's name and dates, read straight off its leaderboard page (used before the event is finished). */
export function ajgaEventMeta(html: string): { name: string; startDate: string; endDate: string } | undefined {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const name = title ? decode(title.replace(/\s*-\s*\d{4}\s*Leaderboard\s*$/i, '')) : undefined;
  const dates = html.match(/range-start="(\d{4}-\d{2}-\d{2})[^"]*"\s+range-end="(\d{4}-\d{2}-\d{2})/);
  if (!name || !dates) return undefined;
  return { name, startDate: dates[1], endDate: dates[2] };
}

export interface AjgaScorecardLink {
  division: string;
  name: string;
  eventId: string;
  tournamentId: string;
  aggregateId: string;
  memberId: string;
}

/**
 * Every player's scorecard-API link on a leaderboard page: clicking a player's name in the real site opens
 * a modal that fetches /api/scorecard?event_id=&tournament_id=&aggregate_id=&member_id= — these ids are all
 * plain HTML attributes already on the page, no click/JS needed. Only public while the event is in progress;
 * once it's archived the same endpoint asks for an AJGA login instead of returning scores.
 */
export function readAjgaScorecardLinks(html: string): AjgaScorecardLink[] {
  const labels = new Map<string, string>();
  for (const m of html.matchAll(/BottomBorderTabs-tab" href="#(\w+)"[^>]*>([^<]+)</g)) labels.set(m[1], decode(m[2]));

  const panelStarts = [...html.matchAll(/<div class="BottomBorderTabs-panel" id="(\w+)"[^>]*>/g)];
  const out: AjgaScorecardLink[] = [];
  for (let i = 0; i < panelStarts.length; i++) {
    const division = labels.get(panelStarts[i][1]) ?? panelStarts[i][1];
    const panel = html.slice(panelStarts[i].index! + panelStarts[i][0].length, panelStarts[i + 1]?.index ?? html.length);
    const endpoint = panel.match(/data-scorecard-endpoint="https:\/\/www\.ajga\.org\/api\/scorecard\?event_id=(\d+)&amp;tournament_id=(\d+)&amp;team_play=false"/);
    if (!endpoint) continue; // team-play event, or no scorecard data published for this division
    for (const row of panel.matchAll(/<tr class="aggregate-row[^"]*" data-aggregate-id="(\d+)" data-aggregate-name="([^"]*)"[^>]*data-member-ids="(\d+)"/g)) {
      out.push({ division, name: decode(row[2]), eventId: endpoint[1], tournamentId: endpoint[2], aggregateId: row[1], memberId: row[3] });
    }
  }
  return out;
}

/** True once an event's scorecards have gone behind the AJGA-account login wall (i.e. it's been archived). */
export function ajgaScorecardLoginWalled(html: string): boolean {
  return /Login as an AJGA Player or Coach/i.test(html);
}

export interface AjgaHole {
  round: number;
  hole: number;
  par: number;
  yards?: number;
  score: number;
}

const SCORECARD_CELL = /data-cell="([^"]*)"[^>]*>\s*<div[^>]*>\s*<span[^>]*>([^<]*)<\/span>/gs;
// Each round's table numbers holes 1-9 as data-cell "0"-"8", then "out", then holes 10-18 as data-cell "10"-"18" (literal), then "in"/"total".
const holeNumber = (cell: string): number | undefined => {
  if (!/^\d+$/.test(cell)) return undefined;
  const n = Number(cell);
  return n <= 8 ? n + 1 : n;
};

/** Parses a /api/scorecard response into Hole/Par/Yardage/Score for every round played so far. */
export function parseAjgaScorecard(html: string): AjgaHole[] {
  const out: AjgaHole[] = [];
  const panels = [...html.matchAll(/CourseTableScorecardTabs-panel" id="round-(\d+)"/g)];
  for (let p = 0; p < panels.length; p++) {
    const round = Number(panels[p][1]);
    const panel = html.slice(panels[p].index!, panels[p + 1]?.index ?? html.length);
    const rowStarts = [...panel.matchAll(/<tr[^>]*>/g)].map((m) => m.index!);
    const par = new Map<number, number>();
    const yards = new Map<number, number>();
    for (let r = 0; r < rowStarts.length; r++) {
      const row = panel.slice(rowStarts[r], rowStarts[r + 1] ?? panel.length);
      const cells = [...row.matchAll(SCORECARD_CELL)];
      const label = cells[0]?.[2];
      if (label === 'Par') for (const [, cell, text] of cells) { const h = holeNumber(cell); if (h) par.set(h, Number(text)); }
      else if (label === 'Yardage') for (const [, cell, text] of cells) { const h = holeNumber(cell); if (h) yards.set(h, Number(text)); }
      else if (label === 'Score') {
        for (const [, cell, text] of cells) {
          const h = holeNumber(cell);
          if (!h || !/^\d+$/.test(text.trim())) continue; // blank: hole not played yet
          out.push({ round, hole: h, par: par.get(h) ?? 0, yards: yards.get(h), score: Number(text) });
        }
      }
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
