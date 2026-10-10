import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { PracticeFocus, PracticeSession } from '../lib/types';
import { Field, PageHead, today } from '../components/ui';

const AREAS: PracticeFocus[] = ['Putting', 'Chipping', 'Bunker', 'Wedges', 'Irons', 'Woods', 'Driver', 'On-course', 'Mental'];
const SUGGESTED_DRILLS = [
  'Made in a row from 3 ft',
  'Ladder putting 10/20/30 ft (inside 3 ft)',
  'Up & down challenge (of 9)',
  'Bunker shots on green (of 10)',
  'Wedge to 15 ft (of 10)',
  'Fairway finder (of 10)',
];

export default function PracticeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<PracticeSession>({ date: today(), minutes: 60, focus: [], drills: [] });
  const pastDrills = useLiveQuery(async () => {
    const all = await db.practice.toArray();
    return [...new Set([...SUGGESTED_DRILLS, ...all.flatMap((p) => p.drills.map((d) => d.name))])];
  }, []);

  useEffect(() => {
    if (id) db.practice.get(Number(id)).then((x) => x && setS(x));
  }, [id]);

  const toggleArea = (area: PracticeFocus) =>
    setS((cur) => ({
      ...cur,
      focus: cur.focus.some((f) => f.area === area) ? cur.focus.filter((f) => f.area !== area) : [...cur.focus, { area, minutes: 15 }],
    }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await db.practice.put({ ...s, drills: s.drills.filter((d) => d.name.trim()) });
    navigate('/practice', { replace: true });
  }

  async function remove() {
    if (id && confirm('Delete this session?')) {
      await db.practice.delete(Number(id));
      navigate('/practice', { replace: true });
    }
  }

  return (
    <form onSubmit={save}>
      <PageHead title={id ? 'Practice session' : 'Log practice'} back="/practice" />
      <div className="card">
        <div className="grid2">
          <Field label="Date">
            <input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
          </Field>
          <Field label="Total minutes">
            <input inputMode="numeric" value={s.minutes} onChange={(e) => setS({ ...s, minutes: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Where">
          <input placeholder="Range, course, backyard…" value={s.location ?? ''} onChange={(e) => setS({ ...s, location: e.target.value })} />
        </Field>
      </div>

      <div className="card">
        <h2>Worked on</h2>
        <div className="chips" style={{ marginBottom: 10 }}>
          {AREAS.map((a) => (
            <button type="button" key={a} className={`chip${s.focus.some((f) => f.area === a) ? ' on' : ''}`} onClick={() => toggleArea(a)}>
              {a}
            </button>
          ))}
        </div>
        {s.focus.map((f, i) => (
          <div className="row" key={f.area} style={{ marginBottom: 6 }}>
            <span className="grow">{f.area}</span>
            <input
              inputMode="numeric"
              style={{ width: 80 }}
              value={f.minutes}
              onChange={(e) => setS({ ...s, focus: s.focus.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) || 0 } : x)) })}
            />
            <span className="muted small">min</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Drills & scores</h2>
        <datalist id="drills">
          {pastDrills?.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        {s.drills.map((d, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <input
              list="drills"
              placeholder="Drill"
              className="grow"
              value={d.name}
              onChange={(e) => setS({ ...s, drills: s.drills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
            />
            <input
              placeholder="Score"
              style={{ width: 90 }}
              value={d.score ?? ''}
              onChange={(e) => setS({ ...s, drills: s.drills.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)) })}
            />
            <button type="button" className="small-btn" aria-label="Remove drill" onClick={() => setS({ ...s, drills: s.drills.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="block" onClick={() => setS({ ...s, drills: [...s.drills, { name: '' }] })}>
          + Add drill
        </button>
      </div>

      <div className="card">
        <Field label="Notes">
          <textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} />
        </Field>
      </div>

      <div className="sticky-actions">
        {id && (
          <button type="button" className="danger" onClick={remove}>
            Delete
          </button>
        )}
        <button type="submit" className="primary block">
          Save
        </button>
      </div>
    </form>
  );
}
