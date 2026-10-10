import { describe, expect, it } from 'vitest';
import { eventId, mergeEventsFile, normalizeEvents, robotsAllows, robotsCrawlDelay } from './lib.ts';

describe('normalizeEvents', () => {
  it('drops bad rows, past events and duplicates; keeps stable ids', () => {
    const out = normalizeEvents(
      'ntpga',
      [
        { name: 'Fall Classic', startDate: '2026-11-08', courseName: 'Grey Rock' },
        { name: 'Fall Classic ', startDate: '2026-11-08', courseName: 'Grey Rock', city: 'Austin' }, // richer duplicate
        { name: 'Old', startDate: '2026-09-01' },
        { name: 'No date', startDate: 'Nov 9' },
        { name: '', startDate: '2026-11-10' },
        { name: 'Two day', startDate: '2026-12-01', endDate: '2026-12-02', entryFee: 0, url: 'javascript:void(0)' },
      ],
      '2026-10-10',
    );
    expect(out.map((e) => e.name)).toEqual(['Fall Classic', 'Two day']);
    expect(out[0].city).toBe('Austin');
    expect(out[0].id).toBe(eventId('ntpga', 'fall classic', '2026-11-08'));
    expect(out[1]).not.toHaveProperty('entryFee');
    expect(out[1]).not.toHaveProperty('url');
    expect(out[1].endDate).toBe('2026-12-02');
  });
});

describe('mergeEventsFile', () => {
  const prev = {
    generatedAt: 'x',
    sources: {},
    events: [
      { id: 'a', tourId: 'ntpga', name: 'A', startDate: '2026-11-01' },
      { id: 'b', tourId: 'usk-austin', name: 'B', startDate: '2026-11-02' },
    ],
  };
  it('replaces events for tours that succeeded and keeps them for tours that failed', () => {
    const out = mergeEventsFile(
      prev,
      [
        { tourId: 'ntpga', ok: true, events: [{ id: 'c', tourId: 'ntpga', name: 'C', startDate: '2026-11-03' }] },
        { tourId: 'usk-austin', ok: false, events: [], error: 'timeout' },
      ],
      'now',
    );
    expect(out.events.map((e) => e.id)).toEqual(['b', 'c']);
    expect(out.sources['usk-austin']).toMatchObject({ ok: false, eventCount: 1, error: 'timeout' });
    expect(out.sources.ntpga).toMatchObject({ ok: true, eventCount: 1 });
  });
});

describe('robotsAllows', () => {
  const robots = `User-agent: *\nDisallow: /private/\nAllow: /private/schedule\nDisallow: /*.pdf$\n\nUser-agent: badbot\nDisallow: /`;
  it('applies the * group with longest-match precedence', () => {
    expect(robotsAllows(robots, '/schedule')).toBe(true);
    expect(robotsAllows(robots, '/private/x')).toBe(false);
    expect(robotsAllows(robots, '/private/schedule/2026')).toBe(true);
    expect(robotsAllows(robots, '/files/a.pdf')).toBe(false);
    expect(robotsAllows('', '/anything')).toBe(true);
  });
});

describe('robotsCrawlDelay', () => {
  it('reads the * group delay', () => {
    expect(robotsCrawlDelay('User-agent: *\nCrawl-delay: 10\nDisallow: /x')).toBe(10);
    expect(robotsCrawlDelay('User-agent: bing\nCrawl-delay: 5\n\nUser-agent: *\nDisallow: /x')).toBe(0);
    expect(robotsCrawlDelay('')).toBe(0);
  });
});
