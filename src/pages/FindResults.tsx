import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { groupHits, importResults, searchResults, sourceId, type PlayerGroup, type ResultHit } from '../lib/results';
import { DateBox, PageHead } from '../components/ui';

const toPar = (n: number | null) => (n === null ? '' : n === 0 ? 'E' : n > 0 ? `+${n}` : String(n));

/** Search the results database by name and add the confirmed results to the selected golfer's Past events. */
export default function FindResults() {
  const { golfer } = useGolfer();
  const [name, setName] = useState(golfer.playerName === 'My Golfer' ? '' : golfer.playerName);
  const [groups, setGroups] = useState<PlayerGroup[]>();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const added = useLiveQuery(
    async () => new Set((await db.tournaments.where('golferId').equals(golfer.id).toArray()).map((t) => t.sourceEventId).filter(Boolean)),
    [golfer.id],
  );

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setPicked(new Set());
    try {
      const hits = await searchResults(name);
      setGroups(groupHits(hits));
      if (!hits.length) setMsg('No results found for that name yet.');
    } catch (err) {
      setGroups(undefined);
      setMsg(/fetch|network/i.test((err as Error).message) ? 'No connection. Searching needs the internet.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number) => setPicked((cur) => new Set(cur.has(id) ? [...cur].filter((x) => x !== id) : [...cur, id]));
  const isAdded = (h: ResultHit) => added?.has(sourceId(h));
  const all = groups?.flatMap((g) => g.hits) ?? [];

  async function add() {
    setBusy(true);
    const n = await importResults(
      all.filter((h) => picked.has(h.result_id)),
      golfer,
    );
    setBusy(false);
    setPicked(new Set());
    setMsg(`Added ${n} result${n === 1 ? '' : 's'} to ${golfer.playerName}'s past events.`);
  }

  return (
    <>
      <PageHead title="Find past results" back="/schedule?tab=past" />
      <form className="card stack" onSubmit={search}>
        <label className="field" style={{ margin: 0 }}>
          <span>Golfer's first and last name, as the tours list it</span>
          <input value={name} autoComplete="off" placeholder="e.g. Ford Smith" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="primary block" disabled={busy || !name.trim()}>
          {busy && !groups ? 'Searching…' : 'Search'}
        </button>
        <p className="muted small" style={{ margin: 0 }}>
          Covers TGA / Legends Junior Tour, HJGT (Texas) and AJGA (nationwide) for the last two years so far, with more tours coming. For US Kids, open an event and use Paste results.
        </p>
      </form>

      {msg && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            {msg} {msg.startsWith('Added') && <Link to="/schedule?tab=past">See past events ›</Link>}
          </p>
        </div>
      )}

      {groups?.map((g) => (
        <div className="card" key={g.label}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>{g.label}</h2>
            <button
              className="small-btn"
              onClick={() => setPicked((cur) => new Set([...cur, ...g.hits.filter((h) => !isAdded(h)).map((h) => h.result_id)]))}
            >
              Select all
            </button>
          </div>
          <ul className="list">
            {g.hits.map((h) => (
              <li key={h.result_id}>
                <button className={`li${picked.has(h.result_id) ? ' picked' : ''}`} disabled={isAdded(h)} onClick={() => toggle(h.result_id)}>
                  <DateBox date={h.start_date} />
                  <div className="grow">
                    <div>{h.event_name}</div>
                    <div className="muted small">
                      {[h.start_date.slice(0, 4), h.division, h.hometown].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isAdded(h) ? (
                      <span className="tag accent">Added</span>
                    ) : (
                      <>
                        <b>{h.position ?? '—'}</b>
                        {h.field_size ? <span className="muted small"> / {h.field_size}</span> : null}
                        <div className="muted small">
                          {h.total ?? ''} {toPar(h.to_par)}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {picked.size > 0 && (
        <div className="sticky-actions">
          <button className="primary block" disabled={busy} onClick={add}>
            Add {picked.size} to {golfer.playerName}'s results
          </button>
        </div>
      )}
    </>
  );
}
