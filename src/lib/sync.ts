/**
 * Keeps the phone's data and the parent's account in step. The phone stays the working copy (so the app
 * works offline); the account holds a copy of the same JSON as the backup file, uploaded a few seconds
 * after each change and downloaded when another phone has saved something newer.
 */
import { db, exportBackup, importBackup, type Backup } from './db';
import { supabase } from './supabase';

const KEY_USER = 'syncUser'; // account id this phone's data belongs to
const KEY_AT = 'syncAt'; // server updated_at of the copy this phone last uploaded or downloaded
const KEY_DIRTY = 'syncDirty'; // '1' when the phone has changes the account doesn't have yet

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Private browsing: sync still works for this visit.
  }
};

/** The account this phone last synced with, used to allow offline use without a fresh login. */
export const knownUser = () => get(KEY_USER);

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'error';
let status: SyncStatus = 'idle';
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export const syncStatus = () => status;
export function onSyncStatus(l: (s: SyncStatus) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let applyingRemote = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let userId: string | undefined;
/** Set once the first sync after signing in has finished, so a new phone's empty data can't overwrite the account. */
let ready = false;
let chooser: () => boolean = () => true;
/** Counts edits, so an upload only marks the phone saved if nothing changed while it was in flight. */
let edits = 0;

function markDirty() {
  if (applyingRemote) return;
  edits++;
  put(KEY_DIRTY, '1');
  clearTimeout(timer);
  timer = setTimeout(() => void upload(), 4000);
}

for (const table of [db.courses, db.tournaments, db.rounds, db.practice, db.profile, db.tours, db.imported]) {
  table.hook('creating', markDirty);
  table.hook('updating', markDirty);
  table.hook('deleting', markDirty);
}

/** True when the phone has nothing worth keeping: no events, rounds, practice or pasted events, and the default golfer. */
async function phoneIsEmpty() {
  const [t, r, p, i, golfers] = await Promise.all([db.tournaments.count(), db.rounds.count(), db.practice.count(), db.imported.count(), db.profile.toArray()]);
  return t + r + p + i === 0 && golfers.length <= 1 && (golfers[0]?.playerName ?? 'My Golfer') === 'My Golfer';
}

async function download(row: { data: Backup; updated_at: string }) {
  applyingRemote = true;
  try {
    await importBackup(row.data);
  } finally {
    applyingRemote = false;
  }
  put(KEY_AT, row.updated_at);
  put(KEY_DIRTY, null);
}

/**
 * Uploads the phone's data. Returns false if it couldn't (offline, an error, or not yet checked against the
 * account since signing in or reconnecting); the changes stay marked for the next try.
 */
export async function upload(force = false): Promise<boolean> {
  clearTimeout(timer);
  if (!userId || get(KEY_DIRTY) !== '1') return true;
  if (!ready && !force) return false;
  if (!navigator.onLine) {
    setStatus('offline');
    return false;
  }
  setStatus('syncing');
  const sent = edits;
  const { data, error } = await supabase
    .from('family_data')
    .upsert({ user_id: userId, data: await exportBackup(), updated_at: new Date().toISOString() })
    .select('updated_at')
    .single();
  if (error) {
    setStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
  put(KEY_AT, data.updated_at);
  if (edits !== sent) {
    // Changed while uploading: send again shortly.
    timer = setTimeout(() => void upload(), 1000);
    return true;
  }
  put(KEY_DIRTY, null);
  setStatus('saved');
  return true;
}

/**
 * Runs when the app starts signed in, or right after signing in. `choose` is asked only when both the
 * phone and the account have changes the other doesn't; it returns true to keep the phone's copy.
 */
export async function syncOnStart(uid: string, choose: () => boolean): Promise<void> {
  userId = uid;
  chooser = choose;
  ready = false;
  clearTimeout(timer);
  // Offline or failed: keep working on the phone; this runs again when the connection comes back.
  ready = await firstSync(uid, choose);
  // Edits made while comparing with the account couldn't upload yet; send them now.
  if (ready && get(KEY_DIRTY) === '1') timer = setTimeout(() => void upload(), 1000);
}

/** Returns true once the phone and the account have been compared (whether or not the upload then worked). */
async function firstSync(uid: string, choose: () => boolean): Promise<boolean> {
  if (!navigator.onLine) {
    setStatus('offline');
    return false;
  }
  setStatus('syncing');
  const { data: row, error } = await supabase.from('family_data').select('data, updated_at').eq('user_id', uid).maybeSingle();
  if (error) {
    setStatus('error');
    return false;
  }
  const sameAccount = get(KEY_USER) === uid;
  put(KEY_USER, uid);
  const phoneChanged = !sameAccount || get(KEY_DIRTY) === '1';

  if (!row) {
    // Brand-new account: it starts with whatever is on this phone.
    put(KEY_DIRTY, '1');
    await upload(true);
    return true;
  }
  const accountChanged = !sameAccount || row.updated_at !== get(KEY_AT);
  if (!accountChanged) {
    if (phoneChanged) await upload(true);
    else setStatus('saved');
    return true;
  }
  if (!phoneChanged || (await phoneIsEmpty()) || !choose()) {
    await download(row as { data: Backup; updated_at: string });
    setStatus('saved');
  } else {
    put(KEY_DIRTY, '1');
    await upload(true);
  }
  return true;
}

/** Saves any last changes, then removes this family's data from the phone. Returns false if it couldn't save (offline). */
export async function signOutAndClear(): Promise<boolean> {
  if (!ready && userId) await syncOnStart(userId, chooser);
  if (!(await upload())) return false;
  await supabase.auth.signOut();
  await clearPhone();
  return true;
}

/** Wipes the phone's copy (after sign-out or account deletion); the app starts fresh on reload. */
export async function clearPhone() {
  userId = undefined;
  ready = false;
  [KEY_USER, KEY_AT, KEY_DIRTY].forEach((k) => put(k, null));
  db.close();
  await db.delete();
}

// Save before the app is put in the background, and retry when the connection comes back.
if (typeof document !== 'undefined') {
  const resync = () => {
    if (userId && !ready) void syncOnStart(userId, chooser);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void upload();
    else resync();
  });
  // Coming back online: compare with the account first (another phone may have saved), then upload.
  window.addEventListener('online', () => (ready ? void upload() : resync()));
  window.addEventListener('offline', () => {
    ready = false;
  });
}
