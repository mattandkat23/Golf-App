import type { Contact, EndLie, HoleResult, Lie, Miss, Round, Shot, ShotType } from './types';

/** Whether a round is entered shot by shot (rounds from before basic entry existed have shots). */
export const isDetailed = (r: Round) => r.detailed ?? r.holes.some((h) => h.shots.length > 0);

export const LEAVE_BUCKETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
export const bucketLabel = (ft: number) => (ft >= 60 ? '60+ ft' : `${ft}–${ft + 5} ft`);
/** Representative distance for a bucket, used for averages. */
const bucketMid = (ft: number) => (ft >= 60 ? 65 : ft + 2.5);

export const CONTACTS: Contact[] = ['Center', 'Heel', 'Toe', 'Fat', 'Thin'];
export const MISSES: Miss[] = ['Left', 'Right', 'Short', 'Long'];

const onGreen = (l?: EndLie) => l === 'Green' || l === 'Holed';

const hasShots = (h: HoleResult) => h.shots.length > 0;

export function holeStrokes(h: HoleResult): number {
  return hasShots(h) ? h.shots.reduce((n, s) => n + 1 + (s.penalty ?? 0), 0) : (h.score ?? 0);
}

/** Putts on the hole, or undefined when a basic-entry hole didn't record them. */
export function holePutts(h: HoleResult): number | undefined {
  return hasShots(h) ? h.shots.filter((s) => s.type === 'Putt').length : h.putts;
}

export function holeComplete(h: HoleResult): boolean {
  return hasShots(h) ? h.shots.at(-1)?.endLie === 'Holed' : h.score !== undefined;
}

/** Stroke count (incl. penalties) at which the ball first reached the green, or undefined. */
function strokesToGreen(h: HoleResult): number | undefined {
  let n = 0;
  for (const s of h.shots) {
    n += 1 + (s.penalty ?? 0);
    if (onGreen(s.endLie)) return n;
  }
  return undefined;
}

/** Green in regulation, or undefined when a basic-entry hole doesn't say and has no putts to work it out from. */
export function isGIR(h: HoleResult): boolean | undefined {
  if (!hasShots(h)) {
    if (h.gir !== undefined) return h.gir;
    return h.score !== undefined && h.putts !== undefined ? h.score - h.putts <= h.par - 2 : undefined;
  }
  const n = strokesToGreen(h);
  return n !== undefined && n <= h.par - 2;
}

export type FairwayResult = 'Hit' | 'Left' | 'Right' | 'Missed' | undefined;

export function fairwayResult(h: HoleResult): FairwayResult {
  if (h.par < 4) return undefined;
  if (!hasShots(h)) return h.fairway;
  const tee = h.shots[0];
  if (!tee?.endLie) return undefined;
  if (tee.endLie === 'Fairway' || tee.endLie === 'Green' || tee.endLie === 'Holed') return 'Hit';
  if (tee.miss?.includes('Left')) return 'Left';
  if (tee.miss?.includes('Right')) return 'Right';
  return 'Missed';
}

/** Suggest a shot type from where the ball is, the hole's par and the previous shot. */
export function inferShotType(startLie: Lie, par: number, index: number, prev?: Shot): ShotType {
  if (startLie === 'Green') return 'Putt';
  if (index === 0) return par >= 4 ? 'Tee' : 'Approach';
  if (startLie === 'Fringe') return 'Short game';
  if (prev && (prev.type === 'Approach' || prev.type === 'Short game') && prev.miss?.length && startLie !== 'Recovery') {
    return 'Short game';
  }
  return 'Approach';
}

/** Lie the next shot is played from, given how the previous one ended. */
export function nextStartLie(prev?: Shot): Lie {
  if (!prev) return 'Tee';
  switch (prev.endLie) {
    case undefined:
    case 'Holed':
      return 'Fairway';
    case 'Penalty':
      return 'Rough';
    default:
      return prev.endLie;
  }
}

/* ----------------------------- aggregate stats ----------------------------- */

export interface Rate {
  made: number;
  total: number;
}
export const pct = (r: Rate) => (r.total ? Math.round((100 * r.made) / r.total) : undefined);

export interface Stats {
  rounds: number;
  holes: number;
  scoringAvg18?: number; // strokes per 18 holes
  toParPer18?: number;
  byPar: Record<3 | 4 | 5, { avg?: number; holes: number }>;
  fairways: Rate;
  fairwayMiss: Record<'Left' | 'Right' | 'Missed', number>;
  gir: Rate;
  /** Holes with putts recorded (basic-entry holes may leave them out). */
  puttHoles: number;
  puttsPerHole?: number;
  puttsPer18?: number;
  threePutts: number;
  scrambling: Rate;
  sandSaves: Rate;
  penalties: number;
  approachProximityFt?: number;
  approachGreens: Rate;
  approachMiss: Record<Miss, number>;
  teeMiss: Record<Miss, number>;
  contact: Record<Contact, number>;
  contactByClub: Record<string, Record<Contact, number>>;
  puttingByDistance: { bucket: number; made: number; total: number }[];
  firstPuttAvgFt?: number;
  scoreDist: Record<'Eagle+' | 'Birdie' | 'Par' | 'Bogey' | 'Double' | 'Triple+', number>;
}

