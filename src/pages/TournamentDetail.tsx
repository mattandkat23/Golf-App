import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { computeStats, holeComplete, pct, summarizeRound, toParLabel } from '../lib/stats';
import { Chips, Kpi, PageHead, fmtDate, today } from '../components/ui';
import { findConflicts } from '../lib/schedule';
import { buildIcs, openIcs, tournamentToIcs } from '../lib/ics';
import { useAuth } from '../lib/auth';
import { useGolfer } from '../lib/golfer';
import { supabase } from '../lib/supabase';
import { ajgaLiveTrackable, ajgaTournamentId, optInAjgaLive, optOutAjgaLive } from '../lib/ajgaLiveTracking';
import type { EventStatus } from '../lib/types';

const STATUSES: EventStatus[] = ['Considering', 'Registered', 'Waitlisted', 'Played', 'Withdrew'];

export default function TournamentDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const t = useLiveQuery(() => db.tournaments.get(id), [id]);
  const course = useLiveQuery(() => (t?.courseId ? db.courses.get(t.courseId) : undefined), [t?.courseId]);
  const rounds = useLiveQuery(() => db.rounds.where('tournamentId').equals(id).sortBy('roundNumber'), [id]);
  const tour = useLiveQuery(() => (t?.tourId ? db.tours.get(t.tourId) : undefined), [t?.tourId]);
  const all = useLiveQuery(() => (t ? db.tournaments.where('golferId').equals(t.golferId).toArray() : []), [t?.golferId]);
  const { session } = useAuth();
  const { golfer } = useGolfer();
  const [optInBump, setOptInBump] = useState(0);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [optInError, setOptInError] = useState('');
  const ajgaId = t ? ajgaTournamentId(t) : undefined;
  const liveTrackable = !!t && ajgaLiveTrackable(t);
  const optedIn = useLiveQuery(async () => {
    if (!session || !liveTrackable || !ajgaId) return false;
    const { data } = await supabase.from('ajga_hole_requests').select('id').eq('golfer_name', golfer.playerName).eq('tournament_id', ajgaId).maybeSingle();
    return !!data;
  }, [session?.user.id, ajgaId, liveTrackable, golfer.playerName, optInBump]);
  if (!t) return null;
  const clashes = all ? findConflicts(all, today()).get(id) : undefined;
  const stats = rounds?.length ? computeStats(rounds) : undefined;
  const totals = rounds?.map(summarizeRound);

  async function toggleHoleTracking() {
    if (!session || !t) return;
    setSavingOptIn(true);
    setOptInError('');
    const { error } = (optedIn ? await optOutAjgaLive(golfer, t) : await optInAjgaLive(session, golfer, t)) ?? {};
    setSavingOptIn(false);
    if (error) setOptInError('Couldn’t save that — check you’re online and try again.');
    else setOptInBump((b) => b + 1);
  }

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
          {tour && <span className="tag">{tour.name}</span>}
          <span className="tag">{t.level}</span>
          {t.ageGroup && <span className="tag">{t.ageGroup}</span>}
        </div>
        <Chips options={STATUSES} value={t.status} scroll onChange={(v) => v && db.tournaments.update(id, { status: v })} />
        {clashes && (
          <div className="small">
            ⚠ Same dates as{' '}
            {clashes.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ', '}
                <Link to={`/tournament/${c.id}`}>{c.name}</Link>
              </span>
            ))}
          </div>
        )}
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
            Event page ↗
          </a>
        )}
        {liveTrackable && golfer.trackAjgaHoles && <p className="muted small">✓ Tracking hole-by-hole live for {golfer.playerName} (every AJGA event -- see More → Profile).</p>}
        {liveTrackable && !golfer.trackAjgaHoles && (
          <div>
            <button className="block" disabled={!session || savingOptIn} onClick={toggleHoleTracking}>
              {optedIn ? '✓ Tracking hole-by-hole live' : session ? 'Track hole-by-hole live' : 'Sign in to track hole-by-hole live'}
            </button>
            <p className="muted small">AJGA shows hole-by-hole scores while this event is in progress. Opt in and we'll pull them in once a day for {golfer.playerName}.</p>
            {optInError && <p className="small" style={{ color: 'var(--danger)' }}>{optInError}</p>}
          </div>
        )}
        <button
          className="block"
          onClick={() => openIcs(buildIcs(tournamentToIcs(t, course ? `${course.name}${course.city ? `, ${course.city}` : ''}` : undefined, tour?.name)))}
        >
          📅 Add to Calendar
        </button>
        {t.notes && <p className="muted">{t.notes}</p>}
      </div>

      {(t.status === 'Played' || t.startDate <= today()) && (
        <Link to={`/tournament/${id}/results`} className="card link">
          <b>{t.finish ? 'Update results' : 'Paste results'}</b>
          <div className="muted small">Copy the results table from the tour's site and the app fills in the finish and scores.</div>
        </Link>
      )}

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
                        {r.total !== undefined && !r.holes.every(holeComplete)
                          ? 'Score from results · tap to add hole-by-hole'
                          : `${s.holesPlayed}/${r.numHoles} holes · ${s.putts} putts ${r.complete ? '' : '· in progress'}`}
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
