import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import TournamentForm from './pages/TournamentForm';
import TournamentDetail from './pages/TournamentDetail';
import StartRound from './pages/StartRound';
import Play from './pages/Play';
import Practice from './pages/Practice';
import PracticeForm from './pages/PracticeForm';
import StatsPage from './pages/Stats';
import Courses from './pages/Courses';
import CourseForm from './pages/CourseForm';
import More from './pages/More';
import MoreGolfers from './pages/MoreGolfers';
import MoreProfile from './pages/MoreProfile';
import MoreTours from './pages/MoreTours';
import MoreAccount from './pages/MoreAccount';
import Rounds from './pages/Rounds';
import RequestTour from './pages/RequestTour';
import PasteResults from './pages/PasteResults';
import FindResults from './pages/FindResults';
import { GolferProvider, GolferSwitch } from './lib/golfer';
import { AuthProvider, useAuth, useSignedIn } from './lib/auth';
import { syncOnStart } from './lib/sync';
import { Icon } from './components/ui';
import SignIn from './pages/SignIn';

const TABS = [
  { to: '/', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/schedule', label: 'Events', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { to: '/practice', label: 'Practice', icon: 'M7 21V4l10 4-10 4' },
  { to: '/stats', label: 'Stats', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

function Shell() {
  const { pathname } = useLocation();
  const playing = pathname.startsWith('/play/');
  const onTab = TABS.some((t) => t.to === pathname);
  return (
    <>
      <main className={`app${playing ? ' play' : ''}`}>
        {onTab && <GolferSwitch />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/tournament/new" element={<TournamentForm />} />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
          <Route path="/tournament/:id/edit" element={<TournamentForm />} />
          <Route path="/tournament/:id/results" element={<PasteResults />} />
          <Route path="/round/new" element={<StartRound />} />
          <Route path="/play/:id" element={<Play />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/new" element={<PracticeForm />} />
          <Route path="/practice/:id" element={<PracticeForm />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/new" element={<CourseForm />} />
          <Route path="/courses/:id" element={<CourseForm />} />
          <Route path="/more" element={<More />} />
          <Route path="/more/golfers" element={<MoreGolfers />} />
          <Route path="/more/profile" element={<MoreProfile />} />
          <Route path="/more/tours" element={<MoreTours />} />
          <Route path="/more/account" element={<MoreAccount />} />
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/request-tour" element={<RequestTour />} />
          <Route path="/results" element={<FindResults />} />
        </Routes>
      </main>
      {!playing && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              <Icon d={t.icon} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

/** Brings the phone and the account in step whenever a parent is signed in. */
function Sync() {
  const uid = useAuth().session?.user.id;
  useEffect(() => {
    if (uid)
      void syncOnStart(uid, () =>
        confirm('This phone and your account both have changes that haven’t been combined.\n\nOK keeps what’s on this phone. Cancel uses what’s saved in your account.'),
      );
  }, [uid]);
  return null;
}

function Gate() {
  if (!useSignedIn()) return <SignIn />;
  return (
    <GolferProvider>
      <Sync />
      <Shell />
    </GolferProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </HashRouter>
  );
}
