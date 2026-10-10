import { describe, expect, it } from 'vitest';
import { parseSchedule } from './importParse';

const TODAY = '2026-10-10';

describe('parseSchedule', () => {
  it('reads a tab-separated table (BlueGolf-style)', () => {
    const text = `Date\tTournament\tCourse\tStatus
Sat 11/7/26 - 11/8/26\tFall Medalist #3\tPecan Hollow GC, Plano\tRegistration Open
Sun 11/15/26\tFall Prep Series\tIron Horse Golf Course\tClosed
Sat 1/9/27\tWinter Classic\tTexas Star Golf Course\t$120`;
    expect(parseSchedule(text, TODAY)).toEqual([
      { startDate: '2026-11-07', endDate: '2026-11-08', name: 'Fall Medalist #3', courseName: 'Pecan Hollow GC', city: 'Plano' },
      { startDate: '2026-11-15', name: 'Fall Prep Series', courseName: 'Iron Horse Golf Course' },
      { startDate: '2027-01-09', name: 'Winter Classic', courseName: 'Texas Star Golf Course', entryFee: 120 },
    ]);
  });

  it('reads stacked lines (one field per line) and infers the year', () => {
    const text = `Fall 2026 Schedule
Sunday, October 25
Mill Creek Golf Club
Salado, TX
Register
Saturday, January 16
Jimmy Clay Golf Course
Austin, TX`;
    expect(parseSchedule(text, TODAY)).toEqual([
      { startDate: '2026-10-25', name: 'Mill Creek Golf Club', courseName: 'Mill Creek Golf Club', city: 'Salado' },
      { startDate: '2027-01-16', name: 'Jimmy Clay Golf Course', courseName: 'Jimmy Clay Golf Course', city: 'Austin' },
    ]);
  });

  it('handles named ranges, ordinals, explicit years and known courses', () => {
    const text = `November 7th-8th, 2026 – Medalist Championship – Firewheel
Dec 5 2026 | Holiday Shootout | Stevens Park`;
    const known = (s: string) => ['firewheel', 'stevens park'].includes(s.toLowerCase());
    expect(parseSchedule(text, TODAY, known)).toEqual([
      { startDate: '2026-11-07', endDate: '2026-11-08', name: 'Medalist Championship', courseName: 'Firewheel' },
      { startDate: '2026-12-05', name: 'Holiday Shootout', courseName: 'Stevens Park' },
    ]);
  });

  it('ignores text without dates and impossible dates', () => {
    expect(parseSchedule('Welcome to the tour!\nMembership is $95\n2/30 Bad Date Classic', TODAY)).toEqual([]);
  });
});
