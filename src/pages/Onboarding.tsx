import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { useGolfer } from '../lib/golfer';
import MyTours from '../components/MyTours';
import { Field, Icon } from '../components/ui';
import { AGE_GROUPS } from '../data/uskids';

const NAV_TABS = [
  { label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', desc: "A quick look at what's coming up, with reminders and shortcuts to everything else." },
  { label: 'Events', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', desc: 'My schedule (what’s added), Available (tournaments you can add), and Past (results).' },
  { label: 'Practice', icon: 'M7 21V4l10 4-10 4', desc: 'Log practice sessions separately from tournament rounds.' },
  { label: 'Stats', icon: 'M5 20V10M12 20V4M19 20v-7', desc: 'Scoring trends, fairways, greens and putting, broken out by tournament or practice.' },
  { label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01', desc: 'Golfers, profile, tours, courses, rounds, and your account.' },
];

const STEP_COUNT = 6;

/**
 * First-time setup walkthrough, shown once right after a brand-new profile is created (see App.tsx's
 * Gate and Profile.onboarded). Also reachable any time from More -> "Replay setup guide" (/onboarding).
 * Marks the golfer onboarded as soon as it opens, not just on Finish, so stepping away early (e.g. to
 * try adding an event) never traps a parent in a loop of seeing this again on their next visit.
 */
export default function Onboarding() {
  const { golfer } = useGolfer();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!golfer.onboarded) void db.profile.update(golfer.id, { onboarded: true });
  }, [golfer.id, golfer.onboarded]);

  const next = () => (step < STEP_COUNT - 1 ? setStep(step + 1) : navigate('/'));
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <>
      {step > 0 && (
        <div className="muted small" style={{ marginBottom: 8 }}>
          Step {step} of {STEP_COUNT - 1}
        </div>
      )}

      {step === 0 && (
        <div className="card stack">
          <h1 style={{ margin: 0 }}>Welcome to Golf Tracker ⛳</h1>
          <p className="muted">
            Let's get {golfer.playerName || 'your golfer'} set up — it only takes a minute. We'll name your golfer, pick the tours they play, and
            show you around.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Your golfer</h2>
          <p className="muted small">This is who the app is tracking. You can add more golfers later under More → Manage golfers.</p>
          <Field label="Name">
            <input autoFocus value={golfer.playerName} onChange={(e) => db.profile.update(golfer.id, { playerName: e.target.value })} />
          </Field>
          <Field label="Age group (default for new events)">
            <select value={golfer.ageGroup ?? ''} onChange={(e) => db.profile.update(golfer.id, { ageGroup: e.target.value || undefined })}>
              <option value="">—</option>
              {AGE_GROUPS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Pick their tours</h2>
          </div>
          <MyTours profile={golfer} />
        </>
      )}

      {step === 3 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Adding a one-off event</h2>
          <p className="muted">
            Playing somewhere that's not on a tour's schedule — a club event, a one-time invitational? Tap <b>+ Add</b> at the top of the{' '}
            <b>Events</b> tab any time to add it by hand, with its own date, course and tour (optional).
          </p>
          <Link className="btn" to="/tournament/new">
            Try it now ›
          </Link>
        </div>
      )}

      {step === 4 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Don't see a tour?</h2>
          <p className="muted">
            We're always adding more. Under <b>Events → Available</b>, tap <b>"Tour not listed here?"</b> to ask for one — we'll look at adding it
            for every family.
          </p>
          <Link className="btn" to="/request-tour">
            Request a tour ›
          </Link>
        </div>
      )}

      {step === 5 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Getting around</h2>
          <p className="muted small">Five tabs at the bottom, always one tap away.</p>
          <ul className="list">
            {NAV_TABS.map((t) => (
              <li key={t.label}>
                <div className="li" style={{ alignItems: 'flex-start' }}>
                  <Icon d={t.icon} />
                  <div className="grow">
                    <b>{t.label}</b>
                    <div className="muted small">{t.desc}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        {step > 0 && (
          <button className="grow" onClick={back}>
            Back
          </button>
        )}
        <button className="grow primary" onClick={next}>
          {step === STEP_COUNT - 1 ? "Let's go" : step === 0 ? 'Get started' : 'Next'}
        </button>
      </div>
      {step > 0 && step < STEP_COUNT - 1 && (
        <button className="small-btn" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => navigate('/')}>
          Skip setup
        </button>
      )}
    </>
  );
}
