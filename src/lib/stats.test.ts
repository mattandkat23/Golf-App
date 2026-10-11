import { describe, expect, it } from 'vitest';
import { computeStats, fairwayResult, holeStrokes, inferShotType, isGIR, summarizeRound } from './stats';
import type { HoleResult, Round } from './types';

// Par 4: drive left rough (toe), approach to green 10–15 ft (center), 2 putts.
const par4: HoleResult = {
  hole: 1,
  par: 4,
  shots: [
    { type: 'Tee', startLie: 'Tee', club: 'Driver', endLie: 'Rough', miss: ['Left'], contact: 'Toe' },
    { type: 'Approach', startLie: 'Rough', club: '7 Iron', endLie: 'Green', leaveFt: 10, contact: 'Center' },
    { type: 'Putt', startLie: 'Green', endLie: 'Green', leaveFt: 0 },
    { type: 'Putt', startLie: 'Green', endLie: 'Holed' },
  ],
};

// Par 3: misses green short-right (fat), bunker shot to 0–5 ft, 1 putt = par save + sand save.
const par3: HoleResult = {
  hole: 2,
  par: 3,
  shots: [
    { type: 'Approach', startLie: 'Tee', club: '6 Iron', endLie: 'Bunker', miss: ['Short', 'Right'], contact: 'Fat' },
    { type: 'Short game', startLie: 'Bunker', club: 'SW', endLie: 'Green', leaveFt: 0, contact: 'Center' },
    { type: 'Putt', startLie: 'Green', endLie: 'Holed' },
  ],
};

// Par 5 with OB off the tee: 1 penalty stroke.
const par5: HoleResult = {
  hole: 3,
  par: 5,
  shots: [
    { type: 'Tee', startLie: 'Tee', endLie: 'Penalty', miss: ['Right'], penalty: 1 },
    { type: 'Tee', startLie: 'Tee', endLie: 'Fairway' },
    { type: 'Approach', startLie: 'Fairway', endLie: 'Fairway' },
    { type: 'Approach', startLie: 'Fairway', endLie: 'Green', leaveFt: 25 },
    { type: 'Putt', startLie: 'Green', endLie: 'Green', leaveFt: 5 },
    { type: 'Putt', startLie: 'Green', endLie: 'Green', leaveFt: 0 },
    { type: 'Putt', startLie: 'Green', endLie: 'Holed' },
  ],
};

const round: Round = { golferId: 'me', date: '2026-10-01', roundNumber: 1, numHoles: 9, holes: [par4, par3, par5] };

describe('hole helpers', () => {
  it('counts strokes including penalties', () => {
    expect(holeStrokes(par4)).toBe(4);
    expect(holeStrokes(par3)).toBe(3);
    expect(holeStrokes(par5)).toBe(8);
  });
  it('computes GIR', () => {
    expect(isGIR(par4)).toBe(true);
    expect(isGIR(par3)).toBe(false);
    expect(isGIR(par5)).toBe(false); // on green in 5 incl. penalty
  });
  it('computes fairway result', () => {
    expect(fairwayResult(par4)).toBe('Left');
    expect(fairwayResult(par3)).toBeUndefined();
    expect(fairwayResult(par5)).toBe('Right');
  });
  it('infers shot type', () => {
    expect(inferShotType('Tee', 4, 0)).toBe('Tee');
    expect(inferShotType('Tee', 3, 0)).toBe('Approach');
    expect(inferShotType('Green', 4, 2)).toBe('Putt');
    expect(inferShotType('Bunker', 3, 1, par3.shots[0])).toBe('Short game');
    expect(inferShotType('Fairway', 5, 1, par5.shots[1])).toBe('Approach');
  });
});

