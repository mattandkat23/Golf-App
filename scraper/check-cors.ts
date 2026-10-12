/**
 * Debug: checks whether a URL's response allows cross-origin reads from the browser (CORS), by sending a
 * browser-like Origin header and printing the access-control-allow-origin response header. Useful before
 * wiring any browser-side fetch() to a third-party API.
 * Usage: node --experimental-strip-types scraper/check-cors.ts <url> [origin]
 */
const url = process.argv[2];
if (!url) throw new Error('usage: check-cors.ts <url> [origin]');
const origin = process.argv[3] ?? 'https://mattandkat23.github.io';

const res = await fetch(url, { headers: { Origin: origin, 'user-agent': 'Mozilla/5.0' } });
const allow = res.headers.get('access-control-allow-origin');
console.log(`GET ${url}\nOrigin: ${origin}\nHTTP ${res.status}`);
console.log(`access-control-allow-origin: ${allow ?? '(not set)'}`);
console.log(allow === '*' || allow === origin ? '\n✅ browser fetch from this origin would be allowed' : '\n❌ browser fetch would be blocked by CORS');
