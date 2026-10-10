import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { Course, Tour, Tournament } from '../lib/types';
import { DateBox, PageHead, fmtDate, today } from '../components/ui';
import MonthCalendar from '../components/MonthCalendar';
import { ON_SCHEDULE, findConflicts, seasonSummary } from '../lib/schedule';
import { tourColor, useMyTours } from '../lib/tourColors';
import { buildIcs, openIcs, shareIcs, tournamentToIcs } from '../lib/ics';
import { type AvailableEvent, type AvailableFile, addAvailableEvent, useAvailableEvents } from '../lib/available';

type Tab = 'schedule' | 'available' | 'past';

function courseLabel(c?: Course) {
  return c ? `${c.name}${c.city ? `, ${c.city}` : ''}` : undefined;
}

function EventRow({ t, courses, tours, color, conflict }: { t: Tournament; courses: Course[]; tours: Tour[]; color: string; conflict?: boolean }) {
  return (
    <li>
      <Link to={`/tournament/${t.id}`}>
        <span className="tour-stripe" style={{ background: color }} />
        <DateBox date={t.startDate} />
        <div className="grow">
          <div>{t.name}</div>
          <div className="muted small">
            {[tours.find((x) => x.id === t.tourId)?.name, courses.find((c) => c.id === t.courseId)?.name].filter(Boolean).join(' · ')}
          </div>
          <div className="row wrap" style={{ marginTop: 4 }}>
            <span className={`tag${t.status === 'Registered' ? ' accent' : ''}`}>{t.status}</span>
            {conflict && <span className="tag">⚠ Date conflict</span>}
            {t.finish && (
              <span className="tag">
                Finished {t.finish}
                {t.fieldSize ? `/${t.fieldSize}` : ''}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function Schedule() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') as Tab) || 'schedule');
  const [view, setView] = useState<'calendar' | 'list'>('list');
  const [day, setDay] = useState<string>();
  const tournaments = useLiveQuery(() => db.tournaments.orderBy('startDate').toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []) ?? [];
  const tours = useLiveQuery(() => db.tours.toArray(), []) ?? [];
  const myTours = useMyTours();
  if (!tournaments) return null;

  const t0 = today();
  const colorOf = (t: { tourId?: string }) => tourColor(t.tourId, myTours);
  const onSchedule = tournaments.filter((t) => ON_SCHEDULE.has(t.status));
  const upcoming = onSchedule.filter((t) => (t.endDate ?? t.startDate) >= t0 && t.status !== 'Played');
  const past = tournaments.filter((t) => (t.endDate ?? t.startDate) < t0 || t.status === 'Played').reverse();
  const conflicts = findConflicts(tournaments, t0);
  const legendTours = tours.filter((x) => onSchedule.some((t) => t.tourId === x.id));

  function exportSchedule() {
    const items = upcoming.flatMap((t) =>
      tournamentToIcs(t, courseLabel(courses.find((c) => c.id === t.courseId)), tours.find((x) => x.id === t.tourId)?.name),
    );
    return buildIcs(items);
  }

  return (
    <>
      <PageHead
        title="Events"
        action={
          <div className="row">
            <Link className="btn" to="/import">
              Paste
            </Link>
            <Link className="btn primary" to="/tournament/new">
              + Add
            </Link>
          </div>
        }
      />
      <div className="chips" style={{ marginBottom: 12 }}>
        {(
          [
            ['schedule', 'My schedule'],
            ['available', 'Available'],
            ['past', 'Past'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          {conflicts.size > 0 && (
            <div className="card alert">
              <b>⚠ Date conflicts</b>
              <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {[...conflicts.entries()]
                  .filter(([id, others]) => others.every((o) => o.id! > id))
                  .map(([id, others]) => (
                    <li key={id}>
                      {tournaments.find((t) => t.id === id)?.name} overlaps {others.map((o) => o.name).join(', ')} ({fmtDate(tournaments.find((t) => t.id === id)?.startDate)})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="row" style={{ marginBottom: 12 }}>
            {(['list', 'calendar'] as const).map((v) => (
              <button key={v} className={`chip${view === v ? ' on' : ''}`} onClick={() => setView(v)}>
                {v === 'list' ? 'List' : 'Calendar'}
              </button>
            ))}
          </div>

          {view === 'calendar' ? (
            <div className="card">
              <MonthCalendar events={onSchedule} colorOf={colorOf} selected={day} onSelect={setDay} />
              {legendTours.length > 0 && (
                <div className="legend">
                  {legendTours.map((x) => (
                    <span key={x.id}>
                      <i className="dot" style={{ background: colorOf({ tourId: x.id }) }} />
                      {x.name}
                    </span>
                  ))}
                </div>
              )}
              {day && (
                <ul className="list" style={{ marginTop: 10 }}>
                  {onSchedule
                    .filter((t) => t.startDate <= day && day <= (t.endDate ?? t.startDate))
                    .map((t) => (
                      <EventRow key={t.id} t={t} courses={courses} tours={tours} color={colorOf(t)} conflict={conflicts.has(t.id!)} />
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="card">
              {upcoming.length ? (
                <ul className="list">
                  {upcoming.map((t) => (
                    <EventRow key={t.id} t={t} courses={courses} tours={tours} color={colorOf(t)} conflict={conflicts.has(t.id!)} />
                  ))}
                </ul>
              ) : (
                <div className="empty">
                  Nothing scheduled yet. Pick events from{' '}
                  <a href="#" onClick={(e) => (e.preventDefault(), setTab('available'))}>
                    Available
                  </a>{' '}
                  or tap + Add.
                </div>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="grow" onClick={() => openIcs(exportSchedule())}>
                📅 Add all to Calendar
              </button>
              <button className="small-btn" onClick={() => shareIcs(exportSchedule(), 'golf-schedule.ics')}>
                Share file
              </button>
            </div>
          )}

          <SeasonCard tournaments={tournaments} tours={tours} colorOf={colorOf} />
        </>
      )}

      {tab === 'available' && <Available tournaments={tournaments} tours={tours} myTours={myTours} colorOf={colorOf} />}

      {tab === 'past' && (
        <div className="card">
          {past.length ? (
            <ul className="list">
              {past.map((t) => (
                <EventRow key={t.id} t={t} courses={courses} tours={tours} color={colorOf(t)} />
              ))}
            </ul>
          ) : (
            <div className="empty">No past events.</div>
          )}
        </div>
      )}
    </>
  );
}

function SeasonCard({ tournaments, tours, colorOf }: { tournaments: Tournament[]; tours: Tour[]; colorOf: (t: { tourId?: string }) => string }) {
  const year = today().slice(0, 4);
  const rows = seasonSummary(tournaments, year);
  if (!rows.length) return null;
  const total = rows.reduce((n, r) => n + r.fees, 0);
  return (
    <div className="card">
      <h2>{year} season</h2>
      <table className="score">
        <thead>
          <tr>
            <th>Tour</th>
            <th>Events</th>
            <th>Played</th>
            <th>Fees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tourId ?? 'none'}>
              <td>
                <span className="row">
                  <i className="dot" style={{ background: colorOf(r) }} />
                  {tours.find((x) => x.id === r.tourId)?.name ?? 'No tour'}
                </span>
              </td>
              <td>{r.events}</td>
              <td>{r.played}</td>
              <td>${r.fees.toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td>
              <b>Total</b>
            </td>
            <td>
              <b>{rows.reduce((n, r) => n + r.events, 0)}</b>
            </td>
            <td>
              <b>{rows.reduce((n, r) => n + r.played, 0)}</b>
            </td>
            <td>
              <b>${total.toLocaleString()}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="muted small" style={{ marginTop: 6 }}>
        Registered, waitlisted and played events. Fees count registered and played events with an entry fee filled in.
      </p>
    </div>
  );
}

function Available({
  tournaments,
  tours,
  myTours,
  colorOf,
}: {
  tournaments: Tournament[];
  tours: Tour[];
  myTours: string[];
  colorOf: (t: { tourId?: string }) => string;
}) {
  const { data: fetched, error } = useAvailableEvents();
  const imported = useLiveQuery(() => db.imported.toArray(), []);
  const [filter, setFilter] = useState<string>('mine'); // 'mine' | 'all' | tourId
  const [busy, setBusy] = useState<string>();
  const t0 = today();

  if ((!fetched && !error) || !imported) return <div className="card empty">Loading events…</div>;
  const data: AvailableFile = fetched ?? { generatedAt: null, sources: {}, events: [] };

  const importedIds = new Set(imported.map((e) => e.id));
  const scrapedTours = tours.filter((x) => data.sources[x.id]);
  const chipTours = tours.filter((x) => data.sources[x.id] || imported.some((e) => e.tourId === x.id));
  const subscribed = myTours.length > 0;
  const effective = filter === 'mine' && !subscribed ? 'all' : filter;
  const events = [...data.events, ...imported]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .filter((e) => (e.endDate ?? e.startDate) >= t0)
    .filter((e) => (effective === 'mine' ? myTours.includes(e.tourId) : effective === 'all' ? true : e.tourId === effective));
  const added = new Map(tournaments.filter((t) => t.sourceEventId).map((t) => [t.sourceEventId!, t]));

  async function add(ev: AvailableEvent, status: 'Considering' | 'Registered') {
    setBusy(ev.id);
    await addAvailableEvent(ev, status);
    setBusy(undefined);
  }

  return (
    <>
      {error && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            Couldn't load the latest tour schedules ({error}). Showing the events you've pasted in.
          </p>
        </div>
      )}
      {!subscribed && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            Subscribe to his tours under <Link to="/more">More → My tours</Link> so only those events show here. Showing all tours for now.
          </p>
        </div>
      )}
      <div className="chips scroll" style={{ marginBottom: 12 }}>
        {subscribed && (
          <button className={`chip${effective === 'mine' ? ' on' : ''}`} onClick={() => setFilter('mine')}>
            My tours
          </button>
        )}
        <button className={`chip${effective === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
          All tours
        </button>
        {chipTours.map((x) => (
          <button key={x.id} className={`chip${effective === x.id ? ' on' : ''}`} onClick={() => setFilter(x.id)}>
            {x.name}
          </button>
        ))}
      </div>

      <div className="card">
        {events.length ? (
          <ul className="list">
            {events.map((ev) => {
              const mine = added.get(ev.id);
              return (
                <li key={ev.id}>
                  <div className="li" style={{ alignItems: 'flex-start' }}>
                    <span className="tour-stripe" style={{ background: colorOf(ev) }} />
                    <DateBox date={ev.startDate} />
                    <div className="grow">
                      <div>{ev.name}</div>
                      <div className="muted small">
                        {[tours.find((x) => x.id === ev.tourId)?.name, [ev.courseName, ev.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                      </div>
                      <div className="muted small">
                        {[
                          ev.endDate && `Through ${fmtDate(ev.endDate)}`,
                          ev.ageGroups,
                          ev.registrationDeadline && `Register by ${fmtDate(ev.registrationDeadline)}`,
                          ev.entryFee && `$${ev.entryFee}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="row wrap" style={{ marginTop: 6 }}>
                        {mine ? (
                          <Link className="tag accent" to={`/tournament/${mine.id}`}>
                            On schedule · {mine.status} ›
                          </Link>
                        ) : (
                          <>
                            <button className="small-btn" disabled={busy === ev.id} onClick={() => add(ev, 'Considering')}>
                              + Interested
                            </button>
                            <button className="small-btn primary" disabled={busy === ev.id} onClick={() => add(ev, 'Registered')}>
                              + Registered
                            </button>
                          </>
                        )}
                        {ev.url && (
                          <a className="small" href={ev.url} target="_blank" rel="noreferrer">
                            Event page ↗
                          </a>
                        )}
                        {importedIds.has(ev.id) && (
                          <>
                            <span className="tag">Pasted in</span>
                            {!mine && (
                              <button className="small-btn" aria-label={`Remove ${ev.name}`} onClick={() => db.imported.delete(ev.id)}>
                                Remove
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">
            {data.generatedAt || imported.length ? 'No upcoming events found for these tours yet.' : 'Tour schedules haven’t been collected yet — check back after the first daily update.'}
          </div>
        )}
      </div>

      <Link to="/import" className="card link">
        <b>Tour not listed here?</b>
        <div className="muted small">
          Some tours (like NTPGA and STPGA, whose schedules are on BlueGolf) can't be collected automatically. Copy their schedule page and paste it —
          the events show up here. ›
        </div>
      </Link>

      {scrapedTours.length > 0 && (
        <div className="card">
          <h3>Last checked</h3>
          <ul className="list small">
            {scrapedTours.map((x) => {
              const s = data.sources[x.id];
              return (
                <li key={x.id}>
                  <div className="li">
                    <span className="grow">{x.name}</span>
                    <span className={s.ok ? 'muted' : ''}>
                      {s.ok ? new Date(s.checkedAt).toLocaleDateString() : `⚠ couldn't update ${new Date(s.checkedAt).toLocaleDateString()}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="muted small" style={{ marginTop: 6 }}>
            Events are collected automatically once a day and can have mistakes. Check the tour's site before registering.
          </p>
        </div>
      )}
    </>
  );
}
