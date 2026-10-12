import { Link } from 'react-router-dom';
import { useGolfer } from '../lib/golfer';
import { useAuth } from '../lib/auth';
import { PageHead } from '../components/ui';

export default function More() {
  const { golfer } = useGolfer();
  const { session } = useAuth();

  return (
    <>
      <PageHead title="More" />

      <div className="section-label">{golfer.playerName || 'Golfer'}</div>
      <div className="card">
        <ul className="list">
          <li>
            <Link to="/more/golfers">Manage golfers ›</Link>
          </li>
          <li>
            <Link to="/more/profile">Profile & bag ›</Link>
          </li>
          <li>
            <Link to="/more/tours">My tours ›</Link>
          </li>
        </ul>
      </div>

      <div className="section-label">Data</div>
      <div className="card">
        <ul className="list">
          <li>
            <Link to="/courses">Courses & scorecards ›</Link>
          </li>
          <li>
            <Link to="/rounds">All rounds ›</Link>
          </li>
        </ul>
      </div>

      <div className="section-label">Settings</div>
      <div className="card">
        <ul className="list">
          <li>
            <Link to="/more/account">
              <span className="grow">Account & backup</span>
              <span className="muted small">{session?.user.email ?? 'Offline'}</span>
              <span> ›</span>
            </Link>
          </li>
          <li>
            <Link to="/onboarding">Replay setup guide ›</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
