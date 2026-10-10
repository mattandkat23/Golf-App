import type { Course } from '../lib/types';

/**
 * Starter list of Texas courses. Scorecards (pars/yardages) are intentionally left blank:
 * US Kids plays age-based tees, so pars and yardages are entered once per tee in the app
 * (or on the first hole-by-hole round) and remembered from then on.
 *
 * `usKidsVenue` marks courses that have hosted US Kids events in the past; it is a hint,
 * not a schedule. Add or edit courses in the app.
 */
type Seed = [name: string, city: string, region: Course['region'], usKidsVenue?: boolean];

const SEEDS: Seed[] = [
  // Waco
  ['Ridgewood Country Club', 'Waco', 'Waco'],
  ['Cottonwood Creek Golf Course', 'Waco', 'Waco'],

  // Austin area
  ['Lions Municipal Golf Course', 'Austin', 'Austin'],
  ['Jimmy Clay Golf Course', 'Austin', 'Austin'],
  ['Roy Kizer Golf Course', 'Austin', 'Austin'],
  ['Morris Williams Golf Course', 'Austin', 'Austin'],
  ['Hancock Golf Course', 'Austin', 'Austin'],
  ['Harvey Penick Golf Campus', 'Austin', 'Austin'],
  ['Grey Rock Golf Club', 'Austin', 'Austin'],
  ['Avery Ranch Golf Club', 'Austin', 'Austin'],
  ['Falconhead Golf Club', 'Austin', 'Austin'],
  ['Teravista Golf Club', 'Round Rock', 'Austin'],
  ['Forest Creek Golf Club', 'Round Rock', 'Austin'],
  ['Star Ranch Golf Club', 'Hutto', 'Austin'],
  ['Blackhawk Golf Club', 'Pflugerville', 'Austin'],
  ['Plum Creek Golf Course', 'Kyle', 'Austin'],
  ['Crystal Falls Golf Club', 'Leander', 'Austin'],
  ['Kissing Tree Golf Club', 'San Marcos', 'Austin'],

  // Dallas–Fort Worth
  ['Stevens Park Golf Course', 'Dallas', 'Dallas–Fort Worth', true],
  ['Tenison Park Golf Course', 'Dallas', 'Dallas–Fort Worth'],
  ['Cedar Crest Golf Course', 'Dallas', 'Dallas–Fort Worth'],
  ['Keeton Park Golf Course', 'Dallas', 'Dallas–Fort Worth'],
  ['Grapevine Golf Course', 'Grapevine', 'Dallas–Fort Worth'],
  ['Cowboys Golf Club', 'Grapevine', 'Dallas–Fort Worth'],
  ['Riverchase Golf Club', 'Coppell', 'Dallas–Fort Worth'],
  ['Firewheel Golf Park', 'Garland', 'Dallas–Fort Worth'],
  ['Indian Creek Golf Club', 'Carrollton', 'Dallas–Fort Worth'],
  ['Pecan Hollow Golf Course', 'Plano', 'Dallas–Fort Worth'],
  ['Chase Oaks Golf Club', 'Plano', 'Dallas–Fort Worth'],
  ['The Tribute Golf Links', 'The Colony', 'Dallas–Fort Worth'],
  ['Old American Golf Club', 'The Colony', 'Dallas–Fort Worth'],
  ['Heritage Ranch Golf Club', 'Fairview', 'Dallas–Fort Worth'],
  ['Texas Star Golf Course', 'Euless', 'Dallas–Fort Worth'],
  ['Iron Horse Golf Course', 'North Richland Hills', 'Dallas–Fort Worth'],
  ['Buffalo Creek Golf Club', 'Rockwall', 'Dallas–Fort Worth'],
  ['Hawks Creek Golf Club', 'Westworth Village', 'Dallas–Fort Worth'],
  ['Waterchase Golf Club', 'Fort Worth', 'Dallas–Fort Worth'],
  ['Sky Creek Ranch Golf Club', 'Keller', 'Dallas–Fort Worth'],
  ['Bear Creek Golf Club', 'DFW Airport', 'Dallas–Fort Worth'],

  // Hill Country / San Antonio (state & regional events)
  ['Horseshoe Bay Resort – Apple Rock', 'Horseshoe Bay', 'Hill Country', true],
  ['Horseshoe Bay Resort – Ram Rock', 'Horseshoe Bay', 'Hill Country', true],
  ['Horseshoe Bay Resort – Slick Rock', 'Horseshoe Bay', 'Hill Country', true],
  ['Lady Bird Golf Course', 'Fredericksburg', 'Hill Country', true],
  ['Northern Hills Golf Club', 'San Antonio', 'San Antonio', true],
  ['Vaaler Creek Golf Club', 'Blanco', 'Hill Country', true],
  ['Hyatt Regency Hill Country Golf Club', 'San Antonio', 'San Antonio', true],
  ['Mission del Lago Golf Course', 'San Antonio', 'San Antonio', true],
  ['Brackenridge Park Golf Course', 'San Antonio', 'San Antonio'],

  // Houston
  ['Memorial Park Golf Course', 'Houston', 'Houston'],
  ['Wildcat Golf Club', 'Houston', 'Houston'],
];

export const SEED_COURSES: Course[] = SEEDS.map(([name, city, region, usKidsVenue]) => ({
  name,
  city,
  region,
  usKidsVenue: usKidsVenue ?? false,
  tees: [],
}));

export const REGIONS: Course['region'][] = [
  'Austin',
  'Dallas–Fort Worth',
  'Waco',
  'Hill Country',
  'San Antonio',
  'Houston',
  'Other Texas',
  'Other',
];
