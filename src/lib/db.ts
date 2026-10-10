import Dexie, { type Table } from 'dexie';
import type { Course, PracticeSession, Profile, Round, Tour, Tournament } from './types';
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
  };
}

/** Replaces all local data with the backup's contents. */
export async function importBackup(data: Backup) {
  if (data?.app !== 'golf-tracker') throw new Error('Not a Golf Tracker backup file');
  await db.transaction('rw', [db.courses, db.tournaments, db.rounds, db.practice, db.profile, db.tours], async () => {
    await Promise.all([db.courses.clear(), db.tournaments.clear(), db.rounds.clear(), db.practice.clear(), db.profile.clear()]);
    // Older backups have no tours; keep the built-in list and add any custom ones from the file.
    await db.tours.bulkPut(data.tours ?? []);
    await db.courses.bulkAdd(data.courses);
    await db.tournaments.bulkAdd(data.tournaments);
    await db.rounds.bulkAdd(data.rounds);
    await db.practice.bulkAdd(data.practice);
    await db.profile.bulkAdd(data.profile);
  });
}
