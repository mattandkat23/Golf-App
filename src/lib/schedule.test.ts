import { describe, expect, it } from 'vitest';
import { findConflicts, seasonSummary, upcomingDeadlines } from './schedule';
import { courseKey, matchCourse, regionForCity } from './courseMatch';
import { buildIcs, tournamentToIcs } from './ics';
import type { Course, Tournament } from './types';

const T = (id: number, startDate: string, extra: Partial<Tournament> = {}): Tournament => ({ id, name: `E${id}`, level: 'Local', startDate, status: 'Registered', ...extra });

describe('findConflicts', () => {
  it('flags overlapping upcoming events only', () => {
    const c = findConflicts(
      [
        T(1, '2026-11-07', { endDate: '2026-11-08' }),
        T(2, '2026-11-08'),
        T(3, '2026-11-08', { status: 'Withdrew' }),
        T(4, '2026-11-09'),
        T(5, '2026-09-01'),
        T(6, '2026-09-01'),
      ],
      '2026-10-10',
    );
    expect([...c.keys()].sort()).toEqual([1, 2]);
    expect(c.get(1)!.map((t) => t.id)).toEqual([2]);
  });
});

describe('upcomingDeadlines', () => {
  it('lists deadlines within the window for unregistered events', () => {
    const d = upcomingDeadlines(
      [
        T(1, '2026-11-08', { status: 'Considering', registrationDeadline: '2026-10-15' }),
        T(2, '2026-11-08', { status: 'Registered', registrationDeadline: '2026-10-15' }),
        T(3, '2026-12-08', { status: 'Considering', registrationDeadline: '2026-12-01' }),
        T(4, '2026-10-20', { status: 'Waitlisted', registrationDeadline: '2026-10-10' }),
      ],
      '2026-10-10',
    );
    expect(d.map((x) => [x.tournament.id, x.daysLeft])).toEqual([
      [4, 0],
      [1, 5],
    ]);
  });
});

describe('seasonSummary', () => {
  it('counts events and fees per tour for the year', () => {
    const rows = seasonSummary(
      [
        T(1, '2026-03-01', { tourId: 'ntpga', status: 'Played', entryFee: 90 }),
        T(2, '2026-11-01', { tourId: 'ntpga', entryFee: 90 }),
        T(3, '2026-11-02', { tourId: 'usk-austin', status: 'Considering', entryFee: 60 }),
        T(4, '2025-11-02', { tourId: 'usk-austin', entryFee: 60 }),
      ],
      '2026',
    );
    expect(rows).toEqual([{ tourId: 'ntpga', events: 2, played: 1, fees: 180 }]);
  });
});

describe('course matching', () => {
  const courses: Course[] = [
    { id: 1, name: 'Grey Rock Golf Club', city: 'Austin', region: 'Austin', tees: [] },
    { id: 2, name: 'Ridgewood Country Club', city: 'Waco', region: 'Waco', tees: [] },
    { id: 3, name: 'Stevens Park Golf Course', city: 'Dallas', region: 'Dallas–Fort Worth', tees: [] },
  ];
  it('matches name variants', () => {
    expect(courseKey('The Grey Rock GC')).toBe('grey rock');
    expect(matchCourse(courses, 'Grey Rock GC', 'Austin')?.id).toBe(1);
    expect(matchCourse(courses, 'Ridgewood CC')?.id).toBe(2);
    expect(matchCourse(courses, 'Stevens Park')?.id).toBe(3);
    expect(matchCourse(courses, 'Brand New Links')).toBeUndefined();
  });
  it('maps cities to regions', () => {
    expect(regionForCity('Round Rock')).toBe('Austin');
    expect(regionForCity('Frisco, TX')).toBe('Dallas–Fort Worth');
    expect(regionForCity('Lubbock')).toBe('Other Texas');
    expect(regionForCity('Pinehurst, NC')).toBe('Other');
    expect(regionForCity('Austin, Texas')).toBe('Austin');
  });
});

describe('ics', () => {
  it('builds all-day and timed events plus a deadline reminder', () => {
    const t = T(7, '2026-11-07', { endDate: '2026-11-08', status: 'Considering', registrationDeadline: '2026-10-30', name: 'Fall, Classic' });
    const ics = buildIcs(tournamentToIcs(t, 'Grey Rock Golf Club, Austin', 'NTPGA'), new Date('2026-10-10T12:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261107');
    expect(ics).toContain('DTEND;VALUE=DATE:20261109');
    expect(ics).toContain('SUMMARY:⛳ Fall\\, Classic');
    expect(ics).toContain('SUMMARY:Register: Fall\\, Classic');
    expect(ics).toContain('LOCATION:Grey Rock Golf Club\\, Austin');
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    const timed = buildIcs(tournamentToIcs(T(8, '2026-11-07', { teeTime: '08:30' })));
    expect(timed).toContain('DTSTART:20261107T083000');
  });
});
