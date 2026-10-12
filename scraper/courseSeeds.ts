/**
 * Shared by course-data.ts and course-web-lookup.ts: reads the starter course list straight from
 * src/data/courses.ts's source text, and the same fuzzy-name-matching key both scripts use to compare a
 * seed course's name against a remote result's.
 *
 * Self-contained/leaf on purpose (only imports node:fs) so the two scripts above can import it with an
 * explicit '.ts' extension -- see their own comments on why src/lib/src/data can't be imported directly
 * when a scraper script runs via `node --experimental-strip-types`.
 */
import fs from 'node:fs';

const FILLER = new Set(['the', 'golf', 'club', 'course', 'courses', 'country', 'cc', 'gc', 'resort', 'links', 'at', 'of', 'and', 'municipal', 'park']);
export function courseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ');
}

export interface SeedCourse {
  name: string;
  city: string;
  state: string;
}

export function seedCourses(path = 'src/data/courses.ts'): SeedCourse[] {
  const text = fs.readFileSync(path, 'utf8');
  return [...text.matchAll(/^\s*\['([^']+)',\s*'([^']+)',\s*'([^']*)'(?:,\s*'([^']*)')?\]/gm)].map((m) => ({
    name: m[1],
    city: m[2],
    state: m[4] ?? 'TX', // every region but 'Other' is a Texas sub-region (see Seed in courses.ts)
  }));
}
