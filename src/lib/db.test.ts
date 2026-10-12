import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

// Dexie's db singleton (and fake-indexeddb's storage) is shared across this whole file, so only the
// first test to import './db' actually sees a genuine from-scratch upgrade chain run -- later tests
// reopening the already-upgraded db don't re-trigger past upgrade() functions. So every old-version
// migration this suite wants to exercise has to be seeded and asserted together, in this one test.
describe('database upgrades', () => {
  it('replaces the combined US Kids championships tour with state/regional/world, and splits NTPGA/STPGA into their series', async () => {
    // Simulate a phone still on v4, with the old tours subscribed and in use.
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
    await old.table('tours').put({ id: 'ntpga', name: 'Northern Texas PGA Junior Tour' });
    await old.table('tours').put({ id: 'stpga', name: 'Southern Texas PGA Junior Golf' });
    await old.table('profile').put({ id: 'me', playerName: 'Test', bag: [], myTours: ['usk-austin', 'usk-championships', 'ntpga', 'stpga'] });
    await old.table('tournaments').add({ name: 'Texas State', level: 'State', startDate: '2026-05-30', status: 'Played', tourId: 'usk-championships' });
    await old.table('tournaments').add({ name: 'Medalist Tour: East 603', level: 'Local', startDate: '2026-10-12', status: 'Registered', tourId: 'ntpga' });
    await old.table('rounds').add({ date: '2026-05-30', roundNumber: 1, numHoles: 9, holes: [] });
    await old.table('practice').add({ date: '2026-05-29', minutes: 30, focus: [], drills: [] });
    old.close();

    const { db } = await import('./db');
    await db.open();
    expect(await db.tours.get('usk-championships')).toBeUndefined();
    expect(await db.tours.get('usk-world')).toBeDefined();
    expect(await db.tours.get('ntpga')).toBeUndefined();
    expect(await db.tours.get('stpga')).toBeUndefined();
    expect(await db.tours.get('ntpga-medalist')).toBeDefined();
    expect(await db.tours.get('stpga-little-linksters')).toBeDefined();
    expect((await db.profile.get('me'))!.myTours).toEqual([
      'usk-austin', 'usk-state', 'usk-regional', 'usk-world',
      'ntpga-majors', 'ntpga-medalist', 'ntpga-prep',
      'stpga-prestige', 'stpga-junior-tour', 'stpga-junior-links', 'stpga-little-linksters',
    ]);
    const tournaments = await db.tournaments.toArray();
    expect(tournaments.find((t) => t.name === 'Texas State')?.tourId).toBe('usk-state');
    expect(tournaments.find((t) => t.name === 'Medalist Tour: East 603')?.tourId).toBe('ntpga-medalist');
    // v10: existing data belongs to the first golfer.
    expect(await db.tournaments.where('golferId').equals('me').count()).toBe(2);
    expect(await db.rounds.where('golferId').equals('me').count()).toBe(1);
    expect(await db.practice.where('golferId').equals('me').count()).toBe(1);
    // v13: a profile that already existed shouldn't see the first-time setup walkthrough.
    expect((await db.profile.get('me'))!.onboarded).toBe(true);
  });
});

describe('multiple golfers', () => {
  it("removes a golfer and only that golfer's data", async () => {
    const { db, deleteGolfer, newGolfer } = await import('./db');
    const sis = newGolfer('Emma');
    expect(sis.onboarded).toBe(true); // a second golfer doesn't need the app walkthrough again
    await db.profile.add(sis);
    await db.tournaments.add({ golferId: sis.id, name: 'Fall Classic', level: 'Local', startDate: '2026-11-07', status: 'Registered' });
    await db.rounds.add({ golferId: sis.id, date: '2026-11-07', roundNumber: 1, numHoles: 9, holes: [] });
    await db.practice.add({ golferId: sis.id, date: '2026-11-01', minutes: 30, focus: [], drills: [] });
    await deleteGolfer(sis.id);
    expect(await db.profile.get(sis.id)).toBeUndefined();
    // 2 pre-existing tournaments (Texas State, Medalist Tour) from the upgrade test above.
    expect(await db.tournaments.count()).toBe(2);
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
