/**
 * One-off/rerunnable backfill: pulls phone, website, GPS, architect/year and -- where real hole-by-hole
 * data exists -- one reference scorecard (par + yardage per hole, plus that tee's USGA rating/slope) for
 * each starter course, from OpenGolfAPI (https://opengolfapi.org/, free, no key needed for reads,
 * ODbL-1.0 licensed -- commercial use is fine with attribution, which the written file carries).
 *
 * Nationwide: queries OpenGolfAPI's /courses/search per course (name + state, see seedCourses()) rather
 * than bulk-fetching a whole state's listing -- that only worked when every course was Texas. A course's
 * name alone usually identifies it uniquely within a state, so a unique name match is trusted even when
 * the city text differs (e.g. a suburb vs. the metro area OpenGolfAPI files it under -- this is the common
 * case, like "Grey Rock Golf Club" filed under a nearby city). When a name matches more than one listing in
 * the state, the two cities are geocoded (free, no-key OpenStreetMap Nominatim, rate-limited and cached in
 * geocode-cache.json) and the closest one is used, but only if it's close (<=30mi) and clearly closer than
 * any other candidate -- otherwise it's left alone rather than risking the wrong course's data. Anything
 * still unmatched is skipped and listed at the end; course-web-lookup.ts covers those with a web search
 * instead (see its own comment). The one scorecard this builds (named after whichever tee OpenGolfAPI's
 * hole yardages belong to -- usually the back/championship tee) is a reference a parent can still edit;
 * it's rarely the age-based tee a US Kids round actually needs (see courses.ts's own comment).
 *
 * Writes src/data/courseDetails.json, which src/data/courses.ts merges into SEED_COURSES by name+city.
 * Usage: node --experimental-strip-types scraper/course-data.ts
 */
import fs from 'node:fs';
import { allowed, USER_AGENT } from './polite.ts';
import { courseKey, seedCourses } from './courseSeeds.ts';

const API = 'https://api.opengolfapi.org/api/v1';
const GEOCODE_CACHE_PATH = 'scraper/geocode-cache.json';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free, no-key geocoding for disambiguating a name match that hits more than one city in the same state.
// Nominatim's usage policy wants a descriptive User-Agent and no more than ~1 request/sec; results are
// cached to disk (keyed by "city|state") so a re-run only geocodes cities it hasn't seen before.
type GeoPoint = { lat: number; lng: number } | null; // null = looked up, nothing found (cached so we don't retry)
const geocodeCache: Record<string, GeoPoint> = JSON.parse(fs.readFileSync(GEOCODE_CACHE_PATH, 'utf8').trim() || '{}');
async function geocodeCity(city: string, state: string): Promise<GeoPoint> {
  const key = `${city.toLowerCase()}|${state}`;
  if (key in geocodeCache) return geocodeCache[key];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&country=us&state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } }).catch(() => undefined);
  await pause(1100); // stay well under Nominatim's ~1 req/sec policy
  const rows = (await res?.json().catch(() => undefined)) as { lat: string; lon: string }[] | undefined;
  const point = rows?.[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null;
  geocodeCache[key] = point;
  return point;
}
function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface Tee {
  name: string;
  pars: number[];
  yardages?: (number | undefined)[];
  rating?: number;
  slope?: number;
}

interface RemoteListing {
  id: string;
  course_name: string;
  city: string;
}

interface RemoteTee {
  tee_name?: string;
  course_rating?: number;
  slope?: number;
  yardage?: number;
}

interface RemoteHole {
  number: number;
  par?: number;
  yardages?: Record<string, number>;
}

interface RemoteDetail {
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  postal_code?: string;
  architect?: string;
  year_built?: number;
  tees?: RemoteTee[];
  holes_data?: RemoteHole[];
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  if (!(await allowed(url))) {
    console.log(`  robots.txt disallows ${url}`);
    return undefined;
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } }).catch(() => undefined);
  if (!res?.ok) {
    console.log(`  couldn't read ${url} (${res?.status ?? 'network error'})`);
    return undefined;
  }
  return res.json() as Promise<T>;
}

async function searchCourse(name: string, state: string): Promise<RemoteListing[]> {
  const page = await fetchJson<{ courses: RemoteListing[] }>(`${API}/courses/search?q=${encodeURIComponent(name)}&state=${state}&limit=50`);
  return page?.courses ?? [];
}

