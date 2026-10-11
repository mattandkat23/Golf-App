import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../lib/db';
import type { Profile } from '../lib/types';

/** Lets the parent pick which tours their golfer plays, and add tours that aren't listed. */
export default function MyTours({ profile }: { profile: Profile }) {
  const tours = useLiveQuery(() => db.tours.toArray(), []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const mine = profile.myTours ?? [];

  const toggle = (id: string) =>
    db.profile.update(profile.id, { myTours: mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id] });

  async function add() {
    if (!name.trim()) return;
    const id = `custom-${Date.now()}`;
    await db.tours.add({ id, name: name.trim(), url: url.trim() || undefined, custom: true });
    await db.profile.update(profile.id, { myTours: [...mine, id] });
    setName('');
    setUrl('');
    setAdding(false);
  }

  return (
    <div className="card">
      <p className="muted small">
        Subscribe to the tours {profile.playerName || 'your golfer'} plays. Their events show up in Events → Available, and they're listed first when you add an event.
      </p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {tours?.map((t) => (
          <button key={t.id} className={`chip${mine.includes(t.id) ? ' on' : ''}`} onClick={() => toggle(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {adding ? (
        <div className="stack">
          <input placeholder="Tour name, e.g. Austin Fall League" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="url" placeholder="Schedule link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="row">
            <button className="grow" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="grow primary" onClick={add}>
              Add tour
            </button>
          </div>
        </div>
      ) : (
        <button className="block" onClick={() => setAdding(true)}>
          + Add a tour that's not listed
        </button>
      )}
    </div>
  );
}
