import type { Course } from './types';

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

/** Finds the course a scraped event refers to, e.g. "Grey Rock GC" → "Grey Rock Golf Club". */
export function matchCourse(courses: Course[], name?: string, city?: string): Course | undefined {
  if (!name) return undefined;
  const key = courseKey(name);
  if (!key) return undefined;
  const cityLc = city?.toLowerCase().trim();
  const candidates = courses.filter((c) => {
    const ck = courseKey(c.name);
    return ck === key || (ck.length >= 4 && key.includes(ck)) || (key.length >= 4 && ck.includes(key));
  });
  return candidates.find((c) => c.city.toLowerCase() === cityLc) ?? candidates.find((c) => courseKey(c.name) === key) ?? candidates[0];
}

const REGION_CITIES: [Course['region'], string[]][] = [
  ['Austin', ['austin', 'round rock', 'georgetown', 'cedar park', 'leander', 'pflugerville', 'hutto', 'kyle', 'buda', 'san marcos', 'lakeway', 'bee cave', 'dripping springs', 'manor', 'lago vista', 'taylor', 'bastrop']],
  ['Dallas–Fort Worth', ['dallas', 'fort worth', 'plano', 'frisco', 'mckinney', 'allen', 'irving', 'arlington', 'grapevine', 'southlake', 'keller', 'coppell', 'carrollton', 'garland', 'richardson', 'the colony', 'flower mound', 'lewisville', 'denton', 'rockwall', 'euless', 'north richland hills', 'colleyville', 'prosper', 'fairview', 'mansfield', 'cedar hill', 'farmers branch', 'addison', 'westworth village', 'grand prairie', 'mesquite', 'wylie', 'little elm', 'trophy club', 'aledo', 'weatherford']],
  ['Waco', ['waco', 'woodway', 'hewitt', 'temple', 'belton', 'killeen']],
  ['San Antonio', ['san antonio', 'boerne', 'new braunfels', 'schertz', 'helotes']],
  ['Houston', ['houston', 'the woodlands', 'katy', 'sugar land', 'spring', 'humble', 'cypress', 'pearland', 'kingwood', 'conroe', 'league city', 'tomball']],
  ['Hill Country', ['horseshoe bay', 'fredericksburg', 'kerrville', 'marble falls', 'blanco', 'wimberley', 'burnet']],
];

export function regionForCity(city?: string): Course['region'] {
  const state = city?.match(/,\s*([A-Za-z .]+)$/)?.[1].trim().toLowerCase();
  if (state && state !== 'tx' && state !== 'texas') return 'Other';
  const c = city?.toLowerCase().replace(/,.*$/, '').trim();
  if (!c) return 'Other Texas';
  return REGION_CITIES.find(([, cities]) => cities.includes(c))?.[0] ?? 'Other Texas';
}
