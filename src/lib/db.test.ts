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
    old.close();

    const { db } = await import('./db');
    await db.open();
    expect(await db.tours.get('usk-championships')).toBeUndefined();
    expect(await db.tours.get('usk-world')).toBeDefined();
    expect((await db.profile.get('me'))!.myTours).toEqual(['usk-austin', 'usk-state', 'usk-regional', 'usk-world']);
    expect((await db.tournaments.toArray())[0].tourId).toBe('usk-state');
  });
});
