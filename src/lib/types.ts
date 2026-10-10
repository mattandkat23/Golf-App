export type TourLevel = 'Local' | 'State' | 'Regional' | 'World' | 'Other';
export type EventStatus = 'Considering' | 'Registered' | 'Waitlisted' | 'Played' | 'Withdrew';

export interface Tee {
  name: string; // e.g. "Age 9 tees", "Blue"
  pars: number[]; // length 9 or 18
  yardages?: (number | undefined)[];
}

export interface Course {
  id?: number;
  name: string;
  city: string;
  region: 'Austin' | 'Dallas–Fort Worth' | 'Waco' | 'San Antonio' | 'Houston' | 'Hill Country' | 'Other Texas' | 'Other';
  usKidsVenue?: boolean;
  tees: Tee[];
  notes?: string;
}

export interface Tour {
  id: string;
  name: string;
  org?: string;
  url?: string;
  custom?: boolean;
}

export interface Tournament {
  id?: number;
  name: string;
  level: TourLevel;
  tourId?: string;
  /** Id of the scraped event this was added from (public/events.json). */
  sourceEventId?: string;
  courseId?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  status: EventStatus;
  ageGroup?: string;
  teeTime?: string;
  registrationDeadline?: string;
  entryFee?: number;
  url?: string;
  finish?: number;
  fieldSize?: number;
  qualified?: string; // e.g. "Worlds", "Regional"
  notes?: string;
}

export type Lie = 'Tee' | 'Fairway' | 'Rough' | 'Bunker' | 'Fringe' | 'Green' | 'Recovery';
export type EndLie = Exclude<Lie, 'Tee'> | 'Holed' | 'Penalty';
export type Miss = 'Left' | 'Right' | 'Short' | 'Long';
export type Contact = 'Center' | 'Heel' | 'Toe' | 'Fat' | 'Thin';
export type ShotType = 'Tee' | 'Approach' | 'Short game' | 'Putt';

export interface Shot {
  type: ShotType;
  startLie: Lie;
  club?: string;
  endLie?: EndLie;
  miss?: Miss[]; // up to two, e.g. Short + Right
  /** Distance to hole after the shot, lower bound of a 5 ft bucket (0 = 0–5 ft). Only when on green/fringe. */
  leaveFt?: number;
  contact?: Contact;
  /** Penalty strokes added by this shot (OB, water, unplayable). */
  penalty?: number;
}

export interface HoleResult {
  hole: number; // 1-based
  par: number;
  yards?: number;
  shots: Shot[];
}

export interface Round {
  id?: number;
  tournamentId?: number; // undefined = casual/practice round
  courseId?: number;
  teeName?: string;
  date: string;
  roundNumber: number;
  holes: HoleResult[];
  numHoles: 9 | 18;
  weather?: string;
  reflection?: { wentWell?: string; workOn?: string; mental?: number };
  complete?: boolean;
}

export type PracticeFocus = 'Putting' | 'Chipping' | 'Bunker' | 'Wedges' | 'Irons' | 'Woods' | 'Driver' | 'On-course' | 'Mental';

export interface Drill {
  name: string;
  score?: string;
}

export interface PracticeSession {
  id?: number;
  date: string;
  location?: string;
  minutes: number;
  focus: { area: PracticeFocus; minutes: number }[];
  drills: Drill[];
  notes?: string;
}

export interface Club {
  name: string;
  carry?: number;
  updated?: string;
}

export interface Profile {
  id: 'me';
  playerName: string;
  ageGroup?: string;
  bag: Club[];
  myTours?: string[];
}
