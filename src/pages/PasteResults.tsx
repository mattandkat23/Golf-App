import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { findPlayer, parsePastedResults, type PastedResult } from '../lib/resultsPaste';
import { applyPastedResult } from '../lib/results';
import { PageHead, fmtDate } from '../components/ui';

const toPar = (n?: number) => (n === undefined ? '' : n === 0 ? 'E' : n > 0 ? `+${n}` : String(n));

/** Paste a tour's results table into one of the golfer's events; the app finds their row and saves the result. */
export default function PasteResults() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const t = useLiveQuery(() => db.tournaments.get(id), [id]);
  const golfer = useLiveQuery(() => (t ? db.profile.get(t.golferId) : undefined), [t?.golferId]);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<PastedResult>();
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => parsePastedResults(text), [text]);
  const match = useMemo(() => (golfer ? findPlayer(rows, golfer.playerName) : undefined), [rows, golfer]);
  const mine = picked && rows.includes(picked) ? picked : match;
  if (!t) return null;

  async function save() {
    if (!mine) return;
    setSaving(true);
    await applyPastedResult(t!, mine, rows.length);
    navigate(`/tournament/${id}`, { replace: true });
  }

  return (
    <>
      <PageHead title="Paste results" back={`/tournament/${id}`} />
      <div className="card">
        <b>{t.name}</b>
        <div className="muted small">
          {fmtDate(t.startDate)}
          {t.ageGroup && ` · ${t.ageGroup}`}
        </div>
      </div>
      <div className="card stack">
        <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Open the event's results page{t.url && <> (<a href={t.url} target="_blank" rel="noreferrer">event page ↗</a>)</>} and pick {golfer?.playerName || 'your golfer'}'s age group.</li>
          <li>Press and hold on the results table, tap <b>Select All</b> (or drag to select the table), then <b>Copy</b>.</li>
          <li>Paste below.</li>
        </ol>
        <textarea rows={6} placeholder="Paste the results table here" value={text} onChange={(e) => setText(e.target.value)} />
        {text && !rows.length && <p className="small" style={{ margin: 0 }}>Couldn't find a results table in that. Try copying just the table.</p>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <h2>
            {rows.length} players {!match && <span className="muted small">· tap {golfer?.playerName || 'your golfer'}'s row</span>}
          </h2>
          <ul className="list">
            {rows.map((r, i) => (
              <li key={i}>
                <button className={`li${r === mine ? ' picked' : ''}`} onClick={() => setPicked(r)}>
                  <b style={{ width: 36 }}>{r.position}</b>
                  <div className="grow">
                    <div>{r.name}</div>
                    {r.hometown && <div className="muted small">{r.hometown}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b>{r.total ?? '—'}</b> <span className="muted small">{toPar(r.toPar)}</span>
                    {r.rounds.length > 1 && <div className="muted small">{r.rounds.join(' · ')}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mine && (
        <div className="sticky-actions">
          <button className="primary block" disabled={saving} onClick={save}>
            Save {mine.name}: {mine.posNum ? `${mine.position} of ${rows.length}` : mine.position}
            {mine.total !== undefined && `, ${mine.total}`}
          </button>
        </div>
      )}
    </>
  );
}
