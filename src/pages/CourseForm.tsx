import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { Course, Tee } from '../lib/types';
import { REGIONS } from '../data/courses';
import { Chips, Field, PageHead } from '../components/ui';

export default function CourseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Course>({ name: '', city: '', region: 'Austin', tees: [] });

  useEffect(() => {
    if (id) db.courses.get(Number(id)).then((x) => x && setC(x));
  }, [id]);

  const setTee = (i: number, t: Tee) => setC({ ...c, tees: c.tees.map((x, j) => (j === i ? t : x)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!c.name.trim()) return;
    await db.courses.put(c);
    navigate(-1);
  }

  async function remove() {
    if (!id || !confirm('Delete this course? Rounds played here keep their scores.')) return;
    await db.courses.delete(Number(id));
    navigate('/courses', { replace: true });
  }

  return (
    <form onSubmit={save}>
      <PageHead title={id ? c.name || 'Course' : 'Add course'} back="/courses" />
      <div className="card">
        <Field label="Name">
          <input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label="City">
            <input value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} />
          </Field>
          <Field label="Region">
            <select value={c.region} onChange={(e) => setC({ ...c, region: e.target.value as Course['region'] })}>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid2">
          <Field label="Phone">
            <input type="tel" value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value || undefined })} />
          </Field>
          <Field label="Website">
            <input type="url" value={c.website ?? ''} onChange={(e) => setC({ ...c, website: e.target.value || undefined })} placeholder="https://…" />
          </Field>
        </div>
        {(c.architect || c.yearBuilt || (c.lat !== undefined && c.lng !== undefined)) && (
          <div className="row wrap" style={{ gap: 12 }}>
            {(c.architect || c.yearBuilt) && (
              <span className="muted small">{[c.architect && `Designed by ${c.architect}`, c.yearBuilt].filter(Boolean).join(' · ')}</span>
            )}
            {c.lat !== undefined && c.lng !== undefined && (
              <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">
                📍 Get directions
              </a>
            )}
          </div>
        )}
      </div>

      {c.tees.map((t, i) => (
        <div className="card" key={i}>
          <div className="row between">
            <input value={t.name} onChange={(e) => setTee(i, { ...t, name: e.target.value })} style={{ fontWeight: 600 }} />
            <button type="button" className="small-btn danger" onClick={() => setC({ ...c, tees: c.tees.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
          <div className="muted small" style={{ margin: '8px 0' }}>
            Par {t.pars.reduce((a, b) => a + b, 0)}
            {t.yardages?.some(Boolean) && ` · ${t.yardages.reduce<number>((a, b) => a + (b ?? 0), 0)} yds`}
            {t.rating !== undefined && ` · ${t.rating} rating`}
            {t.slope !== undefined && ` / ${t.slope} slope`}
          </div>
          <table className="score">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                <th>Yards</th>
              </tr>
            </thead>
            <tbody>
              {t.pars.map((p, h) => (
                <tr key={h}>
                  <td>{h + 1}</td>
                  <td>
                    <Chips options={[3, 4, 5] as const} value={p} onChange={(v) => v && setTee(i, { ...t, pars: t.pars.map((x, k) => (k === h ? v : x)) })} />
                  </td>
                  <td>
                    <input
                      inputMode="numeric"
                      style={{ width: 80 }}
                      value={t.yardages?.[h] ?? ''}
                      onChange={(e) => {
                        const y = [...(t.yardages ?? Array(t.pars.length).fill(undefined))];
                        y[h] = e.target.value ? Number(e.target.value) : undefined;
                        setTee(i, { ...t, yardages: y });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="grow" onClick={() => setC({ ...c, tees: [...c.tees, { name: 'New tees', pars: Array(9).fill(4) }] })}>
          + 9-hole tees
        </button>
        <button type="button" className="grow" onClick={() => setC({ ...c, tees: [...c.tees, { name: 'New tees', pars: Array(18).fill(4) }] })}>
          + 18-hole tees
        </button>
      </div>

      <div className="sticky-actions">
        {id && (
          <button type="button" className="danger" onClick={remove}>
            Delete
          </button>
        )}
        <button type="submit" className="primary block">
          Save course
        </button>
      </div>
    </form>
  );
}
