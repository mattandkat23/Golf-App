/**
 * Collects past tournament results into the results database (run by .github/workflows/results.yml).
 * Every request respects robots.txt (scraper/polite.ts) — a browser for HJGT/TGA (blocks whatever it disallows),
 * plain fetch() for AJGA, whose pages are fully server-rendered. Finished events are read once; events from
 * the last few days are re-read in case results were corrected.
 *
 * Usage: SUPABASE_SECRET_KEY=... node --experimental-strip-types scraper/results/collect.ts [hjgt|tga|ajga] [--since=YYYY-MM-DD]
 */
import { createClient } from '@supabase/supabase-js';
import { chromium, type Page } from 'playwright-core';
import { USER_AGENT, allowed, blockDisallowed } from '../polite.ts';
import { displayName, nameKey } from './names.ts';
import { HJGT_BASE, HJGT_SEASONS, divisions, parseHjgtList, readLeaderboard, type HjgtListed, type HjgtRow } from './hjgt.ts';
import { TGA_LIST_PAGES, parseTgaList, readTgaResults, resultsFrame, type TgaListed } from './tga.ts';
import {
  ajgaEventMeta,
  ajgaScorecardLoginWalled,
  parseAjgaScheduleList,
  parseAjgaScorecard,
  pageParameter,
  politeFetch,
  readAjgaLeaderboard,
  readAjgaScorecardLinks,
  type AjgaListed,
} from './ajga.ts';

const SUPABASE_URL = 'https://jcqvzumkfmbksduzdrbx.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');
const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const today = new Date().toISOString().slice(0, 10);
const twoYearsAgo = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10);
const since = args.find((a) => a.startsWith('--since='))?.slice(8) ?? twoYearsAgo;
const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8) ?? 400);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 864e5;

interface EventRow {
  id: string;
  tour_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  course_name: string | null;
  city: string | null;
  url: string | null;
  num_rounds: number | null;
  holes_per_round: number | null;
}
interface ResultRow {
  event_id: string;
  division: string;
  position: string | null;
  pos_num: number | null;
  field_size: number;
  player_name: string;
  name_key: string;
  hometown: string | null;
  grad_year: number | null;
  to_par: number | null;
  total: number | null;
  round_scores: number[] | null;
  points: number | null;
  holes?: unknown[] | null; // optional hole-by-hole (AJGA opt-in live tracking only); see ajga_hole_requests
}

/** Event ids already collected long enough after they ended that their results are final. */
async function finishedIds(tourId: string): Promise<Set<string>> {
  const { data, error } = await db.from('result_events').select('id, end_date, start_date, collected_at').eq('tour_id', tourId);
  if (error) throw new Error(`reading result_events: ${error.message}`);
  return new Set(data.filter((e) => daysBetween(e.end_date ?? e.start_date, e.collected_at.slice(0, 10)) >= 3).map((e) => e.id));
}

