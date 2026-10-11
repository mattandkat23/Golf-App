import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Field, PageHead, fmtDate } from '../components/ui';

interface TourRequest {
  id: number;
  tour_name: string;
  tour_url: string | null;
  note: string | null;
  created_at: string;
}

export default function RequestTour() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const mine = useLiveQuery(async () => {
    if (!session) return [];
    const { data } = await supabase
      .from('tour_requests')
      .select('id, tour_name, tour_url, note, created_at')
      .order('created_at', { ascending: false });
    return (data as TourRequest[] | null) ?? [];
  }, [session?.user.id, sent]);

  async function submit() {
    if (!name.trim() || !session) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('tour_requests').insert({
      user_id: session.user.id,
      tour_name: name.trim(),
      tour_url: url.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (err) {
      setError('Couldn’t send that — check you’re online and try again.');
      return;
    }
    setName('');
    setUrl('');
    setNote('');
    setSent(true);
  }

  return (
    <>
      <PageHead title="Request a tour" back="/schedule" />
      <div className="card">
        <p className="muted small" style={{ marginTop: 0 }}>
          Some tours can't be collected automatically. Tell us which one and we'll look at adding it for every family — either by finding a way to
          scrape it, or by publishing its schedule by hand.
        </p>
        <Field label="Tour name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NTPGA Junior Tour" />
        </Field>
        <Field label="Tour's website (optional)">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
        </Field>
        <Field label="Anything else (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. city, age group" />
        </Field>
        {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
        {sent && <p className="small">Sent — thanks!</p>}
        <button className="primary block" disabled={!name.trim() || !session || saving} onClick={submit}>
          {session ? 'Send request' : 'Sign in to send a request'}
        </button>
      </div>

      {!!mine?.length && (
        <div className="card">
          <h2>Your requests</h2>
          <ul className="list">
            {mine.map((r) => (
              <li key={r.id} style={{ padding: '10px 0' }}>
                <b>{r.tour_name}</b>
                <div className="muted small">
                  Requested {fmtDate(r.created_at.slice(0, 10))}
                  {r.note && ` · ${r.note}`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
