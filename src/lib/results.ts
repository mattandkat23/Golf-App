/**
 * Past tournament results from the results database (collected from tour websites by scraper/results):
 * searching by name and adding the ones a parent confirms to a golfer's Past events, with rounds that count in stats.
 */
import { supabase } from './supabase';
import { db } from './db';
import { matchCourse, regionForCity } from './courseMatch';
import { nameKey } from '../../scraper/results/names';
import type { HoleResult, Profile, Round, TourLevel, Tournament } from './types';

export interface ResultHit {
  result_id: number;
  event_id: string;
  tour_id: string;
  event_name: string;
  start_date: string;
  end_date: string | null;
  course_name: string | null;
  city: string | null;
  url: string | null;
  num_rounds: number | null;
  holes_per_round: number | null;
  division: string;
  position: string | null;
  pos_num: number | null;
  field_size: number | null;
  player_name: string;
  hometown: string | null;
  grad_year: number | null;
  to_par: number | null;
  total: number | null;
  round_scores: number[] | null;
  points: number | null;
  has_holes: boolean;
  similarity: number;
}

/** One hole of an imported scorecard (results_holes). */
export interface ResultHole {
  round: number;
  hole: number;
  par?: number;
  yards?: number;
  score: number;
}

export const sourceId = (h: { event_id: string }) => `result:${h.event_id}`;

export async function searchResults(name: string): Promise<ResultHit[]> {
  const key = nameKey(name);
  if (key.length < 5 || !key.includes(' ')) throw new Error('Enter a first and last name.');
  const { data, error } = await supabase.rpc('search_results', { key });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResultHit[];
}

/** The state from a hometown like "Woodway, TX" (or "Woodway, TX - UNITED STATES"). */
export const homeState = (hometown: string | null) => hometown?.match(/,\s*([A-Z]{2})\b/)?.[1] ?? '';

export interface PlayerGroup {
  label: string;
  hits: ResultHit[];
}

/**
 * Groups search hits into "probably the same player": the same name from the same state. A parent still
 * confirms each result, so a group only orders the list; it never decides.
 */
