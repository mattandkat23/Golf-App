import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { REGIONS } from '../data/courses';

const ADD_NEW = '__new__';

/** Native select (iOS wheel picker) of courses grouped by region. */
export default function CoursePicker({ value, onChange }: { value?: number; onChange: (id: number | undefined) => void }) {
  const courses = useLiveQuery(() => db.courses.orderBy('name').toArray(), []);
  const navigate = useNavigate();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) navigate('/courses/new');
        else onChange(e.target.value ? Number(e.target.value) : undefined);
      }}
    >
      <option value="">Select a course…</option>
      {REGIONS.map((region) => {
        const inRegion = courses?.filter((c) => c.region === region) ?? [];
        if (!inRegion.length) return null;
        return (
          <optgroup key={region} label={region}>
            {inRegion.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}
              </option>
            ))}
          </optgroup>
        );
      })}
      <option value={ADD_NEW}>+ Add a course…</option>
    </select>
  );
}
