/**
 * Reads a results table a parent copied from a tour's results page (US Kids/TourCaddiePro first), e.g.
 *
 *   POSITION  PLAYER                SCORE  R1  STROKES  POINTS
 *   2         -   Ford SMITH
 *                 Woodway, TX - UNITED STATES   +7   43   43   20.00
 *
 * Copied tables keep cells apart with tabs and rows/line breaks with newlines; this also copes with
 * everything run together with spaces. No AI: plain pattern matching, so it works offline.
 */
import { displayName, nameKey } from '../../scraper/results/names';

export interface PastedResult {
  position: string; // '1', 'T3', 'WD'
  posNum?: number;
  name: string;
  hometown?: string;
  toPar?: number;
  rounds: number[];
  total?: number;
  points?: number;
}

const POS = /^(T?\d{1,3}|WD|DQ|CUT|NS|MC|DNF)$/i;
const MOVE = /^([-–—]|[▲▼↑↓+]?\d{1,3}|E)$/;
const TO_PAR = /^(E|[+-]\d{1,3})$/i;
const INT = /^\d{1,3}$/;
const DEC = /^\d+\.\d+$/;
const TOWN = /^[A-Za-zÀ-ÿ .'-]+,\s*[A-Z]{2}\b/;

function parseRecord(cells: string[]): PastedResult | undefined {
  const [pos, ...rest] = cells;
  if (!pos || !POS.test(pos)) return undefined;
  let i = 0;
  // Optional movement column ("-", "▲2") before the name.
  if (rest[i] && MOVE.test(rest[i]) && rest[i + 1] && /[A-Za-z]/.test(rest[i + 1])) i++;
  const name = rest[i++];
  if (!name || !/[A-Za-z]{2}/.test(name) || /\d|•|\bholes?\b/i.test(name)) return undefined;
  let hometown: string | undefined;
  if (rest[i] && TOWN.test(rest[i])) hometown = rest[i++].replace(/\s*-\s*UNITED STATES$/i, '').trim();
  const nums = rest.slice(i).filter((c) => c !== '-' && c !== '--');
  let toPar: number | undefined;
  if (nums[0] && TO_PAR.test(nums[0]) && !(INT.test(nums[0]) && nums.length === 1)) {
    toPar = /^E$/i.test(nums[0]) ? 0 : Number(nums[0]);
    nums.shift();
  }
  let points: number | undefined;
  if (nums.length && DEC.test(nums[nums.length - 1])) points = Number(nums.pop());
  const ints = nums.filter((n) => INT.test(n)).map(Number);
  let rounds: number[] = [];
  let total: number | undefined;
  if (ints.length === 1) {
    rounds = ints;
    total = ints[0];
  } else if (ints.length > 1) {
    const last = ints[ints.length - 1];
    const before = ints.slice(0, -1);
    // Usually R1..Rn then the total; if the last number isn't their sum, they're all round scores.
    if (before.reduce((a, b) => a + b, 0) === last) {
      rounds = before;
      total = last;
    } else {
      rounds = ints;
      total = ints.reduce((a, b) => a + b, 0);
    }
  }
  const posNum = /^T?\d+$/i.test(pos) ? Number(pos.replace(/^T/i, '')) : undefined;
  return { position: pos.toUpperCase(), posNum, name: displayName(name), hometown, toPar, rounds, total, points };
}

/** Splits text into rows that each start with a position, keeping cells (tabs/newlines) apart. */
export function parsePastedResults(text: string): PastedResult[] {
  let lines = text.replace(/\r/g, '').split('\n');
  // Skip the page heading ("9 Holes • Mill Creek Golf Club") when the table's header row is there.
  const header = lines.findIndex((l) => /\bplayer\b/i.test(l) && /\b(pos|position|place)\b/i.test(l));
  if (header >= 0) lines = lines.slice(header + 1);
  const records: string[][] = [];
  let cur: string[] | undefined;
  for (const line of lines) {
    let cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    // Pasted without tabs: "2 - Ford SMITH" — split off the position (and a movement dash).
    if (cells.length === 1) {
      const m = cells[0].match(/^(T?\d{1,3}|WD|DQ|CUT|NS|MC|DNF)\s+(?:([-–—])\s+)?(\D.*)$/i);
      if (m && /[A-Za-z]{2}/.test(m[3]) && !TOWN.test(m[3])) cells = [m[1], ...(m[2] ? [m[2]] : []), m[3]];
      else {
        // "Woodway, TX - UNITED STATES +7 43 43 20.00": hometown then numbers.
        const t = cells[0].match(/^(.+?,\s*[A-Z]{2}(?:\s*-\s*[A-Z][A-Z ]+?)?)\s+((?:E|[+-]?\d+(?:\.\d+)?)(?:\s+(?:E|[+-]?\d+(?:\.\d+)?))*)$/);
        if (t) cells = [t[1], ...t[2].split(/\s+/)];
      }
    }
    if (POS.test(cells[0]) && cells.slice(1).some((c) => /[A-Za-z]{2}/.test(c) && !TOWN.test(c) && !POS.test(c))) {
      cur = [...cells];
      records.push(cur);
    } else if (cur) cur.push(...cells);
  }
  return records.map(parseRecord).filter((r): r is PastedResult => !!r);
}

/** The row that best matches a golfer's name: exact (any order/format), else all name words present. */
export function findPlayer(rows: PastedResult[], golferName: string): PastedResult | undefined {
  const key = nameKey(golferName);
  if (!key) return undefined;
  const exact = rows.find((r) => nameKey(r.name) === key);
  if (exact) return exact;
  const words = key.split(' ');
  return rows.find((r) => {
    const rk = nameKey(r.name).split(' ');
    return words.every((w) => rk.includes(w));
  });
}
