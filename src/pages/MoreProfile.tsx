import { useState } from 'react';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { useAuth } from '../lib/auth';
import { optInAllAjgaLive, optOutAllAjgaLive } from '../lib/ajgaLiveTracking';
import type { Profile } from '../lib/types';
import { Field, PageHead, today } from '../components/ui';
import { AGE_GROUPS } from '../data/uskids';

export default function MoreProfile() {
  const { golfer: profile } = useGolfer();
  const { session } = useAuth();
  const [savingAjga, setSavingAjga] = useState(false);
  const save = (p: Partial<Profile>) => db.profile.put({ ...profile, ...p });

  async function toggleAjgaHoles(on: boolean) {
    setSavingAjga(true);
    if (on && session) {
      const mine = await db.tournaments.where('golferId').equals(profile.id).toArray();
      await optInAllAjgaLive(session, profile, mine);
    } else if (!on) {
      await optOutAllAjgaLive(profile);
    }
    await save({ trackAjgaHoles: on });
    setSavingAjga(false);
  }

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
        <label className="row" style={{ gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={!!profile.trackAjgaHoles}
            disabled={!session || savingAjga}
            onChange={(e) => toggleAjgaHoles(e.target.checked)}
          />
          <span>Track hole-by-hole live for all of {profile.playerName || 'this golfer'}'s AJGA events</span>
        </label>
        <p className="muted small" style={{ marginTop: 0 }}>
          AJGA shows hole-by-hole scores while an event is in progress. Turn this on once and every AJGA event already on{' '}
          {profile.playerName || 'their'} schedule -- and any added later -- gets pulled in daily, automatically.
          {!session && ' Sign in to turn this on.'}
        </p>
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
