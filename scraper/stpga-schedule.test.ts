import { describe, expect, it } from 'vitest';
import { parseStpgaSchedule } from './stpga-schedule.ts';

const SAMPLE = `Aug 10-11\t
\t
PT - STPGA Challenge  About
Blackhorse GC- North\t  ·  \t
Cypress, TX
Leaderboard\tA+\t
AJGA(B&G) , GJGR, JGS
View leaderboard
Aug 16\t
\t
Junior Tour - Bentwater Country Club
Bentwater CC Weiskopf\t  ·  \t
Montgomery, TX
Leaderboard\tH\t

View leaderboard
Aug 23\t
JCC\t
Junior Tour - Jimmy Clay GC
Jimmy Clay Course\t  ·  \t
Austin, TX
Leaderboard\tA\t

View leaderboard
Oct 17\t
\t
Junior Tour - Fort Sam Houston GC
Fort Sam Houston GC\t  ·  \t
San Antonio, TX
Info\tS\t

Register
$70 • Closes Tomorrow
`;

describe('parseStpgaSchedule', () => {
  const events = parseStpgaSchedule(SAMPLE, '2026-10-11');

  it('keeps the name and course separate even when both contain a course word', () => {
    const e = events.find((e) => e.name.startsWith('Junior Tour - Bentwater'));
    expect(e?.name).toBe('Junior Tour - Bentwater Country Club');
    expect(e?.courseName).toBe('Bentwater CC Weiskopf');
  });

  it('strips the trailing "About" link from major event names', () => {
    const e = events.find((e) => e.name.includes('STPGA Challenge'));
    expect(e?.name).toBe('PT - STPGA Challenge');
    expect(e?.courseName).toBe('Blackhorse GC- North');
    expect(e?.city).toBe('Cypress');
  });

  it('drops the stray favorite-column code instead of reading it as the event name', () => {
    const e = events.find((e) => e.name.includes('Jimmy Clay'));
    expect(e?.name).toBe('Junior Tour - Jimmy Clay GC');
  });

  it('reads the entry fee and ignores the deadline text, without creating a phantom event for its date', () => {
    const e = events.find((e) => e.name.includes('Fort Sam Houston'));
    expect(e?.entryFee).toBe(70);
    expect(events.some((e) => e.name === 'Closes')).toBe(false);
  });

  it('parses every real event with no extras', () => {
    expect(events).toHaveLength(4);
  });
});
