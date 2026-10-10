import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { Contact, EndLie, HoleResult, Lie, Miss, Round, Shot, ShotType } from '../lib/types';
import {
  CONTACTS,
  LEAVE_BUCKETS,
  MISSES,
  bucketLabel,
  holeComplete,
  holePutts,
  holeStrokes,
  inferShotType,
  nextStartLie,
  summarizeRound,
  toParLabel,
} from '../lib/stats';
import { Chips, MultiChips } from '../components/ui';
import Scorecard from '../components/Scorecard';

const LIES: Lie[] = ['Tee', 'Fairway', 'Rough', 'Bunker', 'Fringe', 'Green', 'Recovery'];
const TYPES: ShotType[] = ['Tee', 'Approach', 'Short game', 'Putt'];
const RESULTS: EndLie[] = ['Fairway', 'Rough', 'Bunker', 'Fringe', 'Green', 'Holed', 'Recovery', 'Penalty'];

function newShot(hole: HoleResult): Shot {
  const prev = hole.shots.at(-1);
  const startLie = nextStartLie(prev);
  const type = inferShotType(startLie, hole.par, hole.shots.length, prev);
  return { type, startLie, club: type === 'Putt' ? 'Putter' : undefined };
}

function toggleMiss(cur: Miss[] = [], m: Miss): Miss[] {
  if (cur.includes(m)) return cur.filter((x) => x !== m);
  const opposite: Record<Miss, Miss> = { Left: 'Right', Right: 'Left', Short: 'Long', Long: 'Short' };
  return [...cur.filter((x) => x !== opposite[m]), m];
}

function describe(s: Shot) {
  const parts = [s.club, s.type === 'Putt' ? undefined : s.endLie, s.miss?.join('-'), s.leaveFt !== undefined ? bucketLabel(s.leaveFt) : undefined, s.contact];
  if (s.type === 'Putt') parts.splice(1, 0, s.endLie === 'Holed' ? 'Made' : 'Missed');
  if (s.penalty) parts.push(`+${s.penalty} penalty`);
  return parts.filter(Boolean).join(' · ');
}

