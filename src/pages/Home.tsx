import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { computeStats, pct, summarizeRound, toParLabel } from '../lib/stats';
import { DateBox, Kpi, fmtDate, today } from '../components/ui';

export default function Home() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const upcoming = useLiveQuery(
    () => db.tournaments.where('startDate').aboveOrEqual(today()).filter((t) => t.status !== 'Withdrew').limit(3).toArray(),
    [],
  );
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const inProgress = useLiveQuery(() => db.rounds.filter((r) => !r.complete).toArray(), []);
  const recent = useLiveQuery(() => db.rounds.orderBy('date').reverse().filter((r) => !!r.complete).limit(10).toArray(), []);
  const lastPractice = useLiveQuery(() => db.practice.orderBy('date').reverse().first(), []);
  const courseName = (id?: number) => courses?.find((c) => c.id === id)?.name ?? '';
  const stats = recent ? computeStats(recent) : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small">{fmtDate(today())}</div>
          <h1>{profile?.playerName ?? 'Golf'}</h1>
        </div>
        <Link className="btn primary" to="/round/new">
          Start round
        </Link>
      </div>

      {inProgress?.map((r) => (
        <Link key={r.id} to={`/play/${r.id}`} className="card link" style={{ borderColor: 'var(--accent)' }}>
          <div className="row between">
            <div>
              <b>Round in progress</b>
              <div className="muted small">
                {courseName(r.courseId)} · {summarizeRound(r).holesPlayed} holes entered
              </div>
            </div>
            <span className="tag accent">Resume ›</span>
          </div>
        </Link>
      ))}

      <div className="card">
        <div className="row between">
          <h2>Up next</h2>
          <Link to="/schedule" className="small">
            All events
          </Link>
        </div>
        {upcoming?.length ? (
          <ul className="list">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link to={`/tournament/${t.id}`}>
                  <DateBox date={t.startDate} />
                  <div className="grow">
                    <div>{t.name}</div>
                    <div className="muted small">
                      {courseName(t.courseId)} {t.teeTime && `· ${t.teeTime}`}
                    </div>
                  </div>
                  <span className="tag">{t.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            No upcoming events. <Link to="/tournament/new">Add a tournament</Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h2>Last 10 rounds</h2>
          <Link to="/stats" className="small">
            All stats
          </Link>
        </div>
        {stats && stats.holes > 0 ? (
          <div className="kpis" style={{ marginBottom: 0 }}>
            <Kpi value={stats.toParPer18 !== undefined ? toParLabel(Math.round(stats.toParPer18)) : undefined} label="Avg to par / 18" />
            <Kpi value={pct(stats.fairways) !== undefined ? `${pct(stats.fairways)}%` : undefined} label="Fairways" />
            <Kpi value={pct(stats.gir) !== undefined ? `${pct(stats.gir)}%` : undefined} label="Greens" />
            <Kpi value={stats.puttsPer18?.toFixed(1)} label="Putts / 18" />
            <Kpi value={pct(stats.scrambling) !== undefined ? `${pct(stats.scrambling)}%` : undefined} label="Scrambling" />
            <Kpi value={stats.approachProximityFt ? `${Math.round(stats.approachProximityFt)} ft` : undefined} label="Approach prox." />
          </div>
        ) : (
          <div className="empty">Finish a round to see stats here.</div>
        )}
      </div>

      <Link to="/practice" className="card link">
        <h2>Practice</h2>
        {lastPractice ? (
          <div className="muted small">
            Last session {fmtDate(lastPractice.date)} · {lastPractice.minutes} min
            {lastPractice.focus.length ? ` · ${lastPractice.focus.map((f) => f.area).join(', ')}` : ''}
          </div>
        ) : (
          <div className="muted small">No practice logged yet.</div>
        )}
      </Link>
    </>
  );
}
