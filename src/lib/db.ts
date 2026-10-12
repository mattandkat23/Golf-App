import Dexie, { type Table } from 'dexie';
import type { Course, PracticeSession, Profile, Round, Tour, Tournament } from './types';
import type { ImportedEvent } from './available';
import { SEED_COURSES } from '../data/courses';
import { SEED_TOURS } from '../data/tours';

export const DEFAULT_BAG = ['Driver', '3 Wood', 'Hybrid', '6 Iron', '7 Iron', '8 Iron', '9 Iron', 'PW', 'SW', 'Putter'];

class GolfDB extends Dexie {
  courses!: Table<Course, number>;
  tournaments!: Table<Tournament, number>;
  rounds!: Table<Round, number>;
  practice!: Table<PracticeSession, number>;
  profile!: Table<Profile, string>;
  tours!: Table<Tour, string>;
  imported!: Table<ImportedEvent, string>;

  constructor(name = 'golf-tracker') {
    super(name);
    this.version(1).stores({
      courses: '++id, name, region',
      tournaments: '++id, startDate, status, level, courseId',
      rounds: '++id, date, tournamentId, courseId',
      practice: '++id, date',
      profile: 'id',
    });
    this.version(2)
      .stores({ tours: 'id, name', tournaments: '++id, startDate, status, level, courseId, tourId' })
      .upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    // Bump the version whenever SEED_TOURS changes so existing phones get the new built-in list.
    this.version(3).upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    this.version(4).upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    // v5 splits "US Kids – State, Regional & World" into three tours.
    this.version(5).upgrade(async (tx) => {
      await tx.table('tours').delete('usk-championships');
      await tx.table('tours').bulkPut(SEED_TOURS);
      await tx.table('profile').toCollection().modify((p: Profile) => {
        if (p.myTours?.includes('usk-championships')) {
          p.myTours = [...p.myTours.filter((t) => t !== 'usk-championships'), 'usk-state', 'usk-regional', 'usk-world'];
        }
      });
      await tx.table('tournaments').toCollection().modify((t: Tournament) => {
        if (t.tourId === 'usk-championships') t.tourId = t.level === 'World' ? 'usk-world' : t.level === 'Regional' ? 'usk-regional' : 'usk-state';
      });
    });
    this.version(6).upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    this.version(7).upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    this.version(8).upgrade((tx) => tx.table('tours').bulkPut(SEED_TOURS));
    // v9: events pasted in from tour schedules, listed under Events → Available.
    this.version(9).stores({ imported: 'id, tourId, startDate' });
    // v10: multiple golfers. Events, rounds and practice belong to a golfer; existing data goes to the first one ('me').
    this.version(10)
      .stores({
        tournaments: '++id, startDate, status, level, courseId, tourId, golferId',
        rounds: '++id, date, tournamentId, courseId, golferId',
        practice: '++id, date, golferId',
      })
      .upgrade(async (tx) => {
        for (const name of ['tournaments', 'rounds', 'practice']) {
          await tx.table(name).toCollection().modify((x: { golferId?: string }) => {
            x.golferId ??= 'me';
          });
        }
      });
    // v11 splits NTPGA and STPGA into their separate series (see src/data/tours.ts and scraper/sub-tours.ts).
    this.version(11).upgrade(async (tx) => {
      await tx.table('tours').delete('ntpga');
      await tx.table('tours').delete('stpga');
      await tx.table('tours').bulkPut(SEED_TOURS);
      const classify = (name: string, base: 'ntpga' | 'stpga') =>
        base === 'ntpga'
          ? /^Medalist Tour\b/i.test(name)
            ? 'ntpga-medalist'
            : /^Prep Tour\b/i.test(name)
              ? 'ntpga-prep'
              : 'ntpga-majors'
          : /^Junior Tour\b/i.test(name)
            ? 'stpga-junior-tour'
            : /^Junior Links\b/i.test(name)
              ? 'stpga-junior-links'
              : /^Little Linksters\b/i.test(name)
                ? 'stpga-little-linksters'
                : 'stpga-prestige';
      await tx.table('profile').toCollection().modify((p: Profile) => {
        if (p.myTours?.includes('ntpga')) p.myTours = [...p.myTours.filter((t) => t !== 'ntpga'), 'ntpga-majors', 'ntpga-medalist', 'ntpga-prep'];
        if (p.myTours?.includes('stpga'))
          p.myTours = [...p.myTours.filter((t) => t !== 'stpga'), 'stpga-prestige', 'stpga-junior-tour', 'stpga-junior-links', 'stpga-little-linksters'];
      });
      for (const name of ['tournaments', 'imported'] as const) {
        await tx.table(name).toCollection().modify((x: { tourId?: string; name: string }) => {
          if (x.tourId === 'ntpga' || x.tourId === 'stpga') x.tourId = classify(x.name, x.tourId);
        });
      }
    });
    // v12 splits AJGA into Open/Qualifier/Invitational/Junior All-Star/Preview/Senior (see src/data/tours.ts and scraper/sub-tours.ts).
    this.version(12).upgrade(async (tx) => {
      await tx.table('tours').delete('ajga');
      await tx.table('tours').bulkPut(SEED_TOURS);
      const classify = (name: string) =>
        /^Qualifier\b/i.test(name)
          ? 'ajga-qualifier'
          : /\bInvitational\b/i.test(name)
            ? 'ajga-invitational'
            : /\bJunior All-Star\b/i.test(name)
              ? 'ajga-allstar'
              : /\bPreview\b/i.test(name)
                ? 'ajga-preview'
                : /\bSenior\b/i.test(name)
                  ? 'ajga-senior'
                  : 'ajga-open';
      await tx.table('profile').toCollection().modify((p: Profile) => {
        if (p.myTours?.includes('ajga'))
          p.myTours = [...p.myTours.filter((t) => t !== 'ajga'), 'ajga-open', 'ajga-qualifier', 'ajga-invitational', 'ajga-allstar', 'ajga-preview', 'ajga-senior'];
      });
      for (const name of ['tournaments', 'imported'] as const) {
        await tx.table(name).toCollection().modify((x: { tourId?: string; name: string }) => {
          if (x.tourId === 'ajga') x.tourId = classify(x.name);
        });
      }
    });
    // v13: show the first-time setup walkthrough once, only for a profile that existed before it (or was
    // restored from a backup predating it) -- a genuinely brand-new install's default profile (on('populate')
    // below) starts with onboarded left unset so the walkthrough shows for it.
    this.version(13).upgrade((tx) => tx.table('profile').toCollection().modify((p: Profile) => (p.onboarded ??= true)));
    // v14: SEED_COURSES only ever gets written on a brand-new install (on('populate') below), so a phone
    // that already had the app missed the OpenGolfAPI enrichment (phone/website/GPS/state/reference
    // scorecard) and the ~160 new nationwide courses added alongside it. Matches existing courses by
    // name+city (same key courseDetails.json uses) and only fills fields the parent hasn't already set --
    // never touches tees they've already entered themselves -- then adds any seed course that's missing
    // entirely. Bump this again (same shape) any time SEED_COURSES changes, same as SEED_TOURS above.
    this.version(14).upgrade(async (tx) => {
      const existing = await tx.table<Course>('courses').toArray();
      const byKey = new Map(existing.map((c) => [`${c.name}|${c.city}`, c]));
      for (const seed of SEED_COURSES) {
        const match = byKey.get(`${seed.name}|${seed.city}`);
        if (!match) {
          await tx.table('courses').add(seed);
          continue;
        }
        const patch: Partial<Course> = {};
        (['phone', 'website', 'lat', 'lng', 'postalCode', 'architect', 'yearBuilt', 'state'] as const).forEach((f) => {
          if (match[f] === undefined && seed[f] !== undefined) (patch as Record<string, unknown>)[f] = seed[f];
        });
        if (!match.tees?.length && seed.tees?.length) patch.tees = seed.tees;
        if (Object.keys(patch).length) await tx.table('courses').update(match.id!, patch);
      }
    });
    this.on('populate', (tx) => {
      tx.table('courses').bulkAdd(SEED_COURSES);
      tx.table('tours').bulkAdd(SEED_TOURS);
      tx.table('profile').add({
        id: 'me',
        playerName: 'My Golfer',
        bag: DEFAULT_BAG.map((name) => ({ name })),
        myTours: [],
      } satisfies Profile);
    });
  }
}