/** Candidates whose name matches, preferring an exact key match over a fuzzy substring one. */
function nameCandidates(listing: RemoteListing[], name: string): RemoteListing[] {
  const key = courseKey(name);
  if (!key) return [];
  const exact = listing.filter((c) => courseKey(c.course_name) === key);
  if (exact.length) return exact;
  return listing.filter((c) => {
    const ck = courseKey(c.course_name);
    return (ck.length >= 4 && key.includes(ck)) || (key.length >= 4 && ck.includes(key));
  });
}

/**
 * A unique name match within the state is trusted regardless of city text. A name that matches more than
 * one listing is disambiguated by real distance between the two cities' geocoded centers -- only accepted
 * when the closest candidate is near (<=30mi) and clearly closer than the next-closest, so an actual
 * same-name-different-city collision is left unmatched rather than guessed.
 */
async function findMatch(listing: RemoteListing[], name: string, city: string, state: string): Promise<RemoteListing | undefined> {
  const candidates = nameCandidates(listing, name);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const target = await geocodeCity(city, state);
  if (!target) return undefined;
  const withDist: { c: RemoteListing; dist: number }[] = [];
  for (const c of candidates) {
    const point = await geocodeCity(c.city, state);
    if (point) withDist.push({ c, dist: haversineMiles(target, point) });
  }
  withDist.sort((a, b) => a.dist - b.dist);
  const [best, second] = withDist;
  if (best && best.dist <= 30 && (!second || second.dist > best.dist * 2)) return best.c;
  return undefined;
}

/** Builds one Tee from OpenGolfAPI's hole-by-hole par/yardage, named and rated after whichever tee it matches best. */
function buildTee(detail: RemoteDetail): Tee | undefined {
  const holes = detail.holes_data?.filter((h) => h.number >= 1).sort((a, b) => a.number - b.number);
  if (!holes || (holes.length !== 9 && holes.length !== 18) || holes.some((h) => !h.par)) return undefined;
  const pars = holes.map((h) => h.par!);
  const yardages = holes.map((h) => (h.yardages ? Object.values(h.yardages)[0] : undefined));
  const totalYardage = yardages.reduce<number>((sum, y) => sum + (y ?? 0), 0);
  const tee = detail.tees?.length
    ? detail.tees.reduce((best, t) => (!best || Math.abs((t.yardage ?? 0) - totalYardage) < Math.abs((best.yardage ?? 0) - totalYardage) ? t : best))
    : undefined;
  return {
    name: tee?.tee_name ?? 'Reference tees (OpenGolfAPI)',
    pars,
    ...(yardages.some(Boolean) && { yardages }),
    ...(tee?.course_rating && { rating: tee.course_rating }),
    ...(tee?.slope && { slope: tee.slope }),
  };
}

interface CourseDetails {
  phone?: string;
  website?: string;
  lat?: number;
  lng?: number;
  postalCode?: string;
  architect?: string;
  yearBuilt?: number;
  tees?: Tee[];
}

const courses = seedCourses();
console.log(`Looking up ${courses.length} starter courses on OpenGolfAPI...`);
const out: Record<string, CourseDetails> = {};
const skipped: string[] = [];
let matched = 0;
for (const c of courses) {
  const listing = await searchCourse(c.name, c.state);
  await pause(400);
  const hit = await findMatch(listing, c.name, c.city, c.state);
  if (!hit) {
    skipped.push(`${c.name} (${c.city}, ${c.state})`);
    continue;
  }
  await pause(400);
  const detail = await fetchJson<RemoteDetail>(`${API}/courses/${hit.id}`);
  if (!detail) {
    skipped.push(`${c.name} (${c.city}) -- matched but detail fetch failed`);
    continue;
  }
  const tee = buildTee(detail);
  out[`${c.name}|${c.city}`] = {
    ...(detail.phone && { phone: detail.phone }),
    ...(detail.website && { website: detail.website }),
    ...(detail.lat && { lat: detail.lat }),
    ...(detail.lng && { lng: detail.lng }),
    ...(detail.postal_code && { postalCode: detail.postal_code }),
    ...(detail.architect && { architect: detail.architect }),
    ...(detail.year_built && { yearBuilt: detail.year_built }),
    ...(tee && { tees: [tee] }),
  };
  matched++;
  console.log(`  ${c.name}: matched (${tee ? 'with scorecard' : 'no scorecard data'})`);
}

fs.writeFileSync('src/data/courseDetails.json', JSON.stringify(out, null, 1) + '\n');
fs.writeFileSync(GEOCODE_CACHE_PATH, JSON.stringify(geocodeCache, null, 1) + '\n');
console.log(`\nEnriched ${matched}/${courses.length} courses.`);
if (skipped.length) console.log(`Skipped (no confident match):\n  ${skipped.join('\n  ')}`);