async function save(event: EventRow, results: ResultRow[]) {
  // Same player listed twice in a division (rare): keep the first.
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const k = `${r.division}|${r.name_key}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const e1 = await db.from('result_events').upsert({ ...event, collected_at: new Date().toISOString() });
  if (e1.error) throw new Error(`saving event ${event.id}: ${e1.error.message}`);
  const e2 = await db.from('results').delete().eq('event_id', event.id);
  if (e2.error) throw new Error(`clearing results ${event.id}: ${e2.error.message}`);
  for (let i = 0; i < unique.length; i += 500) {
    const e3 = await db.from('results').insert(unique.slice(i, i + 500));
    if (e3.error) throw new Error(`saving results ${event.id}: ${e3.error.message}`);
  }
}

const toParNum = (s: string) => (/^E$/i.test(s) ? 0 : /^[+-]?\d+$/.test(s) ? Number(s) : null);
const posNum = (s: string) => (/^T?\d+$/i.test(s) ? Number(s.replace(/^T/i, '')) : null);

/* ---------------------------------- HJGT ---------------------------------- */

async function hjgtList(page: Page): Promise<HjgtListed[]> {
  await page.goto(`${HJGT_BASE}/Tournament/Results`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const all: HjgtListed[] = [];
  for (const [year, season] of Object.entries(HJGT_SEASONS)) {
    if (`${year}-12-31` < since || `${year}-01-01` > today) continue;
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
      // The same search the page's season picker runs, from inside the page (with its form token).
      const content = await page.evaluate(
        async ({ season, pageIndex }) => {
          const token = (document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null)?.value ?? '';
          const body = new URLSearchParams({ __RequestVerificationToken: token, PageIndex: String(pageIndex), PageSize: '100', 'SearchForm.SeasonSelected': season });
          const res = await fetch('/tournament/TournamentResultSearch', { method: 'POST', body, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          return res.ok ? ((await res.json()) as { Content?: string }).Content ?? '' : '';
        },
        { season, pageIndex },
      );
      const listed = parseHjgtList(content);
      all.push(...listed);
      if (listed.length < 100) break;
      await pause(3000);
    }
  }
  return all;
}

async function hjgtEvent(page: Page, ev: HjgtListed): Promise<{ event: EventRow; results: ResultRow[] }> {
  const url = `${HJGT_BASE}/Scoreboard?TournamentID=${ev.id}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('table#leaderboard tbody tr', { timeout: 30_000 }).catch(() => undefined);
  const results: ResultRow[] = [];
  let maxRounds = 0;
  const divs = await divisions(page);
  for (const d of divs.length ? divs : [{ label: '', id: '' }]) {
    if (d.id) {
      const before = await page.$eval('table#leaderboard tbody', (t) => t.textContent).catch(() => '');
      await page.click(`button.tournamentdivisionbutton[data-id="${d.id}"]`);
      await page.waitForFunction((prev) => document.querySelector('table#leaderboard tbody')?.textContent !== prev, before, { timeout: 15_000 }).catch(() => undefined);
      await pause(800);
    }
    const rows: HjgtRow[] = await readLeaderboard(page);
    for (const r of rows) {
      if (!r.name) continue;
      const rounds = r.rounds.filter((x): x is number => x !== null);
      maxRounds = Math.max(maxRounds, rounds.length);
      results.push({
        event_id: `hjgt:${ev.id}`,
        division: d.label,
        position: r.position || null,
        pos_num: posNum(r.position),
        field_size: rows.length,
        player_name: displayName(r.name),
        name_key: nameKey(r.name),
        hometown: r.hometown ?? null,
        grad_year: r.gradYear ?? null,
        to_par: toParNum(r.toPar),
        total: r.strokes ?? (rounds.length ? rounds.reduce((a, b) => a + b, 0) : null),
        round_scores: rounds.length ? rounds : null,
        points: null,
      });
    }
  }
  return {
    event: {
      id: `hjgt:${ev.id}`,
      tour_id: 'hjgt',
      name: ev.name,
      start_date: ev.startDate,
      end_date: ev.endDate ?? null,
      course_name: ev.course ?? null,
      city: ev.city || null,
      url,
      num_rounds: maxRounds || null,
      holes_per_round: null, // varies by division; the app works it out from score to par
    },
    results,
  };
}

async function collectHjgt(page: Page) {
  const listed = (await hjgtList(page)).filter((e) => /, TX$/.test(e.city) && e.startDate >= since);
  const done = await finishedIds('hjgt');
  const todo = listed.filter((e) => (e.endDate ?? e.startDate) < today && !/progress|upcoming|register/i.test(e.status) && !done.has(`hjgt:${e.id}`));
  console.log(`HJGT: ${listed.length} Texas events since ${since}, ${todo.length} to read`);
  let n = 0;
  for (const ev of todo.slice(0, limit)) {
    try {
      const { event, results } = await hjgtEvent(page, ev);
      if (!results.length) console.log(`  ${ev.startDate} ${ev.name}: no results shown, skipped`);
      else {
        await save(event, results);
        console.log(`  ${ev.startDate} ${ev.name}: ${results.length} results`);
        n++;
      }
    } catch (e) {
      console.log(`  ${ev.startDate} ${ev.name}: failed (${(e as Error).message})`);
    }
    await pause(4000); // polite pace
  }
  console.log(`HJGT: saved ${n} events`);
}

