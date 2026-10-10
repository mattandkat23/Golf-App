import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { CONTACTS, bucketLabel, computeStats, holeComplete, pct, summarizeRound, toParLabel, type Rate } from '../lib/stats';
import type { Miss, Round, TourLevel } from '../lib/types';
import { Bars, Chips, Kpi, PageHead } from '../components/ui';

type Range = 'Last 5' | 'Last 10' | 'Season' | 'All';
type Kind = 'All rounds' | 'Tournaments' | TourLevel;

const ratePct = (r: Rate) => (pct(r) !== undefined ? `${pct(r)}%` : '—');

function MissCompass({ miss, center, centerLabel }: { miss: Record<Miss, number>; center: number; centerLabel: string }) {
  const cell = (m: Miss) => (
    <div className="cell">
      <b>{miss[m]}</b>
      <span className="small muted">{m}</span>
    </div>
  );
  return (
    <div className="compass" aria-label="Miss directions">
      <div />
      {cell('Long')}
      <div />
      {cell('Left')}
      <div className="center" style={{ flexDirection: 'column' }}>
        {centerLabel} hit
        <br />
        {center}
      </div>
      {cell('Right')}
      <div />
      {cell('Short')}
      <div />
    </div>
  );
}

/** Score-to-par trend as a simple SVG line with dot markers and native tooltips. */
function Trend({ rounds }: { rounds: Round[] }) {
  const pts = rounds
    .map((r) => ({ r, s: summarizeRound(r) }))
    .filter((p) => p.s.holesPlayed > 0)
    .map((p) => ({ date: p.r.date, v: ((p.s.strokes - p.s.par) / p.s.holesPlayed) * 18 }));
  if (pts.length < 2) return <div className="empty">Play two or more rounds to see a trend.</div>;
  const W = 320, H = 120, pad = 24;
  const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v), 1);
  const x = (i: number) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v: number) => H - pad - ((v - lo) * (H - pad * 2)) / (hi - lo || 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Score to par per 18 holes, oldest to newest">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--grid)" strokeWidth={1} />
      <text x={2} y={y(0) + 4} fontSize="10" fill="var(--muted)">E</text>
      <polyline fill="none" stroke="var(--series-1)" strokeWidth={2} points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.v)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2}>
          <title>{`${p.date}: ${toParLabel(Math.round(p.v))} per 18`}</title>
        </circle>
      ))}
      <text x={x(pts.length - 1)} y={y(pts.at(-1)!.v) - 8} fontSize="11" textAnchor="end" fill="var(--text)">
        {toParLabel(Math.round(pts.at(-1)!.v))}
      </text>
    </svg>
  );
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>('Last 10');
  const [kind, setKind] = useState<Kind>('All rounds');
  const [tourId, setTourId] = useState<string>();
  const gid = useGolfer().golfer.id;
  const all = useLiveQuery(() => db.rounds.where('golferId').equals(gid).sortBy('date'), [gid]);
  const tournaments = useLiveQuery(() => db.tournaments.toArray(), []);
  const tours = useLiveQuery(() => db.tours.toArray(), []);
  if (!all || !tournaments || !tours) return null;

  const tourOf = (r: Round) => tournaments.find((t) => t.id === r.tournamentId)?.tourId;
  const playedTours = tours.filter((t) => all.some((r) => tourOf(r) === t.id));

  const levelOf = (r: Round) => tournaments.find((t) => t.id === r.tournamentId)?.level;
  let rounds = all.filter((r) => r.holes.some(holeComplete));
  if (kind === 'Tournaments') rounds = rounds.filter((r) => r.tournamentId);
  else if (kind !== 'All rounds') rounds = rounds.filter((r) => levelOf(r) === kind);
  if (tourId) rounds = rounds.filter((r) => tourOf(r) === tourId);
  const year = String(new Date().getFullYear());
  if (range === 'Season') rounds = rounds.filter((r) => r.date.startsWith(year));
  if (range === 'Last 5') rounds = rounds.slice(-5);
  if (range === 'Last 10') rounds = rounds.slice(-10);
  const s = computeStats(rounds);

  const clubs = Object.entries(s.contactByClub).sort((a, b) => b[1].Center + b[1].Heel + b[1].Toe + b[1].Fat + b[1].Thin - (a[1].Center + a[1].Heel + a[1].Toe + a[1].Fat + a[1].Thin));
  const contactTotal = CONTACTS.reduce((n, c) => n + s.contact[c], 0);

  return (
    <>
      <PageHead title="Stats" />
      <div className="stack" style={{ marginBottom: 12 }}>
        <Chips options={['Last 5', 'Last 10', 'Season', 'All'] as Range[]} value={range} scroll onChange={(v) => v && setRange(v)} />
        <Chips options={['All rounds', 'Tournaments', 'Local', 'State', 'Regional', 'World'] as Kind[]} value={kind} scroll onChange={(v) => v && setKind(v)} />
        {playedTours.length > 0 && (
          <Chips
            options={playedTours.map((t) => t.id)}
            value={tourId}
            scroll
            allowClear
            label={(id) => tours.find((t) => t.id === id)?.name ?? id}
            onChange={setTourId}
          />
        )}
      </div>

      {s.holes === 0 ? (
        <div className="card empty">No completed holes for this filter yet.</div>
      ) : (
        <>
          <div className="kpis">
            <Kpi value={s.toParPer18 !== undefined ? toParLabel(Math.round(s.toParPer18 * 10) / 10) : undefined} label="To par / 18" />
            <Kpi value={ratePct(s.fairways)} label="Fairways" />
            <Kpi value={ratePct(s.gir)} label="Greens in reg." />
            <Kpi value={s.puttsPer18?.toFixed(1)} label="Putts / 18" />
            <Kpi value={s.threePutts} label="3-putts" />
            <Kpi value={s.penalties} label="Penalty strokes" />
            <Kpi value={ratePct(s.scrambling)} label="Scrambling" />
            <Kpi value={ratePct(s.sandSaves)} label="Sand saves" />
            <Kpi value={s.approachProximityFt ? `${Math.round(s.approachProximityFt)} ft` : undefined} label="Approach prox." />
          </div>
          <p className="muted small">
            {s.rounds} round{s.rounds === 1 ? '' : 's'} · {s.holes} holes
            {s.gir.total < s.holes && ` · greens from ${s.gir.total} holes`}
            {s.puttHoles < s.holes && ` · putts from ${s.puttHoles} holes`}
          </p>

          <div className="card">
            <h2>Score to par (per 18)</h2>
            <Trend rounds={rounds} />
          </div>

          <div className="card">
            <h2>Scoring</h2>
            <Bars
              rows={([3, 4, 5] as const).filter((p) => s.byPar[p].holes).map((p) => ({ label: `Par ${p}`, value: s.byPar[p].avg!, note: toParLabel(Math.round((s.byPar[p].avg! - p) * 100) / 100) }))}
              format={(v) => v.toFixed(2)}
            />
            <h3 style={{ marginTop: 14 }}>Hole scores</h3>
            <Bars rows={Object.entries(s.scoreDist).map(([label, value]) => ({ label, value }))} />
          </div>

          <div className="card">
            <h2>Off the tee</h2>
            <MissCompass miss={s.teeMiss} center={s.fairways.made} centerLabel="Fairways" />
            <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>
              Fairways {ratePct(s.fairways)} ({s.fairways.made}/{s.fairways.total})
            </p>
          </div>

          <div className="card">
            <h2>Approach shots</h2>
            <MissCompass miss={s.approachMiss} center={s.approachGreens.made} centerLabel="Greens" />
            <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>
              Hit green {ratePct(s.approachGreens)} · avg leave {s.approachProximityFt ? `${Math.round(s.approachProximityFt)} ft` : '—'}
            </p>
          </div>

          <div className="card">
            <h2>Putting — make % by distance</h2>
            {s.firstPuttAvgFt && <p className="muted small">Avg first putt: {Math.round(s.firstPuttAvgFt)} ft</p>}
            <Bars
              rows={s.puttingByDistance.filter((b) => b.total).map((b) => ({ label: bucketLabel(b.bucket), value: Math.round((100 * b.made) / b.total), note: `${b.made}/${b.total}` }))}
              format={(v) => `${v}%`}
              max={100}
            />
          </div>

          <div className="card">
            <h2>Contact quality</h2>
            {contactTotal ? (
              <>
                <Bars rows={CONTACTS.map((c) => ({ label: c, value: s.contact[c] }))} format={(v) => `${Math.round((100 * v) / contactTotal)}%`} />
                <h3 style={{ marginTop: 14 }}>By club (center %)</h3>
                <Bars
                  rows={clubs.map(([club, c]) => {
                    const n = CONTACTS.reduce((t, k) => t + c[k], 0);
                    const worst = CONTACTS.filter((k) => k !== 'Center').sort((a, b) => c[b] - c[a])[0];
                    return { label: club, value: Math.round((100 * c.Center) / n), note: c[worst] ? `${worst} miss` : undefined };
                  })}
                  format={(v) => `${v}%`}
                  max={100}
                />
              </>
            ) : (
              <div className="empty">Tag contact on shots to see this.</div>
            )}
          </div>
        </>
      )}
    </>
  );
}
