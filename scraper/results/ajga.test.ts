import { describe, expect, it } from 'vitest';
import { pageParameter, parseAjgaScheduleList, readAjgaLeaderboard } from './ajga.ts';

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
});
