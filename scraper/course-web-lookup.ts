/**
 * Fallback for starter courses OpenGolfAPI (course-data.ts) can't find: has Claude search the web for the
 * course's own official site and read it (web_search_20260209 + web_fetch_20260209 server tools -- no
 * client-side crawling or robots.txt handling needed, Anthropic's infrastructure runs the search/fetch),
 * extracting phone/address/website and, where the site publishes one, a complete hole-by-hole scorecard.
 * Also fills in just a scorecard for a course OpenGolfAPI matched but had no hole-by-hole data for.
 *
 * Conservative like course-data.ts: Claude is told to leave every field null rather than guess unless it
 * actually opened a page (via web_fetch, not just a search snippet) confirming the right course in the
 * right city, and a scorecard must be complete or left out entirely -- never a partial/estimated one.
 *
 * Merges into the same src/data/courseDetails.json course-data.ts writes (by name+city), so run this
 * after course-data.ts to cover what it couldn't match.
 * Usage: node --experimental-strip-types scraper/course-web-lookup.ts [--limit=N]
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { seedCourses } from './courseSeeds.ts';

const DETAILS_PATH = 'src/data/courseDetails.json';
// Sonnet, not Opus: this is mechanical extraction (find the official site, read phone/address off it),
// not judgment-heavy work, so the cheaper model is the right fit here -- half Opus's price per token.
const MODEL = 'claude-sonnet-5-5';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Tee {
  name: string;
  pars: number[];
  yardages?: (number | undefined)[];
}
interface CourseDetails {
  phone?: string;
  website?: string;
  address?: string;
  lat?: number;
  lng?: number;
  postalCode?: string;
  architect?: string;
  yearBuilt?: number;
  tees?: Tee[];
}

const CourseInfo = z.object({
  sourceUrl: z.string().nullable().describe("The course's own official page you actually opened with web_fetch and read, or null if you never confirmed one"),
  phone: z.string().nullable(),
  website: z.string().nullable().describe('The course’s main website (homepage), or null'),
  address: z.string().nullable().describe('Street address as shown on the official site, or null'),
  scorecard: z
    .object({
      holes: z.union([z.literal(9), z.literal(18)]),
      pars: z.array(z.number()),
      yardages: z.array(z.number().nullable()),
    })
    .nullable()
    .describe('Only a complete hole-by-hole scorecard (real par + yardage for every hole) read from the official site; null if not found or incomplete'),
  notes: z.string().describe('One short sentence on what was found, or why nothing was confidently found'),
});
type CourseInfo = z.infer<typeof CourseInfo>;

const SYSTEM = `You research junior golf courses for a family golf-tracking app, using web search and page fetching.
For the course described, find its real official website (not a directory, review or aggregator page) and, from pages you actually open with web_fetch -- never from a search-result snippet alone -- its phone number, street address, and, when asked for one, a complete hole-by-hole scorecard (par and yardage for every hole, from the course's own scorecard or course-info page).
Never invent or estimate a phone number, address, or any par/yardage value. If you can't confidently confirm this exact course in this exact city (not a different course with a similar name, or the same name in a different place), leave every field null and say why in notes.
A scorecard must be complete -- every hole, real par and real yardage straight from the site -- or left null entirely; never guess a missing hole.`;

async function lookup(client: Anthropic, name: string, city: string, state: string, needsScorecard: boolean): Promise<CourseInfo | undefined> {
  const ask = needsScorecard
    ? 'Find its official website/contact info and a full hole-by-hole scorecard.'
    : "Find its official website, phone and address (a scorecard isn't needed -- already have one).";
  const prompt = `${ask}\n\nCourse: ${name}\nCity: ${city}, ${state}`;
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: zodOutputFormat(CourseInfo) },
    system: SYSTEM,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
    ],
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') {
    console.log(`  Claude declined: ${name}`);
    return undefined;
  }
  if (res.stop_reason !== 'end_turn' && res.stop_reason !== 'tool_use') {
    console.log(`  stopped early (${res.stop_reason}): ${name}`);
    return undefined;
  }
  if (!res.parsed_output) {
    console.log(`  couldn't parse response: ${name}`);
    return undefined;
  }
  console.log(`    tokens in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
  return res.parsed_output;
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : Infinity;

const seeds = seedCourses();
const details = JSON.parse(fs.readFileSync(DETAILS_PATH, 'utf8')) as Record<string, CourseDetails>;

const targets = seeds
  .map((s) => ({ ...s, key: `${s.name}|${s.city}`, existing: details[`${s.name}|${s.city}`] }))
  .filter((s) => !s.existing || !s.existing.tees?.length)
  .slice(0, limit);

console.log(`${targets.length} courses need a web lookup (${targets.filter((t) => !t.existing).length} fully missing, ${targets.filter((t) => t.existing).length} missing just a scorecard).`);

const client = new Anthropic();
let filled = 0;
let scorecardsFound = 0;
for (const t of targets) {
  const needsScorecard = !t.existing?.tees?.length;
  const info = await lookup(client, t.name, t.city, t.state, needsScorecard);
  await pause(200);
  if (!info) continue;
  const patch: CourseDetails = { ...t.existing };
  let changed = false;
  if (!patch.phone && info.phone) {
    patch.phone = info.phone;
    changed = true;
  }
  if (!patch.website && info.website) {
    patch.website = info.website;
    changed = true;
  }
  if (!patch.address && info.address) {
    patch.address = info.address;
    changed = true;
  }
  if (!patch.tees?.length && info.scorecard && info.scorecard.pars.length === info.scorecard.holes && info.scorecard.yardages.length === info.scorecard.holes) {
    patch.tees = [{ name: 'Reference tees (web)', pars: info.scorecard.pars, yardages: info.scorecard.yardages.map((y) => y ?? undefined) }];
    changed = true;
    scorecardsFound++;
  }
  if (changed) {
    details[t.key] = patch;
    filled++;
    console.log(`  ${t.name}: ${info.sourceUrl ?? 'found'}${patch.tees?.length && needsScorecard ? ' (+scorecard)' : ''}`);
  } else {
    console.log(`  ${t.name}: nothing confident found (${info.notes})`);
  }
}

fs.writeFileSync(DETAILS_PATH, JSON.stringify(details, null, 1) + '\n');
console.log(`\nFilled in something new for ${filled}/${targets.length} courses (${scorecardsFound} scorecards).`);
