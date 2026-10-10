/**
 * Prints a site's robots.txt and whether the scraper may read each URL.
 * Usage: node --experimental-strip-types scraper/robots-check.ts <url> [url...]
 */
import { robotsAllows, robotsMatch } from './lib.ts';

const USER_AGENT = 'Mozilla/5.0 (compatible; GolfTrackerBot/1.0; +https://github.com/mattandkat23/Golf-App)';
const shown = new Set<string>();
for (const url of process.argv.slice(2)) {
  const u = new URL(url);
  const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } });
  const txt = res.ok ? await res.text() : '';
  if (!shown.has(u.origin)) {
    shown.add(u.origin);
    console.log(`\n===== ${u.origin}/robots.txt (HTTP ${res.status}) =====\n${txt || '(empty)'}\n===== end =====`);
  }
  const path = u.pathname + u.search;
  const rule = robotsMatch(txt, path);
  console.log(`${robotsAllows(txt, path) ? 'ALLOWED   ' : 'DISALLOWED'} ${url}${rule ? `   (rule: ${rule})` : '   (no matching rule)'}`);
}
