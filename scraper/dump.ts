/**
 * Debug helper: renders pages the way the scraper does and saves their full HTML (and each frame's) to
 * dumps/, so a results page's layout can be studied when writing a reader for it. Respects robots.txt.
 * With CLICK set to a selector, also clicks each matching element (e.g. age-group tabs) and saves after each.
 * Usage: CLICK='a.tab' node --experimental-strip-types scraper/dump.ts <url> [url...]
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { robotsAllows } from './lib.ts';

const USER_AGENT = 'Mozilla/5.0 (compatible; GolfTrackerBot/1.0; +https://github.com/mattandkat23/Golf-App)';
const click = process.env.CLICK;
fs.mkdirSync('dumps', { recursive: true });
const slug = (u: string) => u.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 100);

const browser = await chromium.launch();
const page = await (await browser.newContext({ userAgent: USER_AGENT })).newPage();

async function save(name: string) {
  fs.writeFileSync(`dumps/${name}.html`, await page.content());
  let i = 0;
  for (const f of page.frames()) {
    if (f === page.mainFrame() || f.url() === 'about:blank') continue;
    const html = await f.content().catch(() => '');
    fs.writeFileSync(`dumps/${name}.frame${++i}.html`, `<!-- ${f.url()} -->\n${html}`);
  }
  console.log(`saved ${name} (+${i} frames)`);
}

for (const url of process.argv.slice(2)) {
  const u = new URL(url);
  const robots = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } }).then((r) => (r.ok ? r.text() : ''));
  if (!robotsAllows(robots, u.pathname + u.search)) {
    console.log(`robots.txt disallows ${url}`);
    continue;
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  const name = slug(url);
  await save(name);
  if (!click) continue;
  for (const frame of page.frames()) {
    const n = await frame.locator(click).count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 30); i++) {
      await frame.locator(click).nth(i).click({ timeout: 5000 }).catch((e) => console.log(`click ${i} failed: ${e.message}`));
      await page.waitForTimeout(2000);
      await save(`${name}.click${i}`);
    }
  }
  await page.waitForTimeout(3000); // be polite between pages
}
await browser.close();
