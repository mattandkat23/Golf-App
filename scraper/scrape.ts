/**
 * Daily tour-schedule scraper (run by .github/workflows/scrape.yml).
 *
 * For each tour in sources.json it opens the tour's pages in headless Chromium, sends the page
 * text to Claude to pull out tournament events, follows the links Claude suggests (up to
 * maxPages), and writes everything to public/events.json, which the app reads.
 *
 * Claude is only called when a page's text has changed since the last run (see cache.json),
 * so most days cost nothing.
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { chromium, type Browser } from 'playwright-core';
import { type EventsFile, type ScrapedEvent, hashText, mergeEventsFile, normalizeEvents, robotsAllows, robotsCrawlDelay } from './lib.ts';

// Paths can be overridden for local testing.
const EVENTS_PATH = process.env.SCRAPER_EVENTS_PATH ?? 'public/events.json';
const CACHE_PATH = process.env.SCRAPER_CACHE_PATH ?? 'scraper/cache.json';
const SOURCES_PATH = process.env.SCRAPER_SOURCES_PATH ?? 'scraper/sources.json';
const PROMPT_VERSION = 1; // bump to invalidate cached extractions after changing the prompt or schema
const MODEL = 'claude-opus-5-5';
const USER_AGENT = 'Mozilla/5.0 (compatible; GolfTrackerBot/1.0; +https://github.com/mattandkat23/Golf-App)';
const MAX_PAGE_CHARS = 150_000;

interface Source {
  tourId: string;
  label: string;
  startUrls: string[];
  hint: string;
  maxPages?: number;
  /** Forces every event from this source to this level (e.g. US Kids state championships). */
  level?: 'Local' | 'State' | 'Regional' | 'World' | 'Other';
}

const Extraction = z.object({
  events: z.array(
    z.object({
      name: z.string(),
      startDate: z.string().describe('YYYY-MM-DD'),
      endDate: z.string().nullable().describe('YYYY-MM-DD for multi-day events, else null'),
      courseName: z.string().nullable(),
      city: z.string().nullable(),
      ageGroups: z.string().nullable().describe('e.g. "Boys & Girls 6-12" or null'),
      registrationDeadline: z.string().nullable().describe('YYYY-MM-DD or null'),
      entryFee: z.number().nullable().describe('USD, or null'),
      url: z.string().nullable().describe('absolute URL of the event page, or null'),
      level: z.enum(['Local', 'State', 'Regional', 'World', 'Other']).nullable(),
    }),
  ),
  nextUrls: z.array(z.string()).describe('Up to 3 absolute URLs from the link list worth opening next to find more of this tour’s events'),
  notes: z.string().describe('One short sentence on what this page contained'),
});
type Extraction = z.infer<typeof Extraction>;

interface CacheEntry {
  hash: string;
  promptVersion: number;
  extraction: Extraction;
}

const SYSTEM = `You extract junior golf tournament schedules from web pages for a family golf-tracking app.
You get the text of one page plus the links on it. Return:
- events: every tournament on this page that belongs to the requested tour. Use the year shown on the page; if a date has no year, pick the next occurrence on or after today's date. Leave a field null when the page doesn't say. Never invent courses, dates or fees.
- nextUrls: links (copied exactly from the link list) that likely lead to more of this tour's schedule, such as the tour's schedule page, the next season, or "view all". Leave it empty when this page already lists the whole schedule. Don't suggest login, registration-checkout, results or news pages.
Only include events for the tour described in the request; ignore other tours and cities.`;

function loadJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const robotsCache = new Map<string, string>();
async function robotsFor(origin: string): Promise<string> {
  if (!robotsCache.has(origin)) {
    const txt = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
    robotsCache.set(origin, txt);
  }
  return robotsCache.get(origin)!;
}
async function allowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  return robotsAllows(await robotsFor(u.origin), u.pathname + u.search);
}

/** Waits out the site's Crawl-delay since our last page load on that site. */
const lastLoad = new Map<string, number>();
async function politeWait(url: string) {
  const origin = new URL(url).origin;
  const delayMs = Math.max(robotsCrawlDelay(await robotsFor(origin)), 2) * 1000;
  const wait = (lastLoad.get(origin) ?? 0) + delayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLoad.set(origin, Date.now());
}

async function renderPage(browser: Browser, url: string) {
  const ctx = await browser.newContext({ userAgent: USER_AGENT });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const parts: string[] = [];
    const links: { text: string; href: string }[] = [];
    // Schedules are often embedded in iframes (tournament software), so read every frame.
    for (const frame of page.frames()) {
      try {
        const text = await frame.evaluate(() => document.body?.innerText ?? '');
        if (text.trim()) parts.push(frame === page.mainFrame() ? text : `\n[Embedded frame: ${frame.url()}]\n${text}`);
        const frameLinks = await frame.$$eval('a[href]', (as) =>
          as.map((a) => ({ text: ((a as HTMLAnchorElement).innerText || a.getAttribute('title') || '').trim().slice(0, 100), href: (a as HTMLAnchorElement).href })),
        );
        links.push(...frameLinks.filter((l) => l.href.startsWith('http')));
      } catch {
        // Cross-origin or detached frame; skip it.
      }
    }
    const unique = [...new Map(links.map((l) => [l.href, l])).values()].slice(0, 400);
    return { finalUrl: page.url(), text: parts.join('\n').slice(0, MAX_PAGE_CHARS), links: unique };
  } finally {
    await ctx.close();
  }
}

type PageContent = { kind: 'html'; text: string; links: { text: string; href: string }[] } | { kind: 'pdf'; base64: string };

