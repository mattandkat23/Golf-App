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
  /** Where most of the tour's events are; used to file courses created from its events. */
  region?: Course['region'];
}

export interface Tournament {
  id?: number;
  /** Profile id of the golfer this event belongs to. */
  golferId: string;
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

export type FairwayHit = 'Hit' | 'Left' | 'Right';

export interface HoleResult {
  hole: number; // 1-based
  par: number;
  yards?: number;
  /** Shot-by-shot detail. When present it is the source of truth and the basic fields below are ignored. */
  shots: Shot[];
  /** Basic entry: strokes including penalties. */
  score?: number;
  fairway?: FairwayHit;
  /** Green in regulation; when unset it's worked out from score and putts. */
  gir?: boolean;
  putts?: number;
}

export interface Round {
  id?: number;
  golferId: string;
  tournamentId?: number; // undefined = casual/practice round
  courseId?: number;
  teeName?: string;
  date: string;
  roundNumber: number;
  holes: HoleResult[];
  numHoles: 9 | 18;
  /** Shot-by-shot entry instead of basic (score, fairway, green, putts). Unset = basic unless shots were entered. */
  detailed?: boolean;
  /** Round total from imported results; used for scoring until every hole has been filled in. */
  total?: number;
  /** Course par for the round, when known (imported results give score to par). */
  par?: number;
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
  golferId: string;
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

/** One golfer. The first golfer on a phone has id 'me'; golfers added later get 'p-<timestamp>'. */
export interface Profile {
  id: string;
  playerName: string;
  ageGroup?: string;
  bag: Club[];
  myTours?: string[];
}
