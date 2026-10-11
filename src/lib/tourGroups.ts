import { SEED_TOURS } from '../data/tours';
import type { Tour } from './types';

const ORG_ORDER = new Map<string, number>();
SEED_TOURS.forEach((t, i) => {
  const org = t.org ?? 'Other';
  if (!ORG_ORDER.has(org)) ORG_ORDER.set(org, i);
});
const TOUR_ORDER = new Map(SEED_TOURS.map((t, i) => [t.id, i]));

/** "NTPGA – Prep Tour" -> "Prep Tour", since the org is usually shown separately (a group header, a filter label). */
export function shortTourName(name: string) {
  const i = name.indexOf('–');
  return i < 0 ? name : name.slice(i + 1).trim();
}

/** Groups tours by org (built-ins in SEED_TOURS order, each group's tours in SEED_TOURS order), for a
 * collapsible list (My tours) or a two-level filter (Events → Available). */
export function groupTours(tours: Tour[]): [string, Tour[]][] {
  const groups = new Map<string, Tour[]>();
  for (const t of tours) {
    const org = t.org ?? 'Other';
    groups.set(org, [...(groups.get(org) ?? []), t]);
  }
  for (const list of groups.values()) list.sort((a, b) => (TOUR_ORDER.get(a.id) ?? Infinity) - (TOUR_ORDER.get(b.id) ?? Infinity) || a.name.localeCompare(b.name));
  return [...groups.entries()].sort((a, b) => (ORG_ORDER.get(a[0]) ?? Infinity) - (ORG_ORDER.get(b[0]) ?? Infinity) || a[0].localeCompare(b[0]));
}
