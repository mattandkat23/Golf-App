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
import Rounds from './pages/Rounds';
import Import from './pages/Import';
import { GolferProvider, GolferSwitch } from './lib/golfer';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const TABS = [
  { to: '/', label: 'Home', icon: icon('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z') },
  { to: '/schedule', label: 'Events', icon: icon('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4') },
  { to: '/practice', label: 'Practice', icon: icon('M7 21V4l10 4-10 4') },
  { to: '/stats', label: 'Stats', icon: icon('M5 20V10M12 20V4M19 20v-7') },
  { to: '/more', label: 'More', icon: icon('M5 12h.01M12 12h.01M19 12h.01') },
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
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/import" element={<Import />} />
        </Routes>
      </main>
      {!playing && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <GolferProvider>
        <Shell />
      </GolferProvider>
    </HashRouter>
  );
}
