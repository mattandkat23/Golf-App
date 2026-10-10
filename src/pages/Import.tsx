import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import { parseSchedule, type ParsedEvent } from '../lib/importParse';
import { courseKey, matchCourse } from '../lib/courseMatch';
import { addAvailableEvent } from '../lib/available';
import { eventId } from '../../scraper/lib';
import type { EventStatus } from '../lib/types';
import { Chips, Field, PageHead, today } from '../components/ui';
import TourPicker from '../components/TourPicker';

interface Row extends ParsedEvent {
  checked: boolean;
}

export default function Import() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tourId, setTourId] = useState<string | undefined>(params.get('tour') ?? undefined);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>();
  const [status, setStatus] = useState<EventStatus>('Considering');
  const [saving, setSaving] = useState(false);
  const courses = useLiveQuery(() => db.courses.toArray(), []) ?? [];
  const tour = useLiveQuery(() => (tourId ? db.tours.get(tourId) : undefined), [tourId]);
  const existing = useLiveQuery(async () => new Set((await db.tournaments.toArray()).map((t) => t.sourceEventId).filter(Boolean)), []);
  const t0 = today();

  const idFor = (r: ParsedEvent) => `import-${eventId(tourId ?? 'none', r.name, r.startDate)}`;

  function findEvents() {
    const known = new Set(courses.map((c) => courseKey(c.name)));
    const parsed = parseSchedule(text, t0, (s) => known.has(courseKey(s)));
    setRows(parsed.map((p) => ({ ...p, checked: (p.endDate ?? p.startDate) >= t0 })));
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selected = rows?.filter((r) => r.checked && r.name.trim() && r.startDate) ?? [];

  async function addAll() {
    setSaving(true);
    for (const r of selected) {
      await addAvailableEvent(
        {
          id: idFor(r),
          tourId: tourId ?? '',
          name: r.name.trim(),
          startDate: r.startDate,
          endDate: r.endDate,
          courseName: r.courseName?.trim() || undefined,
          city: r.city,
          entryFee: r.entryFee,
        },
        status,
      );
    }
    setSaving(false);
    navigate('/schedule', { replace: true });
  }

  return (
    <>
      <PageHead title="Paste a schedule" back="/schedule" />

      {!rows ? (
        <div className="card">
          <Field label="Tour">
            <TourPicker value={tourId} onChange={setTourId} />
          </Field>
          <ol className="small muted" style={{ paddingLeft: 18, margin: '0 0 12px' }}>
            <li>
              Open the tour's schedule in Safari
              {tour?.url && (
                <>
                  {' '}
                  (
                  <a href={tour.url} target="_blank" rel="noreferrer">
                    open it
                  </a>
                  )
                </>
              )}
              .
            </li>
            <li>Press and hold on the schedule text, tap Select All (or drag to select the schedule), then Copy.</li>
            <li>Come back here and paste below.</li>
          </ol>
          <Field label="Schedule text">
            <textarea style={{ minHeight: 200 }} placeholder="Paste the schedule here" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <button className="primary block" disabled={!text.trim()} onClick={findEvents}>
            Find events
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row between">
              <b>
                Found {rows.length} event{rows.length === 1 ? '' : 's'}
              </b>
              <button className="small-btn" onClick={() => setRows(undefined)}>
                ‹ Edit text
              </button>
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Check each one and fix anything that's off. Past events are unticked.
            </p>
          </div>

          {rows.length === 0 && (
            <div className="card empty">
              No dates found. Make sure the copied text includes the dates, then try again — or add events one at a time with{' '}
              <Link to="/tournament/new">+ Add</Link>.
            </div>
          )}

          {rows.map((r, i) => {
            const already = existing?.has(idFor(r));
            const match = matchCourse(courses, r.courseName, r.city);
            return (
              <div className="card" key={i} style={{ opacity: r.checked ? 1 : 0.6 }}>
                <label className="row" style={{ marginBottom: 8 }}>
                  <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={r.checked} onChange={(e) => update(i, { checked: e.target.checked })} />
                  <b className="grow">{already ? 'Already on schedule — will update status' : 'Add this event'}</b>
                </label>
                <Field label="Event name">
                  <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
                </Field>
                <div className="grid2">
                  <Field label="Date">
                    <input type="date" value={r.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
                  </Field>
                  <Field label="End (multi-day)">
                    <input type="date" value={r.endDate ?? ''} onChange={(e) => update(i, { endDate: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Course">
                  <input value={r.courseName ?? ''} placeholder="Course name" onChange={(e) => update(i, { courseName: e.target.value })} />
                </Field>
                <div className="muted small" style={{ marginTop: -6 }}>
                  {r.courseName ? (match ? `Matches ${match.name}${match.city ? `, ${match.city}` : ''}` : 'New course — will be added to your list') : 'No course'}
                  {r.city && r.city !== match?.city && ` · ${r.city}`}
                  {r.entryFee && ` · $${r.entryFee}`}
                </div>
              </div>
            );
          })}

          {rows.length > 0 && (
            <div className="card">
              <Field label="Add them as">
                <Chips options={['Considering', 'Registered'] as EventStatus[]} value={status} label={(s) => (s === 'Considering' ? 'Interested' : s)} onChange={(v) => v && setStatus(v)} />
              </Field>
              <button className="primary block" disabled={!selected.length || saving} onClick={addAll}>
                Add {selected.length} event{selected.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
