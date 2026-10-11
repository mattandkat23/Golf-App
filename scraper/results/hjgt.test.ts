import { describe, expect, it } from 'vitest';
import { parseDateRange, parseHjgtList } from './hjgt.ts';

describe('HJGT', () => {
  it('reads date ranges', () => {
    expect(parseDateRange('October 10-11, 2026')).toEqual({ start: '2026-10-10', end: '2026-10-11' });
    expect(parseDateRange('Oct 31 - Nov 1, 2025')).toEqual({ start: '2025-10-31', end: '2025-11-01' });
    expect(parseDateRange('December 27, 2024')).toEqual({ start: '2024-12-27' });
    expect(parseDateRange('soon')).toBeUndefined();
  });

  it('reads the results list', () => {
    const html = `<div id="container"> <div class="tournamentcontainer tnmtresults32950"> <div Class="tournamentname">
      Dallas Spring Junior Open at Watters Creek <div class="datetextresults">March 14-15, 2026</div>
      <div class="citystateresults">Allen, TX</div> </div> <ul class="tnmtitemlist"> <li class="toplinecoursename">Watters Creek &amp; Golf</li> </ul>
      <div class="padtop tnmtstatusresults">Final</div> </div>
      <div class="tournamentcontainer tnmtresults33062"> <div Class="tournamentname"> Mid-Atlantic Regional <div class="datetextresults">October 10-11, 2026</div>
      <div class="citystateresults">Greensboro, NC</div> </div> <div class="padtop tnmtstatusresults">In Progress</div> </div>`;
    expect(parseHjgtList(html)).toEqual([
      { id: '32950', name: 'Dallas Spring Junior Open at Watters Creek', startDate: '2026-03-14', endDate: '2026-03-15', city: 'Allen, TX', course: 'Watters Creek & Golf', status: 'Final' },
      { id: '33062', name: 'Mid-Atlantic Regional', startDate: '2026-10-10', endDate: '2026-10-11', city: 'Greensboro, NC', course: undefined, status: 'In Progress' },
    ]);
  });
});
