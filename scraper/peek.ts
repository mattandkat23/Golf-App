/**
 * Debug helper: renders a page the way the scraper does and prints its text and links, so a tour's
 * page layout can be inspected from a GitHub Actions log. Respects robots.txt.
 * Usage: node --experimental-strip-types scraper/peek.ts <url> [filter-regex]
 */
import { chromium } from 'playwright-core';
import { USER_AGENT, allowed, blockDisallowed } from './polite.ts';
const [url, filter] = process.argv.slice(2);
const re = filter ? new RegExp(filter, 'i') : undefined;

if (!(await allowed(url))) {
  console.log(`robots.txt disallows ${url}`);
  process.exit(0);
}
const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: USER_AGENT });
const blocked = await blockDisallowed(context);
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
console.log(`FINAL URL: ${page.url()}\n----- TEXT -----`);
for (const frame of page.frames()) {
  const text = await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && (!re || re.test(l)));
  if (lines.length) console.log((frame === page.mainFrame() ? '' : `[frame ${frame.url()}]\n`) + lines.slice(0, 400).join('\n'));
}
console.log('----- LINKS -----');
const links = await page.$$eval('a[href]', (as) => as.map((a) => `${(a as HTMLAnchorElement).innerText.trim().replace(/\s+/g, ' ').slice(0, 80)} → ${(a as HTMLAnchorElement).href}`));
console.log([...new Set(links)].filter((l) => !re || re.test(l)).slice(0, 300).join('\n'));
if (blocked.length) console.log(`----- BLOCKED by robots.txt -----\n${blocked.join('\n')}`);
await browser.close();