export const db = new GolfDB();

export function newGolfer(playerName: string): Profile {
  // A second (or later) golfer doesn't need the whole-app walkthrough again.
  return { id: `p-${Date.now()}`, playerName, bag: DEFAULT_BAG.map((name) => ({ name })), myTours: [], onboarded: true };
}

/** Deletes a golfer and everything that belongs to them. */
export async function deleteGolfer(id: string) {
  await db.transaction('rw', [db.profile, db.tournaments, db.rounds, db.practice], async () => {
    await db.rounds.where('golferId').equals(id).delete();
    await db.tournaments.where('golferId').equals(id).delete();
    await db.practice.where('golferId').equals(id).delete();
    await db.profile.delete(id);
  });
}

export interface Backup {
  app: 'golf-tracker';
  version: 1;
  exportedAt: string;
  courses: Course[];
  tournaments: Tournament[];
  rounds: Round[];
  practice: PracticeSession[];
  profile: Profile[];
  tours?: Tour[];
  imported?: ImportedEvent[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'golf-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    courses: await db.courses.toArray(),
    tournaments: await db.tournaments.toArray(),
    rounds: await db.rounds.toArray(),
    practice: await db.practice.toArray(),
    profile: await db.profile.toArray(),
    tours: await db.tours.toArray(),
    imported: await db.imported.toArray(),
  };
}

/** Replaces all local data with the backup's contents. */
export async function importBackup(data: Backup) {
  if (data?.app !== 'golf-tracker') throw new Error('Not a Golf Tracker backup file');
  await db.transaction('rw', [db.courses, db.tournaments, db.rounds, db.practice, db.profile, db.tours, db.imported], async () => {
    await Promise.all([db.courses.clear(), db.tournaments.clear(), db.rounds.clear(), db.practice.clear(), db.profile.clear(), db.imported.clear()]);
    await db.imported.bulkPut(data.imported ?? []);
    // Older backups have no tours; keep the built-in list and add any custom ones from the file.
    await db.tours.bulkPut(data.tours ?? []);
    // Backups from before multiple golfers have no golferId; their data belongs to the one golfer in the file.
    const owner = data.profile[0]?.id ?? 'me';
    const own = <T extends { golferId?: string }>(rows: T[]) => rows.map((x) => ({ ...x, golferId: x.golferId ?? owner }));
    await db.courses.bulkAdd(data.courses);
    await db.tournaments.bulkAdd(own(data.tournaments));
    await db.rounds.bulkAdd(own(data.rounds));
    await db.practice.bulkAdd(own(data.practice));
    await db.profile.bulkAdd(data.profile);
  });
}
