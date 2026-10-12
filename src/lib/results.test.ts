import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./supabase', () => ({
  supabase: { rpc: async () => ({ data: [{ round: 1, hole: 1, par: 5, score: 3 }], error: null }) },
}));

const { db } = await import('./db');
const { importResults } = await import('./results');

describe('importResults', () => {
  const golfer = { id: 'me', playerName: 'Beckett McLaughlin', bag: [] };

  beforeEach(async () => {
    await db.tournaments.clear();
    await db.rounds.clear();
    await db.profile.clear();
    await db.profile.add(golfer);
  });

  it('folds a result into an already-tracked Tournament for the same event+date instead of duplicating it', async () => {
    const existingId = await db.tournaments.add({
      golferId: 'me',
      name: 'AJGA Junior All-Star Invitational',
      level: 'Other',
      tourId: 'ajga-invitational',
      sourceEventId: 'ajga-invitational-2026-10-08-abc123', // Available's own id scheme, unrelated to the result's
      startDate: '2026-10-08',
      endDate: '2026-10-11',
      status: 'Registered',
    });

    const added = await importResults([BASE], golfer);

    expect(added).toBe(1);
    const all = await db.tournaments.where('golferId').equals('me').toArray();
    expect(all).toHaveLength(1); // no duplicate
    expect(all[0].id).toBe(existingId); // the original row, not a new one
    expect(all[0].status).toBe('Played');
    expect(await db.rounds.where('tournamentId').equals(existingId).count()).toBeGreaterThan(0);
  });

  it('adds a new Tournament when nothing matching is already tracked', async () => {
    await importResults([BASE], golfer);
    const all = await db.tournaments.where('golferId').equals('me').toArray();
    expect(all).toHaveLength(1);
    expect(all[0].sourceEventId).toBe('result:ajga:2026145');
  });

  it("doesn't overwrite rounds already scored live in-app for the matched Tournament", async () => {
    const existingId = await db.tournaments.add({
      golferId: 'me',
      name: 'AJGA Junior All-Star Invitational',
      level: 'Other',
      startDate: '2026-10-08',
      endDate: '2026-10-11',
      status: 'Registered',
    });
    await db.rounds.add({ golferId: 'me', tournamentId: existingId, date: '2026-10-08', roundNumber: 1, numHoles: 18, holes: [], total: 65, complete: true });

    await importResults([BASE], golfer);

    const rounds = await db.rounds.where('tournamentId').equals(existingId).toArray();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].total).toBe(65); // untouched
  });
});