/* ----------------------------------- TGA ----------------------------------- */

async function tgaList(): Promise<TgaListed[]> {
  const byPage = new Map<string, TgaListed>();
  for (const url of TGA_LIST_PAGES) {
    if (!(await allowed(url))) {
      console.log(`  robots.txt disallows ${url}, skipped`);
      continue;
    }
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } }).catch(() => undefined);
    if (!res?.ok) {
      console.log(`  couldn't read ${url} (${res?.status ?? 'network error'})`);
      continue;
    }
    for (const ev of parseTgaList(await res.text())) if (!byPage.has(ev.pageId)) byPage.set(ev.pageId, ev); // live page first
    await pause(3000);
  }
  return [...byPage.values()];
}

async function tgaEvent(page: Page, ev: TgaListed): Promise<{ event: EventRow; results: ResultRow[] }> {
  const url = `https://www.golfgenius.com/pages/${ev.pageId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  let frame = resultsFrame(page);
  for (let i = 0; i < 20 && !frame; i++) {
    await pause(1000);
    frame = resultsFrame(page);
  }
  if (!frame) return { event: undefined as never, results: [] };
  await frame.waitForSelector('a.expand-tournament', { timeout: 20_000 }).catch(() => undefined);
  const rows = await readTgaResults(frame);
  const sizes = rows.reduce((m, r) => m.set(r.division, (m.get(r.division) ?? 0) + 1), new Map<string, number>());
  const results: ResultRow[] = rows
    .filter((r) => r.name)
    .map((r) => ({
      event_id: `tga:${ev.pageId}`,
      division: r.division,
      position: r.position || null,
      pos_num: posNum(r.position),
      field_size: sizes.get(r.division) ?? rows.length,
      player_name: displayName(r.name),
      name_key: nameKey(r.name),
      hometown: r.hometown ?? null,
      grad_year: r.gradYear ?? null,
      to_par: toParNum(r.toPar),
      total: r.total ?? null,
      round_scores: r.rounds.length ? r.rounds : null,
      points: null,
    }));
  return {
    event: {
      id: `tga:${ev.pageId}`,
      tour_id: 'tga-ljt',
      name: ev.name,
      start_date: ev.startDate,
      end_date: ev.endDate ?? null,
      course_name: ev.course ?? null,
      city: ev.city ? `${ev.city}, TX` : null,
      url,
      num_rounds: Math.max(0, ...rows.map((r) => r.rounds.length)) || null,
      holes_per_round: 18,
    },
    results,
  };
}

async function collectTga(page: Page) {
  const listed = (await tgaList()).filter((e) => e.startDate >= since);
  const done = await finishedIds('tga-ljt');
  const todo = listed.filter((e) => (e.endDate ?? e.startDate) < today && (!done.has(`tga:${e.pageId}`) || /match play/i.test(e.name)));
  console.log(`TGA: ${listed.length} junior events since ${since}, ${todo.length} to read`);
  let n = 0;
  for (const ev of todo.slice(0, limit)) {
    try {
      const { event, results } = await tgaEvent(page, ev);
      // Match play (and pages without a leaderboard) have no round scores to keep.
      if (results.filter((r) => r.round_scores).length < Math.max(3, results.length / 2)) {
        await db.from('result_events').delete().eq('id', `tga:${ev.pageId}`);
        console.log(`  ${ev.startDate} ${ev.name}: no stroke-play results shown, skipped`);
      }
      else {
        await save(event, results);
        console.log(`  ${ev.startDate} ${ev.name}: ${results.length} results`);
        n++;
      }
    } catch (e) {
      console.log(`  ${ev.startDate} ${ev.name}: failed (${(e as Error).message})`);
    }
    await pause(4000);
  }
  console.log(`TGA: saved ${n} events`);
}

/* ---------------------------------- AJGA ---------------------------------- */

async function ajgaList(): Promise<AjgaListed[]> {
  const startYear = Number(since.slice(0, 4));
  const endYear = Number(today.slice(0, 4));
  const all: AjgaListed[] = [];
  for (let year = endYear; year >= startYear; year--) {
    const base = `https://www.ajga.org/schedule/${year}/completed`;
    const first = await politeFetch(base);
    if (!first) continue;
    all.push(...parseAjgaScheduleList(first));
    const param = pageParameter(first);
    for (let page = 2; param && page <= 30; page++) {
      await pause(2000);
      const html = await politeFetch(`${base}?${param}=${page}`);
      if (!html) break;
      const rows = parseAjgaScheduleList(html);
      if (!rows.length) break;
      all.push(...rows);
      if (rows[rows.length - 1].startDate < since) break;
    }
    await pause(3000);
  }
  return all;
}

