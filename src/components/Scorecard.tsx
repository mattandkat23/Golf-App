import type { HoleResult, Round } from '../lib/types';
import { fairwayResult, holeComplete, holePutts, holeStrokes, isGIR } from '../lib/stats';

const FW: Record<string, string> = { Hit: '✓', Left: '←', Right: '→', Missed: '✗' };

function Nine({ holes, label }: { holes: HoleResult[]; label: string }) {
  const done = holes.filter(holeComplete);
  return (
    <table className="score">
      <thead>
        <tr>
          <th>Hole</th>
          {holes.map((h) => (
            <th key={h.hole}>{h.hole}</th>
          ))}
          <th>{label}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="muted">
          <td>Par</td>
          {holes.map((h) => (
            <td key={h.hole}>{h.par}</td>
          ))}
          <td>{holes.reduce((n, h) => n + h.par, 0)}</td>
        </tr>
        <tr>
          <td>Score</td>
          {holes.map((h) => {
            if (!holeComplete(h)) return <td key={h.hole}>–</td>;
            const d = holeStrokes(h) - h.par;
            return (
              <td key={h.hole} className={d < 0 ? 'u-par' : d > 0 ? 'o-par' : ''}>
                {holeStrokes(h)}
              </td>
            );
          })}
          <td>
            <b>{done.reduce((n, h) => n + holeStrokes(h), 0) || '–'}</b>
          </td>
        </tr>
        <tr>
          <td>Putts</td>
          {holes.map((h) => (
            <td key={h.hole}>{holeComplete(h) ? holePutts(h) : ''}</td>
          ))}
          <td>{done.reduce((n, h) => n + holePutts(h), 0) || ''}</td>
        </tr>
        <tr>
          <td>FW</td>
          {holes.map((h) => {
            const f = holeComplete(h) ? fairwayResult(h) : undefined;
            return <td key={h.hole}>{f ? FW[f] : ''}</td>;
          })}
          <td />
        </tr>
        <tr>
          <td>GIR</td>
          {holes.map((h) => (
            <td key={h.hole}>{holeComplete(h) ? (isGIR(h) ? '✓' : '·') : ''}</td>
          ))}
          <td>{done.filter(isGIR).length || ''}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function Scorecard({ round }: { round: Round }) {
  const front = round.holes.slice(0, 9);
  const back = round.holes.slice(9);
  return (
    <div className="stack">
      <Nine holes={front} label="Out" />
      {back.length > 0 && <Nine holes={back} label="In" />}
    </div>
  );
}
