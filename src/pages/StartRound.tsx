import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { Round } from '../lib/types';
import { Chips, Field, PageHead, today } from '../components/ui';
import CoursePicker from '../components/CoursePicker';

const NEW_TEE = '__new__';

export default function StartRound() {
  const [params] = useSearchParams();
  const tournamentId = params.get('tournament') ? Number(params.get('tournament')) : undefined;
  const navigate = useNavigate();
  const tournament = useLiveQuery(() => (tournamentId ? db.tournaments.get(tournamentId) : undefined), [tournamentId]);
  const [courseId, setCourseId] = useState<number>();
  const [teeName, setTeeName] = useState('');
  const [newTee, setNewTee] = useState('');
  const [numHoles, setNumHoles] = useState<9 | 18>(9);
  const [date, setDate] = useState(today());
  const course = useLiveQuery(() => (courseId ? db.courses.get(courseId) : undefined), [courseId]);

  useEffect(() => {
    if (tournament?.courseId) setCourseId(tournament.courseId);
    if (tournament && tournament.startDate > today()) setDate(tournament.startDate);
  }, [tournament]);
  useEffect(() => {
    setTeeName(course?.tees[0]?.name ?? NEW_TEE);
  }, [course?.id]);

  const selectedTee = course?.tees.find((x) => x.name === teeName);
  useEffect(() => {
    if (selectedTee) setNumHoles(selectedTee.pars.length >= 18 ? 18 : 9);
  }, [selectedTee]);

  async function start() {
    let tee = selectedTee;
    const name = teeName === NEW_TEE ? newTee.trim() || 'Default tees' : teeName;
    if (course && !tee) {
      tee = { name, pars: Array(numHoles).fill(4) };
      await db.courses.update(course.id!, { tees: [...course.tees, tee] });
    }
    const pars = tee?.pars ?? Array(numHoles).fill(4);
    const existing = tournamentId ? await db.rounds.where('tournamentId').equals(tournamentId).count() : 0;
    const round: Round = {
      tournamentId,
      courseId,
      teeName: course ? name : undefined,
      date,
      roundNumber: existing + 1,
      numHoles,
      holes: Array.from({ length: numHoles }, (_, i) => ({ hole: i + 1, par: pars[i] ?? 4, yards: tee?.yardages?.[i], shots: [] })),
    };
    const id = await db.rounds.add(round);
    navigate(`/play/${id}`, { replace: true });
  }

  return (
    <>
      <PageHead title="Start round" back={tournamentId ? `/tournament/${tournamentId}` : '/'} />
      <div className="card">
        {tournament && <p className="muted">{tournament.name}</p>}
        <Field label="Course">
          <CoursePicker value={courseId} onChange={setCourseId} />
        </Field>
        {course && (
          <Field label="Tees">
            <select value={teeName} onChange={(e) => setTeeName(e.target.value)}>
              {course.tees.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name} ({x.pars.length} holes, par {x.pars.reduce((a, b) => a + b, 0)})
                </option>
              ))}
              <option value={NEW_TEE}>+ New tees…</option>
            </select>
          </Field>
        )}
        {course && teeName === NEW_TEE && (
          <Field label="Tee name">
            <input placeholder="e.g. Age 9 (2,700 yds)" value={newTee} onChange={(e) => setNewTee(e.target.value)} />
            <span className="muted small">You'll set each hole's par as you play; it's saved for next time.</span>
          </Field>
        )}
        <Field label="Holes">
          <Chips options={[9, 18] as const} value={numHoles} onChange={(v) => v && setNumHoles(v)} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <button className="primary block" onClick={start}>
        Tee off
      </button>
    </>
  );
}