function ajgaEvent(ev: AjgaListed, html: string): { event: EventRow; results: ResultRow[] } {
  const rows = readAjgaLeaderboard(html);
  const results: ResultRow[] = rows
    .filter((r) => r.name)
    .map((r) => ({
      event_id: `ajga:${ev.id}`,
      division: r.division,
      position: r.position || null,
      pos_num: posNum(r.position),
      field_size: rows.filter((x) => x.division === r.division).length,
      player_name: displayName(r.name),
      name_key: nameKey(r.name),
      hometown: r.hometown ?? null,
      grad_year: r.gradYear ?? null,
      to_par: toParNum(r.toPar),
      total: r.total ?? (r.rounds.length ? r.rounds.reduce((a, b) => a + b, 0) : null),
      round_scores: r.rounds.length ? r.rounds : null,
      points: null,
    }));
  return {
    event: {
      id: `ajga:${ev.id}`,
      tour_id: 'ajga',
      name: ev.name,
      start_date: ev.startDate,
      end_date: ev.endDate,
      course_name: ev.course ?? null,
      city: ev.city ?? null,
      url: `https://www.ajga.org/tournaments/${ev.id}/leaderboard`,
      num_rounds: Math.max(0, ...rows.map((r) => r.rounds.length)) || null,
      holes_per_round: 18,
    },
    results,
  };
}

async function collectAjga() {
  const listed = (await ajgaList()).filter((e) => e.startDate >= since);
  const done = await finishedIds('ajga');
  const todo = listed.filter((e) => e.endDate < today && !done.has(`ajga:${e.id}`));
  console.log(`AJGA: ${listed.length} events since ${since}, ${todo.length} to read`);
  let n = 0;
  for (const ev of todo.slice(0, limit)) {
    try {
      const html = await politeFetch(`https://www.ajga.org/tournaments/${ev.id}/leaderboard`);
      if (!html) continue;
      const { event, results } = ajgaEvent(ev, html);
      if (!results.length) console.log(`  ${ev.startDate} ${ev.name}: no results shown, skipped`);
      else {
        // Carry over any hole-by-hole already collected live (collectAjgaLive) before this overwrites the event's rows.
        const { data: existingHoles } = await db.from('results').select('name_key, holes').eq('event_id', event.id).not('holes', 'is', null);
        if (existingHoles?.length) {
          const byKey = new Map(existingHoles.map((r) => [r.name_key, r.holes]));
          for (const r of results) if (byKey.has(r.name_key)) r.holes = byKey.get(r.name_key);
        }
        await save(event, results);
        console.log(`  ${ev.startDate} ${ev.name}: ${results.length} results`);
        n++;
      }
    } catch (e) {
      console.log(`  ${ev.startDate} ${ev.name}: failed (${(e as Error).message})`);
    }
    await pause(4000); // polite pace
  }
  console.log(`AJGA: saved ${n} events`);
}

/**
 * Hole-by-hole for golfers a parent opted into (ajga_hole_requests): AJGA only publishes scorecards while
 * an event is in progress (archived events ask for an AJGA account login instead), so this has to run
 * daily while the event is live rather than waiting for it to finish like collectAjga() above.
 */
