import type { Tournament } from './types';

export interface IcsEvent {
  uid: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // inclusive
  time?: string; // HH:MM tee time, single-day events only
  location?: string;
  description?: string;
  url?: string;
}

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d: string) => d.replace(/-/g, '');
function nextDay(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + 1));
  return dt.toISOString().slice(0, 10);
}

/** Folds lines to 75 octets as RFC 5545 requires (approximated by characters). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

export function buildIcs(events: IcsEvent[], stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Golf Tracker//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@golf-tracker`, `DTSTAMP:${dtstamp}`, `SUMMARY:${escape(e.title)}`);
    if (e.time && (!e.endDate || e.endDate === e.startDate)) {
      const t = e.time.replace(':', '') + '00';
      lines.push(`DTSTART:${ymd(e.startDate)}T${t}`, 'DURATION:PT5H');
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.startDate)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.endDate ?? e.startDate))}`);
    }
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Calendar entries for a tournament: the event itself, plus a reminder on its registration deadline if he isn't registered yet.
 * Pass `golferName` when the phone has several golfers so the calendar shows whose event it is.
 */
export function tournamentToIcs(t: Tournament, courseLabel?: string, tourName?: string, golferName?: string): IcsEvent[] {
  const who = golferName ? `${golferName}: ` : '';
  const out: IcsEvent[] = [
    {
      uid: `t${t.id}`,
      title: `⛳ ${who}${t.name}`,
      startDate: t.startDate,
      endDate: t.endDate,
      time: t.teeTime,
      location: courseLabel,
      description: [tourName, t.ageGroup, t.status].filter(Boolean).join(' · '),
      url: t.url,
    },
  ];
  if (t.registrationDeadline && (t.status === 'Considering' || t.status === 'Waitlisted')) {
    out.push({ uid: `t${t.id}-reg`, title: `Register: ${t.name}${golferName ? ` (${golferName})` : ''}`, startDate: t.registrationDeadline, url: t.url });
  }
  return out;
}

/**
 * Opens an .ics file. iPhone Safari shows the calendar sheet ("Add All") for text/calendar files;
 * if that doesn't happen, `shareIcs` hands the file to the share sheet instead.
 */
export function openIcs(ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareIcs(ics: string, filename: string) {
  const file = new File([ics], filename, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => undefined);
  else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
  }
}
