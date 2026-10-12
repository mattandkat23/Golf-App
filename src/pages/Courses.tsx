import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { REGIONS } from '../data/courses';
import { STATE_NAMES } from '../data/states';
import type { Course } from '../lib/types';
import { PageHead } from '../components/ui';

function CourseList({ list }: { list: Course[] }) {
  return (
    <ul className="list">
      {list.map((c) => (
        <li key={c.id}>
          <Link to={`/courses/${c.id}`}>
            <div className="grow">
              <div>{c.name}</div>
              <div className="muted small">
                {c.city}
                {c.tees.length > 0 && ` · ${c.tees.map((t) => t.name).join(', ')}`}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Courses() {
  const [q, setQ] = useState('');
  const courses = useLiveQuery(() => db.courses.orderBy('name').toArray(), []);
  const match = (courses ?? []).filter((c) => `${c.name} ${c.city}`.toLowerCase().includes(q.toLowerCase()));

  const otherByState = useMemo(() => {
    const groups = new Map<string, Course[]>();
    for (const c of match) {
      if (c.region !== 'Other') continue;
      const state = c.state ?? '?';
      (groups.get(state) ?? groups.set(state, []).get(state)!).push(c);
    }
    return [...groups.entries()].sort(([a], [b]) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b));
  }, [match]);

  return (
    <>
      <PageHead
        title="Courses"
        back="/more"
        action={
          <Link className="btn primary" to="/courses/new">
            + Add
          </Link>
        }
      />
      <input placeholder="Search courses or cities" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {REGIONS.filter((r) => r !== 'Other').map((region) => {
        const list = match.filter((c) => c.region === region);
        if (!list.length) return null;
        return (
          <div className="card" key={region}>
            <h2>{region}</h2>
            <CourseList list={list} />
          </div>
        );
      })}
      {otherByState.length > 0 && (
        <div className="card">
          <h2>Other states</h2>
          {otherByState.map(([state, list]) => (
            <details key={`${state}:${q ? 'q' : 'noq'}`} className="tour-group" open={!!q}>
              <summary>
                <span className="grow">{STATE_NAMES[state] ?? state}</span>
                <span className="muted small">{list.length}</span>
              </summary>
              <CourseList list={list} />
            </details>
          ))}
        </div>
      )}
    </>
  );
}