export default function Play() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [round, setRound] = useState<Round>();
  const [holeIdx, setHoleIdx] = useState(0);
  const [editIdx, setEditIdx] = useState<number>(-1); // -1 = new shot
  const [draft, setDraft] = useState<Shot>();
  const [showCard, setShowCard] = useState(false);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const course = useLiveQuery(() => (round?.courseId ? db.courses.get(round.courseId) : undefined), [round?.courseId]);
  const clubs = useMemo(() => profile?.bag.map((c) => c.name).filter((c) => c !== 'Putter') ?? [], [profile]);

  useEffect(() => {
    db.rounds.get(id).then((r) => {
      if (!r) return;
      setRound(r);
      const first = r.holes.findIndex((h) => !holeComplete(h));
      setHoleIdx(first === -1 ? r.holes.length - 1 : first);
      if (r.complete) setShowCard(true);
    });
  }, [id]);

  const hole = round?.holes[holeIdx];
  const done = hole ? holeComplete(hole) : false;

  // Fresh draft whenever we land on a hole / finish editing.
  useEffect(() => {
    if (hole && editIdx === -1) setDraft(done ? undefined : newShot(hole));
  }, [holeIdx, editIdx, hole?.shots.length, done]);

  if (!round || !hole) return null;

  function persist(next: Round) {
    setRound(next);
    db.rounds.put(next);
  }

  function updateHole(h: HoleResult) {
    persist({ ...round!, holes: round!.holes.map((x, i) => (i === holeIdx ? h : x)) });
  }

  async function setPar(par: number) {
    updateHole({ ...hole!, par });
    if (course && round!.teeName) {
      const tees = course.tees.map((t) => {
        if (t.name !== round!.teeName) return t;
        const pars = [...t.pars];
        while (pars.length < round!.numHoles) pars.push(4);
        pars[holeIdx] = par;
        return { ...t, pars };
      });
      await db.courses.update(course.id!, { tees });
    }
  }

  function commit(shot: Shot) {
    const clean: Shot = { ...shot };
    if (!clean.miss?.length) delete clean.miss;
    if (!(clean.endLie === 'Green' || clean.endLie === 'Fringe')) delete clean.leaveFt;
    if (clean.endLie !== 'Penalty') delete clean.penalty;
    else clean.penalty ??= 1;
    const shots = editIdx === -1 ? [...hole!.shots, clean] : hole!.shots.map((s, i) => (i === editIdx ? clean : s));
    // A holed shot ends the hole: drop anything recorded after it.
    const holedAt = shots.findIndex((s) => s.endLie === 'Holed');
    updateHole({ ...hole!, shots: holedAt >= 0 ? shots.slice(0, holedAt + 1) : shots });
    setEditIdx(-1);
  }

  function removeShot(i: number) {
    updateHole({ ...hole!, shots: hole!.shots.filter((_, j) => j !== i) });
    setEditIdx(-1);
  }

  function goHole(i: number) {
    setHoleIdx(i);
    setEditIdx(-1);
    window.scrollTo(0, 0);
  }

  const total = summarizeRound(round);
  const isLast = holeIdx === round.holes.length - 1;

  if (showCard) {
    return (
      <RoundSummary
        round={round}
        courseName={course?.name}
        onBack={() => setShowCard(false)}
        onSave={(r) => {
          persist(r);
          navigate(r.tournamentId ? `/tournament/${r.tournamentId}` : '/');
        }}
      />
    );
  }

  const set = (patch: Partial<Shot>) => setDraft((d) => ({ ...d!, ...patch }));
  const isPutt = draft?.type === 'Putt';
  const showMiss = draft && draft.endLie && !['Holed', 'Green'].includes(draft.endLie) && !(draft.endLie === 'Fairway' && draft.type === 'Tee');
  const showLeave = draft && (draft.endLie === 'Green' || draft.endLie === 'Fringe');

  return (
    <>
      <div className="play-head">
        <div className="hole-nav">
          <button className="small-btn" onClick={() => navigate(round.tournamentId ? `/tournament/${round.tournamentId}` : '/')}>
            Exit
          </button>
          <div className="hole-title">
            <b>Hole {hole.hole}</b>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="small-btn" onClick={() => setPar(hole.par === 5 ? 3 : hole.par + 1)} aria-label="Change par">
                Par {hole.par} ⟳
              </button>
              <input
                aria-label="Yards"
                inputMode="numeric"
                placeholder="yds"
                value={hole.yards ?? ''}
                onChange={(e) => updateHole({ ...hole, yards: e.target.value ? Number(e.target.value) : undefined })}
                style={{ width: 70, minHeight: 36, padding: '4px 8px' }}
              />
            </div>
          </div>
          <button className="small-btn" onClick={() => setShowCard(true)}>
            {total.holesPlayed ? toParLabel(total.strokes - total.par) : 'E'} · Card
          </button>
        </div>
        <div className="hole-strip">
          {round.holes.map((h, i) => (
            <button key={h.hole} className={`${i === holeIdx ? 'cur' : ''} ${holeComplete(h) ? 'done' : ''}`} onClick={() => goHole(i)}>
              {holeComplete(h) ? holeStrokes(h) : h.hole}
            </button>
          ))}
        </div>
      </div>

      {hole.shots.length > 0 && (
        <ul className="shot-list">
          {hole.shots.map((s, i) => (
            <li
              key={i}
              className={editIdx === i ? 'editing' : ''}
              onClick={() => {
                setEditIdx(i);
                setDraft({ ...s });
              }}
            >
              <span className="shot-num">{i + 1}</span>
              <div className="grow">
                <div>
                  <b>{s.type}</b> <span className="muted small">from {s.startLie}</span>
                </div>
                <div className="small">{describe(s)}</div>
              </div>
              <span className="muted small">Edit</span>
            </li>
          ))}
        </ul>
      )}

      {done && editIdx === -1 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="big">{holeStrokes(hole)}</div>
          <div className="muted">
            {toParLabel(holeStrokes(hole) - hole.par)} · {holePutts(hole)} putt{holePutts(hole) === 1 ? '' : 's'}
          </div>
          <div style={{ marginTop: 12 }}>
            {isLast ? (
              <button className="primary block" onClick={() => setShowCard(true)}>
                Finish round
              </button>
            ) : (
              <button className="primary block" onClick={() => goHole(holeIdx + 1)}>
                Next hole ›
              </button>
            )}
          </div>
        </div>
      )}

      {draft && (
        <div className="card editor">
          <div className="row between">
            <h2>{editIdx === -1 ? `Shot ${hole.shots.length + 1}` : `Edit shot ${editIdx + 1}`}</h2>
            {editIdx !== -1 && (
              <button className="small-btn" onClick={() => setEditIdx(-1)}>
                Cancel
              </button>
            )}
          </div>

          <h3>From</h3>
          <Chips
            options={LIES}
            value={draft.startLie}
            scroll
            onChange={(v) => {
              if (!v) return;
              const type = inferShotType(v, hole.par, editIdx === -1 ? hole.shots.length : editIdx, hole.shots[(editIdx === -1 ? hole.shots.length : editIdx) - 1]);
              set({ startLie: v, type, club: type === 'Putt' ? 'Putter' : draft.club === 'Putter' ? undefined : draft.club });
            }}
          />
          <h3>Shot type</h3>
          <Chips options={TYPES} value={draft.type} grid={4} onChange={(v) => v && set({ type: v, club: v === 'Putt' ? 'Putter' : draft.club === 'Putter' ? undefined : draft.club })} />

          {isPutt ? (
            <>
              <h3>Miss (optional)</h3>
              <MultiChips options={MISSES} value={draft.miss ?? []} grid={4} onToggle={(m) => set({ miss: toggleMiss(draft.miss, m) })} />
              <h3>Result</h3>
              <button className="primary block" style={{ marginBottom: 8 }} onClick={() => commit({ ...draft, endLie: 'Holed', miss: undefined })}>
                Made it ✓
              </button>
              <div className="muted small" style={{ marginBottom: 6 }}>
                Missed — left it:
              </div>
              <Chips options={LEAVE_BUCKETS} value={draft.endLie === 'Green' ? draft.leaveFt : undefined} grid={4} label={bucketLabel} onChange={(v) => v !== undefined && commit({ ...draft, endLie: 'Green', leaveFt: v })} />
            </>
          ) : (
            <>
              <h3>Club</h3>
              <Chips options={clubs} value={draft.club} scroll allowClear onChange={(v) => set({ club: v })} />

              <h3>Result</h3>
              <Chips options={RESULTS} value={draft.endLie} grid={4} onChange={(v) => set({ endLie: v })} />

              {draft.endLie === 'Penalty' && (
                <>
                  <h3>Penalty strokes</h3>
                  <Chips options={[1, 2] as const} value={draft.penalty ?? 1} grid={2} onChange={(v) => v && set({ penalty: v })} />
                </>
              )}

              {showMiss && (
                <>
                  <h3>Miss direction</h3>
                  <MultiChips options={MISSES} value={draft.miss ?? []} grid={4} onToggle={(m) => set({ miss: toggleMiss(draft.miss, m) })} />
                </>
              )}

              {showLeave && (
                <>
                  <h3>Distance to hole</h3>
                  <Chips options={LEAVE_BUCKETS} value={draft.leaveFt} grid={4} label={bucketLabel} onChange={(v) => set({ leaveFt: v })} />
                </>
              )}

              <h3>Contact</h3>
              <Chips options={CONTACTS as Contact[]} value={draft.contact} grid={3} allowClear onChange={(v) => set({ contact: v })} />

              <div className="sticky-actions">
                <button className="primary block" disabled={!draft.endLie} onClick={() => commit(draft)}>
                  {draft.endLie === 'Holed' ? 'Holed it! Save' : 'Save shot'}
                </button>
              </div>
            </>
          )}

          {editIdx !== -1 && (
            <button className="danger block" style={{ marginTop: 8 }} onClick={() => removeShot(editIdx)}>
              Delete shot
            </button>
          )}
        </div>
      )}

      {editIdx === -1 && hole.shots.length > 0 && !done && (
        <button className="block" onClick={() => removeShot(hole.shots.length - 1)}>
          Undo last shot
        </button>
      )}
    </>
  );
}

