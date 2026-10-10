// Pure helpers for the tour-schedule scraper. Kept free of network and SDK code so they can be unit tested.

export interface ScrapedEvent {
  id: string;
  tourId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  courseName?: string;
  city?: string;
  ageGroups?: string;
  registrationDeadline?: string;
  entryFee?: number;
  url?: string;
  level?: 'Local' | 'State' | 'Regional' | 'World' | 'Other';
}

export interface SourceStatus {
  checkedAt: string;
  ok: boolean;
  eventCount: number;
  error?: string;
}

export interface EventsFile {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  events: ScrapedEvent[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stable id so the same event keeps its id across daily runs. */
export function eventId(tourId: string, name: string, startDate: string): string {
  const key = `${tourId}|${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${startDate}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return `${tourId}-${startDate}-${h.toString(36)}`;
}

/** Drops malformed rows, fills ids, de-duplicates, and keeps events from `keepFrom` onward. */
export function normalizeEvents(tourId: string, raw: Omit<ScrapedEvent, 'id' | 'tourId'>[], keepFrom: string): ScrapedEvent[] {
  const seen = new Map<string, ScrapedEvent>();
  for (const r of raw) {
    if (!r.name?.trim() || !ISO_DATE.test(r.startDate)) continue;
    const endDate = r.endDate && ISO_DATE.test(r.endDate) && r.endDate > r.startDate ? r.endDate : undefined;
    if ((endDate ?? r.startDate) < keepFrom) continue;
    const ev: ScrapedEvent = {
      id: eventId(tourId, r.name, r.startDate),
      tourId,
      name: r.name.trim(),
      startDate: r.startDate,
      ...(endDate && { endDate }),
      ...(r.courseName?.trim() && { courseName: r.courseName.trim() }),
      ...(r.city?.trim() && { city: r.city.trim() }),
      ...(r.ageGroups?.trim() && { ageGroups: r.ageGroups.trim() }),
      ...(r.registrationDeadline && ISO_DATE.test(r.registrationDeadline) && { registrationDeadline: r.registrationDeadline }),
      ...(typeof r.entryFee === 'number' && r.entryFee > 0 && { entryFee: r.entryFee }),
      ...(r.url?.startsWith('http') && { url: r.url }),
      ...(r.level && { level: r.level }),
    };
    // Keep the richer of two duplicates.
    const prev = seen.get(ev.id);
    if (!prev || Object.keys(ev).length > Object.keys(prev).length) seen.set(ev.id, ev);
  }
  return [...seen.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

/**
 * Builds the new events file. Tours whose scrape failed keep their previous events so a
 * temporary site outage doesn't wipe a family's Available list.
 */
export function mergeEventsFile(
  previous: EventsFile | undefined,
  results: { tourId: string; ok: boolean; events: ScrapedEvent[]; error?: string }[],
  now: string,
): EventsFile {
  const sources: Record<string, SourceStatus> = { ...(previous?.sources ?? {}) };
  const byTour = new Map<string, ScrapedEvent[]>();
  for (const ev of previous?.events ?? []) byTour.set(ev.tourId, [...(byTour.get(ev.tourId) ?? []), ev]);
  for (const r of results) {
    if (r.ok) byTour.set(r.tourId, r.events);
    const kept = byTour.get(r.tourId) ?? [];
    sources[r.tourId] = {
      checkedAt: now,
      ok: r.ok,
      eventCount: kept.length,
      ...(r.error && { error: r.error.slice(0, 300) }),
    };
  }
  const events = [...byTour.values()].flat().sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  return { generatedAt: now, sources, events };
}

/** Finds the robots.txt rule that decides `path` for the `*` user agent (or ours). */
export function robotsMatch(robotsTxt: string, path: string, agent = 'golftrackerbot'): string | undefined {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const line of robotsTxt.split(/\r?\n/)) {
    const m = line.replace(/#.*/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((k === 'allow' || k === 'disallow') && cur) {
      if (value) cur.rules.push({ allow: k === 'allow', path: value });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const group = groups.find((g) => g.agents.includes(agent)) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return undefined;
  // Longest matching rule wins; Allow wins ties.
  let best: { allow: boolean; path: string } | undefined;
  for (const r of group.rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return best && `${best.allow ? 'Allow' : 'Disallow'}: ${best.path}`;
}

/** Minimal robots.txt check for the `*` user agent (and ours). */
export function robotsAllows(robotsTxt: string, path: string, agent = 'golftrackerbot'): boolean {
  return !robotsMatch(robotsTxt, path, agent)?.startsWith('Disallow');
}

/** Cheap content hash used to skip the Claude call when a page hasn't changed. */
export function hashText(s: string): string {
  let h1 = 0x811c9dc5, h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = ((h2 * 33) ^ c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36) + s.length.toString(36);
}
