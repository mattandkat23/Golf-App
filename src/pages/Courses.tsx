import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { REGIONS } from '../data/courses';
import { PageHead } from '../components/ui';

export default function Courses() {
  const [q, setQ] = useState('');
  const courses = useLiveQuery(() => db.courses.orderBy('name').toArray(), []);
  const match = (courses ?? []).filter((c) => `${c.name} ${c.city}`.toLowerCase().includes(q.toLowerCase()));

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
      {REGIONS.map((region) => {
        const list = match.filter((c) => c.region === region);
        if (!list.length) return null;
        return (
          <div className="card" key={region}>
            <h2>{region}</h2>
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
          </div>
        );
      })}
    </>
  );
}
