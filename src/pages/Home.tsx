import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { computeStats, pct, summarizeRound, toParLabel } from '../lib/stats';
import { DateBox, Kpi, fmtDate, today } from '../components/ui';
import { findConflicts, upcomingDeadlines } from '../lib/schedule';

export default function Home() {
  const { golfer } = useGolfer();
  const gid = golfer.id;
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const rounds = useLiveQuery(() => db.rounds.where('golferId').equals(gid).sortBy('date'), [gid]);
  const inProgress = rounds?.filter((r) => !r.complete);
  const recent = rounds?.filter((r) => !!r.complete).slice(-10);
  const lastPractice = useLiveQuery(async () => (await db.practice.where('golferId').equals(gid).sortBy('date')).at(-1), [gid]);
  const allEvents = useLiveQuery(() => db.tournaments.where('golferId').equals(gid).sortBy('startDate'), [gid]);
  const upcoming = allEvents?.filter((t) => t.startDate >= today() && t.status !== 'Withdrew').slice(0, 3);
  const deadlines = allEvents ? upcomingDeadlines(allEvents, today()) : [];
  const conflictCount = allEvents ? findConflicts(allEvents, today()).size : 0;
  const courseName = (id?: number) => courses?.find((c) => c.id === id)?.name ?? '';
  const stats = recent ? computeStats(recent) : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small">{fmtDate(today())}</div>
          <h1>{golfer.playerName || 'Golf'}</h1>
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

      {deadlines.length > 0 && (
        <div className="card alert">
          <h2>Registration deadlines</h2>
          <ul className="list">
            {deadlines.map((d) => (
              <li key={d.tournament.id}>
                <Link to={`/tournament/${d.tournament.id}`}>
                  <div className="grow">
                    <div>{d.tournament.name}</div>
                    <div className="muted small">
                      Register by {fmtDate(d.date)} · {d.tournament.status}
                    </div>
                  </div>
                  <b>{d.daysLeft === 0 ? 'Today' : d.daysLeft === 1 ? '1 day' : `${d.daysLeft} days`}</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflictCount > 0 && (
        <Link to="/schedule" className="card link alert">
          ⚠ {conflictCount} upcoming events have overlapping dates. Review schedule ›
        </Link>
      )}

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
