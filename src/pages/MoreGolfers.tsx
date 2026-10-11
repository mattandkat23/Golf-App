import { useState } from 'react';
import { db, deleteGolfer, newGolfer } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { PageHead } from '../components/ui';

export default function MoreGolfers() {
  const { golfer: profile, golfers, setGolferId } = useGolfer();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  async function addGolfer() {
    if (!newName.trim()) return;
    const g = newGolfer(newName.trim());
    await db.profile.add(g);
    setGolferId(g.id);
    setNewName('');
    setAdding(false);
  }

  async function removeGolfer() {
    const name = profile.playerName || 'this golfer';
    if (!confirm(`Remove ${name} and all of ${name}'s events, rounds and practice? This can't be undone.`)) return;
    await deleteGolfer(profile.id);
    setGolferId(golfers.find((g) => g.id !== profile.id)!.id);
  }

  return (
    <>
      <PageHead title="Golfers" back="/more" />
      <div className="card">
        <p className="muted small">Each golfer has their own schedule, rounds, stats, practice, tours and bag. Courses are shared.</p>
        <ul className="list" style={{ marginBottom: 10 }}>
          {golfers.map((g) => (
            <li key={g.id}>
              <button className="li" onClick={() => setGolferId(g.id)}>
                <span className="grow">{g.playerName || 'Golfer'}</span>
                {g.id === profile.id && <span className="tag accent">Selected</span>}
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <div className="row">
            <input className="grow" autoFocus placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGolfer()} />
            <button onClick={() => setAdding(false)}>Cancel</button>
            <button className="primary" onClick={addGolfer}>
              Add
            </button>
          </div>
        ) : (
          <button className="block" onClick={() => setAdding(true)}>
            + Add golfer
          </button>
        )}
      </div>

      {golfers.length > 1 && (
        <button className="block danger" onClick={removeGolfer}>
          Remove {profile.playerName || 'this golfer'}
        </button>
      )}
    </>
  );
}
