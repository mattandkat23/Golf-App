import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import type { PracticeFocus } from '../lib/types';
import { Bars, DateBox, PageHead, today } from '../components/ui';

export default function Practice() {
  const gid = useGolfer().golfer.id;
  const sessions = useLiveQuery(async () => (await db.practice.where('golferId').equals(gid).sortBy('date')).reverse(), [gid]);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const cutoff = since.toISOString().slice(0, 10);
  const recent = (sessions ?? []).filter((s) => s.date >= cutoff && s.date <= today());
  const byArea = new Map<PracticeFocus, number>();
  recent.forEach((s) => s.focus.forEach((f) => byArea.set(f.area, (byArea.get(f.area) ?? 0) + f.minutes)));
  const totalMin = recent.reduce((n, s) => n + s.minutes, 0);

  return (
    <>
      <PageHead
        title="Practice"
        action={
          <Link className="btn primary" to="/practice/new">
            + Log
          </Link>
        }
      />
      <div className="card">
        <h2>Last 30 days</h2>
        <p className="muted small">
          {recent.length} sessions · {Math.floor(totalMin / 60)}h {totalMin % 60}m
        </p>
        {byArea.size > 0 ? (
          <Bars
            rows={[...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([area, min]) => ({ label: area, value: min }))}
            format={(v) => `${v} min`}
          />
        ) : (
          <div className="empty">Log a session to see where practice time goes.</div>
        )}
      </div>
      <div className="card">
        {sessions?.length ? (
          <ul className="list">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link to={`/practice/${s.id}`}>
                  <DateBox date={s.date} />
                  <div className="grow">
                    <div>{s.focus.map((f) => f.area).join(', ') || 'Practice'}</div>
                    <div className="muted small">
                      {s.minutes} min {s.location && `· ${s.location}`}
                      {s.drills.length > 0 && ` · ${s.drills.length} drill${s.drills.length > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">No sessions yet.</div>
        )}
      </div>
    </>
  );
}