function RoundSummary({ round, courseName, onBack, onSave }: { round: Round; courseName?: string; onBack: () => void; onSave: (r: Round) => void }) {
  const [r, setR] = useState(round);
  const s = summarizeRound(r);
  const refl = r.reflection ?? {};
  const setRefl = (patch: Partial<NonNullable<Round['reflection']>>) => setR({ ...r, reflection: { ...refl, ...patch } });
  return (
    <>
      <button className="small-btn" onClick={onBack}>
        ‹ Back to holes
      </button>
      <div className="page-head">
        <div>
          <h1>
            {s.strokes} <span className="muted">({toParLabel(s.strokes - s.par)})</span>
          </h1>
          <div className="muted small">
            {courseName} · {s.holesPlayed}/{r.numHoles} holes · {s.putts} putts
          </div>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <Scorecard round={r} />
      </div>
      <div className="card">
        <h2>Reflection</h2>
        <label className="field">
          <span>What went well?</span>
          <textarea value={refl.wentWell ?? ''} onChange={(e) => setRefl({ wentWell: e.target.value })} />
        </label>
        <label className="field">
          <span>One thing to work on</span>
          <textarea value={refl.workOn ?? ''} onChange={(e) => setRefl({ workOn: e.target.value })} />
        </label>
        <label className="field">
          <span>Mental game / attitude (1–5)</span>
          <Chips options={[1, 2, 3, 4, 5] as const} value={refl.mental} grid={4} allowClear onChange={(v) => setRefl({ mental: v })} />
        </label>
        <label className="field">
          <span>Weather</span>
          <input placeholder="e.g. 95°F, windy from south" value={r.weather ?? ''} onChange={(e) => setR({ ...r, weather: e.target.value })} />
        </label>
      </div>
      <div className="sticky-actions">
        <button className="primary block" onClick={() => onSave({ ...r, complete: true })}>
          {round.complete ? 'Save' : 'Finish & save round'}
        </button>
      </div>
      {!round.complete && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          Not done yet? <Link to="/">Leave it in progress</Link> — it's saved as you go.
        </p>
      )}
    </>
  );
}
