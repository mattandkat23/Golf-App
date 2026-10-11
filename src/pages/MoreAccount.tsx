import { useEffect, useRef, useState } from 'react';
import { exportBackup, importBackup } from '../lib/db';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { clearPhone, onSyncStatus, signOutAndClear, syncStatus, type SyncStatus } from '../lib/sync';
import { PageHead, today } from '../components/ui';

export default function MoreAccount() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

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
      <PageHead title="Account & backup" back="/more" />
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
