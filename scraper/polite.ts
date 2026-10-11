/**
 * Robots.txt for everything a page loads, not just the page itself: a rendered page can call data feeds a site
 * has asked bots not to use (e.g. TourCaddiePro's /plugins/links/admin/), so every request is checked and the
 * disallowed ones are blocked before they leave the browser.
 */
import type { BrowserContext } from 'playwright-core';
import { robotsAllows } from './lib.ts';

export const USER_AGENT = 'Mozilla/5.0 (compatible; GolfTrackerBot/1.0; +https://github.com/mattandkat23/Golf-App)';

const robots = new Map<string, Promise<string>>();

export function robotsFor(origin: string): Promise<string> {
  if (!robots.has(origin)) {
    robots.set(
      origin,
      fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    );
  }
  return robots.get(origin)!;
}

export async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) return true;
  return robotsAllows(await robotsFor(u.origin), u.pathname + u.search);
}

/** Blocks every request robots.txt disallows in this browser context. Returns the blocked URLs as they happen. */
export async function blockDisallowed(context: BrowserContext): Promise<string[]> {
  const blocked: string[] = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (await allowed(url)) return route.continue();
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  return blocked;
}