export function groupHits(hits: ResultHit[]): PlayerGroup[] {
  const groups = new Map<string, ResultHit[]>();
  for (const h of hits) {
    const k = `${nameKey(h.player_name)}|${homeState(h.hometown)}`;
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  return [...groups.values()]
    .map((hs) => {
      const towns = [...new Set(hs.map((h) => h.hometown?.replace(/\s*-\s*UNITED STATES$/i, '')).filter(Boolean))];
      return { label: `${hs[0].player_name}${towns.length ? ` · ${towns.slice(0, 3).join(', ')}` : ''}`, hits: hs.sort((a, b) => b.start_date.localeCompare(a.start_date)) };
    })
    .sort((a, b) => b.hits.length - a.hits.length);
}

const LEVELS: Record<string, TourLevel> = { 'usk-state': 'State', 'usk-regional': 'Regional', 'usk-world': 'World' };
const levelFor = (tourId: string): TourLevel => LEVELS[tourId] ?? (tourId.startsWith('usk-') ? 'Local' : 'Other');

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Builds the rounds for a result: hole-by-hole when the tour published it, otherwise round totals. */
export function roundsFor(hit: ResultHit, golferId: string, holes: ResultHole[] | null): Omit<Round, 'tournamentId' | 'courseId'>[] {
  const scores = hit.round_scores?.length ? hit.round_scores : hit.total !== null ? [hit.total] : [];
  const perRound = hit.holes_per_round ?? (holes?.length ? Math.max(...holes.map((h) => h.hole)) : 18);
  const numHoles: 9 | 18 = perRound <= 9 ? 9 : 18;
  // Par per round from score to par, when the tour gives it.
  const coursePar = hit.to_par !== null && hit.total !== null && scores.length ? (hit.total - hit.to_par) / scores.length : undefined;
  return scores.map((total, i) => {
    const mine = holes?.filter((h) => h.round === i + 1) ?? [];
    const holeList: HoleResult[] = Array.from({ length: numHoles }, (_, j) => {
      const h = mine.find((x) => x.hole === j + 1);
      return { hole: j + 1, par: h?.par ?? 4, yards: h?.yards, shots: [], score: h?.score || undefined };
    });
    const parSum = mine.length === numHoles && mine.every((h) => h.par) ? mine.reduce((n, h) => n + h.par!, 0) : undefined;
    return {
      golferId,
      date: hit.end_date ? [addDays(hit.start_date, i), hit.end_date].sort()[0] : addDays(hit.start_date, i),
      roundNumber: i + 1,
      numHoles,
      holes: holeList,
      total,
      par: parSum ?? (coursePar !== undefined ? Math.round(coursePar) : undefined),
      complete: true,
    };
  });
}

/** Adds confirmed results to a golfer's Past events. Skips any already added. Returns how many were added. */
export async function importResults(hits: ResultHit[], golfer: Profile): Promise<number> {
  let added = 0;
  for (const hit of hits) {
    const existing = await db.tournaments.where('golferId').equals(golfer.id).filter((t) => t.sourceEventId === sourceId(hit)).first();
    if (existing) continue;
    let holes: ResultHole[] | null = null;
    if (hit.has_holes) {
      const { data } = await supabase.rpc('result_holes', { result_id: hit.result_id });
      holes = (data as ResultHole[] | null) ?? null;
    }
    let courseId: number | undefined;
    if (hit.course_name) {
      const course = matchCourse(await db.courses.toArray(), hit.course_name, hit.city ?? undefined);
      courseId = course?.id ?? (await db.courses.add({ name: hit.course_name, city: hit.city ?? '', region: hit.city ? regionForCity(hit.city) : 'Other Texas', tees: [] }));
    }
    const t: Tournament = {
      golferId: golfer.id,
      name: hit.event_name,
      level: levelFor(hit.tour_id),
      tourId: (await db.tours.get(hit.tour_id)) ? hit.tour_id : undefined,
      sourceEventId: sourceId(hit),
      courseId,
      startDate: hit.start_date,
      endDate: hit.end_date && hit.end_date !== hit.start_date ? hit.end_date : undefined,
      status: 'Played',
      ageGroup: hit.division || undefined,
      finish: hit.pos_num ?? undefined,
      fieldSize: hit.field_size ?? undefined,
      url: hit.url ?? undefined,
      notes: hit.pos_num === null && hit.position ? `Result: ${hit.position}` : undefined,
    };
    await db.transaction('rw', db.tournaments, db.rounds, async () => {
      const tournamentId = await db.tournaments.add(t);
      await db.rounds.bulkAdd(roundsFor(hit, golfer.id, holes).map((r) => ({ ...r, tournamentId, courseId })));
    });
    added++;
  }
  return added;
}

/** Holes for a new round: the course's tee pars when one matches the hole count, else par 4s. */
async function blankHoles(courseId: number | undefined, numHoles: 9 | 18): Promise<HoleResult[]> {
  const course = courseId ? await db.courses.get(courseId) : undefined;
  const tee = course?.tees.find((t) => t.pars.length === numHoles);
  return Array.from({ length: numHoles }, (_, i) => ({ hole: i + 1, par: tee?.pars[i] ?? 4, yards: tee?.yardages?.[i], shots: [] }));
}

/**
 * Saves a pasted result row to a tournament: finish, field size and one round per round score. Rounds the
 * parent already scored hole by hole keep their holes; their pasted total is stored alongside.
 */
export async function applyPastedResult(
  t: Tournament,
  row: { posNum?: number; position: string; toPar?: number; rounds: number[]; total?: number },
  fieldSize: number,
) {
  const existing = await db.rounds.where('tournamentId').equals(t.id!).toArray();
  const coursePar = row.toPar !== undefined && row.total !== undefined && row.rounds.length ? (row.total - row.toPar) / row.rounds.length : undefined;
  await db.transaction('rw', db.tournaments, db.rounds, db.courses, async () => {
    await db.tournaments.update(t.id!, {
      status: 'Played',
      finish: row.posNum,
      fieldSize,
      notes: row.posNum === undefined ? [t.notes, `Result: ${row.position}`].filter(Boolean).join(' · ') : t.notes,
    });
    for (const [i, total] of row.rounds.entries()) {
      const par = coursePar !== undefined ? Math.round(coursePar) : undefined;
      const r = existing.find((x) => x.roundNumber === i + 1);
      if (r) {
        await db.rounds.update(r.id!, { total, par: par ?? r.par, complete: true });
        continue;
      }
      const numHoles: 9 | 18 = par !== undefined ? (par <= 45 ? 9 : 18) : (existing[0]?.numHoles ?? 18);
      await db.rounds.add({
        golferId: t.golferId,
        tournamentId: t.id,
        courseId: t.courseId,
        date: t.endDate ? [addDays(t.startDate, i), t.endDate].sort()[0] : addDays(t.startDate, i),
        roundNumber: i + 1,
        numHoles,
        holes: await blankHoles(t.courseId, numHoles),
        total,
        par,
        complete: true,
      });
    }
  });
}
