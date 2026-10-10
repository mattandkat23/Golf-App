import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { computeStats, pct, summarizeRound, toParLabel } from '../lib/stats';
import { Kpi, PageHead, fmtDate } from '../components/ui';

export default function TournamentDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const t = useLiveQuery(() => db.tournaments.get(id), [id]);
  const course = useLiveQuery(() => (t?.courseId ? db.courses.get(t.courseId) : undefined), [t?.courseId]);
  const rounds = useLiveQuery(() => db.rounds.where('tournamentId').equals(id).sortBy('roundNumber'), [id]);
  if (!t) return null;
  const stats = rounds?.length ? computeStats(rounds) : undefined;
  const totals = rounds?.map(summarizeRound);

  async function remove() {
    if (!confirm('Delete this event and its rounds?')) return;
    await db.rounds.where('tournamentId').equals(id).delete();
    await db.tournaments.delete(id);
    navigate('/schedule', { replace: true });
  }

  return (
    <>
      <PageHead
        title={t.name}
        back="/schedule"
        action={
          <Link className="btn" to={`/tournament/${id}/edit`}>
            Edit
          </Link>
        }
      />
      <div className="card stack">
        <div className="row wrap">
          <span className="tag">{t.level}</span>
          <span className={`tag${t.status === 'Registered' ? ' accent' : ''}`}>{t.status}</span>
          {t.ageGroup && <span className="tag">{t.ageGroup}</span>}
        </div>
        <div>
          {fmtDate(t.startDate)}
          {t.endDate && t.endDate !== t.startDate && ` – ${fmtDate(t.endDate)}`}
          {t.teeTime && <span className="muted"> · Tee time {t.teeTime}</span>}
        </div>
        {course && (
          <div>
            {course.name} <span className="muted">· {course.city}</span>
          </div>
        )}
        {(t.registrationDeadline || t.entryFee) && (
          <div className="muted small">
            {t.registrationDeadline && `Register by ${fmtDate(t.registrationDeadline)}`}
            {t.entryFee !== undefined && ` · $${t.entryFee}`}
          </div>
        )}
        {t.finish && (
          <div>
            <b>
              Finished {t.finish}
              {t.fieldSize ? ` of ${t.fieldSize}` : ''}
            </b>
            {t.qualified && <span className="tag accent" style={{ marginLeft: 8 }}>Qualified: {t.qualified}</span>}
          </div>
        )}
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer">
            US Kids event page ↗
          </a>
        )}
        {t.notes && <p className="muted">{t.notes}</p>}
      </div>

      <div className="card">
        <div className="row between">
          <h2>Rounds</h2>
          <Link className="btn primary" to={`/round/new?tournament=${id}`}>
            Start round {(rounds?.length ?? 0) + 1}
          </Link>
        </div>
        {rounds?.length ? (
          <ul className="list">
            {rounds.map((r, i) => {
              const s = totals![i];
              return (
                <li key={r.id}>
                  <Link to={`/play/${r.id}`}>
                    <div className="grow">
                      <div>
                        Round {r.roundNumber} <span className="muted small">· {fmtDate(r.date)}</span>
                      </div>
                      <div className="muted small">
                        {s.holesPlayed}/{r.numHoles} holes · {s.putts} putts {!r.complete && '· in progress'}
                      </div>
                    </div>
                    <b>
                      {s.strokes || '—'} {s.holesPlayed > 0 && <span className="muted small">({toParLabel(s.strokes - s.par)})</span>}
                    </b>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">No rounds yet. Tap Start round when he tees off.</div>
        )}
      </div>

      {stats && stats.holes > 0 && (
        <div className="kpis">
          <Kpi value={`${pct(stats.fairways) ?? '—'}%`} label="Fairways" />
          <Kpi value={`${pct(stats.gir) ?? '—'}%`} label="Greens" />
          <Kpi value={stats.puttsPerHole ? (stats.puttsPerHole * 9).toFixed(1) : undefined} label="Putts / 9" />
        </div>
      )}

      <button className="danger block" onClick={remove}>
        Delete event
      </button>
    </>
  );
}
