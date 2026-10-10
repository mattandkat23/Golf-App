import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { DateBox, PageHead, today } from '../components/ui';

export default function Schedule() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [tourFilter, setTourFilter] = useState<string>();
  const tournaments = useLiveQuery(() => db.tournaments.orderBy('startDate').toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const tours = useLiveQuery(() => db.tours.toArray(), []);
  const myTourIds = useLiveQuery(() => db.profile.get('me').then((p) => p?.myTours ?? []), []);
  const t0 = today();

  // Filter chips: the golfer's tours plus any tour that already has events.
  const usedTourIds = new Set([...(myTourIds ?? []), ...(tournaments ?? []).flatMap((t) => (t.tourId ? [t.tourId] : []))]);
  const chipTours = (tours ?? []).filter((t) => usedTourIds.has(t.id));
  const linkTours = (tours ?? []).filter((t) => t.url && (myTourIds?.length ? myTourIds.includes(t.id) : true));

  const list = (tournaments ?? [])
    .filter((t) => !tourFilter || t.tourId === tourFilter)
    .filter((t) => (tab === 'upcoming' ? (t.endDate ?? t.startDate) >= t0 : (t.endDate ?? t.startDate) < t0));
  if (tab === 'past') list.reverse();
  const tourName = (id?: string) => tours?.find((x) => x.id === id)?.name;

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
      <div className="stack" style={{ marginBottom: 12 }}>
        <div className="chips">
          {(['upcoming', 'past'] as const).map((k) => (
            <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {k === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
        {chipTours.length > 0 && (
          <div className="chips scroll">
            <button className={`chip${!tourFilter ? ' on' : ''}`} onClick={() => setTourFilter(undefined)}>
              All tours
            </button>
            {chipTours.map((t) => (
              <button key={t.id} className={`chip${tourFilter === t.id ? ' on' : ''}`} onClick={() => setTourFilter(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        )}
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
                    <div className="muted small">
                      {[tourName(t.tourId), courses?.find((c) => c.id === t.courseId)?.name].filter(Boolean).join(' · ')}
                    </div>
                    <div className="row wrap" style={{ marginTop: 4 }}>
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
        <h2>Find events</h2>
        <p className="muted small">
          Open a tour's schedule, find an event he's playing, then tap <b>+ Add</b>.{' '}
          {myTourIds?.length ? (
            <>
              Showing your tours — <Link to="/more">change</Link>.
            </>
          ) : (
            <>
              Pick his tours under <Link to="/more">More → My tours</Link> to shorten this list.
            </>
          )}
        </p>
        <ul className="list">
          {linkTours.map((t) => (
            <li key={t.id}>
              <a href={t.url} target="_blank" rel="noreferrer">
                {t.name} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