const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function computeStats(rounds: Round[]): Stats {
  const holes = rounds.flatMap((r) => r.holes.filter(holeComplete));
  const s: Stats = {
    rounds: rounds.length,
    holes: holes.length,
    byPar: { 3: { holes: 0 }, 4: { holes: 0 }, 5: { holes: 0 } },
    fairways: { made: 0, total: 0 },
    fairwayMiss: { Left: 0, Right: 0, Missed: 0 },
    gir: { made: 0, total: 0 },
    puttHoles: 0,
    threePutts: 0,
    scrambling: { made: 0, total: 0 },
    sandSaves: { made: 0, total: 0 },
    penalties: 0,
    approachGreens: { made: 0, total: 0 },
    approachMiss: zero(MISSES),
    teeMiss: zero(MISSES),
    contact: zero(CONTACTS),
    contactByClub: {},
    puttingByDistance: LEAVE_BUCKETS.map((bucket) => ({ bucket, made: 0, total: 0 })),
    scoreDist: { 'Eagle+': 0, Birdie: 0, Par: 0, Bogey: 0, Double: 0, 'Triple+': 0 },
  };
  if (!holes.length) return s;

  let strokes = 0, par = 0, putts = 0;
  const parSums: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
  const proximities: number[] = [];
  const firstPutts: number[] = [];

  for (const h of holes) {
    const hs = holeStrokes(h);
    const hp = holePutts(h);
    strokes += hs;
    par += h.par;
    if (hp !== undefined) {
      putts += hp;
      s.puttHoles++;
      if (hp >= 3) s.threePutts++;
    }

    const diff = hs - h.par;
    s.scoreDist[diff <= -2 ? 'Eagle+' : diff === -1 ? 'Birdie' : diff === 0 ? 'Par' : diff === 1 ? 'Bogey' : diff === 2 ? 'Double' : 'Triple+']++;

    if (h.par === 3 || h.par === 4 || h.par === 5) {
      s.byPar[h.par].holes++;
      parSums[h.par] += hs;
    }

    const fw = fairwayResult(h);
    if (fw) {
      s.fairways.total++;
      if (fw === 'Hit') s.fairways.made++;
      else s.fairwayMiss[fw]++;
    }

    const gir = isGIR(h);
    if (gir !== undefined) s.gir.total++;
    if (gir) s.gir.made++;
    else if (gir === false) {
      s.scrambling.total++;
      if (hs <= h.par) s.scrambling.made++;
    }

    // Sand save: a greenside bunker shot followed by holing out in at most one more stroke.
    const bunkerIdx = h.shots.findLastIndex((x) => x.startLie === 'Bunker' && x.type === 'Short game');
    if (bunkerIdx >= 0) {
      s.sandSaves.total++;
      const rest = h.shots.slice(bunkerIdx);
      if (rest.length <= 2 && rest.every((x) => !x.penalty)) s.sandSaves.made++;
    }

    let firstPuttSeen = false;
    h.shots.forEach((shot, i) => {
      s.penalties += shot.penalty ?? 0;
      if (shot.contact && shot.type !== 'Putt') {
        s.contact[shot.contact]++;
        const club = shot.club ?? 'Unknown club';
        s.contactByClub[club] ??= zero(CONTACTS);
        s.contactByClub[club][shot.contact]++;
      }
      if (shot.type === 'Tee') shot.miss?.forEach((m) => s.teeMiss[m]++);
      if (shot.type === 'Approach') {
        s.approachGreens.total++;
        if (onGreen(shot.endLie)) {
          s.approachGreens.made++;
          if (shot.endLie === 'Holed') proximities.push(0);
          else if (shot.leaveFt !== undefined) proximities.push(bucketMid(shot.leaveFt));
        } else shot.miss?.forEach((m) => s.approachMiss[m]++);
      }
      if (shot.type === 'Putt') {
        const prev = h.shots[i - 1];
        if (prev?.leaveFt !== undefined) {
          const b = s.puttingByDistance.find((x) => x.bucket === Math.min(prev.leaveFt!, 60));
          if (b) {
            b.total++;
            if (shot.endLie === 'Holed') b.made++;
          }
          if (!firstPuttSeen) firstPutts.push(bucketMid(prev.leaveFt));
        }
        firstPuttSeen = true;
      }
    });
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  s.scoringAvg18 = (strokes / holes.length) * 18;
  s.toParPer18 = ((strokes - par) / holes.length) * 18;
  if (s.puttHoles) {
    s.puttsPerHole = putts / s.puttHoles;
    s.puttsPer18 = s.puttsPerHole * 18;
  }
  for (const p of [3, 4, 5] as const) if (s.byPar[p].holes) s.byPar[p].avg = parSums[p] / s.byPar[p].holes;
  s.approachProximityFt = avg(proximities);
  s.firstPuttAvgFt = avg(firstPutts);
  return s;
}

export interface RoundSummary {
  strokes: number;
  par: number;
  holesPlayed: number;
  /** Sum over holes with putts recorded. */
  putts: number;
  front?: number;
  back?: number;
}

export function summarizeRound(r: Round): RoundSummary {
  const done = r.holes.filter(holeComplete);
  const sum = (hs: HoleResult[]) => hs.reduce((n, h) => n + holeStrokes(h), 0);
  const front = done.filter((h) => h.hole <= 9);
  const back = done.filter((h) => h.hole > 9);
  return {
    strokes: sum(done),
    par: done.reduce((n, h) => n + h.par, 0),
    holesPlayed: done.length,
    putts: done.reduce((n, h) => n + (holePutts(h) ?? 0), 0),
    front: front.length ? sum(front) : undefined,
    back: back.length ? sum(back) : undefined,
  };
}

export const toParLabel = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
