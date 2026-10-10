import { useState } from 'react';
import type { Tournament } from '../lib/types';
import { today } from './ui';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Month grid with a colored dot per event on each day it spans. */
export default function MonthCalendar({
  events,
  colorOf,
  selected,
  onSelect,
}: {
  events: Tournament[];
  colorOf: (t: Tournament) => string;
  selected?: string;
  onSelect: (date: string) => void;
}) {
  const t0 = today();
  const [month, setMonth] = useState(() => {
    const [y, m] = (selected ?? t0).split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  // Drop a trailing week that's entirely next month.
  const weeks = days[35].getMonth() !== month.getMonth() ? 5 : 6;
  const on = (date: string) => events.filter((e) => e.startDate <= date && date <= (e.endDate ?? e.startDate));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div>
      <div className="cal-head">
        <button className="small-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <b>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <button className="small-btn" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="cal" role="grid">
        {DOW.map((d, i) => (
          <div className="dow" key={i}>
            {d}
          </div>
        ))}
        {days.slice(0, weeks * 7).map((d) => {
          const date = iso(d);
          const evs = on(date);
          return (
            <button
              key={date}
              className={`day${d.getMonth() !== month.getMonth() ? ' out' : ''}${date === t0 ? ' today' : ''}${date === selected ? ' sel' : ''}`}
              aria-label={`${date}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}
              onClick={() => onSelect(date)}
            >
              {d.getDate()}
              <span className="dots">
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className="dot" style={{ background: colorOf(e) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
