import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../lib/db';
import { SEED_TOURS } from '../data/tours';
import type { Profile, Tour } from '../lib/types';
import { Field } from './ui';

const ORG_ORDER = new Map<string, number>();
SEED_TOURS.forEach((t, i) => {
  const org = t.org ?? 'Other';
  if (!ORG_ORDER.has(org)) ORG_ORDER.set(org, i);
});
const TOUR_ORDER = new Map(SEED_TOURS.map((t, i) => [t.id, i]));

/** "NTPGA – Prep Tour" -> "Prep Tour", since the group header already says the org. */
function shortName(name: string) {
  const i = name.indexOf('–');
  return i < 0 ? name : name.slice(i + 1).trim();
}

/** Lets the parent pick which tours their golfer plays, grouped by org so a long list stays scannable. */
export default function MyTours({ profile }: { profile: Profile }) {
  const tours = useLiveQuery(() => db.tours.toArray(), []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const mine = profile.myTours ?? [];

  const toggle = (id: string) => db.profile.update(profile.id, { myTours: mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id] });

  async function add() {
    if (!name.trim()) return;
    const id = `custom-${Date.now()}`;
    await db.tours.add({ id, name: name.trim(), url: url.trim() || undefined, custom: true });
    await db.profile.update(profile.id, { myTours: [...mine, id] });
    setName('');
    setUrl('');
    setAdding(false);
  }

  if (!tours) return null;

  const q = query.trim().toLowerCase();
  const matches = (t: Tour) => !q || t.name.toLowerCase().includes(q) || (t.org ?? '').toLowerCase().includes(q);
  const groups = new Map<string, Tour[]>();
  for (const t of tours.filter(matches)) {
    const org = t.org ?? 'Other';
    groups.set(org, [...(groups.get(org) ?? []), t]);
  }
  for (const list of groups.values()) list.sort((a, b) => (TOUR_ORDER.get(a.id) ?? Infinity) - (TOUR_ORDER.get(b.id) ?? Infinity) || a.name.localeCompare(b.name));
  const sortedGroups = [...groups.entries()].sort((a, b) => (ORG_ORDER.get(a[0]) ?? Infinity) - (ORG_ORDER.get(b[0]) ?? Infinity) || a[0].localeCompare(b[0]));

  return (
    <div className="card">
      <p className="muted small">
        Subscribe to the tours {profile.playerName || 'your golfer'} plays. Their events show up in Events → Available, and they're listed first when you add
        an event.
      </p>
      <Field label="Search tours">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. US Kids, NTPGA, Houston…" />
      </Field>
      {sortedGroups.length === 0 ? (
        <p className="empty">No tours match “{query}”.</p>
      ) : (
        sortedGroups.map(([org, list]) => {
          const selected = list.filter((t) => mine.includes(t.id)).length;
          return (
            <details key={`${org}:${q ? 'q' : 'noq'}`} className="tour-group" open={!!q || selected > 0}>
              <summary>
                <span className="grow">{org}</span>
                <span className="muted small">
                  {selected > 0 ? `${selected}/${list.length}` : list.length}
                </span>
              </summary>
              <ul className="list">
                {list.map((t) => (
                  <li key={t.id}>
                    <label className="row">
                      <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={mine.includes(t.id)} onChange={() => toggle(t.id)} />
                      <span className="grow">{shortName(t.name)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        })
      )}
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
