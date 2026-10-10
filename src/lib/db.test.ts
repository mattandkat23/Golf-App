import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

describe('database upgrade to v5', () => {
  it('replaces the combined US Kids championships tour with state/regional/world', async () => {
    // Simulate a phone still on v4 with the old tour subscribed.
    const old = new Dexie('golf-tracker');
    old.version(4).stores({
      courses: '++id, name, region',
      tournaments: '++id, startDate, status, level, courseId, tourId',
      rounds: '++id, date, tournamentId, courseId',
      practice: '++id, date',
      profile: 'id',
      tours: 'id, name',
    });
    await old.open();
    await old.table('tours').put({ id: 'usk-championships', name: 'US Kids – State, Regional & World' });
    await old.table('profile').put({ id: 'me', playerName: 'Test', bag: [], myTours: ['usk-austin', 'usk-championships'] });
    await old.table('tournaments').add({ name: 'Texas State', level: 'State', startDate: '2026-05-30', status: 'Played', tourId: 'usk-championships' });
    await old.table('rounds').add({ date: '2026-05-30', roundNumber: 1, numHoles: 9, holes: [] });
    await old.table('practice').add({ date: '2026-05-29', minutes: 30, focus: [], drills: [] });
    old.close();

    const { db } = await import('./db');
    await db.open();
    expect(await db.tours.get('usk-championships')).toBeUndefined();
    expect(await db.tours.get('usk-world')).toBeDefined();
    expect((await db.profile.get('me'))!.myTours).toEqual(['usk-austin', 'usk-state', 'usk-regional', 'usk-world']);
    expect((await db.tournaments.toArray())[0].tourId).toBe('usk-state');
    // v10: existing data belongs to the first golfer.
    expect(await db.tournaments.where('golferId').equals('me').count()).toBe(1);
    expect(await db.rounds.where('golferId').equals('me').count()).toBe(1);
    expect(await db.practice.where('golferId').equals('me').count()).toBe(1);
  });
});

describe('multiple golfers', () => {
  it("removes a golfer and only that golfer's data", async () => {
    const { db, deleteGolfer, newGolfer } = await import('./db');
    const sis = newGolfer('Emma');
    await db.profile.add(sis);
    await db.tournaments.add({ golferId: sis.id, name: 'Fall Classic', level: 'Local', startDate: '2026-11-07', status: 'Registered' });
    await db.rounds.add({ golferId: sis.id, date: '2026-11-07', roundNumber: 1, numHoles: 9, holes: [] });
    await db.practice.add({ golferId: sis.id, date: '2026-11-01', minutes: 30, focus: [], drills: [] });
    await deleteGolfer(sis.id);
    expect(await db.profile.get(sis.id)).toBeUndefined();
    expect(await db.tournaments.count()).toBe(1);
    expect(await db.rounds.count()).toBe(1);
    expect(await db.practice.count()).toBe(1);
  });

  it('gives data in an old one-golfer backup to that golfer', async () => {
    const { db, importBackup } = await import('./db');
    await importBackup({
      app: 'golf-tracker',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      courses: [],
      tournaments: [{ name: 'Old', level: 'Local', startDate: '2026-03-01', status: 'Played' } as never],
      rounds: [],
      practice: [],
      profile: [{ id: 'me', playerName: 'Jack', bag: [] }],
    });
    expect((await db.tournaments.toArray()).map((t) => t.golferId)).toEqual(['me']);
  });
});
