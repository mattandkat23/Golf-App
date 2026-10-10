import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, deleteGolfer, exportBackup, importBackup, newGolfer } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { clearPhone, onSyncStatus, signOutAndClear, syncStatus, type SyncStatus } from '../lib/sync';
import type { Profile } from '../lib/types';
import { Field, PageHead, today } from '../components/ui';
import { AGE_GROUPS } from '../data/uskids';
import MyTours from '../components/MyTours';

export default function More() {
  const { golfer: profile, golfers, setGolferId } = useGolfer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const save = (p: Partial<Profile>) => db.profile.put({ ...profile, ...p });

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

  async function doExport() {
    const data = await exportBackup();
    const file = new File([JSON.stringify(data)], `golf-backup-${today()}.json`, { type: 'application/json' });
    // iPhone: the share sheet lets you save to Files, AirDrop, or text it to someone.
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Golf Tracker backup' }).catch(() => undefined);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  async function doImport(f: File) {
    if (!confirm('Replace everything on this phone with the backup?')) return;
    try {
      await importBackup(JSON.parse(await f.text()));
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Couldn't restore: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <PageHead title="More" />
      <div className="card">
        <h2>Golfers</h2>
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

      <div className="card">
        <h2>{profile.playerName || 'Player'}</h2>
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
        {golfers.length > 1 && (
          <button className="block danger" onClick={removeGolfer}>
            Remove {profile.playerName || 'this golfer'}
          </button>
        )}
      </div>

      <MyTours profile={profile} />

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

      <div className="card">
        <ul className="list">
          <li>
            <Link to="/courses">Courses & scorecards ›</Link>
          </li>
          <li>
            <Link to="/rounds">All rounds ›</Link>
          </li>
        </ul>
      </div>

      <AccountCard />

      <div className="card">
        <h2>Backup & sharing</h2>
        <p className="muted small">
          Everything is saved to your account automatically and works offline on the course. You can also export a backup file to keep or to send
          to a coach.
        </p>
        <div className="row">
          <button className="grow primary" onClick={doExport}>
            Export backup
          </button>
          <button className="grow" onClick={() => fileRef.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </>
  );
}

const STATUS: Record<SyncStatus, string> = {
  idle: '',
  syncing: 'Saving…',
  saved: 'All changes saved to your account.',
  offline: 'Offline. Changes will save when you’re back online.',
  error: 'Couldn’t save just now. It will try again.',
};

function AccountCard() {
  const { session } = useAuth();
  const [status, setStatus] = useState(syncStatus());
  const [busy, setBusy] = useState(false);
  useEffect(() => onSyncStatus(setStatus), []);
  const [plan, setPlan] = useState<string>();
  const uid = session?.user.id;
  useEffect(() => {
    if (uid)
      supabase
        .from('accounts')
        .select('plan')
        .eq('id', uid)
        .maybeSingle()
        .then(({ data }) => setPlan(data?.plan));
  }, [uid]);

  async function signOut() {
    setBusy(true);
    if (!(await signOutAndClear())) {
      alert('Couldn’t save your latest changes, so you’re still signed in. Connect to the internet and try again.');
      setBusy(false);
      return;
    }
    location.reload();
  }

  async function deleteAccount() {
    if (!confirm('Delete your account and all your golfers, events, rounds and practice? This can’t be undone.')) return;
    if (!confirm('Are you sure? Everything will be permanently deleted.')) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      alert(`Couldn’t delete the account: ${error.message}`);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    await clearPhone();
    location.reload();
  }

  return (
    <div className="card">
      <h2>Account</h2>
      <p className="small" style={{ marginTop: 0 }}>
        {session?.user.email ?? 'Offline'}
        {plan && <span className="tag" style={{ marginLeft: 8 }}>{plan === 'paid' ? 'Paid plan' : 'Free plan'}</span>}
      </p>
      {STATUS[status] && <p className="muted small">{STATUS[status]}</p>}
      <div className="row">
        <button className="grow" disabled={busy || !session} onClick={signOut}>
          Sign out
        </button>
      </div>
      <button className="block danger" style={{ marginTop: 8 }} disabled={busy || !session} onClick={deleteAccount}>
        Delete my account
      </button>
    </div>
  );
}
