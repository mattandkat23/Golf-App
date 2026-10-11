import { describe, expect, it } from 'vitest';
import { ajgaEventMeta, ajgaScorecardLoginWalled, pageParameter, parseAjgaScheduleList, parseAjgaScorecard, readAjgaLeaderboard, readAjgaScorecardLinks } from './ajga.ts';

describe('AJGA', () => {
  it('reads the completed-events table', () => {
    const html = `<table><tr class="ScheduleRow" data-stripe="">
      <td class="ScheduleRow-date"><ps-dateformat range-start="2026-08-04" range-end="2026-08-07"><span class="year">2026</span></ps-dateformat></td>
      <td class="ScheduleRow-tournament">
        <div class="ScheduleRow-title"><a class="Link" href="https://www.ajga.org/tournaments/2026114" data-cms-ai="0">Justin Thomas Junior Championship</a></div>
        <div class="ScheduleRow-description">
                Harmony Landing Country Club
        </div>
      </td>
      <td class="ScheduleRow-location">
        Goshen, KY
      </td>
      <td class="ScheduleRow-results"><div class="ScheduleRow-relatedLink"><a class="Link" href="https://www.ajga.org/tournaments/2026114/leaderboard" data-cms-ai="0">Leaderboard</a></div></td>
    </tr>
    <tr class="ScheduleRow"><td class="ScheduleRow-date"><ps-dateformat range-start="2026-08-20" range-end="2026-08-20"></ps-dateformat></td>
      <td class="ScheduleRow-tournament"><div class="ScheduleRow-title"><a class="Link" href="https://www.ajga.org/tournaments/2026999q" data-cms-ai="0">Qualifier - No Results Yet</a></div></td>
      <td class="ScheduleRow-location">Dallas, TX</td>
    </tr></table>
    <ul class="SearchResults-pagination" data-page-parameter="00000194-4725-daba-a7f5-57bd04dc000d-p"></ul>`;
    expect(parseAjgaScheduleList(html)).toEqual([
      { id: '2026114', name: 'Justin Thomas Junior Championship', startDate: '2026-08-04', endDate: '2026-08-07', course: 'Harmony Landing Country Club', city: 'Goshen, KY' },
    ]);
    expect(pageParameter(html)).toBe('00000194-4725-daba-a7f5-57bd04dc000d-p');
  });

  it('reads each division on the leaderboard', () => {
    const html = `<div class="BottomBorderTabs" data-widget="Tabs">
      <ul class="BottomBorderTabs-tabs">
        <li><a class="BottomBorderTabs-tab" href="#boys" data-tab="">Boys</a></li>
        <li><a class="BottomBorderTabs-tab" href="#girls" data-tab="">Girls</a></li>
      </ul>
      <div class="BottomBorderTabs-panel" id="boys">
        <table><tbody>
          <tr class="aggregate-row odd" data-aggregate-id="1" data-aggregate-name="JP Lynch">
            <td class="pos" style="">1</td>
            <td class="name"><div class="player"><a class="Link" href="/tournaments2/details/1">JP Lynch</a>
              <div class="affiliation">Austin, Texas (2028)</div></div></td>
            <td class="colored score" style="color: #f00;">-8</td>
            <td class="colored past_round_total"><div><div class="col-xs-12 score_to_print">71</div></div></td>
            <td class="colored past_round_total"><div><div class="col-xs-12 score_to_print">71</div></div></td>
            <td class="colored total" style="color: #f00;">142</td>
          </tr>
          <tr class="expanded hidden"><td colspan="10">&nbsp;</td></tr>
          <tr class="aggregate-row even" data-aggregate-id="2" data-aggregate-name="Alexis Rouleau">
            <td class="pos" style="">T2</td>
            <td class="name"><div class="player"><a class="Link" href="/tournaments2/details/2">Alexis Rouleau</a>
              <div class="affiliation">(Canada) Montreal, Quebec, Canada (2029)</div></div></td>
            <td class="colored score">-4</td>
            <td class="colored past_round_total"><div><div class="col-xs-12 score_to_print">72</div></div></td>
            <td class="colored past_round_total"><div><div class="col-xs-12 score_to_print">70</div></div></td>
            <td class="colored total">142</td>
          </tr>
        </tbody></table>
      </div>
      <div class="BottomBorderTabs-panel" id="girls">
        <table><tbody>
          <tr class="aggregate-row odd" data-aggregate-id="3" data-aggregate-name="Jane Doe">
            <td class="pos" style="">1</td>
            <td class="name"><div class="player"><a class="Link" href="/tournaments2/details/3">Jane Doe</a>
              <div class="affiliation">Plano, Texas (2027)</div></div></td>
            <td class="colored score">E</td>
            <td class="colored past_round_total"><div><div class="col-xs-12 score_to_print">70</div></div></td>
            <td class="colored total">70</td>
          </tr>
        </tbody></table>
      </div>
    </div>`;
    expect(readAjgaLeaderboard(html)).toEqual([
      { division: 'Boys', position: '1', name: 'JP Lynch', hometown: 'Austin, Texas', gradYear: 2028, toPar: '-8', rounds: [71, 71], total: 142 },
      { division: 'Boys', position: 'T2', name: 'Alexis Rouleau', hometown: '(Canada) Montreal, Quebec, Canada', gradYear: 2029, toPar: '-4', rounds: [72, 70], total: 142 },
      { division: 'Girls', position: '1', name: 'Jane Doe', hometown: 'Plano, Texas', gradYear: 2027, toPar: 'E', rounds: [70], total: 70 },
    ]);
  });

  it('reads the event name/dates and each player\'s scorecard-API link off a leaderboard page', () => {
    const html = `<title>AJGA Junior All-Star Invitational - 2026 Leaderboard</title>
    <ps-dateformat range-start="2026-10-08T04:00:00Z" range-end="2026-10-11T04:00:00Z"></ps-dateformat>
    <div class="BottomBorderTabs" data-widget="Tabs">
      <ul class="BottomBorderTabs-tabs">
        <li><a class="BottomBorderTabs-tab" href="#boys" data-tab="">Boys</a></li>
      </ul>
      <div class="BottomBorderTabs-panel" id="boys">
        <ps-leaderboardtable data-scorecard-endpoint="https://www.ajga.org/api/scorecard?event_id=522977&amp;tournament_id=4867645&amp;team_play=false">
          <table><tbody>
            <tr class="aggregate-row odd" data-aggregate-id="2468296415" data-aggregate-name="Beckett McLaughlin" data-display-embed="true" data-member-ids="44232816" data-connected="">
              <td class="pos">1</td>
            </tr>
          </tbody></table>
        </ps-leaderboardtable>
      </div>
    </div>`;
    expect(ajgaEventMeta(html)).toEqual({ name: 'AJGA Junior All-Star Invitational', startDate: '2026-10-08', endDate: '2026-10-11' });
    expect(readAjgaScorecardLinks(html)).toEqual([
      { division: 'Boys', name: 'Beckett McLaughlin', eventId: '522977', tournamentId: '4867645', aggregateId: '2468296415', memberId: '44232816' },
    ]);
  });

  it('detects the login wall on an archived event\'s scorecard response', () => {
    expect(ajgaScorecardLoginWalled('<p>Login as an AJGA Player or Coach to view expanded Player Scorecards.</p>')).toBe(true);
    expect(ajgaScorecardLoginWalled('<table class="CourseTableScorecardRound-table">...</table>')).toBe(false);
  });

  it('parses a round\'s Hole/Par/Yardage/Score grid from a /api/scorecard response', () => {
    const cell = (value: string, cell: string) =>
      `<td class="CourseTableCell CourseTableScorecardRound-td " data-cell="${cell}"><div class="CourseTableCell-cell"><span class="CourseTableCell-cellText">${value}</span></div></td>`;
    const row = (label: string, values: string[], cells: string[]) =>
      `<tr class="CourseTableScorecardRound-row "  >${cell(label, 'row label')}${values.map((v, i) => cell(v, cells[i])).join('')}</tr>`;
    const cellIds = ['0', '1', 'out', '10', '11', 'in', 'total'];
    const html = `<div class="CourseTableScorecardTabs-panel" id="round-1">
      <table class="CourseTableScorecardRound-table">
        ${row('Hole', ['1', '2', 'Out', '10', '11', 'In', 'Total'], cellIds)}
        ${row('Par', ['4', '3', '7', '4', '5', '9', '16'], cellIds)}
        ${row('Yardage', ['400', '150', '550', '380', '520', '900', '1450'], cellIds)}
        ${row('Score', ['5', '', '5', '4', '6', '10', '15'], cellIds)}
      </table>
    </div>`;
    expect(parseAjgaScorecard(html)).toEqual([
      { round: 1, hole: 1, par: 4, yards: 400, score: 5 },
      // hole 2 has a blank score (not played yet) and is skipped
      { round: 1, hole: 10, par: 4, yards: 380, score: 4 },
      { round: 1, hole: 11, par: 5, yards: 520, score: 6 },
    ]);
  });
});
