/**
 * Name rules shared by the results collector and the app's search, so "SMITH, Ford", "Ford SMITH" and
 * "Ford Smith Jr." all find each other.
 */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/** "Smith, Ford" → "Ford Smith"; trims extra spaces. */
function firstLast(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  const comma = s.indexOf(',');
  if (comma < 0) return s;
  const last = s.slice(0, comma).trim();
  const first = s.slice(comma + 1).trim();
  // "Smith, Jr." style: the part after the comma is only a suffix.
  if (!first || SUFFIXES.has(first.toLowerCase().replace(/\./g, ''))) return `${last} ${first}`.trim();
  return `${first} ${last}`;
}

/** Search key: lowercase words without accents, punctuation or suffixes, in alphabetical order. */
export function nameKey(raw: string): string {
  return firstLast(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/['-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .sort()
    .join(' ');
}

/** Display name: "SMITH, Ford" → "Ford Smith". Mixed-case words are kept as written (McDonald, DeLaRosa). */
export function displayName(raw: string): string {
  return firstLast(raw)
    .split(' ')
    .map((w) => (w === w.toUpperCase() && w.length > 1 && !SUFFIXES.has(w.toLowerCase().replace(/\./g, '')) ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}
