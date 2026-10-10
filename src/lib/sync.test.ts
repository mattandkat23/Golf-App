import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Browser bits the sync code uses, in a plain Node test.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal('navigator', { onLine: true });

// A fake account: one family_data row, read and written through the same calls the app uses.
const server: { row: { data: unknown; updated_at: string } | null } = { row: null };
let clock = 0;
vi.mock('./supabase', () => {
  const table = {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: server.row, error: null }) }),
    }),
    upsert: (v: { data: unknown }) => ({
      select: () => ({
        single: async () => {
          server.row = { data: JSON.parse(JSON.stringify(v.data)), updated_at: `t${++clock}` };
          return { data: { updated_at: server.row.updated_at }, error: null };
        },
      }),
    }),
  };
  return { supabase: { from: () => table, auth: { signOut: async () => ({}) } } };
});

const { db } = await import('./db');
const { syncOnStart, upload } = await import('./sync');

const golferNames = async () => (await db.profile.toArray()).map((p) => p.playerName).sort();

beforeEach(async () => {
  localStorage.clear();
  server.row = null;
  await db.profile.clear();
  await db.tournaments.clear();
  await db.profile.add({ id: 'me', playerName: 'My Golfer', bag: [], myTours: [] });
});

describe('account sync', () => {
  it('starts a brand-new account with what is on the phone', async () => {
    await db.profile.update('me', { playerName: 'Jack' });
    await syncOnStart('u1', () => true);
    expect(JSON.stringify(server.row?.data)).toContain('Jack');
  });

  it('a new phone downloads the account instead of uploading its empty data', async () => {
    server.row = { data: { app: 'golf-tracker', version: 1, courses: [], tournaments: [], rounds: [], practice: [], profile: [{ id: 'me', playerName: 'Emma', bag: [] }] }, updated_at: 't0' };
    await syncOnStart('u2', () => true);
    expect(await golferNames()).toEqual(['Emma']);
    expect(JSON.stringify(server.row.data)).toContain('Emma');
  });

  it('uploads later changes, and asks when the phone and account both changed', async () => {
    await syncOnStart('u3', () => true);
    await db.profile.update('me', { playerName: 'Ava' });
    await upload();
    expect(JSON.stringify(server.row?.data)).toContain('Ava');

    // Another phone saves, while this one also has an unsaved change.
    server.row = { data: { ...(server.row!.data as object), profile: [{ id: 'me', playerName: 'From other phone', bag: [] }] }, updated_at: 'other' };
    await db.profile.update('me', { playerName: 'From this phone' });
    const choose = vi.fn(() => false); // keep the account's copy
    await syncOnStart('u3', choose);
    expect(choose).toHaveBeenCalledOnce();
    expect(await golferNames()).toEqual(['From other phone']);
  });
});
