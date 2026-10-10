import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { DateBox, PageHead, today } from '../components/ui';
import { US_KIDS_LINKS } from '../data/uskids';

export default function Schedule() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const tournaments = useLiveQuery(() => db.tournaments.orderBy('startDate').toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const t0 = today();
  const list = (tournaments ?? []).filter((t) => (tab === 'upcoming' ? (t.endDate ?? t.startDate) >= t0 : (t.endDate ?? t.startDate) < t0));
  if (tab === 'past') list.reverse();

  return (
    <>
      <PageHead
        title="Events"
        action={
          <Link className="btn primary" to="/tournament/new">
            + Add
          </Link>
        }
      />
      <div className="chips" style={{ marginBottom: 12 }}>
        {(['upcoming', 'past'] as const).map((k) => (
          <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {k === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      <div className="card">
        {list.length ? (
          <ul className="list">
            {list.map((t) => (
              <li key={t.id}>
                <Link to={`/tournament/${t.id}`}>
                  <DateBox date={t.startDate} />
                  <div className="grow">
                    <div>{t.name}</div>
                    <div className="muted small">{courses?.find((c) => c.id === t.courseId)?.name}</div>
                    <div className="row" style={{ marginTop: 4 }}>
                      <span className="tag">{t.level}</span>
                      <span className={`tag${t.status === 'Registered' ? ' accent' : ''}`}>{t.status}</span>
                      {t.finish && <span className="tag">Finished {t.finish}{t.fieldSize ? `/${t.fieldSize}` : ''}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">{tab === 'upcoming' ? 'No upcoming events yet.' : 'No past events.'}</div>
        )}
      </div>

      <div className="card">
        <h2>Find US Kids events</h2>
        <p className="muted small">
          Open the US Kids schedule, find an event he's playing, then tap <b>+ Add</b>. The course list already has Austin, Dallas, Waco and
          state/regional venues.
        </p>
        <ul className="list">
          {US_KIDS_LINKS.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
