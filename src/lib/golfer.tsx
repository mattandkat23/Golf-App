import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_BAG, db } from './db';
import type { Profile } from './types';

interface GolferState {
  /** The golfer the app is showing. */
  golfer: Profile;
  golfers: Profile[];
  setGolferId: (id: string) => void;
}

const GolferContext = createContext<GolferState | undefined>(undefined);
const KEY = 'golfer';

function readSaved() {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Holds which golfer is selected. Renders nothing until the golfers have loaded. */
export function GolferProvider({ children }: { children: ReactNode }) {
  const golfers = useLiveQuery(() => db.profile.toArray(), []);
  const [id, setId] = useState(readSaved);

  // A restored backup can leave the phone with no golfers; make sure there's always one. Not a fresh
  // install (that goes through db.ts's on('populate') instead), so it doesn't need the walkthrough.
  useEffect(() => {
    if (golfers && !golfers.length) db.profile.put({ id: 'me', playerName: 'My Golfer', bag: DEFAULT_BAG.map((name) => ({ name })), myTours: [], onboarded: true });
  }, [golfers]);

  if (!golfers?.length) return null;
  const golfer = golfers.find((g) => g.id === id) ?? golfers[0];
  const setGolferId = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  };
  return <GolferContext.Provider value={{ golfer, golfers, setGolferId }}>{children}</GolferContext.Provider>;
}

export function useGolfer(): GolferState {
  const ctx = useContext(GolferContext);
  if (!ctx) throw new Error('useGolfer needs a GolferProvider');
  return ctx;
}

/** Name buttons for switching golfers. Hidden when there's only one. */
export function GolferSwitch() {
  const { golfer, golfers, setGolferId } = useGolfer();
  if (golfers.length < 2) return null;
  return (
    <div className="chips scroll golfer-switch" role="tablist" aria-label="Golfer">
      {golfers.map((g) => (
        <button key={g.id} role="tab" aria-selected={g.id === golfer.id} className={`chip${g.id === golfer.id ? ' on' : ''}`} onClick={() => setGolferId(g.id)}>
          {g.playerName || 'Golfer'}
        </button>
      ))}
    </div>
  );
}
