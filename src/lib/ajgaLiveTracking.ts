/**
 * Opt-in live hole-by-hole tracking for AJGA events (see CLAUDE.md's Results section). A golfer can opt in
 * once (Profile.trackAjgaHoles, set from More -> Profile) and every AJGA event already on their schedule --
 * and every one added later -- gets tracked automatically; there's also a per-event override on the
 * Tournament detail page for a golfer who hasn't turned that on. Either way this just writes rows to
 * ajga_hole_requests; scraper/results/collect.ts's collectAjgaLive() does the actual daily pull.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, Tournament } from './types';
import { today } from '../components/ui';

/** The numeric AJGA tournament id from a Tournament's url, if this is an AJGA event at all (any sub-tour -- see src/data/tours.ts). */
export function ajgaTournamentId(t: Pick<Tournament, 'tourId' | 'url'>): string | undefined {
  return t.tourId?.startsWith('ajga-') ? t.url?.match(/\/tournaments\/(\w+)/)?.[1] : undefined;
}

/** True once an AJGA event's scorecards could plausibly still be public (hasn't ended yet). */
export function ajgaLiveTrackable(t: Pick<Tournament, 'tourId' | 'url' | 'endDate'>): boolean {
  return !!ajgaTournamentId(t) && (!t.endDate || t.endDate >= today());
}

/** Opts a golfer into live tracking for one AJGA tournament. Safe to call more than once. */
export async function optInAjgaLive(session: Session, golfer: Profile, t: Pick<Tournament, 'tourId' | 'url' | 'name' | 'endDate'>) {
  const tournamentId = ajgaTournamentId(t);
  if (!tournamentId || !ajgaLiveTrackable(t)) return;
  return supabase
    .from('ajga_hole_requests')
    .upsert({ user_id: session.user.id, golfer_name: golfer.playerName, tournament_id: tournamentId, tournament_name: t.name }, { onConflict: 'user_id,golfer_name,tournament_id', ignoreDuplicates: true });
}

/** Stops live tracking for one AJGA tournament (doesn't delete holes already collected). */
export async function optOutAjgaLive(golfer: Profile, t: Pick<Tournament, 'tourId' | 'url'>) {
  const tournamentId = ajgaTournamentId(t);
  if (!tournamentId) return;
  return supabase.from('ajga_hole_requests').delete().eq('golfer_name', golfer.playerName).eq('tournament_id', tournamentId);
}

/** Turning the golfer-level preference on: backfill every AJGA event already on their schedule. */
export async function optInAllAjgaLive(session: Session, golfer: Profile, golferTournaments: Tournament[]) {
  for (const t of golferTournaments) await optInAjgaLive(session, golfer, t);
}

/** Turning it off: remove every live-tracking request for this golfer. */
export async function optOutAllAjgaLive(golfer: Profile) {
  return supabase.from('ajga_hole_requests').delete().eq('golfer_name', golfer.playerName);
}
