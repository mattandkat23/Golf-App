import type { Tournament } from './types';

/** Statuses that put an event on his calendar. */
export const ON_SCHEDULE = new Set(['Considering', 'Registered', 'Waitlisted', 'Played']);
const ACTIVE = new Set(['Considering', 'Registered', 'Waitlisted']);

const end = (t: Tournament) => t.endDate ?? t.startDate;

/** Upcoming events whose dates overlap another upcoming event. Returns id → overlapping events. */
export function findConflicts(tournaments: Tournament[], today: string): Map<number, Tournament[]> {
  const active = tournaments.filter((t) => ACTIVE.has(t.status) && end(t) >= today && t.id !== undefined);
  const out = new Map<number, Tournament[]>();
  for (const a of active) {
    const clash = active.filter((b) => b.id !== a.id && a.startDate <= end(b) && b.startDate <= end(a));
    if (clash.length) out.set(a.id!, clash);
  }
  return out;
}

export interface Deadline {
  tournament: Tournament;
  date: string;
  daysLeft: number;
}

/** Registration deadlines in the next `withinDays` for events he hasn't registered for yet. */
export function upcomingDeadlines(tournaments: Tournament[], today: string, withinDays = 21): Deadline[] {
  const t0 = new Date(today + 'T00:00:00');
  return tournaments
    .filter((t) => t.registrationDeadline && (t.status === 'Considering' || t.status === 'Waitlisted') && t.registrationDeadline >= today)
    .map((t) => ({
      tournament: t,
      date: t.registrationDeadline!,
      daysLeft: Math.round((new Date(t.registrationDeadline! + 'T00:00:00').getTime() - t0.getTime()) / 864e5),
    }))
    .filter((d) => d.daysLeft <= withinDays)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TourSeason {
  tourId?: string;
  events: number;
  played: number;
  fees: number;
}

/** Per-tour counts and entry fees for a season (calendar year), registered or played events only. */
export function seasonSummary(tournaments: Tournament[], year: string): TourSeason[] {
  const rows = new Map<string, TourSeason>();
  for (const t of tournaments) {
    if (!t.startDate.startsWith(year) || !(t.status === 'Registered' || t.status === 'Played' || t.status === 'Waitlisted')) continue;
    const key = t.tourId ?? '';
    const row = rows.get(key) ?? { tourId: t.tourId, events: 0, played: 0, fees: 0 };
    row.events++;
    if (t.status === 'Played') row.played++;
    if (t.status !== 'Waitlisted') row.fees += t.entryFee ?? 0;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.events - a.events);
}
