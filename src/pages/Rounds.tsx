import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { summarizeRound, toParLabel } from '../lib/stats';
import { DateBox, PageHead } from '../components/ui';

export default function Rounds() {
  const rounds = useLiveQuery(() => db.rounds.orderBy('date').reverse().toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const tournaments = useLiveQuery(() => db.tournaments.toArray(), []);

  return (
    <>
      <PageHead title="All rounds" back="/more" />
      <div className="card">
        {rounds?.length ? (
          <ul className="list">
            {rounds.map((r) => {
              const s = summarizeRound(r);
              const t = tournaments?.find((x) => x.id === r.tournamentId);
              return (
                <li key={r.id}>
                  <Link to={`/play/${r.id}`}>
                    <DateBox date={r.date} />
                    <div className="grow">
                      <div>{t ? `${t.name} · R${r.roundNumber}` : 'Casual round'}</div>
                      <div className="muted small">
                        {courses?.find((c) => c.id === r.courseId)?.name ?? 'No course'} · {s.holesPlayed}/{r.numHoles} holes
                        {!r.complete && ' · in progress'}
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
          <div className="empty">No rounds yet.</div>
        )}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        To delete a round, open it and tap Card → Delete round.
      </p>
    </>
  );
}
