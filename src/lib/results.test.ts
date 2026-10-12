import { describe, expect, it } from 'vitest';
import { roundsFor, type ResultHit, type ResultHole } from './results';

const BASE: ResultHit = {
  result_id: 1,
  event_id: 'ajga:2026145',
  tour_id: 'ajga-invitational',
  event_name: 'AJGA Junior All-Star Invitational',
  start_date: '2026-10-08',
  end_date: '2026-10-11',
  course_name: null,
  city: null,
  url: null,
  num_rounds: null,
  holes_per_round: null,
  division: 'Boys',
  position: null,
  pos_num: null,
  field_size: null,
  player_name: 'Beckett McLaughlin',
  hometown: null,
  grad_year: null,
  to_par: null,
  total: null,
  round_scores: null,
  points: null,
  has_holes: true,
  similarity: 1,
};

describe('roundsFor', () => {
  it('derives round totals from holes when the tour has no round_scores/total yet (AJGA live opt-in, event still in progress)', () => {
    const holes: ResultHole[] = [
      ...Array.from({ length: 18 }, (_, i) => ({ round: 1, hole: i + 1, par: 4, score: 4 })),
      ...Array.from({ length: 18 }, (_, i) => ({ round: 2, hole: i + 1, par: 4, score: 3 })),
    ];
    const rounds = roundsFor(BASE, 'me', holes);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].total).toBe(72);
    expect(rounds[0].par).toBe(72);
    expect(rounds[0].numHoles).toBe(18);
    expect(rounds[1].total).toBe(54);
  });

  it('uses round_scores/total as-is once the tour has collected them, ignoring holes for the total', () => {
    const rounds = roundsFor({ ...BASE, round_scores: [69, 71, 71], total: 211, to_par: -5 }, 'me', null);
    expect(rounds.map((r) => r.total)).toEqual([69, 71, 71]);
  });

  it('produces no rounds when there is nothing to build from', () => {
    expect(roundsFor(BASE, 'me', null)).toEqual([]);
  });
});
