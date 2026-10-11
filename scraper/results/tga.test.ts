import { describe, expect, it } from 'vitest';
import { parseTgaDates, parseTgaList } from './tga.ts';

describe('TGA', () => {
  it('reads TGA date styles', () => {
    expect(parseTgaDates('Jan. 31 - Feb 1, 2026', 2026)).toEqual({ start: '2026-01-31', end: '2026-02-01' });
    expect(parseTgaDates('Feb. 28 - Mar. 1', 2026)).toEqual({ start: '2026-02-28', end: '2026-03-01' });
    expect(parseTgaDates('June 29- July 1, 2026', 2026)).toEqual({ start: '2026-06-29', end: '2026-07-01' });
    expect(parseTgaDates('Sept. 12-13, 2025', 2026)).toEqual({ start: '2025-09-12', end: '2025-09-13' });
  });

  it('reads the junior events table, live or archived', () => {
    const html = `<table><tr><td>Winter Classic &#8211; Open</td><td>Jan. 17-18, 2026</td><td>Dallas Athletic Club</td><td>Dallas</td>
      <td><a href="https://www.golfgenius.com/pages/12196951516707324494">RESULTS</a></td></tr>
      <tr><td>Spring Preview &#8211; Open</td><td>Feb. 28 - Mar. 1</td><td>Rayburn Resort | Brookeland</td>
      <td><a href="http://web.archive.org/web/2025/https://www.golfgenius.com/pages/12196574405022745151">RESULTS</a></td></tr>
      <tr><td>Alamo Shootout &#8211; Open</td><td>Dec. 5-6, 2026</td><td>Olympia Hills</td><td>Universal City</td><td>OPENS OCTOBER 14</td></tr></table>`;
    expect(parseTgaList(html)).toEqual([
      { pageId: '12196951516707324494', name: 'Winter Classic', startDate: '2026-01-17', endDate: '2026-01-18', course: 'Dallas Athletic Club', city: 'Dallas' },
      { pageId: '12196574405022745151', name: 'Spring Preview', startDate: '2026-02-28', endDate: '2026-03-01', course: 'Rayburn Resort', city: 'Brookeland' },
    ]);
  });
});
