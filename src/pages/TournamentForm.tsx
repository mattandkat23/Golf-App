import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { EventStatus, TourLevel, Tournament } from '../lib/types';
import { Chips, Field, PageHead, today } from '../components/ui';
import CoursePicker from '../components/CoursePicker';
import TourPicker from '../components/TourPicker';
import { AGE_GROUPS } from '../data/uskids';

const LEVELS: TourLevel[] = ['Local', 'State', 'Regional', 'World', 'Other'];
const STATUSES: EventStatus[] = ['Considering', 'Registered', 'Played', 'Withdrew'];

export default function TournamentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Tournament>({ name: '', level: 'Local', startDate: today(), status: 'Registered' });

  useEffect(() => {
    if (id) db.tournaments.get(Number(id)).then((x) => x && setT(x));
    else
      db.profile.get('me').then((p) =>
        setT((cur) => ({ ...cur, ageGroup: cur.ageGroup ?? p?.ageGroup, tourId: cur.tourId ?? (p?.myTours?.length === 1 ? p.myTours[0] : undefined) })),
      );
  }, [id]);

  const set = <K extends keyof Tournament>(k: K, v: Tournament[K]) => setT((cur) => ({ ...cur, [k]: v }));
  const num = (s: string) => (s === '' ? undefined : Number(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const tour = t.tourId ? await db.tours.get(t.tourId) : undefined;
    const name = t.name.trim() || `${tour?.name ?? 'Tournament'} – ${t.level}`;
    const newId = await db.tournaments.put({ ...t, name });
    navigate(`/tournament/${newId}`, { replace: true });
  }

  return (
    <form onSubmit={save}>
      <PageHead title={id ? 'Edit event' : 'Add event'} back={id ? `/tournament/${id}` : '/schedule'} />
      <div className="card">
        <Field label="Tour / series">
          <TourPicker value={t.tourId} onChange={(v) => set('tourId', v)} />
        </Field>
        <Field label="Level">
          <Chips options={LEVELS} value={t.level} onChange={(v) => v && set('level', v)} />
        </Field>
        <Field label="Event name">
          <input value={t.name} placeholder="e.g. Austin Local Tour – Event 3" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Course">
          <CoursePicker value={t.courseId} onChange={(v) => set('courseId', v)} />
        </Field>
        <div className="grid2">
          <Field label="Start date">
            <input type="date" required value={t.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="End date (multi-day)">
            <input type="date" value={t.endDate ?? ''} min={t.startDate} onChange={(e) => set('endDate', e.target.value || undefined)} />
          </Field>
          <Field label="Tee time">
            <input type="time" value={t.teeTime ?? ''} onChange={(e) => set('teeTime', e.target.value || undefined)} />
          </Field>
          <Field label="Age group">
            <select value={t.ageGroup ?? ''} onChange={(e) => set('ageGroup', e.target.value || undefined)}>
              <option value="">—</option>
              {AGE_GROUPS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Status">
          <Chips options={STATUSES} value={t.status} onChange={(v) => v && set('status', v)} />
        </Field>
      </div>

      <div className="card">
        <h2>Registration</h2>
        <div className="grid2">
          <Field label="Registration deadline">
            <input type="date" value={t.registrationDeadline ?? ''} onChange={(e) => set('registrationDeadline', e.target.value || undefined)} />
          </Field>
          <Field label="Entry fee ($)">
            <input inputMode="decimal" value={t.entryFee ?? ''} onChange={(e) => set('entryFee', num(e.target.value))} />
          </Field>
        </div>
        <Field label="US Kids event link">
          <input type="url" placeholder="https://tournaments.uskidsgolf.com/…" value={t.url ?? ''} onChange={(e) => set('url', e.target.value || undefined)} />
        </Field>
      </div>

      <div className="card">
        <h2>Result</h2>
        <div className="grid2">
          <Field label="Finish position">
            <input inputMode="numeric" value={t.finish ?? ''} onChange={(e) => set('finish', num(e.target.value))} />
          </Field>
          <Field label="Field size">
            <input inputMode="numeric" value={t.fieldSize ?? ''} onChange={(e) => set('fieldSize', num(e.target.value))} />
          </Field>
        </div>
        <Field label="Qualified for">
          <input placeholder="e.g. Worlds, Regional, State Championship" value={t.qualified ?? ''} onChange={(e) => set('qualified', e.target.value || undefined)} />
        </Field>
        <Field label="Notes">
          <textarea value={t.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
        </Field>
      </div>

      <div className="sticky-actions">
        <button type="submit" className="primary block">
          Save
        </button>
      </div>
    </form>
  );
}
