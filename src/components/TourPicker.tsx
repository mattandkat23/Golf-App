import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useMyTours } from '../lib/tourColors';

/** Native select of tours, with the golfer's own tours listed first. */
export default function TourPicker({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const tours = useLiveQuery(() => db.tours.toArray(), []);
  const mine = useMyTours();
  const myTours = tours?.filter((t) => mine.includes(t.id)) ?? [];
  const others = tours?.filter((t) => !mine.includes(t.id)) ?? [];
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">No tour / one-off event</option>
      {myTours.length > 0 && (
        <optgroup label="My tours">
          {myTours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={myTours.length ? 'Other tours' : 'Tours'}>
        {others.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