async function collectAjgaLive() {
  const { data: requests, error } = await db.from('ajga_hole_requests').select('golfer_name, tournament_id');
  if (error) {
    console.log(`AJGA live: couldn't read ajga_hole_requests (${error.message})`);
    return;
  }
  if (!requests?.length) {
    console.log('AJGA live: no opt-in requests');
    return;
  }
  const byTournament = new Map<string, { golfer_name: string }[]>();
  for (const r of requests) byTournament.set(r.tournament_id, [...(byTournament.get(r.tournament_id) ?? []), r]);
  console.log(`AJGA live: ${requests.length} opt-in request(s) across ${byTournament.size} tournament(s)`);
  for (const [tournamentId, reqs] of byTournament) {
    const url = `https://www.ajga.org/tournaments/${tournamentId}/leaderboard`;
    const html = await politeFetch(url);
    if (!html) continue;
    const eventId = `ajga:${tournamentId}`;
    const { data: existingEvent } = await db.from('result_events').select('id').eq('id', eventId).maybeSingle();
    if (!existingEvent) {
      const meta = ajgaEventMeta(html);
      if (!meta) {
        console.log(`  ${tournamentId}: couldn't read the event's name/dates yet, skipped`);
        continue;
      }
      const e1 = await db
        .from('result_events')
        .insert({ id: eventId, tour_id: 'ajga', name: meta.name, start_date: meta.startDate, end_date: meta.endDate, url, holes_per_round: 18, collected_at: new Date().toISOString() });
      if (e1.error) {
        console.log(`  ${tournamentId}: couldn't create its event row (${e1.error.message})`);
        continue;
      }
    }
    const links = readAjgaScorecardLinks(html);
    for (const req of reqs) {
      const key = nameKey(req.golfer_name);
      const link = links.find((l) => nameKey(l.name) === key);
      if (!link) {
        console.log(`  ${tournamentId}: no leaderboard row yet for ${req.golfer_name}`);
        continue;
      }
      await pause(2000); // polite pace between the per-player scorecard requests
      const scorecardUrl = `https://www.ajga.org/api/scorecard?event_id=${link.eventId}&tournament_id=${link.tournamentId}&team_play=false&aggregate_id=${link.aggregateId}&member_id=${link.memberId}`;
      const scorecardHtml = await politeFetch(scorecardUrl);
      if (!scorecardHtml) continue;
      if (ajgaScorecardLoginWalled(scorecardHtml)) {
        console.log(`  ${tournamentId}: ${req.golfer_name}'s scorecard is login-walled now (event's gone final)`);
        continue;
      }
      const holes = parseAjgaScorecard(scorecardHtml);
      if (!holes.length) {
        console.log(`  ${tournamentId}: ${req.golfer_name} hasn't teed off yet`);
        continue;
      }
      const e2 = await db
        .from('results')
        .upsert({ event_id: eventId, division: link.division, player_name: displayName(link.name), name_key: key, holes }, { onConflict: 'event_id,division,name_key' });
      if (e2.error) console.log(`  ${tournamentId}: couldn't save ${req.golfer_name}'s holes (${e2.error.message})`);
      else console.log(`  ${tournamentId}: saved ${holes.length} holes for ${req.golfer_name}`);
    }
    await pause(3000);
  }
}

/* ---------------------------------------------------------------------------- */

if (!only || only === 'ajga') {
  await collectAjgaLive(); // plain fetch, no browser needed
  await collectAjga();
}

if (!only || only === 'hjgt' || only === 'tga') {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const blocked = await blockDisallowed(context);
    const page = await context.newPage();
    if (!only || only === 'hjgt') await collectHjgt(page);
    if (!only || only === 'tga') await collectTga(page);
    if (blocked.length) console.log(`Blocked by robots.txt (not loaded): ${[...new Set(blocked.map((u) => new URL(u).origin + new URL(u).pathname))].slice(0, 20).join(', ')}`);
  } finally {
    await browser.close();
  }
}
