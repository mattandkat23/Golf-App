import { useEffect, useState } from 'react';
import { db } from './db';
import { matchCourse, regionForCity } from './courseMatch';
import type { EventStatus, TourLevel, Tournament } from './types';

/** One event from public/events.json, written daily by the scraper (see scraper/). */
export interface AvailableEvent {
  id: string;
  tourId: string;
  name: string;
  startDate: string;
  endDate?: string;
  courseName?: string;
  city?: string;
  ageGroups?: string;
  registrationDeadline?: string;
  entryFee?: number;
  url?: string;
  level?: TourLevel;
}

/** An event the parent pasted in (Events → Paste). Stored on the phone and listed in Available. */
export interface ImportedEvent extends AvailableEvent {
  importedAt: string;
}

export interface AvailableFile {
  generatedAt: string | null;
  sources: Record<string, { checkedAt: string; ok: boolean; eventCount: number; error?: string }>;
  events: AvailableEvent[];
}

/** Loads the published events list; the service worker keeps the last copy for offline use. */
export function useAvailableEvents() {
  const [data, setData] = useState<AvailableFile>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch('./events.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

/** Adds a scraped event to his schedule, matching (or creating) its course. Returns the new tournament id. */
export async function addAvailableEvent(ev: AvailableEvent, status: EventStatus): Promise<number> {
  const existing = await db.tournaments.filter((t) => t.sourceEventId === ev.id).first();
  if (existing) {
    await db.tournaments.update(existing.id!, { status });
    return existing.id!;
  }
  let courseId: number | undefined;
  if (ev.courseName) {
    const course = matchCourse(await db.courses.toArray(), ev.courseName, ev.city);
    const tourRegion = ev.tourId ? (await db.tours.get(ev.tourId))?.region : undefined;
    const region = ev.city ? regionForCity(ev.city) : (tourRegion ?? 'Other Texas');
    courseId = course?.id ?? (await db.courses.add({ name: ev.courseName, city: ev.city ?? '', region, tees: [] }));
  }
  const profile = await db.profile.get('me');
  const t: Tournament = {
    name: ev.name,
    level: ev.level ?? 'Local',
    tourId: ev.tourId || undefined,
    sourceEventId: ev.id,
    courseId,
    startDate: ev.startDate,
    endDate: ev.endDate,
    status,
    ageGroup: profile?.ageGroup,
    registrationDeadline: ev.registrationDeadline,
    entryFee: ev.entryFee,
    url: ev.url,
  };
  return db.tournaments.add(t);
}