describe('computeStats', () => {
  const s = computeStats([round]);
  it('aggregates scoring', () => {
    expect(s.holes).toBe(3);
    expect(s.byPar[3].avg).toBe(3);
    expect(s.byPar[5].avg).toBe(8);
    expect(s.scoreDist.Par).toBe(2);
    expect(s.scoreDist['Triple+']).toBe(1);
    expect(s.penalties).toBe(1);
  });
  it('aggregates fairways, greens, scrambling and sand saves', () => {
    expect(s.fairways).toEqual({ made: 0, total: 2 });
    expect(s.fairwayMiss).toEqual({ Left: 1, Right: 1, Missed: 0 });
    expect(s.gir).toEqual({ made: 1, total: 3 });
    expect(s.scrambling).toEqual({ made: 1, total: 2 });
    expect(s.sandSaves).toEqual({ made: 1, total: 1 });
    expect(s.threePutts).toBe(1);
  });
  it('aggregates approach, misses and contact', () => {
    expect(s.approachGreens).toEqual({ made: 2, total: 4 });
    expect(s.approachMiss.Short).toBe(1);
    expect(s.approachMiss.Right).toBe(1);
    expect(s.approachProximityFt).toBe((12.5 + 27.5) / 2);
    expect(s.contact).toEqual({ Center: 2, Heel: 0, Toe: 1, Fat: 1, Thin: 0 });
    expect(s.contactByClub['Driver'].Toe).toBe(1);
  });
  it('aggregates putting by distance', () => {
    const at = (b: number) => s.puttingByDistance.find((x) => x.bucket === b)!;
    expect(at(0)).toEqual({ bucket: 0, made: 3, total: 3 });
    expect(at(10)).toEqual({ bucket: 10, made: 0, total: 1 });
    expect(at(25)).toEqual({ bucket: 25, made: 0, total: 1 });
    expect(at(5)).toEqual({ bucket: 5, made: 0, total: 1 });
    expect(s.firstPuttAvgFt).toBe((12.5 + 2.5 + 27.5) / 3);
  });
  it('ignores incomplete holes', () => {
    const partial = { ...round, holes: [...round.holes, { hole: 4, par: 4, shots: [{ type: 'Tee', startLie: 'Tee' }] } as HoleResult] };
    expect(computeStats([partial]).holes).toBe(3);
  });
});

describe('summarizeRound', () => {
  it('totals the round', () => {
    expect(summarizeRound(round)).toMatchObject({ strokes: 15, par: 12, holesPlayed: 3, putts: 6, front: 15 });
  });
});

describe('basic (non shot-by-shot) holes', () => {
  const basic = (hole: number, par: number, extra: Partial<HoleResult>): HoleResult => ({ hole, par, shots: [], ...extra });

  it('uses the entered score, fairway, green and putts', () => {
    const h = basic(1, 4, { score: 5, fairway: 'Left', putts: 2 });
    expect(holeStrokes(h)).toBe(5);
    expect(fairwayResult(h)).toBe('Left');
    expect(isGIR(h)).toBe(false); // on in 3 on a par 4
    expect(isGIR(basic(2, 4, { score: 4, putts: 2 }))).toBe(true);
    expect(isGIR(basic(3, 4, { score: 4, putts: 2, gir: false }))).toBe(false); // explicit answer wins
    expect(isGIR(basic(4, 4, { score: 4 }))).toBeUndefined();
  });

  it('mixes with shot-by-shot holes and only counts what was recorded', () => {
    const r: Round = {
      golferId: 'me',
      date: '2026-10-02',
      roundNumber: 1,
      numHoles: 9,
      holes: [par4, basic(2, 4, { score: 4, fairway: 'Hit', putts: 2 }), basic(3, 3, { score: 3 }), basic(4, 5, {})],
    };
    const s = computeStats([r]);
    expect(s.holes).toBe(3); // the hole with no score isn't finished
    expect(s.scoringAvg18).toBeCloseTo(((4 + 4 + 3) / 3) * 18);
    expect(s.puttHoles).toBe(2);
    expect(s.puttsPerHole).toBe(2);
    expect(s.gir).toEqual({ made: 2, total: 2 });
    expect(s.fairways).toEqual({ made: 1, total: 2 });
    expect(summarizeRound(r)).toMatchObject({ strokes: 11, holesPlayed: 3, putts: 4 });
  });
});

describe('imported rounds with only a total', () => {
  const imported = (extra: Partial<Round>): Round => ({
    golferId: 'me',
    date: '2026-08-16',
    roundNumber: 1,
    numHoles: 9,
    holes: Array.from({ length: 9 }, (_, i) => ({ hole: i + 1, par: 4, shots: [] })),
    total: 43,
    par: 36,
    ...extra,
  });

  it('counts the total toward scoring until every hole is filled in', () => {
    const s = computeStats([imported({})]);
    expect(s.holes).toBe(9);
    expect(s.scoringAvg18).toBe(86);
    expect(s.toParPer18).toBe(14);
    expect(summarizeRound(imported({}))).toMatchObject({ strokes: 43, par: 36, holesPlayed: 9 });
  });

  it('still uses the total when only some holes have stats, but counts those holes for greens and putts', () => {
    const r = imported({});
    r.holes[0] = { ...r.holes[0], score: 5, putts: 2, fairway: 'Hit' };
    const s = computeStats([r]);
    expect(s.scoringAvg18).toBe(86);
    expect(s.holes).toBe(9);
    expect(s.puttHoles).toBe(1);
    expect(s.fairways).toEqual({ made: 1, total: 1 });
  });

  it('switches to the holes once all are filled in', () => {
    const r = imported({});
    r.holes = r.holes.map((h) => ({ ...h, score: 5 }));
    expect(computeStats([r]).scoringAvg18).toBe(90);
    expect(summarizeRound(r).strokes).toBe(45);
  });
});
