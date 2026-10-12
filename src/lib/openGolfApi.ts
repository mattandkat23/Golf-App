import type { Tee } from './types';

/**
 * Thin client for OpenGolfAPI (https://opengolfapi.org/, free, no key needed for reads, ODbL-1.0 --
 * commercial use OK with attribution, which CourseForm's "via OpenGolfAPI" credit carries) -- used for the
 * live nationwide course lookup on the Add Course page. CORS is open (access-control-allow-origin: *,
 * confirmed via scraper/check-cors.ts), so this runs straight from the browser; no server/scraper needed.
 * See scraper/course-data.ts for the equivalent server-side backfill used for the starter list.
 */
const API = 'https://api.opengolfapi.org/api/v1';

export interface SearchResult {
  id: string;
  course_name: string;
  city: string;
  state: string;
}

interface RemoteTee {
  tee_name?: string;
  course_rating?: number;
  slope?: number;
  yardage?: number;
}

interface RemoteHole {
  number: number;
  par?: number;
  yardages?: Record<string, number>;
}

export interface CourseDetail {
  course_name: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  postal_code?: string;
  architect?: string;
  year_built?: number;
  tees?: RemoteTee[];
  holes_data?: RemoteHole[];
}

export async function searchCourses(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API}/courses/search?q=${encodeURIComponent(q)}&limit=8`, { signal });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const page = (await res.json()) as { courses: SearchResult[] };
  return page.courses;
}

export async function getCourseDetail(id: string): Promise<CourseDetail> {
  const res = await fetch(`${API}/courses/${id}`);
  if (!res.ok) throw new Error(`detail fetch failed: ${res.status}`);
  return res.json() as Promise<CourseDetail>;
}

/** Same approach as scraper/course-data.ts's buildTee: one reference tee from hole-by-hole par/yardage. */
export function buildTeeFromDetail(detail: CourseDetail): Tee | undefined {
  const holes = detail.holes_data?.filter((h) => h.number >= 1).sort((a, b) => a.number - b.number);
  if (!holes || (holes.length !== 9 && holes.length !== 18) || holes.some((h) => !h.par)) return undefined;
  const pars = holes.map((h) => h.par!);
  const yardages = holes.map((h) => (h.yardages ? Object.values(h.yardages)[0] : undefined));
  const totalYardage = yardages.reduce<number>((sum, y) => sum + (y ?? 0), 0);
  const tee = detail.tees?.length
    ? detail.tees.reduce((best, t) => (!best || Math.abs((t.yardage ?? 0) - totalYardage) < Math.abs((best.yardage ?? 0) - totalYardage) ? t : best))
    : undefined;
  return {
    name: tee?.tee_name ?? 'Reference tees (OpenGolfAPI)',
    pars,
    ...(yardages.some(Boolean) && { yardages }),
    ...(tee?.course_rating && { rating: tee.course_rating }),
    ...(tee?.slope && { slope: tee.slope }),
  };
}
