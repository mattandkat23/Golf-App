/**
 * One-off/rerunnable backfill: pulls phone, website, GPS, architect/year and -- where real hole-by-hole
 * data exists -- one reference scorecard (par + yardage per hole, plus that tee's USGA rating/slope) for
 * each starter course, from OpenGolfAPI (https://opengolfapi.org/, free, no key needed for reads,
 * ODbL-1.0 licensed -- commercial use is fine with attribution, which the written file carries).
 *
 * Deliberately conservative: a course is only filled in when its name+city matches a single OpenGolfAPI
 * listing in the same city (see findMatch); anything uncertain is skipped and listed at the end instead
 * of risking the wrong course's data. The one scorecard it builds (named after whichever tee OpenGolfAPI's
 * hole yardages belong to -- usually the back/championship tee) is a reference a parent can still edit;
 * it's rarely the age-based tee a US Kids round actually needs (see courses.ts's own comment).
 *
 * Writes src/data/courseDetails.json, which src/data/courses.ts merges into SEED_COURSES by name+city.
 * Usage: node --experimental-strip-types scraper/course-data.ts
 */
import fs from 'node:fs';
import { allowed, USER_AGENT } from './polite.ts';

const API = 'https://api.opengolfapi.org/api/v1';
const COURSES_PATH = 'src/data/courses.ts';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Self-contained on purpose: src/lib and src/data use the app's extension-less bundler-style imports,
// which Node's own ESM loader can't resolve when this script runs directly, so courseKey() is duplicated
// (kept tiny and in sync with src/lib/courseMatch.ts's) and the seed list is read from the source text
// instead of imported as a module.
const FILLER = new Set(['the', 'golf', 'club', 'course', 'courses', 'country', 'cc', 'gc', 'resort', 'links', 'at', 'of', 'and', 'municipal', 'park']);
function courseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ');
}

interface Tee {
  name: string;
  pars: number[];
  yardages?: (number | undefined)[];
  rating?: number;
  slope?: number;
}

function seedCourses(): { name: string; city: string }[] {
  const text = fs.readFileSync(COURSES_PATH, 'utf8');
  return [...text.matchAll(/^\s*\['([^']+)', '([^']+)', '[^']+'\]/gm)].map((m) => ({ name: m[1], city: m[2] }));
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

async function fetchAllTx(): Promise<RemoteListing[]> {
  const all: RemoteListing[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await fetchJson<{ courses: RemoteListing[]; total: number }>(`${API}/courses/state/TX?limit=200&offset=${offset}`);
    if (!page?.courses.length) break;
    all.push(...page.courses);
    if (all.length >= page.total) break;
    await pause(1000);
  }
  return all;
}

/** Only matches when exactly one OpenGolfAPI listing shares a city with this course and a close-enough name. */
function findMatch(listing: RemoteListing[], name: string, city: string): RemoteListing | undefined {
  const key = courseKey(name);
  if (!key) return undefined;
  const sameCity = listing.filter((c) => c.city.toLowerCase() === city.toLowerCase());
  const candidates = sameCity.filter((c) => {
    const ck = courseKey(c.course_name);
    return ck === key || (ck.length >= 4 && key.includes(ck)) || (key.length >= 4 && ck.includes(key));
  });
  return candidates.length === 1 ? candidates[0] : candidates.find((c) => courseKey(c.course_name) === key);
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

console.log('Fetching every OpenGolfAPI course in Texas...');
const listing = await fetchAllTx();
console.log(`  ${listing.length} courses`);

const courses = seedCourses();
const out: Record<string, CourseDetails> = {};
const skipped: string[] = [];
let matched = 0;
for (const c of courses) {
  const hit = findMatch(listing, c.name, c.city);
  if (!hit) {
    skipped.push(`${c.name} (${c.city})`);
    continue;
  }
  await pause(800);
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
console.log(`\nEnriched ${matched}/${courses.length} courses.`);
if (skipped.length) console.log(`Skipped (no confident match):\n  ${skipped.join('\n  ')}`);
