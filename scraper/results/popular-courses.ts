/**
 * One-off: ranks courses by how often they've hosted a tournament in result_events (AJGA nationwide, TGA/HJGT
 * Texas -- whatever's been collected so far, see collect.ts), so the starter course list can be grounded in
 * real junior-golf venues instead of a guessed "popular courses" list. Prints name|city|state|count, one per
 * line, most-used first; doesn't write anything.
 *
 * Usage: SUPABASE_SECRET_KEY=... node --experimental-strip-types scraper/results/popular-courses.ts [--limit=200]
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jcqvzumkfmbksduzdrbx.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');
const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 200);

interface Row {
  course_name: string | null;
  city: string | null;
  tour_id: string;
}

const all: Row[] = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db.from('result_events').select('course_name, city, tour_id').range(from, from + PAGE - 1);
  if (error) throw new Error(`reading result_events: ${error.message}`);
  all.push(...(data as Row[]));
  if (data.length < PAGE) break;
}
console.error(`${all.length} result_events rows read`);

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const counts = new Map<string, { name: string; city: string; count: number; tours: Set<string> }>();
for (const r of all) {
  if (!r.course_name) continue;
  const key = `${norm(r.course_name)}|${norm(r.city ?? '')}`;
  const existing = counts.get(key);
  if (existing) {
    existing.count++;
    existing.tours.add(r.tour_id);
  } else {
    counts.set(key, { name: r.course_name, city: r.city ?? '', count: 1, tours: new Set([r.tour_id]) });
  }
}

const ranked = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
console.error(`${counts.size} distinct venues, printing top ${ranked.length}`);
for (const r of ranked) console.log(`${r.name}|${r.city}|${r.count}|${[...r.tours].join(',')}`);
