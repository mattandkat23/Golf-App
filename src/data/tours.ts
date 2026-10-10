import type { Tour } from '../lib/types';

/**
 * Texas junior tours and series. Parents pick the ones their golfer plays under More → My tours,
 * and can add any tour that's missing. URLs point at each organization's site, where the
 * current schedule is posted.
 */
export const SEED_TOURS: Tour[] = [
  { id: 'usk-austin', name: 'US Kids – Austin', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/284862/austin', region: 'Austin' },
  { id: 'usk-dallas', name: 'US Kids – Dallas', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/284874/dallas', region: 'Dallas–Fort Worth' },
  { id: 'usk-houston', name: 'US Kids – Houston', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/284880/houston', region: 'Houston' },
  { id: 'usk-san-antonio', name: 'US Kids – San Antonio', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/284902/san-antonio', region: 'San Antonio' },
  { id: 'usk-el-paso', name: 'US Kids – El Paso', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/496853/el-paso', region: 'Other Texas' },
  { id: 'usk-state', name: 'US Kids – Texas State', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/state' },
  { id: 'usk-regional', name: 'US Kids – Regionals', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/regional' },
  { id: 'usk-world', name: 'US Kids – World Championships', org: 'US Kids Golf', url: 'https://tournaments.uskidsgolf.com/tournaments/world', region: 'Other' },
  { id: 'ntpga', name: 'Northern Texas PGA Junior Tour', org: 'NTPGA', url: 'https://www.ntpgajuniorgolf.com/', region: 'Dallas–Fort Worth' },
  { id: 'stpga', name: 'South Texas PGA Junior Tour', org: 'STPGA', url: 'https://www.stpga.com/', region: 'Houston' },
  { id: 'ajga', name: 'AJGA (incl. Under Armour / Jordan Spieth)', org: 'AJGA', url: 'https://www.ajga.org/schedule' },
  { id: 'under-armour', name: 'Under Armour Junior Tour', org: 'Under Armour', url: 'https://www.uagolftour.com/' },
  { id: 'hjgt', name: 'Hurricane Junior Golf Tour (HJGT)', org: 'HJGT', url: 'https://www.hjgt.org/' },
  { id: 'tga-ljt', name: 'TGA / Legends Junior Tour', org: 'Texas Golf Association', url: 'https://txga.org/' },
  { id: 'tjgt', name: 'Texas Junior Golf Tour (TJGT)', org: 'TJGT', url: 'https://www.tjgt.com/' },
];
