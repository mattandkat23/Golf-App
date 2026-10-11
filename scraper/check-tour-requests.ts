/**
 * Flags new tour requests from parents (Events -> "Request a tour") so they don't sit unseen in the
 * database. Exits non-zero when there's something new, which fails the job on purpose — GitHub emails
 * repo watchers on a failed scheduled run (GitHub -> Settings -> Notifications -> Actions, if that's not
 * already on). The run's own log always lists what was asked for, failure email or not.
 *
 * Usage: SUPABASE_SECRET_KEY=... node --experimental-strip-types scraper/check-tour-requests.ts
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jcqvzumkfmbksduzdrbx.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');
const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

const SEEN_PATH = 'scraper/tour-requests-seen.json';
const seen = fs.existsSync(SEEN_PATH) ? (JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')) as { lastId: number }) : { lastId: 0 };

const { data, error } = await db.from('tour_requests').select('id, tour_name, tour_url, note, created_at').gt('id', seen.lastId).order('id');
if (error) throw new Error(`reading tour_requests: ${error.message}`);

if (!data.length) {
  console.log('No new tour requests.');
  process.exit(0);
}

console.log(`${data.length} new tour request${data.length === 1 ? '' : 's'}:\n`);
for (const r of data) {
  console.log(`- "${r.tour_name}"${r.tour_url ? ` (${r.tour_url})` : ''}${r.note ? ` — ${r.note}` : ''}`);
  console.log(`  requested ${String(r.created_at).slice(0, 10)}`);
}

fs.writeFileSync(SEEN_PATH, JSON.stringify({ lastId: Math.max(...data.map((r) => r.id as number)) }) + '\n');
console.log('\nPublish any you can with scraper/publish-schedule.ts, or add scraping support — then this stops flagging them.');
process.exit(1); // fails the job on purpose so a scheduled run surfaces this
