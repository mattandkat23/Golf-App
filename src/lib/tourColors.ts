import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/**
 * Color for a tour. Subscribed tours get the categorical slots in subscription order, so a tour keeps
 * its color as long as the subscription list doesn't change. Past slot 8, tours fold to a neutral gray.
 */
export function tourColor(tourId: string | undefined, myTours: string[]): string {
  const i = tourId ? myTours.indexOf(tourId) : -1;
  return i >= 0 && i < 8 ? `var(--tour-${i + 1})` : 'var(--tour-other)';
}

export function useMyTours() {
  return useLiveQuery(() => db.profile.get('me').then((p) => p?.myTours ?? []), []) ?? [];
}