const MAX_PDF_BYTES = 20 * 1024 * 1024;
async function fetchPdf(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PDF_BYTES) throw new Error(`PDF too large (${buf.length} bytes): ${url}`);
  if (buf.subarray(0, 4).toString() !== '%PDF') throw new Error(`Not a PDF: ${url}`);
  return buf.toString('base64');
}

async function extract(client: Anthropic, source: Source, url: string, page: PageContent, today: string) {
  const header = `Tour: ${source.label}\nWhat to collect: ${source.hint}\nToday's date: ${today}\nPage URL: ${url}`;
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    page.kind === 'pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: page.base64 } },
          { type: 'text', text: `${header}\n\nThe schedule is the attached PDF. It has no clickable links, so return an empty nextUrls list.` },
        ]
      : [
          {
            type: 'text',
            text: `${header}\n\n<page_text>\n${page.text}\n</page_text>\n\n<links>\n${page.links.map((l) => `- ${l.text || '(no text)'} → ${l.href}`).join('\n')}\n</links>`,
          },
        ];
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: zodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  });
  if (res.stop_reason === 'refusal') throw new Error(`Claude declined to read ${url}`);
  if (res.stop_reason === 'max_tokens') throw new Error(`Response cut off for ${url}`);
  if (!res.parsed_output) throw new Error(`Couldn't parse Claude's response for ${url}`);
  console.log(`    tokens in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
  return res.parsed_output;
}

async function scrapeSource(browser: Browser, client: Anthropic, source: Source, cache: Record<string, CacheEntry>, today: string) {
  const queue = [...source.startUrls];
  const visited = new Set<string>();
  const raw: Extraction['events'] = [];
  const errors: string[] = [];
  let pages = 0;
  while (queue.length && pages < (source.maxPages ?? 8)) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      if (!(await allowedByRobots(url))) {
        console.log(`  skip (robots.txt): ${url}`);
        continue;
      }
      pages++;
      console.log(`  page ${pages}: ${url}`);
      await politeWait(url);
      let finalUrl = url;
      let page: PageContent;
      if (/\.pdf($|\?)/i.test(url)) page = { kind: 'pdf', base64: await fetchPdf(url) };
      else {
        try {
          const r = await renderPage(browser, url);
          finalUrl = r.finalUrl;
          page = { kind: 'html', text: r.text, links: r.links };
        } catch (e) {
          // Links without a .pdf extension can still be file downloads.
          if (!/Download is starting/.test((e as Error).message)) throw e;
          page = { kind: 'pdf', base64: await fetchPdf(url) };
        }
      }
      visited.add(finalUrl);
      const key = `${source.tourId}|${finalUrl}`;
      const hash = hashText(source.hint + (page.kind === 'pdf' ? page.base64 : page.text + page.links.map((l) => l.href).join()));
      let extraction = cache[key]?.hash === hash && cache[key].promptVersion === PROMPT_VERSION ? cache[key].extraction : undefined;
      if (extraction) console.log('    unchanged since last run (cached)');
      else {
        extraction = await extract(client, source, finalUrl, page, today);
        cache[key] = { hash, promptVersion: PROMPT_VERSION, extraction };
      }
      console.log(`    ${extraction.events.length} events · ${extraction.notes}`);
      raw.push(...extraction.events);
      for (const next of extraction.nextUrls.slice(0, 3)) {
        try {
          const abs = new URL(next, finalUrl).toString();
          if (abs.startsWith('http') && !visited.has(abs)) queue.push(abs);
        } catch {
          // Ignore malformed URLs.
        }
      }
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`);
      console.log(`    error: ${(e as Error).message}`);
    }
  }
  const events: ScrapedEvent[] = normalizeEvents(
    source.tourId,
    raw.map((r) => ({
      ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)),
      ...(source.level && { level: source.level }),
    })) as Omit<ScrapedEvent, 'id' | 'tourId'>[],
    today,
  );
  // Finding no events at all (past or upcoming) usually means the site changed or blocked us; keep
  // last run's events in that case. Events that were found but are all in the past are a valid result.
  const ok = raw.length > 0;
  const error = ok ? (errors.length ? errors.join(' | ') : undefined) : errors.join(' | ') || 'No events found';
  return { tourId: source.tourId, ok, events, error };
}

async function main() {
  const only = process.argv[2]; // optional tourId to run just one source
  const sources = loadJson<Source[]>(SOURCES_PATH, []).filter((s) => !only || s.tourId === only);
  const cache = loadJson<Record<string, CacheEntry>>(CACHE_PATH, {});
  const previous = loadJson<EventsFile | undefined>(EVENTS_PATH, undefined);
  const now = new Date();
  // Dates are evaluated in Texas time.
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  const client = new Anthropic();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = [];
  try {
    for (const source of sources) {
      console.log(`\n${source.label}`);
      results.push(await scrapeSource(browser, client, source, cache, today));
    }
  } finally {
    await browser.close();
  }

  const merged = mergeEventsFile(previous, results, now.toISOString());
  // Drop events that ended more than 30 days ago.
  const cutoff = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  merged.events = merged.events.filter((e) => (e.endDate ?? e.startDate) >= cutoff);
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(merged, null, 1) + '\n');
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache) + '\n');

  console.log('\nSummary');
  for (const r of results) console.log(`  ${r.tourId}: ${r.ok ? `${r.events.length} events` : `FAILED – ${r.error}`}`);
  if (results.every((r) => !r.ok)) process.exitCode = 1;
}

main();
