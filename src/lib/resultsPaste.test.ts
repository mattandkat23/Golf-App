import { describe, expect, it } from 'vitest';
import { findPlayer, parsePastedResults } from './resultsPaste';

// As copied from a US Kids results page (TourCaddiePro), one round.
const ONE_ROUND = `Boys 6 & Under
Boys 7
Mill Creek Golf Club
August 16
9 Holes • Mill Creek Golf Club
Refresh
POSITION\tPLAYER\tSCORE\tR1\tSTROKES\tPOINTS
1\t-\tBennett SPRADLIN
Knoxville, TN - UNITED STATES\t-1\t35\t35\t30.00
2\t-\tFord SMITH
Woodway, TX - UNITED STATES\t+7\t43\t43\t20.00
3\t-\tSkyler MARUSCO
Cedar Park, TX - UNITED STATES\t+32\t68\t68\t15.00`;

describe('pasted results', () => {
  it('reads a one-round US Kids table', () => {
    const rows = parsePastedResults(ONE_ROUND);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({ position: '2', posNum: 2, name: 'Ford Smith', hometown: 'Woodway, TX', toPar: 7, rounds: [43], total: 43, points: 20 });
    expect(rows[0].toPar).toBe(-1);
  });

  it('reads the same table pasted without tabs', () => {
    const rows = parsePastedResults(ONE_ROUND.replace(/\t/g, ' '));
    expect(rows.map((r) => [r.position, r.name, r.total])).toEqual([
      ['1', 'Bennett Spradlin', 35],
      ['2', 'Ford Smith', 43],
      ['3', 'Skyler Marusco', 68],
    ]);
    expect(rows[1].hometown).toBe('Woodway, TX');
  });

  it('reads two rounds, ties, even par and withdrawals', () => {
    const rows = parsePastedResults(`POSITION\tPLAYER\tSCORE\tR1\tR2\tSTROKES\tPOINTS
T1\t-\tAva LOPEZ
Austin, TX - UNITED STATES\tE\t36\t36\t72\t50.00
T1\t-\tMia CHEN
Plano, TX - UNITED STATES\tE\t35\t37\t72\t50.00
WD\t-\tZoe KIM
Waco, TX - UNITED STATES`);
    expect(rows.map((r) => [r.position, r.posNum, r.toPar, r.rounds, r.total])).toEqual([
      ['T1', 1, 0, [36, 36], 72],
      ['T1', 1, 0, [35, 37], 72],
      ['WD', undefined, undefined, [], undefined],
    ]);
  });

  it('finds the golfer however the name is written', () => {
    const rows = parsePastedResults(ONE_ROUND);
    expect(findPlayer(rows, 'Ford Smith')?.position).toBe('2');
    expect(findPlayer(rows, 'smith, ford')?.position).toBe('2');
    expect(findPlayer(rows, 'Emma Smith')).toBeUndefined();
  });
});
