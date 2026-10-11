import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import type { Profile } from '../lib/types';
import { Field, PageHead, today } from '../components/ui';
import { AGE_GROUPS } from '../data/uskids';

export default function MoreProfile() {
  const { golfer: profile } = useGolfer();
  const save = (p: Partial<Profile>) => db.profile.put({ ...profile, ...p });

  return (
    <>
      <PageHead title={profile.playerName || 'Profile'} back="/more" />
      <div className="card">
        <Field label="Name">
          <input value={profile.playerName} onChange={(e) => save({ playerName: e.target.value })} />
        </Field>
        <Field label="Age group (default for new events)">
          <select value={profile.ageGroup ?? ''} onChange={(e) => save({ ageGroup: e.target.value || undefined })}>
            <option value="">—</option>
            {AGE_GROUPS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="card">
        <h2>Bag & carry distances</h2>
        <p className="muted small">Clubs here appear in play mode. Update carry yardages as they grow.</p>
        {profile.bag.map((c, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <input className="grow" value={c.name} onChange={(e) => save({ bag: profile.bag.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input
              inputMode="numeric"
              placeholder="carry"
              style={{ width: 80 }}
              value={c.carry ?? ''}
              onChange={(e) => save({ bag: profile.bag.map((x, j) => (j === i ? { ...x, carry: e.target.value ? Number(e.target.value) : undefined, updated: today() } : x)) })}
            />
            <span className="muted small">yds</span>
            <button className="small-btn" aria-label={`Remove ${c.name}`} onClick={() => save({ bag: profile.bag.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button className="block" onClick={() => save({ bag: [...profile.bag, { name: 'New club' }] })}>
          + Add club
        </button>
      </div>
    </>
  );
}
