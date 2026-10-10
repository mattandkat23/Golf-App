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
